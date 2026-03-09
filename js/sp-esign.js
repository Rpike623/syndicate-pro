/**
 * sp-esign.js — Firma.dev E-Signature Integration for deeltrack
 * 
 * Creates signing requests for subscription agreements via Firma.dev API.
 * API key is stored in Firestore _config collection (server-side only for Cloud Functions).
 * Client-side uses a Cloud Function proxy to avoid exposing the API key.
 * 
 * For demo/development: calls Firma API directly (key in memory, not in source).
 */

const SPEsign = (() => {
  const FIRMA_BASE = 'https://api.firma.dev/functions/v1/signing-request-api';
  const TEMPLATE_ID = '931599a9-1116-42a4-bbac-f0168add67e1'; // Subscription Agreement
  
  let _firmaKey = null;

  // Load API key from Firestore _config (production) or fallback
  async function init() {
    if (_firmaKey) return;
    try {
      const db = firebase.firestore();
      const doc = await db.collection('_config').doc('esign').get();
      if (doc.exists) _firmaKey = doc.data().firmaApiKey;
    } catch(e) {
      // _config not accessible from client (rules block it) — use Cloud Function
      console.log('SPEsign: will use Cloud Function proxy for signing requests');
    }
  }

  /**
   * Create a signing request for a subscription agreement
   * @param {Object} deal - Deal object
   * @param {Object} investor - Investor object {firstName, lastName, email, committed, ownership}
   * @param {Object} gpInfo - GP info {name, email}
   * @returns {Object} signing request result
   */
  async function createSubscriptionAgreement(deal, investor, gpInfo) {
    const name = `Subscription Agreement - ${investor.firstName} ${investor.lastName} - ${deal.name}`;
    
    const payload = {
      template_id: TEMPLATE_ID,
      name,
      recipients: [
        {
          first_name: investor.firstName,
          last_name: investor.lastName,
          email: investor.email,
          role: 'signer'
        }
      ]
    };

    try {
      let result;
      
      // Try Cloud Function first (production path)
      if (typeof firebase !== 'undefined' && firebase.functions) {
        try {
          const fn = firebase.functions().httpsCallable('createSigningRequest');
          const res = await fn(payload);
          result = res.data;
        } catch(fnErr) {
          console.warn('SPEsign: Cloud Function not available, trying direct API');
        }
      }
      
      // Direct API fallback (dev/demo)
      if (!result && _firmaKey) {
        const res = await fetch(FIRMA_BASE + '/signing-requests', {
          method: 'POST',
          headers: {
            'Authorization': _firmaKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        result = await res.json();
      }

      if (!result) throw new Error('No signing method available. Deploy Cloud Function or configure API key.');

      if (result.error) throw new Error(result.error);

      // Send the signing request
      if (result.id) {
        const sendRes = await fetch(FIRMA_BASE + '/signing-requests/' + result.id + '/send', {
          method: 'POST',
          headers: { 'Authorization': _firmaKey, 'Content-Type': 'application/json' }
        });
        const sendData = await sendRes.json();
        result.sent = sendData.success;
      }

      // Store in Firestore for tracking
      if (typeof SP !== 'undefined' && SP.save) {
        const esignLog = SP.load('esign_requests', []);
        esignLog.unshift({
          id: result.id,
          dealId: deal.id,
          dealName: deal.name,
          investorId: investor.id,
          investorName: `${investor.firstName} ${investor.lastName}`,
          investorEmail: investor.email,
          type: 'subscription_agreement',
          status: 'sent',
          sentAt: new Date().toISOString(),
          firmaId: result.id,
        });
        SP.save('esign_requests', esignLog);
      }

      return { success: true, signingRequestId: result.id, sentTo: investor.email };
    } catch(e) {
      console.error('SPEsign error:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * Check status of a signing request
   */
  async function checkStatus(signingRequestId) {
    if (!_firmaKey) return { error: 'No API key' };
    try {
      const res = await fetch(FIRMA_BASE + '/signing-requests/' + signingRequestId, {
        headers: { 'Authorization': _firmaKey }
      });
      const data = await res.json();
      return {
        id: data.id,
        status: data.status,
        sent: data.timestamps?.sent_on,
        finished: data.timestamps?.finished_on,
        downloadUrl: data.final_document_download_url,
      };
    } catch(e) {
      return { error: e.message };
    }
  }

  /**
   * Get all signing requests for a deal
   */
  function getRequestsForDeal(dealId) {
    const all = SP.load('esign_requests', []);
    return all.filter(r => r.dealId === dealId);
  }

  /**
   * Check if an investor has a pending or completed signing request
   */
  function getRequestForInvestor(dealId, investorId) {
    const all = SP.load('esign_requests', []);
    return all.find(r => r.dealId === dealId && r.investorId === investorId);
  }

  return { init, createSubscriptionAgreement, checkStatus, getRequestsForDeal, getRequestForInvestor };
})();

// Auto-init when loaded
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => SPEsign.init());
}
