/**
 * migrate-keys.js — One-time migration of legacy encryption keys to KMS
 *
 * Run from Cloud Shell:
 *   cd functions && npm install && node migrate-keys.js
 *
 * What it does:
 * 1. Reads all orgs with plaintext encryptionKey
 * 2. Encrypts each DEK with Cloud KMS
 * 3. Stores encrypted DEK as encryptedDek field
 * 4. Removes plaintext encryptionKey field
 * 5. Logs everything to auditLogs collection
 */

const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();

const projectId = 'deeltrack';
const locationId = 'global';
const keyRingId = 'deeltrack-keys';
const keyId = 'org-master-key';

async function encryptWithKMS(plaintext) {
  const { KeyManagementServiceClient } = require('@google-cloud/kms');
  const client = new KeyManagementServiceClient();
  const name = client.cryptoKeyPath(projectId, locationId, keyRingId, keyId);
  
  const [result] = await client.encrypt({
    name,
    plaintext: Buffer.from(plaintext, 'base64'),
  });
  
  return result.ciphertext;
}

async function migrate() {
  const db = admin.firestore();
  
  console.log('Starting key migration...');
  
  // Get all orgs
  const orgsSnap = await db.collection('orgs').get();
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const doc of orgsSnap.docs) {
    const data = doc.data();
    const orgId = doc.id;
    
    // Skip if already migrated
    if (data.encryptedDek) {
      console.log(`  [skip] ${orgId} — already has encryptedDek`);
      skipped++;
      continue;
    }
    
    // Skip if no legacy key
    if (!data.encryptionKey) {
      console.log(`  [skip] ${orgId} — no encryptionKey found`);
      skipped++;
      continue;
    }
    
    try {
      // Encrypt the legacy key with KMS
      const encryptedDek = await encryptWithKMS(data.encryptionKey);
      
      // Update org document
      await doc.ref.update({
        encryptedDek: encryptedDek,
        encryptionKey: admin.firestore.FieldValue.delete(), // remove plaintext key
        keyMigratedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      // Log migration
      await db.collection('auditLogs').add({
        orgId,
        action: 'key_migrated_to_kms',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userId: 'system_migration',
      });
      
      console.log(`  [OK] ${orgId} — migrated to KMS`);
      migrated++;
    } catch (e) {
      console.error(`  [ERR] ${orgId} — ${e.message}`);
      errors++;
    }
  }
  
  console.log(`\nMigration complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
  process.exit(0);
}

migrate().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
