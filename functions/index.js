/**
 * deeltrack — Firebase Cloud Functions
 * Email relay via GoDaddy SMTP (admin@deeltrack.com)
 * SMTP credentials stored in Firestore/_config/smtp
 */

const functions  = require('firebase-functions');
const admin      = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// ── Get SMTP config from Firestore (avoids env config requirement) ────────────
let _smtpConfig = null;
async function getSmtpConfig() {
  if (_smtpConfig) return _smtpConfig;
  try {
    const doc = await admin.firestore().collection('_config').doc('smtp').get();
    if (doc.exists) { _smtpConfig = doc.data(); return _smtpConfig; }
  } catch (e) { console.warn('Could not read SMTP config:', e.message); }
  // Fallback to env config
  const cfg = functions.config().email || {};
  return { user: cfg.user || 'admin@deeltrack.com', pass: cfg.pass || '', host: 'smtpout.secureserver.net', port: 465 };
}

async function getTransporter() {
  const cfg = await getSmtpConfig();
  return nodemailer.createTransport({
    host: cfg.host || 'smtpout.secureserver.net',
    port: cfg.port || 465,
    secure: true,
    auth: { user: cfg.user, pass: cfg.pass },
    tls: { rejectUnauthorized: false },
  });
}

// ── Auth check ────────────────────────────────────────────────────────────────
async function verifyAndGetOrg(context) {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  const doc = await admin.firestore().collection('users').doc(context.auth.uid).get();
  if (!doc.exists) throw new functions.https.HttpsError('not-found', 'User not found');
  return { uid: context.auth.uid, orgId: doc.data().orgId };
}

// ── sendEmail callable (main entry point from sp-email.js) ───────────────────
exports.sendEmail = functions.https.onCall(async (data, context) => {
  const { uid, orgId } = await verifyAndGetOrg(context);
  const { to, subject, html, text, type, dealId } = data;
  if (!to || !subject) throw new functions.https.HttpsError('invalid-argument', 'Missing to or subject');

  const recipients = Array.isArray(to) ? to : [to];
  const transporter = await getTransporter();
  const results = [];

  for (const email of recipients) {
    try {
      const info = await transporter.sendMail({
        from:    '"deeltrack" <admin@deeltrack.com>',
        to:      email,
        subject,
        html:    html || `<p>${text || subject}</p>`,
        text:    text || subject,
        replyTo: 'admin@deeltrack.com',
      });
      await admin.firestore().collection('orgs').doc(orgId).collection('emails').add({
        to: email, subject, type: type || 'custom', dealId: dealId || null,
        status: 'sent', messageId: info.messageId,
        sentAt: admin.firestore.FieldValue.serverTimestamp(), sentBy: uid, orgId,
      });
      results.push({ to: email, status: 'sent' });
    } catch (err) {
      console.error('Send error:', err.message);
      await admin.firestore().collection('orgs').doc(orgId).collection('emails').add({
        to: email, subject, type: type || 'custom',
        status: 'error', error: err.message,
        sentAt: admin.firestore.FieldValue.serverTimestamp(), sentBy: uid, orgId,
      });
      results.push({ to: email, status: 'error', error: err.message });
    }
  }

  const sent = results.filter(r => r.status === 'sent').length;
  return { success: sent > 0, sent, errors: results.length - sent, results };
});

// ── Firestore trigger: auto-email on capital call ────────────────────────────
exports.onCapitalCallCreated = functions.firestore
  .document('orgs/{orgId}/capitalCalls/{callId}')
  .onCreate(async (snap, context) => {
    const call = snap.data();
    const orgId = context.params.orgId;
    const dealDoc = await admin.firestore().collection('orgs').doc(orgId).collection('deals').doc(call.dealId).get();
    if (!dealDoc.exists) return null;
    const deal = dealDoc.data();
    const invIds = (deal.investors || []).map(i => i.investorId || i.id).filter(Boolean);
    if (!invIds.length) return null;
    const transporter = await getTransporter();
    for (const invId of invIds) {
      const inv = (await admin.firestore().collection('orgs').doc(orgId).collection('investors').doc(invId).get()).data();
      if (!inv || !inv.email) continue;
      const recipient = (deal.investors || []).find(i => (i.investorId || i.id) === invId);
      await transporter.sendMail({
        from: '"deeltrack" <admin@deeltrack.com>', to: inv.email,
        subject: `Capital Call — ${deal.name} | Due ${call.dueDate || 'TBD'}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><div style="background:#f59e0b;padding:24px;border-radius:8px 8px 0 0;text-align:center;"><h1 style="color:white;margin:0;">⚡ Capital Call</h1></div><div style="background:#f8fafc;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;"><p>Dear ${inv.firstName || inv.email},</p><p>A capital call of <strong style="color:#f59e0b;font-size:1.25rem;">$${Number(recipient?.amount || call.amount || 0).toLocaleString()}</strong> has been issued for <strong>${deal.name}</strong>.</p><p>Due: <strong>${call.dueDate || 'Contact your GP'}</strong></p>${call.wireInstructions ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-top:16px;"><strong>Wire Instructions</strong><p style="white-space:pre-line;font-size:.875rem;">${call.wireInstructions}</p></div>` : ''}</div></div>`,
      }).catch(e => console.error('Cap call email error:', e.message));
    }
    return null;
  });

// ── Firestore trigger: auto-email on distribution ────────────────────────────
exports.onDistributionCreated = functions.firestore
  .document('orgs/{orgId}/distributions/{distId}')
  .onCreate(async (snap, context) => {
    const dist = snap.data();
    const orgId = context.params.orgId;
    const transporter = await getTransporter();
    for (const recipient of (dist.recipients || [])) {
      const inv = (await admin.firestore().collection('orgs').doc(orgId).collection('investors').doc(recipient.investorId).get()).data();
      if (!inv || !inv.email) continue;
      await transporter.sendMail({
        from: '"deeltrack" <admin@deeltrack.com>', to: inv.email,
        subject: `💰 Distribution — ${dist.dealName} | ${dist.period || ''}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><div style="background:#10b981;padding:24px;border-radius:8px 8px 0 0;text-align:center;"><h1 style="color:white;margin:0;">💰 Distribution Notice</h1></div><div style="background:#f8fafc;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;"><p>Dear ${inv.firstName || inv.email},</p><p>A distribution of <strong style="color:#10b981;font-size:1.5rem;">$${Number(recipient.amount || 0).toLocaleString()}</strong> has been issued for <strong>${dist.dealName}</strong>.</p><p style="color:#64748b;">Period: ${dist.period || '—'} · Date: ${dist.date || 'Today'}</p><p>Funds will be processed within 3–5 business days via ${dist.paymentMethod || 'wire transfer'}.</p></div></div>`,
      }).catch(e => console.error('Distribution email error:', e.message));
    }
    return null;
  });
