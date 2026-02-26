/**
 * deeltrack — Firebase Cloud Functions v2
 * Email via Microsoft Graph API (OAuth2) — admin@deeltrack.com
 */

const { onCall, HttpsError, onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated }  = require('firebase-functions/v2/firestore');
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
