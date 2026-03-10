const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const FIRMA_BASE = 'https://api.firma.dev/functions/v1/signing-request-api';

exports.createSigningRequest = functions.https.onCall(async (data, context) => {
  // Auth check
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  
  // Get user's org to verify they're a GP
  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User not found');
  const userData = userDoc.data();
  if (userData.role === 'Investor') throw new functions.https.HttpsError('permission-denied', 'Only GPs can send signing requests');
  
  // Get Firma API key from _config
  const configDoc = await db.collection('_config').doc('esign').get();
  if (!configDoc.exists) throw new functions.https.HttpsError('failed-precondition', 'E-sign not configured');
  const firmaKey = configDoc.data().firmaApiKey;
  const templateId = configDoc.data().templateId;
  
  // Create signing request
  const payload = {
    template_id: data.template_id || templateId,
    name: data.name || 'Subscription Agreement',
    recipients: data.recipients || []
  };
  
  const createRes = await fetch(FIRMA_BASE + '/signing-requests', {
    method: 'POST',
    headers: { 'Authorization': firmaKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await createRes.json();
  
  if (result.error) throw new functions.https.HttpsError('internal', result.error);
  
  // Send the signing request
  if (result.id) {
    await fetch(FIRMA_BASE + '/signing-requests/' + result.id + '/send', {
      method: 'POST',
      headers: { 'Authorization': firmaKey, 'Content-Type': 'application/json' }
    });
  }
  
  // Log to Firestore
  await db.collection('orgs').doc(userData.orgId).collection('esign_log').add({
    signingRequestId: result.id,
    dealId: data.dealId || null,
    investorEmail: data.recipients?.[0]?.email || null,
    type: 'subscription_agreement',
    status: 'sent',
    sentBy: context.auth.uid,
    sentAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return { id: result.id, sent: true };
});
