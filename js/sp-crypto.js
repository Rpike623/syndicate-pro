/**
 * sp-crypto.js — Field-level encryption for sensitive investor data
 *
 * Uses AES-GCM (Web Crypto API) with a per-org key stored in Firestore.
 * Protects SSN/EIN, routing numbers, and account numbers at rest.
 *
 * Encrypted values are stored as "enc:<base64>" so we can detect them.
 * Unencrypted legacy values are auto-encrypted on next save.
 */

const SPCrypto = (() => {
  'use strict';

  let _key = null;       // CryptoKey object
  let _ready = false;
  let _orgId = null;
  let _db = null;

  // Sensitive field names that get encrypted
  const SENSITIVE_FIELDS = ['tin', 'routing', 'acctNum'];
  const PREFIX = 'enc:';

  // ── Init: load or generate per-org encryption key ───────────────────────
  async function init(db, orgId) {
    if (_ready && _orgId === orgId) return;
    _db = db;
    _orgId = orgId;

    try {
      const orgRef = db.collection('orgs').doc(orgId);
      const orgDoc = await orgRef.get();
      let rawKey = orgDoc.exists ? orgDoc.data()?.encryptionKey : null;

      if (!rawKey) {
        // Generate new 256-bit key and store it
        rawKey = _generateKeyString();
        await orgRef.set({ encryptionKey: rawKey }, { merge: true });
      }

      // Import as CryptoKey
      const keyBytes = _base64ToBytes(rawKey);
      _key = await crypto.subtle.importKey(
        'raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
      );
      _ready = true;
    } catch (e) {
      console.warn('SPCrypto: init failed, sensitive fields will be stored as-is:', e.message);
      _ready = false;
    }
  }

  // ── Encrypt a string value ──────────────────────────────────────────────
  async function encrypt(plaintext) {
    if (!_ready || !_key || !plaintext) return plaintext;
    if (typeof plaintext !== 'string') return plaintext;
    if (plaintext.startsWith(PREFIX)) return plaintext; // Already encrypted

    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(plaintext);
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, _key, encoded
      );
      // Store as: enc:<base64(iv + ciphertext)>
      const combined = new Uint8Array(iv.length + ciphertext.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(ciphertext), iv.length);
      return PREFIX + _bytesToBase64(combined);
    } catch (e) {
      console.warn('SPCrypto: encrypt failed:', e.message);
      return plaintext;
    }
  }

  // ── Decrypt a string value ──────────────────────────────────────────────
  async function decrypt(encrypted) {
    if (!_ready || !_key || !encrypted) return encrypted;
    if (typeof encrypted !== 'string') return encrypted;
    if (!encrypted.startsWith(PREFIX)) return encrypted; // Not encrypted (legacy plaintext)

    try {
      const combined = _base64ToBytes(encrypted.slice(PREFIX.length));
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv }, _key, ciphertext
      );
      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.warn('SPCrypto: decrypt failed:', e.message);
      return '••••••••'; // Show masked value if decryption fails
    }
  }

  // ── Encrypt sensitive fields on an investor object before save ──────────
  async function encryptInvestor(inv) {
    if (!_ready || !inv) return inv;
    const copy = { ...inv };
    for (const field of SENSITIVE_FIELDS) {
      if (copy[field] && typeof copy[field] === 'string' && !copy[field].startsWith(PREFIX)) {
        copy[field] = await encrypt(copy[field]);
      }
    }
    return copy;
  }

  // ── Decrypt sensitive fields on an investor object for display ──────────
  async function decryptInvestor(inv) {
    if (!_ready || !inv) return inv;
    const copy = { ...inv };
    for (const field of SENSITIVE_FIELDS) {
      if (copy[field] && typeof copy[field] === 'string' && copy[field].startsWith(PREFIX)) {
        copy[field] = await decrypt(copy[field]);
      }
    }
    return copy;
  }

  // ── Batch encrypt/decrypt arrays ────────────────────────────────────────
  async function encryptInvestors(investors) {
    if (!_ready || !investors) return investors;
    return Promise.all(investors.map(inv => encryptInvestor(inv)));
  }

  async function decryptInvestors(investors) {
    if (!_ready || !investors) return investors;
    return Promise.all(investors.map(inv => decryptInvestor(inv)));
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  function _generateKeyString() {
    const bytes = crypto.getRandomValues(new Uint8Array(32)); // 256-bit
    return _bytesToBase64(bytes);
  }

  function _bytesToBase64(bytes) {
    const bin = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
    return btoa(bin);
  }

  function _base64ToBytes(b64) {
    const bin = atob(b64);
    return new Uint8Array(bin.split('').map(c => c.charCodeAt(0)));
  }

  function isEncrypted(value) {
    return typeof value === 'string' && value.startsWith(PREFIX);
  }

  function isReady() { return _ready; }

  function getSensitiveFields() { return [...SENSITIVE_FIELDS]; }

  return {
    init, isReady, encrypt, decrypt,
    encryptInvestor, decryptInvestor,
    encryptInvestors, decryptInvestors,
    isEncrypted, getSensitiveFields,
  };
})();
