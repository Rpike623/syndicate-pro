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

async function graphSendMail(to, subject, html, token, options = {}) {
  // Suppress emails to demo/fake addresses to prevent bouncebacks
  const demoPatterns = ['@demo.deeltrack.com', '@invest.net', '@example.com', '@test.com'];
  const allAddrs = Array.isArray(to) ? to : [to];
  const realRecipients = allAddrs.filter(addr => !demoPatterns.some(p => addr.toLowerCase().endsWith(p)));
  if (realRecipients.length === 0) {
    console.log('[Email] Suppressed — all recipients are demo/fake:', recipients.join(', '));
    return;
  }
  to = realRecipients.length === 1 ? realRecipients[0] : realRecipients;

  const cfg = await getEmailConfig();
  const fromEmail = cfg.fromEmail || 'admin@deeltrack.com';
  // Use GP firm name if provided, format as "Firm Name via deeltrack"
  const gpName = options.fromName || options.gpFirmName;
  const displayName = gpName ? `${gpName} via deeltrack` : (cfg.fromName || 'deeltrack');
  const replyTo = options.replyTo || cfg.replyTo;
  const recipients = (Array.isArray(to) ? to : [to]).map(a => ({ emailAddress: { address: a } }));
  const payload = JSON.stringify({
    message: {
      subject,
      body: { contentType: 'HTML', content: html },
      toRecipients: recipients,
      from: { emailAddress: { address: fromEmail, name: displayName } },
      replyTo: replyTo ? [{ emailAddress: { address: replyTo } }] : [],
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

// ── Rate Limiter ──────────────────────────────────────────────────────────────
// Simple in-memory rate limiter for Cloud Functions.
// Limits per-user calls to prevent abuse of email, encryption, and billing endpoints.
const _rateLimits = new Map(); // key: uid+action → { count, resetAt }

function rateLimit(uid, action, maxCalls, windowMs) {
  const key = `${uid}:${action}`;
  const now = Date.now();
  let entry = _rateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
  }
  entry.count++;
  _rateLimits.set(key, entry);
  if (entry.count > maxCalls) {
    throw new HttpsError('resource-exhausted',
      `Rate limit exceeded for ${action}. Max ${maxCalls} calls per ${Math.round(windowMs/60000)} minutes.`);
  }
}

// Clean up stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of _rateLimits) {
    if (now > entry.resetAt) _rateLimits.delete(key);
  }
}, 10 * 60 * 1000);

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
  rateLimit(uid, 'sendEmail', 30, 60 * 60 * 1000); // 30 emails per hour
  const { to, subject, html, text, type, dealId, fromName } = request.data;
  if (!to || !subject) throw new HttpsError('invalid-argument', 'Missing to or subject');

  // Look up GP's firm name from org settings
  let gpFirmName = fromName || null;
  if (!gpFirmName) {
    try {
      const settingsDoc = await db.collection('orgs').doc(orgId).collection('settings').doc('main').get();
      if (settingsDoc.exists) gpFirmName = settingsDoc.data().firmName || null;
    } catch(e) {}
  }

  const recipients = Array.isArray(to) ? to : [to];
  const token      = await getGraphToken();
  const results    = [];
  const emailOpts  = { gpFirmName };

  // Get GP's email for reply-to
  try {
    const settingsDoc = await db.collection('orgs').doc(orgId).collection('settings').doc('main').get();
    if (settingsDoc.exists && settingsDoc.data().firmEmail) emailOpts.replyTo = settingsDoc.data().firmEmail;
  } catch(e) {}

  for (const email of recipients) {
    try {
      await graphSendMail(email, subject, html || `<p>${text || subject}</p>`, token, emailOpts);
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
    rateLimit(uid, 'checkout', 5, 10 * 60 * 1000); // 5 checkout attempts per 10 min

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

// ── AI Document Variable Extraction (Gemini 2.5 Flash) ─────────────────────────
/**
 * parseDocumentVariables — extract template variables from uploaded legal document text
 * Uses Gemini 2.5 Flash via Google Generative Language API (free tier via service account)
 * Called from sp-doc-upload.js after DOCX text extraction
 */
exports.parseDocumentVariables = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be logged in.');
    rateLimit(uid, 'docparse', 5, 60 * 60 * 1000); // 5 parses per hour

    const { text, docType } = request.data;
    if (!text || text.length < 100) {
      throw new HttpsError('invalid-argument', 'Document text too short.');
    }

    // Truncate to ~30K chars to stay within token limits
    const truncatedText = text.substring(0, 30000);

    const prompt = `You are a legal document parser for a real estate syndication platform. Given this ${docType || 'operating agreement'}, extract ALL variable fields that would change between deals.

Return a JSON array where each item has:
- "name": short variable name (SCREAMING_SNAKE_CASE, e.g. COMPANY_NAME, PREF_RETURN_PCT)
- "label": human-readable label (e.g. "Company Name", "Preferred Return %")
- "category": one of entity|financial|parties|dates|legal
- "value": the exact text found in the document
- "context": a short phrase showing where it appears (max 80 chars)

Focus on fields that would change between deals:
- Entity names (LLC, LP names)
- State of formation, filing numbers
- Addresses
- Member/partner names
- Dollar amounts (capital contributions, minimum investments)
- Percentages (preferred return, promote/carry, ownership splits, GP equity)
- Dates (effective date, formation date)
- Hold periods, distribution frequency
- Fee percentages (management, acquisition, disposition)

Do NOT extract:
- Standard legal boilerplate (Treasury Regulations, IRS references, generic legal terms)
- Section/article numbers
- Generic terms like "Members" or "Manager" without specific names

Return ONLY the JSON array, no markdown fences, no explanation.

DOCUMENT:
${truncatedText}`;

    try {
      const { GoogleAuth } = require('google-auth-library');
      const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/generative-language'] });
      const client = await auth.getClient();
      const token = await client.getAccessToken();

      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
      });

      const body = await res.json();
      const responseText = body.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Parse JSON from response using resilient parser
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const variables = _parseGeminiJSON(cleaned, 'DocParse');

      if (!Array.isArray(variables)) {
        throw new Error('Expected JSON array from AI');
      }

      return { variables, model: 'gemini-2.5-flash', charsParsed: truncatedText.length };

    } catch (err) {
      console.error('[DocParse] AI extraction failed:', err.message);
      throw new HttpsError('internal', 'AI parsing failed: ' + err.message);
    }
  }
);

// ── Shared Gemini helper ────────────────────────────────────────────────────────
async function _callGemini(prompt, maxTokens = 4096) {
  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/generative-language'] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    }),
  });

  const body = await res.json();

  // Check for blocked/empty responses
  const candidate = body.candidates?.[0];
  if (!candidate || candidate.finishReason === 'SAFETY') {
    const blockReason = body.promptFeedback?.blockReason || candidate?.finishReason || 'unknown';
    console.error('[Gemini] Response blocked:', blockReason, JSON.stringify(body).substring(0, 500));
    throw new Error(`Gemini response blocked: ${blockReason}`);
  }

  const text = candidate.content?.parts?.[0]?.text || '';
  if (!text) {
    console.error('[Gemini] Empty response:', JSON.stringify(body).substring(0, 500));
    throw new Error('Gemini returned empty response');
  }

  // Strip markdown fences if present
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  // If the response starts with non-JSON (thinking text), try to extract the JSON object/array
  if (cleaned && !cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const jsonStart = cleaned.indexOf('{');
    const arrStart = cleaned.indexOf('[');
    const start = jsonStart === -1 ? arrStart : (arrStart === -1 ? jsonStart : Math.min(jsonStart, arrStart));
    if (start > 0) {
      cleaned = cleaned.substring(start);
    }
  }

  return cleaned;
}

/**
 * Parse JSON from Gemini response with fallback extraction.
 * Handles cases where Gemini wraps JSON in thinking text or markdown.
 */
function _parseGeminiJSON(text, label = 'Gemini') {
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error(`[${label}] JSON parse failed. Raw (first 500 chars):`, text.substring(0, 500));
    // Try extracting the outermost JSON object or array
    const objMatch = text.match(/\{[\s\S]*\}/);
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch {}
    }
    if (arrMatch) {
      try { return JSON.parse(arrMatch[0]); } catch {}
    }
    throw new Error(`Failed to parse AI response as JSON: ${text.substring(0, 200)}`);
  }
}

// ── AI: Draft Investor Update ───────────────────────────────────────────────────
exports.aiDraftInvestorUpdate = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be logged in.');
    rateLimit(uid, 'ai-draft', 10, 60 * 60 * 1000);

    const { dealName, period, updateType, bullets, metrics } = request.data;
    if (!bullets || bullets.length < 10) throw new HttpsError('invalid-argument', 'Please provide some notes or bullet points.');

    const metricsText = metrics ? `\nForm metrics (may be placeholder defaults — the GP's notes below are MORE AUTHORITATIVE): ${JSON.stringify(metrics)}` : '';
    const prompt = `You are writing a professional quarterly investor update for a real estate syndication.

CRITICAL: The GP's rough notes below are the PRIMARY source of truth. They reflect what actually happened. Any form metrics provided may be stale placeholder defaults — if the notes contradict the metrics, ALWAYS use the numbers and tone from the notes.

Tone: Professional but honest. If the GP says things are tough, reflect that transparently (investors respect honesty). Don't sugarcoat bad news into good news. A GP who says "occupancy is 74%" should NOT get a letter claiming "strong performance." Frame challenges constructively but never fabricate optimism.

Property: ${dealName || 'the property'}
Period: ${period || 'this quarter'}
Update type: ${updateType || 'quarterly'}
${metricsText}

THE GP'S ACTUAL NOTES (this is what really happened — base your draft on THIS):
${bullets}

Write the following sections as polished prose (2-4 sentences each). Return JSON:
{
  "greeting": "Opening paragraph — reference the period and property, set the right tone based on the GP's notes",
  "operations": "Operational highlights — what happened this quarter, based on the GP's notes",
  "capex": "Renovation/CapEx update — progress, completions, upcoming work (skip if notes don't mention capex)",
  "outlook": "Forward-looking outlook — honest about challenges, concrete about next steps",
  "distributionNote": "One sentence about distributions if the notes mention them, otherwise null"
}

Return ONLY the JSON, no explanation.`;

    try {
      const result = await _callGemini(prompt, 2048);
      return _parseGeminiJSON(result, 'AI Draft');
    } catch (err) {
      console.error('[AI Draft] Failed:', err.message);
      throw new HttpsError('internal', 'AI drafting failed: ' + err.message);
    }
  }
);

// ── AI: Parse Broker OM ─────────────────────────────────────────────────────────
exports.aiParseBrokerOM = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be logged in.');
    rateLimit(uid, 'ai-om', 5, 60 * 60 * 1000);

    const { text } = request.data;
    if (!text || text.length < 50) throw new HttpsError('invalid-argument', 'OM text too short.');

    const prompt = `You are a real estate deal analyzer for a syndication platform. Extract structured deal data from this broker's offering memorandum.

Return JSON with these fields (use null for anything not found):
{
  "name": "Property name",
  "location": "Full address or city, state",
  "propertyType": "multifamily|industrial|retail|office|mixed-use|self-storage|hospitality",
  "units": number or null,
  "yearBuilt": number or null,
  "sqft": number or null,
  "askingPrice": number or null,
  "pricePerUnit": number or null,
  "pricePerSqft": number or null,
  "capRate": number (as percentage, e.g. 6.5) or null,
  "noi": number or null,
  "occupancy": number (as percentage) or null,
  "totalRaise": number or null,
  "irr": number or null,
  "highlights": ["key selling point 1", "key selling point 2", "..."],
  "risks": ["risk factor 1", "risk factor 2"],
  "market": "Brief market summary (1-2 sentences)"
}

Return ONLY the JSON, no explanation.

OM TEXT:
${text.substring(0, 20000)}`;

    try {
      const result = await _callGemini(prompt, 2048);
      return { deal: _parseGeminiJSON(result, 'AI OM') };
    } catch (err) {
      console.error('[AI OM] Failed:', err.message);
      throw new HttpsError('internal', 'OM parsing failed: ' + err.message);
    }
  }
);

// ── AI: Document Review ─────────────────────────────────────────────────────────
exports.aiReviewDocument = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be logged in.');
    rateLimit(uid, 'ai-review', 10, 60 * 60 * 1000);

    const { documentText, dealData } = request.data;
    if (!documentText || documentText.length < 100) throw new HttpsError('invalid-argument', 'Document text too short.');

    const prompt = `You are a legal document reviewer for a real estate syndication platform. Compare the generated operating agreement against the deal data to find mismatches, inconsistencies, or potential issues.

DEAL DATA:
${JSON.stringify(dealData, null, 2)}

DOCUMENT (first 15000 chars):
${documentText.substring(0, 15000)}

Return JSON:
{
  "matches": [{"field": "field name", "dealValue": "from deal", "docValue": "from document", "note": "brief note"}],
  "mismatches": [{"field": "field name", "dealValue": "from deal", "docValue": "from document", "severity": "high|medium|low", "note": "what's wrong"}],
  "warnings": [{"note": "potential issue or missing clause", "severity": "high|medium|low"}],
  "summary": "One-paragraph overall assessment"
}

Return ONLY the JSON, no explanation.`;

    try {
      const result = await _callGemini(prompt, 8192);
      return _parseGeminiJSON(result, 'AI Review');
    } catch (err) {
      console.error('[AI Review] Failed:', err.message);
      throw new HttpsError('internal', 'Document review failed: ' + err.message);
    }
  }
);

// ── AI: Capital Call / Distribution Notice Drafter ──────────────────────────────
exports.aiDraftNotice = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be logged in.');
    rateLimit(uid, 'ai-notice', 10, 60 * 60 * 1000);

    const { noticeType, dealName, amount, dueDate, notes, investors } = request.data;
    if (!noticeType || !dealName) throw new HttpsError('invalid-argument', 'Missing required fields.');

    const prompt = `You are writing a professional ${noticeType === 'capital_call' ? 'capital call notice' : 'distribution notice'} for a real estate syndication.

Deal: ${dealName}
Amount: ${amount || 'TBD'}
${dueDate ? 'Due Date: ' + dueDate : ''}
${investors ? 'Number of investors: ' + investors : ''}
${notes ? 'Additional notes from GP: ' + notes : ''}

Write a formal but warm investor notice. Return JSON:
{
  "subject": "Email subject line",
  "greeting": "Opening paragraph",
  "body": "Main body — explain the ${noticeType === 'capital_call' ? 'capital call amount, purpose, due date, wire instructions reference' : 'distribution amount, period, breakdown if applicable'}",
  "closing": "Closing paragraph with contact info placeholder",
  "wireNote": "${noticeType === 'capital_call' ? 'Wire instructions reminder (reference deal docs)' : ''}"
}

Return ONLY the JSON.`;

    try {
      const result = await _callGemini(prompt, 2048);
      return _parseGeminiJSON(result, 'AI Notice');
    } catch (err) {
      console.error('[AI Notice] Failed:', err.message);
      throw new HttpsError('internal', 'Notice drafting failed: ' + err.message);
    }
  }
);

// ── AI: Due Diligence Checklist Generator ───────────────────────────────────────
exports.aiDueDiligenceChecklist = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be logged in.');
    rateLimit(uid, 'ai-dd', 5, 60 * 60 * 1000);

    const { propertyType, dealSize, units, state, strategy } = request.data;

    const prompt = `Generate a comprehensive due diligence checklist for acquiring a ${propertyType || 'multifamily'} property.

Deal details:
- Property type: ${propertyType || 'multifamily'}
- Approximate size: ${dealSize ? '$' + dealSize : 'not specified'}
- Units: ${units || 'not specified'}
- State: ${state || 'Texas'}
- Strategy: ${strategy || 'value-add'}

Return JSON with categories, each containing checklist items:
{
  "categories": [
    {
      "name": "Category name",
      "icon": "FontAwesome icon class (e.g. fa-building)",
      "items": [
        {"task": "Description", "critical": true/false, "notes": "Brief guidance"}
      ]
    }
  ],
  "estimatedDays": number,
  "summary": "One sentence overview"
}

Include categories: Financial/Underwriting, Physical/Property Condition, Legal/Title, Environmental, Market/Comps, Tenant/Lease Audit, Insurance, Tax/Assessment, Zoning/Entitlements, Operations. 5-8 items per category. Flag critical items. Keep notes very brief (under 15 words each).

Return ONLY the JSON. Be concise — no verbose explanations in notes.`;

    try {
      const result = await _callGemini(prompt, 16384);
      return _parseGeminiJSON(result, 'AI DD');
    } catch (err) {
      console.error('[AI DD] Failed:', err.message);
      throw new HttpsError('internal', 'Checklist generation failed: ' + err.message);
    }
  }
);

// ── AI: Deal Comparison ─────────────────────────────────────────────────────────
exports.aiCompareDeal = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be logged in.');
    rateLimit(uid, 'ai-compare', 5, 60 * 60 * 1000);

    const { dealA, dealB } = request.data;
    if (!dealA || !dealB) throw new HttpsError('invalid-argument', 'Need two deals to compare.');

    const prompt = `Compare these two real estate investment opportunities for a syndicator evaluating which to pursue.

DEAL A:
${typeof dealA === 'string' ? dealA.substring(0, 10000) : JSON.stringify(dealA)}

DEAL B:
${typeof dealB === 'string' ? dealB.substring(0, 10000) : JSON.stringify(dealB)}

Return JSON:
{
  "comparison": [
    {"metric": "metric name", "dealA": "value", "dealB": "value", "advantage": "A" or "B" or "tie", "note": "brief analysis"}
  ],
  "scores": {"dealA": number 1-100, "dealB": number 1-100},
  "recommendation": "2-3 sentence recommendation",
  "risks": {"dealA": ["risk 1", "risk 2"], "dealB": ["risk 1", "risk 2"]},
  "summary": "One paragraph executive summary"
}

Compare on: price/unit, cap rate, NOI, location/market, age/condition, upside potential, risk profile, exit strategy.
Return ONLY the JSON.`;

    try {
      const result = await _callGemini(prompt, 8192);
      return _parseGeminiJSON(result, 'AI Compare');
    } catch (err) {
      console.error('[AI Compare] Failed:', err.message);
      throw new HttpsError('internal', 'Deal comparison failed: ' + err.message);
    }
  }
);

// ── AI: Document Auto-Categorizer ───────────────────────────────────────────────
exports.aiCategorizeDocument = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be logged in.');
    rateLimit(uid, 'ai-categorize', 20, 60 * 60 * 1000);

    const { fileName, textPreview } = request.data;
    if (!fileName && !textPreview) throw new HttpsError('invalid-argument', 'Need file name or text preview.');

    const prompt = `Categorize this real estate syndication document based on its filename and/or content preview.

Filename: ${fileName || 'unknown'}
Content preview (first 2000 chars): ${(textPreview || '').substring(0, 2000)}

Return JSON:
{
  "category": one of: "operating-agreement" | "ppm" | "subscription" | "side-letter" | "k1" | "appraisal" | "environmental" | "title-report" | "insurance" | "inspection" | "lease" | "rent-roll" | "financial-statement" | "tax-return" | "bank-statement" | "wire-instructions" | "correspondence" | "amendment" | "investor-update" | "distribution-notice" | "capital-call-notice" | "closing-docs" | "other",
  "confidence": number 0-1,
  "suggestedName": "Clean display name for the document",
  "tags": ["tag1", "tag2"],
  "dealRelevance": "brief note on what deal stage this relates to"
}

Return ONLY the JSON.`;

    try {
      const result = await _callGemini(prompt, 1024);
      return _parseGeminiJSON(result, 'AI Categorize');
    } catch (err) {
      console.error('[AI Categorize] Failed:', err.message);
      throw new HttpsError('internal', 'Categorization failed: ' + err.message);
    }
  }
);

// ── AI: Underwriting Sanity Check ───────────────────────────────────────────────
exports.aiUnderwritingCheck = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be logged in.');
    rateLimit(uid, 'ai-underwrite', 5, 60 * 60 * 1000);

    const { assumptions } = request.data;
    if (!assumptions) throw new HttpsError('invalid-argument', 'Missing underwriting assumptions.');

    const prompt = `You are a senior real estate underwriter reviewing proforma assumptions for a syndication deal. Flag anything that looks aggressive, conservative, or unusual.

UNDERWRITING ASSUMPTIONS:
${JSON.stringify(assumptions, null, 2)}

Return JSON:
{
  "overall": "green" | "yellow" | "red",
  "overallNote": "One sentence overall assessment",
  "checks": [
    {
      "field": "field name",
      "value": "the value being checked",
      "status": "green" | "yellow" | "red",
      "marketRange": "typical market range for this metric",
      "note": "specific feedback"
    }
  ],
  "suggestions": ["improvement suggestion 1", "suggestion 2"],
  "risks": ["key risk 1", "key risk 2"]
}

Check: exit cap rate, going-in cap rate, rent growth %, expense ratio, vacancy, renovation cost/unit, hold period, pref return, promote structure, debt terms (LTV, rate, IO period), management fee. Compare against typical 2025-2026 market norms for the property type and location if provided.

Return ONLY the JSON.`;

    try {
      const result = await _callGemini(prompt, 8192);
      return _parseGeminiJSON(result, 'AI Underwrite');
    } catch (err) {
      console.error('[AI Underwrite] Failed:', err.message);
      throw new HttpsError('internal', 'Underwriting check failed: ' + err.message);
    }
  }
);

// ── AI: LP Portal Q&A (grounded in deal documents) ─────────────────────────────
exports.aiInvestorQA = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be logged in.');
    rateLimit(uid, 'ai-qa', 20, 60 * 60 * 1000);

    const { question, dealContext, documentExcerpts } = request.data;
    if (!question) throw new HttpsError('invalid-argument', 'Missing question.');

    const prompt = `You are a helpful investor relations assistant for a real estate syndication platform. Answer the investor's question ONLY using the provided deal context and document excerpts. If the answer is not in the provided context, say "I don't have that information in your deal documents. Please contact your GP directly."

DEAL CONTEXT:
${JSON.stringify(dealContext || {}, null, 2)}

DOCUMENT EXCERPTS:
${(documentExcerpts || 'No documents provided').substring(0, 10000)}

INVESTOR QUESTION:
${question}

Return JSON:
{
  "answer": "Clear, helpful answer grounded in the documents",
  "source": "Which document or data point the answer came from",
  "confidence": "high" | "medium" | "low",
  "followUp": "Optional suggested follow-up question or action"
}

CRITICAL: Never make up financial figures, dates, or terms. Only state what is explicitly in the context. If unsure, direct them to the GP.

Return ONLY the JSON.`;

    try {
      const result = await _callGemini(prompt, 2048);
      return _parseGeminiJSON(result, 'AI QA');
    } catch (err) {
      console.error('[AI QA] Failed:', err.message);
      throw new HttpsError('internal', 'Q&A failed: ' + err.message);
    }
  }
);

// ── Stripe Customer Portal ─────────────────────────────────────────────────────
/**
 * createBillingPortalSession — callable function to open Stripe Customer Portal
 * Lets users manage subscription, update payment, view invoices, cancel.
 */
exports.createBillingPortalSession = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be logged in.');
    rateLimit(uid, 'portal', 5, 10 * 60 * 1000);

    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const customerId = userData.subscription?.stripeCustomerId;

    if (!customerId) {
      throw new HttpsError('failed-precondition', 'No active subscription found. Please subscribe first.');
    }

    const stripeConfig = await getStripeConfig();
    const stripe = Stripe(stripeConfig.secretKey);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: 'https://deeltrack.com/settings.html',
    });

    return { url: session.url };
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

// ── K-1 Available Notification ────────────────────────────────────────────────
/**
 * onK1StatusChanged — when a K-1 vault entry is marked as 'sent',
 * email the investor that their K-1 is available in the portal.
 */
exports.onK1StatusChanged = onDocumentUpdated(
  { document: 'orgs/{orgId}/k1vault/{k1Id}', region: 'us-central1' },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const orgId = event.params.orgId;

    // Only fire when status changes to 'sent'
    if (before.status === after.status || after.status !== 'sent') return;
    if (!after.investorId) return;

    const invDoc = await db.collection('orgs').doc(orgId).collection('investors').doc(after.investorId).get();
    if (!invDoc.exists) return;
    const inv = invDoc.data();
    if (!inv.email) return;

    // Get deal name
    let dealName = 'your investment';
    if (after.dealId) {
      const dealDoc = await db.collection('orgs').doc(orgId).collection('deals').doc(after.dealId).get();
      if (dealDoc.exists) dealName = dealDoc.data().name || dealName;
    }

    const firstName = inv.firstName || inv.name || 'Investor';
    const taxYear = after.taxYear || new Date().getFullYear();

    try {
      const token = await getGraphToken();
      await graphSendMail(inv.email,
        `📄 Your ${taxYear} K-1 is ready — ${dealName}`,
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#F37925;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
            <h1 style="color:white;margin:0;font-size:1.3rem;">📄 Your ${taxYear} K-1 is Ready</h1>
          </div>
          <div style="background:#f8fafc;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;">
            <p>Hi ${firstName},</p>
            <p>Your Schedule K-1 for <strong>${dealName}</strong> (tax year ${taxYear}) is now available in your investor portal.</p>
            <div style="text-align:center;margin:28px 0;">
              <a href="https://deeltrack.com/investor-portal.html" style="background:#F37925;color:#1B1A19;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:.95rem;display:inline-block;">View in Portal →</a>
            </div>
            <p style="color:#64748b;font-size:.85rem;">You can download the PDF from your Documents section. Please share it with your tax preparer for your ${taxYear} filing.</p>
            <p style="color:#94a3b8;font-size:.75rem;text-align:center;margin-top:32px;">deeltrack — Investor management platform</p>
          </div>
        </div>`,
        token
      );
      console.log(`✅ K-1 notification sent to ${inv.email} for ${dealName} ${taxYear}`);
    } catch (e) {
      console.error('K-1 notification error:', e.message);
    }
  }
);

// ── Distribution Posted Notification ──────────────────────────────────────────
/**
 * onDistributionPosted — when a distribution status changes to 'posted',
 * email all recipients. Covers the case where GP creates as draft then posts later.
 */
exports.onDistributionPosted = onDocumentUpdated(
  { document: 'orgs/{orgId}/distributions/{distId}', region: 'us-central1' },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const orgId = event.params.orgId;

    // Only fire when status changes to 'posted'
    if (before.status === after.status || after.status !== 'posted') return;

    let dealName = after.dealName || null;
    if (!dealName && after.dealId) {
      const dealDoc = await db.collection('orgs').doc(orgId).collection('deals').doc(after.dealId).get();
      dealName = dealDoc.exists ? (dealDoc.data().name || 'your investment') : 'your investment';
    }
    dealName = dealName || 'your investment';

    const token = await getGraphToken();

    for (const recipient of (after.recipients || [])) {
      if (!recipient.investorId) continue;
      const invDoc = await db.collection('orgs').doc(orgId).collection('investors').doc(recipient.investorId).get();
      if (!invDoc.exists) continue;
      const inv = invDoc.data();
      if (!inv.email) continue;

      const firstName = inv.firstName || inv.name || 'Investor';
      const amount = Number(recipient.amount || recipient.totalThisDist || 0);
      const period = after.period || (after.quarter && after.year ? after.quarter + ' ' + after.year : '') || '';

      await graphSendMail(inv.email,
        `💰 Distribution Posted — ${dealName}${period ? ' | ' + period : ''}`,
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#2D9A6B;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
            <h1 style="color:white;margin:0;font-size:1.3rem;">💰 Distribution Posted</h1>
          </div>
          <div style="background:#f8fafc;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;">
            <p>Hi ${firstName},</p>
            <p>A distribution has been posted for <strong>${dealName}</strong>${period ? ' (' + period + ')' : ''}.</p>
            <div style="background:white;border:2px solid #2D9A6B;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
              <p style="margin:0;font-size:1.75rem;font-weight:700;color:#2D9A6B;">$${amount.toLocaleString()}</p>
              <p style="margin:4px 0 0;color:#64748b;">Your distribution</p>
            </div>
            <div style="text-align:center;margin:24px 0;">
              <a href="https://deeltrack.com/investor-portal.html" style="background:#F37925;color:#1B1A19;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:.9rem;display:inline-block;">View in Portal →</a>
            </div>
            <p style="color:#64748b;font-size:.85rem;">Funds will be processed within 3–5 business days via your registered payment method.</p>
            <p style="color:#94a3b8;font-size:.75rem;text-align:center;margin-top:32px;">deeltrack — Investor management platform</p>
          </div>
        </div>`,
        token
      ).catch(e => console.error('Distribution posted email error:', e.message));
    }
  }
);

// ── E-Signature via Firma.dev ─────────────────────────────────────────────────
exports.createSigningRequest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');
  
  const userDoc = await db.collection('users').doc(request.auth.uid).get();
  if (!userDoc.exists) throw new HttpsError('not-found', 'User not found');
  const userData = userDoc.data();
  if (userData.role === 'Investor') throw new HttpsError('permission-denied', 'Only GPs can send signing requests');
  
  // Get Firma API key from _config
  const configDoc = await db.collection('_config').doc('esign').get();
  if (!configDoc.exists) throw new HttpsError('failed-precondition', 'E-sign not configured');
  const firmaKey = configDoc.data().firmaApiKey;
  const templateId = configDoc.data().templateId;
  
  const data = request.data;
  const FIRMA_BASE = 'https://api.firma.dev/functions/v1/signing-request-api';
  
  // Create signing request
  const createRes = await fetch(FIRMA_BASE + '/signing-requests', {
    method: 'POST',
    headers: { 'Authorization': firmaKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template_id: data.template_id || templateId,
      name: data.name || 'Subscription Agreement',
      recipients: data.recipients || []
    })
  });
  const result = await createRes.json();
  if (result.error) throw new HttpsError('internal', result.error);
  
  // Send
  if (result.id) {
    await fetch(FIRMA_BASE + '/signing-requests/' + result.id + '/send', {
      method: 'POST',
      headers: { 'Authorization': firmaKey, 'Content-Type': 'application/json' }
    });
  }
  
  // Log
  await db.collection('orgs').doc(userData.orgId).collection('esign_log').add({
    signingRequestId: result.id,
    dealId: data.dealId || null,
    investorEmail: data.recipients?.[0]?.email || null,
    status: 'sent',
    sentBy: request.auth.uid,
    sentAt: FieldValue.serverTimestamp()
  });
  
  return { id: result.id, sent: true };
});

// ── Firma.dev E-Sign Webhook ──────────────────────────────────────────────────
// Receives events: signing_request.viewed, signing_request.recipient.signed, signing_request.completed
// Endpoint: https://us-central1-deeltrack.cloudfunctions.net/firmaWebhook
exports.firmaWebhook = onRequest(async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }
  
  try {
    const event = req.body;
    const eventType = event.event_type || event.type;
    const signingRequestId = event.data?.signing_request_id || event.signing_request_id;
    
    if (!eventType || !signingRequestId) {
      res.status(400).json({ error: 'Missing event_type or signing_request_id' });
      return;
    }
    
    console.log(`[firma-webhook] ${eventType} for ${signingRequestId}`);
    
    // Find the esign_log entry across all orgs
    const orgsSnap = await db.collectionGroup('esign_log')
      .where('signingRequestId', '==', signingRequestId)
      .limit(1).get();
    
    if (orgsSnap.empty) {
      console.warn(`[firma-webhook] No esign_log found for ${signingRequestId}`);
      res.json({ received: true, matched: false });
      return;
    }
    
    const logDoc = orgsSnap.docs[0];
    const logData = logDoc.data();
    const orgId = logDoc.ref.parent.parent.id; // orgs/{orgId}/esign_log/{docId}
    
    // Update the log entry
    const updateData = { lastEvent: eventType, lastEventAt: FieldValue.serverTimestamp() };
    
    if (eventType === 'signing_request.viewed') {
      updateData.status = 'viewed';
      updateData.viewedAt = FieldValue.serverTimestamp();
    }
    
    if (eventType === 'signing_request.recipient.signed') {
      updateData.status = 'signed';
      updateData.signedAt = FieldValue.serverTimestamp();
    }
    
    if (eventType === 'signing_request.completed') {
      updateData.status = 'completed';
      updateData.completedAt = FieldValue.serverTimestamp();
      
      // Download the signed PDF from Firma and store reference
      try {
        const configDoc = await db.collection('_config').doc('esign').get();
        const firmaKey = configDoc.data().firmaApiKey;
        const FIRMA_BASE = 'https://api.firma.dev/functions/v1/signing-request-api';
        
        const srRes = await fetch(FIRMA_BASE + '/signing-requests/' + signingRequestId, {
          headers: { 'Authorization': firmaKey }
        });
        const srData = await srRes.json();
        
        if (srData.final_document_download_url) {
          updateData.signedDocumentUrl = srData.final_document_download_url;
        }
        if (srData.certificate_only_download_url) {
          updateData.certificateUrl = srData.certificate_only_download_url;
        }
      } catch(e) {
        console.warn('[firma-webhook] Could not fetch signed doc URL:', e.message);
      }
      
      // Update the investor's subscription status in the deal
      if (logData.dealId && logData.investorEmail) {
        try {
          const dealDoc = await db.collection('orgs').doc(orgId).collection('deals').doc(logData.dealId).get();
          if (dealDoc.exists) {
            const deal = dealDoc.data();
            const investors = deal.investors || [];
            // Find investor by email — can't use findIndex with await, use loop
            for (let idx = 0; idx < investors.length; idx++) {
              const invDoc = await db.collection('orgs').doc(orgId).collection('investors').doc(investors[idx].investorId).get();
              if (invDoc.exists && invDoc.data().email === logData.investorEmail) {
                investors[idx].subStatus = 'signed';
                investors[idx].subSignedAt = new Date().toISOString();
                await dealDoc.ref.update({ investors });
                console.log(`[firma-webhook] Updated ${logData.investorEmail} subStatus → signed in deal ${logData.dealId}`);
                break;
              }
            }
          }
        } catch(e) {
          console.warn('[firma-webhook] Could not update deal investor status:', e.message);
        }
      }
    }
    
    await logDoc.ref.update(updateData);
    console.log(`[firma-webhook] Updated esign_log: ${eventType}`);
    
    res.json({ received: true, matched: true, event: eventType });
  } catch(e) {
    console.error('[firma-webhook] Error:', e);
    res.status(500).json({ error: e.message });
  }
});
// Auto-deployed via GitHub Actions

// ══════════════════════════════════════════════════════════════════════════════
// KMS-Backed Encryption — Secure Key Management
// ══════════════════════════════════════════════════════════════════════════════

const crypto = require('crypto');

const KMS_PROJECT = 'deeltrack';
const KMS_LOCATION = 'global';
const KMS_KEYRING = 'deeltrack-keys';
const KMS_KEY = 'org-master-key';

let _kmsClient = null;
function getKMSClient() {
  if (!_kmsClient) {
    const { KeyManagementServiceClient } = require('@google-cloud/kms');
    _kmsClient = new KeyManagementServiceClient();
  }
  return _kmsClient;
}

async function kmsEncrypt(plaintext) {
  const client = getKMSClient();
  const name = client.cryptoKeyPath(KMS_PROJECT, KMS_LOCATION, KMS_KEYRING, KMS_KEY);
  const [result] = await client.encrypt({ name, plaintext });
  return result.ciphertext;
}

async function kmsDecrypt(ciphertext) {
  const client = getKMSClient();
  const name = client.cryptoKeyPath(KMS_PROJECT, KMS_LOCATION, KMS_KEYRING, KMS_KEY);
  const [result] = await client.decrypt({ name, ciphertext });
  return result.plaintext;
}

// Get or create KMS-encrypted org key
exports.getOrgKey = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');
  rateLimit(request.auth.uid, 'getOrgKey', 20, 60 * 1000); // 20 per minute
  const { orgId } = request.data;

  // Verify user belongs to this org
  const userDoc = await db.collection('users').doc(request.auth.uid).get();
  if (!userDoc.exists || userDoc.data().orgId !== orgId) {
    throw new HttpsError('permission-denied', 'No access to this org');
  }

  const orgRef = db.collection('orgs').doc(orgId);
  const orgDoc = await orgRef.get();
  let encryptedDek = orgDoc.exists ? orgDoc.data().encryptedDek : null;

  if (!encryptedDek) {
    // Generate new 256-bit DEK, encrypt with KMS, store
    const dek = crypto.randomBytes(32);
    encryptedDek = await kmsEncrypt(dek);
    await orgRef.set({ encryptedDek: Buffer.from(encryptedDek).toString('base64'), createdAt: FieldValue.serverTimestamp() }, { merge: true });
    encryptedDek = Buffer.from(encryptedDek).toString('base64');
  } else if (Buffer.isBuffer(encryptedDek)) {
    encryptedDek = encryptedDek.toString('base64');
  }

  // Audit log
  await db.collection('auditLogs').add({
    orgId, userId: request.auth.uid, action: 'key_retrieved',
    timestamp: FieldValue.serverTimestamp(),
  });

  return encryptedDek;
});

// Encrypt data server-side using KMS-decrypted DEK
exports.encryptData = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');
  rateLimit(request.auth.uid, 'encryptData', 60, 60 * 1000); // 60 per minute
  const { orgId, plaintext, encryptedDek } = request.data;

  const dek = await kmsDecrypt(Buffer.from(encryptedDek, 'base64'));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    authTag: authTag.toString('base64'),
  };
});

// Decrypt data server-side using KMS-decrypted DEK
exports.decryptData = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');
  const { orgId, iv, ciphertext, authTag, encryptedDek } = request.data;

  const dek = await kmsDecrypt(Buffer.from(encryptedDek, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', dek, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]);

  return decrypted.toString('utf8');
});

// Decrypt legacy enc: format (Web Crypto AES-GCM where ciphertext includes auth tag)
// Called by sp-crypto.js to migrate enc: → enc2: values
exports.decryptLegacy = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');
  const { orgId, combined, encryptedDek } = request.data;
  // combined = base64 of iv[12] + ciphertext_with_tag
  // Web Crypto AES-GCM appends 16-byte auth tag to ciphertext

  if (!combined || !encryptedDek || !orgId) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }

  // Verify user belongs to this org
  const userDoc = await db.collection('users').doc(request.auth.uid).get();
  if (!userDoc.exists || userDoc.data().orgId !== orgId) {
    throw new HttpsError('permission-denied', 'No access to this org');
  }

  try {
    const dek = await kmsDecrypt(Buffer.from(encryptedDek, 'base64'));
    const raw = Buffer.from(combined, 'base64');
    const iv = raw.slice(0, 12);
    const ciphertextWithTag = raw.slice(12);
    // Auth tag is last 16 bytes
    const authTag = ciphertextWithTag.slice(-16);
    const ciphertext = ciphertextWithTag.slice(0, -16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    // Log migration action
    await db.collection('auditLogs').add({
      orgId,
      userId: request.auth.uid,
      action: 'legacy_decrypt_for_migration',
      timestamp: FieldValue.serverTimestamp(),
    });

    return decrypted.toString('utf8');
  } catch (e) {
    console.error('decryptLegacy failed:', e.message);
    throw new HttpsError('internal', 'Legacy decryption failed');
  }
});

// Rotate org encryption key
exports.rotateKey = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');
  const { orgId } = request.data;

  const userDoc = await db.collection('users').doc(request.auth.uid).get();
  if (!userDoc.exists || userDoc.data().orgId !== orgId) {
    throw new HttpsError('permission-denied', 'No access');
  }

  const newDek = crypto.randomBytes(32);
  const encryptedNewDek = await kmsEncrypt(newDek);
  await db.collection('orgs').doc(orgId).update({
    encryptedDek: Buffer.from(encryptedNewDek).toString('base64'),
    keyRotatedAt: FieldValue.serverTimestamp(),
  });

  await db.collection('auditLogs').add({
    orgId, userId: request.auth.uid, action: 'key_rotated',
    timestamp: FieldValue.serverTimestamp(),
  });

  return { success: true };
});

// Get key status
exports.getKeyStatus = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');
  const { orgId } = request.data;
  const orgDoc = await db.collection('orgs').doc(orgId).get();
  if (!orgDoc.exists) return { encryptedDekExists: false };
  return {
    encryptedDekExists: !!orgDoc.data().encryptedDek,
    keyRotatedAt: orgDoc.data().keyRotatedAt || null,
    createdAt: orgDoc.data().createdAt || null,
  };
});

// ── healUserRole — Admin SDK role fix for known accounts ──────────────────────
// Called from client when a ROLE_LOCK mismatch is detected.
// Only fixes roles for hardcoded known accounts (prevents abuse).
const ROLE_LOCK_SERVER = {
  'gp@deeltrack.com': 'General Partner',
  'demo@deeltrack.com': 'General Partner',
  'demo-gp2@deeltrack.com': 'General Partner',
  'philip@jchapmancpa.com': 'Investor',
  'investor@deeltrack.com': 'Investor',
};

exports.healUserRole = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
  rateLimit(request.auth.uid, 'healUserRole', 5, 60 * 60 * 1000); // 5 per hour
  const { uid, expectedRole } = request.data;
  if (!uid || !expectedRole) throw new HttpsError('invalid-argument', 'uid and expectedRole required');

  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) throw new HttpsError('not-found', 'User not found');

  const email = (userDoc.data().email || '').toLowerCase();
  const correctRole = ROLE_LOCK_SERVER[email];
  if (!correctRole) throw new HttpsError('permission-denied', 'Not a role-locked account');
  if (expectedRole !== correctRole) throw new HttpsError('permission-denied', 'Expected role does not match server lock');

  await db.collection('users').doc(uid).update({ role: correctRole });
  await db.collection('auditLogs').add({
    action: 'healUserRole',
    uid,
    email,
    oldRole: userDoc.data().role,
    newRole: correctRole,
    callerUid: request.auth.uid,
    timestamp: FieldValue.serverTimestamp(),
  });
  return { healed: true, role: correctRole };
});

// ══════════════════════════════════════════════════════════════════════════════
// Team Management — Multi-user per org
// ══════════════════════════════════════════════════════════════════════════════

/**
 * inviteTeamMember — Send a team invite to join an org
 * Only org owner/admin can call. Creates invite record + sends email.
 *
 * data: { email, memberRole: 'admin' | 'member' | 'viewer' }
 */
exports.inviteTeamMember = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
  rateLimit(request.auth.uid, 'inviteTeam', 20, 60 * 60 * 1000); // 20/hour

  const { email, memberRole } = request.data;
  if (!email) throw new HttpsError('invalid-argument', 'Email required');
  const validRoles = ['admin', 'member', 'viewer'];
  const role = validRoles.includes(memberRole) ? memberRole : 'member';

  // Verify caller is GP in their org
  const callerDoc = await db.collection('users').doc(request.auth.uid).get();
  if (!callerDoc.exists) throw new HttpsError('not-found', 'User not found');
  const caller = callerDoc.data();
  if (caller.role === 'Investor') throw new HttpsError('permission-denied', 'Investors cannot invite team members');
  const orgId = caller.orgId;
  if (!orgId) throw new HttpsError('failed-precondition', 'No org associated');

  // Check caller is owner or admin
  const callerMember = await db.collection('orgs').doc(orgId).collection('members').doc(request.auth.uid).get();
  const isOwner = caller.orgId === orgId; // primary org owner
  const isAdmin = callerMember.exists && ['owner', 'admin'].includes(callerMember.data().role);
  if (!isOwner && !isAdmin) throw new HttpsError('permission-denied', 'Only org owners/admins can invite');

  // Generate invite token
  const crypto = require('crypto');
  const token = crypto.randomBytes(24).toString('hex');

  // Store invite
  const invite = {
    email: email.toLowerCase(),
    memberRole: role,
    orgId,
    invitedBy: request.auth.uid,
    invitedByEmail: caller.email,
    token,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  };

  await db.collection('orgs').doc(orgId).collection('team_invites').doc(token).set(invite);
  // Global index for lookup by token
  await db.collection('_team_invites').doc(token).set({ orgId, email: email.toLowerCase(), token });

  // Send invite email
  try {
    const orgDoc = await db.collection('orgs').doc(orgId).get();
    const orgName = orgDoc.exists ? (orgDoc.data().firmName || orgDoc.data().orgId) : orgId;
    const settings = await db.collection('orgs').doc(orgId).collection('settings').doc('firm').get();
    const firmName = settings.exists ? (settings.data().firmName || orgName) : orgName;

    const joinUrl = `https://rpike623.github.io/syndicate-pro/join-team.html?token=${token}`;
    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#F37925,#FAC670);padding:24px;border-radius:8px 8px 0 0;text-align:center;">
          <h1 style="color:white;margin:0;font-size:1.3rem;">You're invited to join ${firmName}</h1>
        </div>
        <div style="background:#f8fafc;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;">
          <p><strong>${caller.name || caller.email}</strong> has invited you to join their team on deeltrack as a <strong>${role}</strong>.</p>
          <p style="margin:24px 0;text-align:center;">
            <a href="${joinUrl}" style="display:inline-block;padding:14px 32px;background:#F37925;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Accept Invitation</a>
          </p>
          <p style="font-size:.85rem;color:#64748b;">This invite expires in 7 days. If you don't have a deeltrack account, you'll be asked to create one.</p>
        </div>
      </div>`;

    const graphToken = await getGraphToken();
    await graphSendMail(email, `Join ${firmName} on deeltrack`, htmlBody, graphToken);
  } catch (emailErr) {
    console.warn('Team invite email failed:', emailErr.message);
    // Invite still created — user can share the link manually
  }

  return { success: true, token, expiresAt: invite.expiresAt.toISOString() };
});

/**
 * acceptTeamInvite — Accept an invite and join an org
 * Adds user to org's members, updates user's orgIds array.
 *
 * data: { token }
 */
exports.acceptTeamInvite = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
  rateLimit(request.auth.uid, 'acceptInvite', 10, 60 * 60 * 1000);

  const { token } = request.data;
  if (!token) throw new HttpsError('invalid-argument', 'Token required');

  // Look up invite
  const indexDoc = await db.collection('_team_invites').doc(token).get();
  if (!indexDoc.exists) throw new HttpsError('not-found', 'Invalid or expired invite');
  const { orgId } = indexDoc.data();

  const inviteRef = db.collection('orgs').doc(orgId).collection('team_invites').doc(token);
  const inviteDoc = await inviteRef.get();
  if (!inviteDoc.exists) throw new HttpsError('not-found', 'Invite not found');
  const invite = inviteDoc.data();

  if (invite.status !== 'pending') throw new HttpsError('failed-precondition', 'Invite already ' + invite.status);
  if (invite.expiresAt && invite.expiresAt.toDate() < new Date()) {
    await inviteRef.update({ status: 'expired' });
    throw new HttpsError('deadline-exceeded', 'Invite has expired');
  }

  // Verify email matches (case-insensitive)
  const userDoc = await db.collection('users').doc(request.auth.uid).get();
  if (!userDoc.exists) throw new HttpsError('not-found', 'User not found');
  const userEmail = (userDoc.data().email || '').toLowerCase();
  if (userEmail !== invite.email.toLowerCase()) {
    throw new HttpsError('permission-denied',
      `This invite is for ${invite.email}. You're signed in as ${userEmail}.`);
  }

  const batch = db.batch();

  // Add to org members
  const memberRef = db.collection('orgs').doc(orgId).collection('members').doc(request.auth.uid);
  batch.set(memberRef, {
    uid: request.auth.uid,
    email: userEmail,
    name: userDoc.data().name || userEmail,
    role: invite.memberRole || 'member',
    joinedAt: FieldValue.serverTimestamp(),
    invitedBy: invite.invitedBy,
  });

  // Update user's orgIds array
  const userRef = db.collection('users').doc(request.auth.uid);
  const currentOrgIds = userDoc.data().orgIds || [];
  if (!currentOrgIds.includes(orgId)) {
    batch.update(userRef, { orgIds: [...currentOrgIds, orgId] });
  }

  // Mark invite as accepted
  batch.update(inviteRef, { status: 'accepted', acceptedAt: FieldValue.serverTimestamp(), acceptedBy: request.auth.uid });

  // Clean up global index
  batch.delete(db.collection('_team_invites').doc(token));

  await batch.commit();

  // Log
  await db.collection('auditLogs').add({
    action: 'teamMemberJoined',
    orgId,
    uid: request.auth.uid,
    email: userEmail,
    memberRole: invite.memberRole,
    invitedBy: invite.invitedBy,
    timestamp: FieldValue.serverTimestamp(),
  });

  return { success: true, orgId, role: invite.memberRole };
});

/**
 * removeTeamMember — Remove a member from an org
 * Only org owner/admin can call.
 *
 * data: { orgId, targetUid }
 */
exports.removeTeamMember = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
  rateLimit(request.auth.uid, 'removeTeam', 10, 60 * 60 * 1000);

  const { orgId, targetUid } = request.data;
  if (!orgId || !targetUid) throw new HttpsError('invalid-argument', 'orgId and targetUid required');

  // Verify caller is owner/admin
  const callerDoc = await db.collection('users').doc(request.auth.uid).get();
  if (!callerDoc.exists) throw new HttpsError('not-found', 'Caller not found');
  const isOwner = callerDoc.data().orgId === orgId;
  const callerMember = await db.collection('orgs').doc(orgId).collection('members').doc(request.auth.uid).get();
  const isAdmin = callerMember.exists && ['owner', 'admin'].includes(callerMember.data().role);
  if (!isOwner && !isAdmin) throw new HttpsError('permission-denied', 'Only owners/admins can remove members');

  // Can't remove the primary org owner
  const targetDoc = await db.collection('users').doc(targetUid).get();
  if (targetDoc.exists && targetDoc.data().orgId === orgId) {
    throw new HttpsError('failed-precondition', 'Cannot remove the primary org owner');
  }

  const batch = db.batch();

  // Remove from members
  batch.delete(db.collection('orgs').doc(orgId).collection('members').doc(targetUid));

  // Remove orgId from user's orgIds array
  if (targetDoc.exists) {
    const orgIds = (targetDoc.data().orgIds || []).filter(id => id !== orgId);
    batch.update(db.collection('users').doc(targetUid), { orgIds });
  }

  await batch.commit();

  await db.collection('auditLogs').add({
    action: 'teamMemberRemoved',
    orgId,
    targetUid,
    removedBy: request.auth.uid,
    timestamp: FieldValue.serverTimestamp(),
  });

  return { success: true };
});

/**
 * listTeamMembers — Get all members of an org (callable)
 * Returns owner + members list.
 */
exports.listTeamMembers = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const callerDoc = await db.collection('users').doc(request.auth.uid).get();
  if (!callerDoc.exists) throw new HttpsError('not-found', 'User not found');
  const orgId = callerDoc.data().orgId;
  if (!orgId) throw new HttpsError('failed-precondition', 'No org');

  // Helper: convert Firestore Timestamps to ISO strings for serialization
  const toISO = (ts) => {
    if (!ts) return null;
    if (ts.toDate) return ts.toDate().toISOString();
    if (ts instanceof Date) return ts.toISOString();
    return ts;
  };

  // Get members subcollection
  const membersSnap = await db.collection('orgs').doc(orgId).collection('members').get();
  const members = membersSnap.docs.map(d => {
    const data = d.data();
    return { uid: d.id, email: data.email, name: data.name, role: data.role, joinedAt: toISO(data.joinedAt) };
  });

  // Add the primary owner if not in members list
  const ownerInMembers = members.some(m => m.uid === request.auth.uid);
  if (!ownerInMembers && callerDoc.data().orgId === orgId) {
    members.unshift({
      uid: request.auth.uid,
      email: callerDoc.data().email,
      name: callerDoc.data().name,
      role: 'owner',
      joinedAt: toISO(callerDoc.data().createdAt),
      isPrimaryOwner: true,
    });
  }

  // Get pending invites
  const invitesSnap = await db.collection('orgs').doc(orgId).collection('team_invites')
    .where('status', '==', 'pending').get();
  const pendingInvites = invitesSnap.docs.map(d => {
    const data = d.data();
    return { email: data.email, memberRole: data.memberRole, createdAt: toISO(data.createdAt), token: d.id };
  });

  return { members, pendingInvites };
});
// CI trigger 1774058021
// gen2 IAM fix 1774058585
