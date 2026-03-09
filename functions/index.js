/**
 * deeltrack — Firebase Cloud Functions v2
 * Email via Microsoft Graph API (OAuth2) — admin@deeltrack.com
 */

const { onCall, HttpsError, onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp }      = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Stripe = require('stripe');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const https = require('https');

initializeApp();
const db = getFirestore();

// ── Microsoft Graph email sender ──────────────────────────────────────────────
let _msalApp = null;
let _emailConfig = null;

async function getEmailConfig() {
  if (_emailConfig) return _emailConfig;
  const doc = await db.collection('_config').doc('email').get();
  if (doc.exists) { _emailConfig = doc.data(); return _emailConfig; }
  throw new Error('Email config not found in Firestore/_config/email');
}

async function getMsalApp() {
  if (_msalApp) return _msalApp;
  const cfg = await getEmailConfig();
  _msalApp = new ConfidentialClientApplication({
    auth: {
      clientId:     cfg.clientId,
      authority:    `https://login.microsoftonline.com/${cfg.tenantId}`,
      clientSecret: cfg.clientSecret,
    },
  });
  return _msalApp;
}

async function getGraphToken() {
  const app = await getMsalApp();
  const result = await app.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  });
  return result.accessToken;
}

async function graphSendMail(to, subject, html, token) {
  const cfg = await getEmailConfig();
  const fromEmail = cfg.fromEmail || 'admin@deeltrack.com';
  const recipients = (Array.isArray(to) ? to : [to]).map(a => ({ emailAddress: { address: a } }));
  const payload = JSON.stringify({
    message: {
      subject,
      body: { contentType: 'HTML', content: html },
      toRecipients: recipients,
      from: { emailAddress: { address: fromEmail, name: cfg.fromName || 'deeltrack' } },
    },
    saveToSentItems: true,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'graph.microsoft.com',
      path: `/v1.0/users/${fromEmail}/sendMail`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode === 202) resolve({ success: true });
        else {
          const err = data ? JSON.parse(data) : {};
          reject(new Error(err.error?.message || `HTTP ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Auth helper ───────────────────────────────────────────────────────────────
async function verifyAndGetOrg(auth) {
  if (!auth) throw new HttpsError('unauthenticated', 'Must be signed in');
  const doc = await db.collection('users').doc(auth.uid).get();
  if (!doc.exists) throw new HttpsError('not-found', 'User not found');
  return { uid: auth.uid, orgId: doc.data().orgId };
}

// ── sendEmail callable ────────────────────────────────────────────────────────
exports.sendEmail = onCall({ region: 'us-central1' }, async (request) => {
  const { uid, orgId } = await verifyAndGetOrg(request.auth);
  const { to, subject, html, text, type, dealId } = request.data;
  if (!to || !subject) throw new HttpsError('invalid-argument', 'Missing to or subject');

  const recipients = Array.isArray(to) ? to : [to];
  const token      = await getGraphToken();
  const results    = [];

  for (const email of recipients) {
    try {
      await graphSendMail(email, subject, html || `<p>${text || subject}</p>`, token);
      await db.collection('orgs').doc(orgId).collection('emails').add({
        to: email, subject, type: type || 'custom', dealId: dealId || null,
        status: 'sent', sentAt: FieldValue.serverTimestamp(), sentBy: uid, orgId,
      });
      results.push({ to: email, status: 'sent' });
      console.log('✅ Email sent to', email);
    } catch (err) {
      console.error('Send error to', email, ':', err.message);
      await db.collection('orgs').doc(orgId).collection('emails').add({
        to: email, subject, status: 'error', error: err.message,
        sentAt: FieldValue.serverTimestamp(), sentBy: uid, orgId,
      });
      results.push({ to: email, status: 'error', error: err.message });
    }
  }

  const sent = results.filter(r => r.status === 'sent').length;
  return { success: sent > 0, sent, errors: results.length - sent, results };
});

// ── Auto-email on capital call created ───────────────────────────────────────
exports.onCapitalCallCreated = onDocumentCreated(
  { document: 'orgs/{orgId}/capitalCalls/{callId}', region: 'us-central1' },
  async (event) => {
    const call  = event.data.data();
    const orgId = event.params.orgId;
    if (!call.dealId) return null;

    const dealDoc = await db.collection('orgs').doc(orgId).collection('deals').doc(call.dealId).get();
    if (!dealDoc.exists) return null;
    const deal   = dealDoc.data();
    const invIds = (deal.investors || []).map(i => i.investorId || i.id).filter(Boolean);
    if (!invIds.length) return null;

    const token = await getGraphToken();

    for (const invId of invIds) {
      const invDoc = await db.collection('orgs').doc(orgId).collection('investors').doc(invId).get();
      if (!invDoc.exists) continue;
      const inv = invDoc.data();
      if (!inv.email) continue;
      const recipient = (deal.investors || []).find(i => (i.investorId || i.id) === invId);
      const amount = recipient?.amount || call.amount || 0;

      await graphSendMail(inv.email,
        `Capital Call — ${deal.name} | Due ${call.dueDate || 'TBD'}`,
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:#f59e0b;padding:24px;border-radius:8px 8px 0 0;text-align:center;"><h1 style="color:white;margin:0;">⚡ Capital Call Notice</h1></div><div style="background:#f8fafc;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;"><p>Dear ${inv.firstName || inv.email},</p><p>A capital call has been issued for <strong>${deal.name}</strong>.</p><div style="background:white;border:2px solid #f59e0b;border-radius:8px;padding:20px;margin:20px 0;"><p style="margin:0;font-size:1.5rem;font-weight:700;color:#f59e0b;">$${Number(amount).toLocaleString()}</p><p style="margin:4px 0 0;color:#64748b;">Due: ${call.dueDate || 'Contact your GP'}</p></div>${call.wireInstructions ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;"><strong>Wire Instructions</strong><p style="white-space:pre-line;font-size:.875rem;">${call.wireInstructions}</p></div>` : ''}<p style="color:#94a3b8;font-size:.8rem;text-align:center;margin-top:24px;">deeltrack — Real estate syndication platform</p></div></div>`,
        token
      ).catch(e => console.error('Cap call email error:', e.message));
    }
    return null;
  }
);

// ── Auto-email on distribution created ───────────────────────────────────────
exports.onDistributionCreated = onDocumentCreated(
  { document: 'orgs/{orgId}/distributions/{distId}', region: 'us-central1' },
  async (event) => {
    const dist  = event.data.data();
    const orgId = event.params.orgId;

    // Resolve deal name — dist may have dealName directly or only dealId
    let dealName = dist.dealName || null;
    if (!dealName && dist.dealId) {
      const dealDoc = await db.collection('orgs').doc(orgId).collection('deals').doc(dist.dealId).get();
      dealName = dealDoc.exists ? (dealDoc.data().name || `Deal ${dist.dealId}`) : `Deal ${dist.dealId}`;
    }
    dealName = dealName || 'your investment';

    const token = await getGraphToken();

    for (const recipient of (dist.recipients || [])) {
      if (!recipient.investorId) continue;
      const invDoc = await db.collection('orgs').doc(orgId).collection('investors').doc(recipient.investorId).get();
      if (!invDoc.exists) continue;
      const inv = invDoc.data();
      if (!inv.email) continue;

      const firstName = inv.firstName || inv.name || inv.email;
      const amount = Number(recipient.amount || 0);
      const subject = dist.period
        ? `💰 Distribution — ${dealName} | ${dist.period}`
        : `💰 Distribution — ${dealName} | ${dist.date || 'New'}`;

      await graphSendMail(inv.email, subject,
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#10b981;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
            <h1 style="color:white;margin:0;">💰 Distribution Notice</h1>
          </div>
          <div style="background:#f8fafc;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;">
            <p>Dear ${firstName},</p>
            <p>A distribution has been issued for <strong>${dealName}</strong>.</p>
            <div style="background:white;border:2px solid #10b981;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
              <p style="margin:0;font-size:1.75rem;font-weight:700;color:#10b981;">$${amount.toLocaleString()}</p>
              <p style="margin:4px 0 0;color:#64748b;">Your distribution amount</p>
            </div>
            <p style="color:#64748b;">Period: ${dist.period || '—'} · Date: ${dist.date || 'Today'}</p>
            <p>Funds will be processed within 3–5 business days via your registered payment method.</p>
            <p style="color:#94a3b8;font-size:.8rem;text-align:center;margin-top:24px;">deeltrack — Real estate syndication platform</p>
          </div>
        </div>`,
        token
      ).catch(e => console.error('Distribution email error to', inv.email, ':', e.message));
    }
    return null;
  }
);

// ── Stripe Checkout Session Creator ────────────────────────────────────────────
/**
 * createCheckoutSession — callable function to create a Stripe Checkout Session
 * Called from sp-billing.js with { plan: 'per_deal' | 'enterprise', quantity: N }
 */
exports.createCheckoutSession = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be logged in.');

    const { plan, quantity } = request.data;
    if (!plan || !['per_deal', 'enterprise'].includes(plan)) {
      throw new HttpsError('invalid-argument', 'Invalid plan.');
    }

    const stripeConfig = await getStripeConfig();
    const stripe = Stripe(stripeConfig.secretKey);
    const planConfig = stripeConfig.plans?.[plan];
    if (!planConfig?.priceId) throw new HttpsError('internal', 'Plan price not configured.');

    const trialDays = stripeConfig.trialDays || 90;

    // Check if user already has a Stripe customer ID
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const existingCustomerId = userData.subscription?.stripeCustomerId;

    // Build line items
    const lineItems = [{
      price: planConfig.priceId,
      quantity: plan === 'per_deal' ? (quantity || 1) : 1,
    }];

    // Create checkout session
    const sessionParams = {
      mode: 'subscription',
      client_reference_id: uid,
      line_items: lineItems,
      subscription_data: {
        trial_period_days: trialDays,
        metadata: { firebaseUid: uid, plan },
      },
      success_url: 'https://deeltrack.com/settings.html?billing=success&plan=' + plan,
      cancel_url: 'https://deeltrack.com/settings.html?billing=cancel',
      metadata: { firebaseUid: uid, plan },
    };

    // Reuse existing customer if they have one
    if (existingCustomerId) {
      sessionParams.customer = existingCustomerId;
    } else {
      sessionParams.customer_email = userData.email || request.auth.token?.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return { sessionId: session.id, url: session.url };
  }
);

// ── Stripe Webhook ─────────────────────────────────────────────────────────────
/**
 * stripeWebhook — HTTP endpoint for Stripe webhook events
 *
 * Setup in Stripe Dashboard:
 *   Endpoint URL: https://us-central1-deeltrack.cloudfunctions.net/stripeWebhook
 *   Events to listen for:
 *     - checkout.session.completed
 *     - customer.subscription.created
 *     - customer.subscription.updated
 *     - customer.subscription.deleted
 *     - invoice.paid
 *     - invoice.payment_failed
 *
 * Stripe webhook signing secret stored in Firestore:
 *   _config/stripe → { secretKey, webhookSecret }
 *
 * client_reference_id on Payment Links = Firebase UID (set in sp-billing.js)
 */

async function getStripeConfig() {
  const doc = await db.collection('_config').doc('stripe').get();
  if (!doc.exists) throw new Error('Stripe config not found in Firestore/_config/stripe');
  return doc.data();
}

// Map Stripe price IDs → plan names (also stored in _config/stripe)
const PRICE_PLAN_MAP = {
  // Populated dynamically from _config/stripe.plans at runtime
};

async function getPriceMap(stripeConfig) {
  const plans = stripeConfig.plans || {};
  // plans = { starter: { priceId: 'price_xxx', priceIdAnnual: 'price_yyy' }, ... }
  const map = {};
  for (const [planName, planCfg] of Object.entries(plans)) {
    if (planCfg.priceId)       map[planCfg.priceId]       = planName;
    if (planCfg.priceIdAnnual) map[planCfg.priceIdAnnual] = planName;
  }
  return map;
}

async function activateSubscription(uid, orgId, plan, stripeData) {
  const now = FieldValue.serverTimestamp();
  const subData = {
    plan,
    status:              'active',
    stripeCustomerId:    stripeData.customerId    || null,
    stripeSubscriptionId:stripeData.subscriptionId|| null,
    stripePriceId:       stripeData.priceId       || null,
    currentPeriodEnd:    stripeData.currentPeriodEnd || null,
    cancelAtPeriodEnd:   stripeData.cancelAtPeriodEnd || false,
    activatedAt:         now,
    updatedAt:           now,
  };

  const batch = db.batch();

  // Update user record
  batch.set(db.collection('users').doc(uid), { subscription: subData }, { merge: true });

  // Update org record
  if (orgId) {
    batch.set(db.collection('orgs').doc(orgId), { subscription: subData }, { merge: true });
  }

  // Log the event
  batch.set(db.collection('_stripe_events').doc(), {
    type:      'subscription_activated',
    uid, orgId, plan,
    stripeData,
    processedAt: now,
  });

  await batch.commit();
  console.log(`✅ Subscription activated: uid=${uid} org=${orgId} plan=${plan}`);
}

async function deactivateSubscription(uid, orgId, reason) {
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();

  const subData = {
    plan:      'free',
    status:    reason || 'canceled',
    updatedAt: now,
    canceledAt: now,
  };

  batch.set(db.collection('users').doc(uid), { subscription: subData }, { merge: true });
  if (orgId) {
    batch.set(db.collection('orgs').doc(orgId), { subscription: subData }, { merge: true });
  }
  batch.set(db.collection('_stripe_events').doc(), {
    type: 'subscription_deactivated', uid, orgId, reason, processedAt: now,
  });

  await batch.commit();
  console.log(`⚠️ Subscription deactivated: uid=${uid} reason=${reason}`);
}

async function findUidByStripeCustomer(customerId) {
  // Try users collection first
  const snap = await db.collection('users')
    .where('subscription.stripeCustomerId', '==', customerId)
    .limit(1).get();
  if (!snap.empty) {
    const doc = snap.docs[0];
    return { uid: doc.id, orgId: doc.data().orgId };
  }
  return null;
}

exports.stripeWebhook = onRequest(
  { region: 'us-central1', timeoutSeconds: 60 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    let stripeConfig;
    try {
      stripeConfig = await getStripeConfig();
    } catch (e) {
      console.error('Stripe config error:', e.message);
      res.status(500).send('Stripe not configured');
      return;
    }

    const stripe = Stripe(stripeConfig.secretKey);
    const webhookSecret = stripeConfig.webhookSecret;

    // Verify webhook signature
    let event;
    try {
      const sig = req.headers['stripe-signature'];
      // req.rawBody is available in Firebase Functions v2 for onRequest
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Log raw event to Firestore for debugging
    await db.collection('_stripe_events').add({
      eventId:   event.id,
      type:      event.type,
      livemode:  event.livemode,
      createdAt: FieldValue.serverTimestamp(),
      processed: false,
    }).catch(() => {});

    console.log(`📩 Stripe event: ${event.type} (${event.id})`);

    const priceMap = await getPriceMap(stripeConfig);

    try {
      switch (event.type) {

        // ── Checkout completed ─────────────────────────────────────────────
        case 'checkout.session.completed': {
          const session = event.data.object;
          // client_reference_id = Firebase UID (set by sp-billing.js on Payment Link)
          const uid = session.client_reference_id;
          if (!uid) { console.warn('checkout.session.completed: no client_reference_id'); break; }

          const customerId    = session.customer;
          const subscriptionId= session.subscription;

          // Get the subscription to find the price/plan
          let plan = 'starter';
          let priceId = null;
          let currentPeriodEnd = null;
          let cancelAtPeriodEnd = false;

          if (subscriptionId) {
            try {
              const sub = await stripe.subscriptions.retrieve(subscriptionId);
              priceId    = sub.items.data[0]?.price?.id;
              plan       = priceMap[priceId] || 'starter';
              currentPeriodEnd  = sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toISOString()
                : null;
              cancelAtPeriodEnd = sub.cancel_at_period_end || false;
            } catch (e) {
              console.error('Could not retrieve subscription:', e.message);
            }
          }

          // Look up orgId from user record
          const userDoc = await db.collection('users').doc(uid).get();
          const orgId   = userDoc.exists ? userDoc.data().orgId : null;

          await activateSubscription(uid, orgId, plan, {
            customerId, subscriptionId, priceId, currentPeriodEnd, cancelAtPeriodEnd,
          });

          // Send welcome email
          try {
            const token = await getGraphToken();
            const userData = userDoc.exists ? userDoc.data() : {};
            const name = userData.name || userData.email || 'there';
            const email = userData.email || session.customer_details?.email;
            if (email) {
              await graphSendMail(email,
                `✅ Your deeltrack ${plan.charAt(0).toUpperCase() + plan.slice(1)} subscription is active!`,
                `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                  <div style="background:linear-gradient(135deg,#3b82f6,#1d4ed8);padding:32px;border-radius:8px 8px 0 0;text-align:center;">
                    <h1 style="color:white;margin:0;font-size:1.5rem;">Welcome to deeltrack ${plan.charAt(0).toUpperCase() + plan.slice(1)}! 🎉</h1>
                  </div>
                  <div style="background:#f8fafc;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;">
                    <p style="font-size:1rem;color:#1e293b;">Hi ${name},</p>
                    <p>Your subscription is now active. You have full access to all ${plan} features.</p>
                    <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
                      <p style="margin:0;font-size:0.8rem;color:#64748b;font-weight:600;text-transform:uppercase;">Active Plan</p>
                      <p style="margin:8px 0 0;font-size:1.5rem;font-weight:700;color:#3b82f6;">${plan.charAt(0).toUpperCase() + plan.slice(1)}</p>
                      ${currentPeriodEnd ? `<p style="margin:4px 0 0;font-size:0.8rem;color:#94a3b8;">Next renewal: ${new Date(currentPeriodEnd).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p>` : ''}
                    </div>
                    <div style="text-align:center;margin:24px 0;">
                      <a href="https://rpike623.github.io/syndicate-pro/dashboard.html" style="background:#3b82f6;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:.95rem;">Go to Dashboard →</a>
                    </div>
                    <p style="color:#94a3b8;font-size:.8rem;text-align:center;">Questions? Reply to this email or visit your billing settings.</p>
                  </div>
                </div>`,
                token
              );
            }
          } catch (emailErr) {
            console.error('Welcome email error:', emailErr.message);
          }
          break;
        }

        // ── Subscription created / updated ─────────────────────────────────
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const sub = event.data.object;
          const customerId = sub.customer;
          const priceId    = sub.items.data[0]?.price?.id;
          const plan       = priceMap[priceId] || 'starter';
          const status     = sub.status; // active, trialing, past_due, canceled, etc.

          const found = await findUidByStripeCustomer(customerId);
          if (!found) { console.warn('No user found for customer:', customerId); break; }
          const { uid, orgId } = found;

          if (status === 'active' || status === 'trialing') {
            await activateSubscription(uid, orgId, plan, {
              customerId,
              subscriptionId:   sub.id,
              priceId,
              currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
              cancelAtPeriodEnd: sub.cancel_at_period_end,
            });
          } else if (status === 'canceled' || status === 'unpaid') {
            await deactivateSubscription(uid, orgId, status);
          } else {
            // past_due, incomplete, etc — update status but keep plan
            await db.collection('users').doc(uid).set(
              { subscription: { status, updatedAt: FieldValue.serverTimestamp() } },
              { merge: true }
            );
            if (orgId) {
              await db.collection('orgs').doc(orgId).set(
                { subscription: { status, updatedAt: FieldValue.serverTimestamp() } },
                { merge: true }
              );
            }
          }
          break;
        }

        // ── Subscription canceled / deleted ────────────────────────────────
        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          const found = await findUidByStripeCustomer(sub.customer);
          if (!found) { console.warn('No user for customer:', sub.customer); break; }
          await deactivateSubscription(found.uid, found.orgId, 'canceled');
          break;
        }

        // ── Invoice paid — renewal ─────────────────────────────────────────
        case 'invoice.paid': {
          const invoice = event.data.object;
          if (invoice.billing_reason !== 'subscription_cycle') break;
          const sub = await stripe.subscriptions.retrieve(invoice.subscription);
          const priceId = sub.items.data[0]?.price?.id;
          const plan    = priceMap[priceId] || 'starter';
          const found   = await findUidByStripeCustomer(invoice.customer);
          if (!found) break;

          await activateSubscription(found.uid, found.orgId, plan, {
            customerId:       invoice.customer,
            subscriptionId:   invoice.subscription,
            priceId,
            currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          });
          console.log(`🔄 Subscription renewed: uid=${found.uid} plan=${plan}`);
          break;
        }

        // ── Invoice payment failed ─────────────────────────────────────────
        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const found   = await findUidByStripeCustomer(invoice.customer);
          if (!found) break;

          // Mark as past_due but don't fully deactivate yet (Stripe retries)
          await db.collection('users').doc(found.uid).set(
            { subscription: { status: 'past_due', updatedAt: FieldValue.serverTimestamp() } },
            { merge: true }
          );
          if (found.orgId) {
            await db.collection('orgs').doc(found.orgId).set(
              { subscription: { status: 'past_due', updatedAt: FieldValue.serverTimestamp() } },
              { merge: true }
            );
          }

          // Send payment failure email
          try {
            const userDoc = await db.collection('users').doc(found.uid).get();
            const userData = userDoc.exists ? userDoc.data() : {};
            if (userData.email) {
              const token = await getGraphToken();
              await graphSendMail(userData.email,
                '⚠️ deeltrack — Payment failed, action required',
                `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                  <div style="background:#ef4444;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
                    <h1 style="color:white;margin:0;">Payment Failed</h1>
                  </div>
                  <div style="background:#f8fafc;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;">
                    <p>Hi ${userData.name || 'there'},</p>
                    <p>We were unable to process your deeltrack subscription payment. Please update your payment method to keep your account active.</p>
                    <p>Amount due: <strong>$${(invoice.amount_due / 100).toFixed(2)}</strong></p>
                    <div style="text-align:center;margin:24px 0;">
                      <a href="https://rpike623.github.io/syndicate-pro/settings.html#billing" style="background:#ef4444;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;">Update Payment Method →</a>
                    </div>
                    <p style="color:#94a3b8;font-size:.8rem;">We'll retry your payment automatically. If payment continues to fail, your account will be downgraded to the free plan.</p>
                  </div>
                </div>`,
                token
              );
            }
          } catch (emailErr) {
            console.error('Payment failure email error:', emailErr.message);
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      // Mark event as processed
      const eventSnap = await db.collection('_stripe_events')
        .where('eventId', '==', event.id).limit(1).get();
      if (!eventSnap.empty) {
        await eventSnap.docs[0].ref.update({ processed: true, processedAt: FieldValue.serverTimestamp() });
      }

      res.status(200).json({ received: true, type: event.type });

    } catch (err) {
      console.error(`Error processing ${event.type}:`, err);
      res.status(500).send(`Processing error: ${err.message}`);
    }
  }
);

// ── Deal Count Sync — update Stripe subscription quantity ──────────────────────

const ACTIVE_DEAL_STATUSES = ['raising', 'operating', 'closed', 'dd', 'loi', 'due diligence'];

/**
 * Count active deals for an org and update Stripe subscription quantity.
 * Called by the scheduled function and the deal-change trigger.
 */
async function syncDealCountForOrg(orgId) {
  if (!orgId) return;

  // Get org subscription
  const orgDoc = await db.collection('orgs').doc(orgId).get();
  if (!orgDoc.exists) return;
  const orgData = orgDoc.data();
  const sub = orgData.subscription;

  // Skip if not on per_deal plan or not active
  if (!sub || sub.plan !== 'per_deal' || sub.status !== 'active') return;
  if (!sub.stripeSubscriptionId) {
    console.log(`[syncDeals] org=${orgId} — no Stripe subscription ID, skipping`);
    return;
  }

  // Count active deals
  const dealsSnap = await db.collection('orgs').doc(orgId).collection('deals').get();
  let activeCount = 0;
  dealsSnap.forEach(doc => {
    const deal = doc.data();
    const status = (deal.status || '').toLowerCase().trim();
    if (ACTIVE_DEAL_STATUSES.includes(status)) activeCount++;
  });

  // Minimum 1 (Stripe doesn't allow quantity 0 on active subscriptions)
  activeCount = Math.max(1, activeCount);

  // Update Stripe subscription quantity
  try {
    const stripeConfig = await getStripeConfig();
    const stripe = Stripe(stripeConfig.secretKey);

    const subscription = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    const itemId = subscription.items.data[0]?.id;
    if (!itemId) {
      console.error(`[syncDeals] org=${orgId} — no subscription item found`);
      return;
    }

    const currentQty = subscription.items.data[0]?.quantity || 0;
    if (currentQty === activeCount) {
      console.log(`[syncDeals] org=${orgId} — quantity unchanged at ${activeCount}`);
      return;
    }

    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      items: [{ id: itemId, quantity: activeCount }],
      proration_behavior: 'create_prorations', // pro-rate mid-cycle changes
    });

    // Update Firestore with current count
    await db.collection('orgs').doc(orgId).set({
      subscription: { activeDealCount: activeCount, lastSyncedAt: FieldValue.serverTimestamp() }
    }, { merge: true });

    console.log(`✅ [syncDeals] org=${orgId} — updated quantity ${currentQty} → ${activeCount}`);
  } catch (err) {
    console.error(`[syncDeals] org=${orgId} error:`, err.message);
  }
}

/**
 * Scheduled function — runs daily at 2 AM CT (7 AM UTC) to sync all orgs.
 * Catches any deal changes that the trigger might have missed.
 */
exports.syncDealCounts = onSchedule(
  { schedule: 'every day 07:00', region: 'us-central1', timeZone: 'America/Chicago' },
  async () => {
    console.log('[syncDealCounts] Daily sync starting...');

    // Find all orgs with active per_deal subscriptions
    const orgsSnap = await db.collection('orgs')
      .where('subscription.plan', '==', 'per_deal')
      .where('subscription.status', '==', 'active')
      .get();

    let synced = 0;
    for (const doc of orgsSnap.docs) {
      await syncDealCountForOrg(doc.id);
      synced++;
    }

    console.log(`[syncDealCounts] Done — synced ${synced} orgs`);
  }
);

/**
 * Firestore trigger — when a deal document is created or updated,
 * re-sync the deal count if the status changed.
 */
exports.onDealChanged = onDocumentUpdated(
  { document: 'orgs/{orgId}/deals/{dealId}', region: 'us-central1' },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const orgId = event.params.orgId;

    // Only re-sync if status changed
    const oldStatus = (before.status || '').toLowerCase().trim();
    const newStatus = (after.status || '').toLowerCase().trim();
    if (oldStatus === newStatus) return;

    console.log(`[onDealChanged] org=${orgId} deal=${event.params.dealId} status: ${oldStatus} → ${newStatus}`);
    await syncDealCountForOrg(orgId);
  }
);

/**
 * Firestore trigger — when a new deal is created, re-sync count.
 */
exports.onDealCreated = onDocumentCreated(
  { document: 'orgs/{orgId}/deals/{dealId}', region: 'us-central1' },
  async (event) => {
    const orgId = event.params.orgId;
    console.log(`[onDealCreated] org=${orgId} deal=${event.params.dealId}`);
    await syncDealCountForOrg(orgId);
  }
);

/**
 * getSubscriptionStatus — callable function for the frontend to get current billing info.
 */
exports.getSubscriptionStatus = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be logged in.');

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return { plan: 'free', status: 'none' };

    const userData = userDoc.data();
    const orgId = userData.orgId;
    let sub = userData.subscription || {};

    // If org-level subscription exists, prefer it
    if (orgId) {
      const orgDoc = await db.collection('orgs').doc(orgId).get();
      if (orgDoc.exists && orgDoc.data().subscription) {
        sub = orgDoc.data().subscription;
      }
    }

    // Get live data from Stripe if we have a subscription ID
    if (sub.stripeSubscriptionId) {
      try {
        const stripeConfig = await getStripeConfig();
        const stripe = Stripe(stripeConfig.secretKey);
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);

        return {
          plan: sub.plan || 'free',
          status: stripeSub.status, // 'trialing', 'active', 'past_due', 'canceled'
          trialEnd: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000).toISOString() : null,
          currentPeriodEnd: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000).toISOString() : null,
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
          quantity: stripeSub.items.data[0]?.quantity || 1,
          activeDealCount: sub.activeDealCount || null,
        };
      } catch (err) {
        console.error('[getSubscriptionStatus] Stripe error:', err.message);
      }
    }

    // Fallback to Firestore data
    return {
      plan: sub.plan || 'free',
      status: sub.status || 'none',
      trialEnd: sub.trialEnd || null,
      currentPeriodEnd: sub.currentPeriodEnd || null,
      activeDealCount: sub.activeDealCount || null,
    };
  }
);
