/**
 * sp-crypto.js — Field-level encryption for sensitive investor data
 *
 * v2.0: KMS-backed encryption via Cloud Functions
 * - DEK (Data Encryption Key) per org, encrypted by Cloud KMS
 * - All encrypt/decrypt operations go through Cloud Functions
 * - Keys never exposed to client in plaintext
 * - Audit logging on every key access
 * - Backward compatible with legacy enc: prefix format
 */

const SPCrypto = (() => {
  'use strict';

  let _ready = false;
  let _orgId = null;
  let _encryptedDek = null; // KMS-encrypted DEK (base64)
  let _hasKMS = false;

  // Sensitive field names that get encrypted
  const SENSITIVE_FIELDS = ['tin', 'routing', 'acctNum'];
  const PREFIX = 'enc:';     // legacy format
  const PREFIX_V2 = 'enc2:'; // KMS-backed format

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init(firebaseApp, orgId) {
    if (_ready && _orgId === orgId) return;
    _orgId = orgId;

    try {
      // Wait briefly for Firebase Functions SDK if not yet loaded
      if (typeof firebase === 'undefined' || !firebase.functions) {
        await new Promise(r => {
          let attempts = 0;
          const check = setInterval(() => {
            attempts++;
            if ((typeof firebase !== 'undefined' && firebase.functions) || attempts >= 20) {
              clearInterval(check);
              r();
            }
          }, 150);
        });
      }
      if (typeof firebase === 'undefined' || !firebase.functions) {
        console.warn('SPCrypto: Firebase Functions not available — encryption disabled');
        return;
      }

      const getOrgKey = firebase.functions().httpsCallable('getOrgKey');
      const result = await getOrgKey({ orgId });
      _encryptedDek = result.data; // base64-encoded KMS-encrypted DEK
      _hasKMS = true;
      _ready = true;
      console.log('SPCrypto: KMS-backed encryption ready');
    } catch (e) {
      console.warn('SPCrypto: KMS init failed, encryption disabled:', e.message);
      _hasKMS = false;
      _ready = false;
    }
  }

  // ── Encrypt via Cloud Function ────────────────────────────────────────────
  async function encrypt(plaintext) {
    if (!_ready || !_hasKMS || !plaintext) return plaintext;
    if (typeof plaintext !== 'string') return plaintext;
    if (plaintext.startsWith(PREFIX) || plaintext.startsWith(PREFIX_V2)) return plaintext;

    try {
      const encryptFn = firebase.functions().httpsCallable('encryptData');
      const result = await encryptFn({
        orgId: _orgId,
        plaintext,
        encryptedDek: _encryptedDek,
      });

      // Combine iv + ciphertext + authTag into single base64 string
      const iv = _b64ToBytes(result.data.iv);
      const ct = _b64ToBytes(result.data.ciphertext);
      const tag = _b64ToBytes(result.data.authTag);

      const combined = new Uint8Array(iv.length + ct.length + tag.length);
      combined.set(iv, 0);
      combined.set(ct, iv.length);
      combined.set(tag, iv.length + ct.length);

      return PREFIX_V2 + _bytesToB64(combined);
    } catch (e) {
      console.warn('SPCrypto: encrypt failed:', e.message);
      return plaintext;
    }
  }

  // ── Decrypt via Cloud Function ────────────────────────────────────────────
  async function decrypt(encrypted) {
    if (!_ready || !_hasKMS || !encrypted) return encrypted;
    if (typeof encrypted !== 'string') return encrypted;

    // Handle v2 format (KMS-backed)
    if (encrypted.startsWith(PREFIX_V2)) {
      try {
        const combined = _b64ToBytes(encrypted.slice(PREFIX_V2.length));
        const iv = combined.slice(0, 12);
        const tag = combined.slice(-16);
        const ct = combined.slice(12, combined.length - 16);

        const decryptFn = firebase.functions().httpsCallable('decryptData');
        const result = await decryptFn({
          orgId: _orgId,
          iv: _bytesToB64(iv),
          ciphertext: _bytesToB64(ct),
          authTag: _bytesToB64(tag),
          encryptedDek: _encryptedDek,
        });

        return result.data;
      } catch (e) {
        console.warn('SPCrypto: decrypt v2 failed:', e.message);
        return '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';
      }
    }

    // Handle legacy v1 format (old local key — read-only, will re-encrypt on save)
    if (encrypted.startsWith(PREFIX)) {
      // Can't decrypt legacy without old key — mask it
      console.warn('SPCrypto: legacy enc: value found — will re-encrypt on next save');
      return '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';
    }

    return encrypted; // plaintext passthrough
  }

  // ── Encrypt sensitive fields on investor object ───────────────────────────
  async function encryptInvestor(inv) {
    if (!_ready || !inv) return inv;
    const copy = { ...inv };
    for (const field of SENSITIVE_FIELDS) {
      if (copy[field] && typeof copy[field] === 'string'
          && !copy[field].startsWith(PREFIX) && !copy[field].startsWith(PREFIX_V2)) {
        copy[field] = await encrypt(copy[field]);
      }
    }
    return copy;
  }

  // ── Decrypt sensitive fields on investor object ───────────────────────────
  async function decryptInvestor(inv) {
    if (!_ready || !inv) return inv;
    const copy = { ...inv };
    for (const field of SENSITIVE_FIELDS) {
      if (copy[field] && typeof copy[field] === 'string'
          && (copy[field].startsWith(PREFIX) || copy[field].startsWith(PREFIX_V2))) {
        copy[field] = await decrypt(copy[field]);
      }
    }
    return copy;
  }

  // ── Batch ─────────────────────────────────────────────────────────────────
  async function encryptInvestors(investors) {
    if (!_ready || !investors) return investors;
    return Promise.all(investors.map(inv => encryptInvestor(inv)));
  }

  async function decryptInvestors(investors) {
    if (!_ready || !investors) return investors;
    return Promise.all(investors.map(inv => decryptInvestor(inv)));
  }

  // ── Helpers (browser-safe, no Buffer) ─────────────────────────────────────
  function _bytesToB64(bytes) {
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let bin = '';
    for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    return btoa(bin);
  }

  function _b64ToBytes(b64) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  function isEncrypted(value) {
    return typeof value === 'string' && (value.startsWith(PREFIX) || value.startsWith(PREFIX_V2));
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
