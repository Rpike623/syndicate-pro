// Cloud Functions for deeltrack — Secure Key Management
// Deploys: firebase deploy --only functions

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

admin.initializeApp();

// Project and location where the keyring is located
const projectId = 'deeltrack';
const locationId = 'global';
const keyRingId = 'deeltrack-keys';
const keyId = 'org-master-key';

// Generate a new DEK (Data Encryption Key)
async function generateDEK() {
  return crypto.randomBytes(32); // 256-bit key
}

// Encrypt DEK using Cloud KMS
async function encryptDEK(dek) {
  const { KMSServiceClient } = require('@google-cloud/kms');
  const client = new KMSServiceClient();
  
  const name = client.keyName(projectId, locationId, keyRingId, keyId);
  const [response] = await client.encrypt({
    name,
    plaintext: dek,
  });
  
  return response.ciphertext;
}

// Decrypt DEK using Cloud KMS
async function decryptDEK(encryptedDek) {
  const { KMSServiceClient } = require('@google-cloud/kms');
  const client = new KMSServiceClient();
  
  const name = client.keyName(projectId, locationId, keyRingId, keyId);
  const [response] = await client.decrypt({
    name,
    ciphertext: encryptedDek,
  });
  
  return response.plaintext;
}

// Get or create org encryption key
exports.getOrgKey = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { orgId } = data;
  const db = admin.firestore();

  // Get org document
  const orgRef = db.collection('orgs').doc(orgId);
  const orgDoc = await orgRef.get();

  // Check if user has access to this org
  const userRef = db.collection('users').doc(context.auth.uid);
  const userDoc = await userRef.get();
  if (!userDoc.exists || userDoc.data().orgId !== orgId) {
    throw new functions.https.HttpsError('permission-denied', 'User does not have access to this org');
  }

  // Check if org has an encrypted key
  let encryptedDek = orgDoc.exists ? orgDoc.data().encryptedDek : null;

  if (!encryptedDek) {
    // Generate new DEK and encrypt it
    const dek = await generateDEK();
    encryptedDek = await encryptDEK(dek);
    
    // Store encrypted DEK
    await orgRef.set({ encryptedDek, createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }

  // Log key access
  await logKeyAccess(orgId, context.auth.uid, 'key_retrieved');

  // Return base64 encoded encrypted DEK for client-side use
  return encryptedDek.toString('base64');
});

// Encrypt data with DEK (client provides encrypted DEK)
exports.encryptData = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { orgId, plaintext, encryptedDek } = data;
  
  // Decrypt DEK
  const dek = await decryptDEK(Buffer.from(encryptedDek, 'base64'));
  
  // Encrypt with AES-GCM
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  // Log encryption
  await logKeyAccess(orgId, context.auth.uid, 'data_encrypted');
  
  // Return encrypted data with IV and auth tag
  return {
    iv: iv.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    authTag: authTag.toString('base64'),
  };
});

// Decrypt data with DEK (client provides encrypted DEK)
exports.decryptData = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { orgId, iv, ciphertext, authTag, encryptedDek } = data;
  
  // Decrypt DEK
  const dek = await decryptDEK(Buffer.from(encryptedDek, 'base64'));
  
  // Decrypt
  const decipher = crypto.createDecipheriv('aes-256-gcm', dek, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]);
  
  // Log decryption
  await logKeyAccess(orgId, context.auth.uid, 'data_decrypted');
  
  return decrypted.toString('utf8');
});

// Audit log for key access
async function logKeyAccess(orgId, userId, action) {
  const db = admin.firestore();
  const auditRef = db.collection('auditLogs').doc();
  await auditRef.set({
    orgId,
    userId,
    action,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    ip: (context?.request?.ip || null),
  });
}

// Key rotation
exports.rotateKey = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { orgId } = data;
  const db = admin.firestore();
  
  // Verify user is admin
  const userRef = db.collection('users').doc(context.auth.uid);
  const userDoc = await userRef.get();
  if (!userDoc.exists || userDoc.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can rotate keys');
  }

  // Generate new DEK
  const newDek = await generateDEK();
  const encryptedNewDek = await encryptDEK(newDek);
  
  // Update org with new key
  const orgRef = db.collection('orgs').doc(orgId);
  await orgRef.update({ encryptedDek: encryptedNewDek, keyRotatedAt: admin.firestore.FieldValue.serverTimestamp() });
  
  // Log rotation
  await logKeyAccess(orgId, context.auth.uid, 'key_rotated');
  
  return { success: true };
});

// Get key rotation status
exports.getKeyStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { orgId } = data;
  const db = admin.firestore();
  const orgRef = db.collection('orgs').doc(orgId);
  const orgDoc = await orgRef.get();
  
  if (!orgDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Org not found');
  }
  
  return {
    encryptedDekExists: !!orgDoc.data().encryptedDek,
    keyRotatedAt: orgDoc.data().keyRotatedAt || null,
    createdAt: orgDoc.data().createdAt || null,
  };
});