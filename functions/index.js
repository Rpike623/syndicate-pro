/**
 * deeltrack — Firebase Cloud Functions v2
 * Email via Microsoft Graph API (OAuth2) — admin@deeltrack.com
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated }  = require('firebase-functions/v2/firestore');
const { initializeApp }      = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
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
    const token = await getGraphToken();

    for (const recipient of (dist.recipients || [])) {
      const invDoc = await db.collection('orgs').doc(orgId).collection('investors').doc(recipient.investorId).get();
      if (!invDoc.exists) continue;
      const inv = invDoc.data();
      if (!inv.email) continue;

      await graphSendMail(inv.email,
        `💰 Distribution — ${dist.dealName} | ${dist.period || ''}`,
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:#10b981;padding:24px;border-radius:8px 8px 0 0;text-align:center;"><h1 style="color:white;margin:0;">💰 Distribution Notice</h1></div><div style="background:#f8fafc;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;"><p>Dear ${inv.firstName || inv.email},</p><p>A distribution of <strong style="color:#10b981;font-size:1.5rem;">$${Number(recipient.amount || 0).toLocaleString()}</strong> has been issued for <strong>${dist.dealName}</strong>.</p><p style="color:#64748b;">Period: ${dist.period || '—'} · Date: ${dist.date || 'Today'}</p><p>Funds will be processed within 3–5 business days.</p><p style="color:#94a3b8;font-size:.8rem;text-align:center;margin-top:24px;">deeltrack — Real estate syndication platform</p></div></div>`,
        token
      ).catch(e => console.error('Distribution email error:', e.message));
    }
    return null;
  }
);
