/**
 * sp-esign.js — E-Signature Module for deeltrack
 * 
 * Two modes:
 * 1. Built-in: Generates a signing link to sign.html with a Firestore-backed signing request.
 *    No external API needed. Investor signs in-app.
 * 2. Firma.dev: Creates signing requests via Firma API (when configured).
 *    Falls back to built-in if Firma isn't set up.
 *
 * Flow:
 *   GP clicks "Send for Signature" on deal-detail →
 *   System generates custom sub doc HTML from SPDocs →
 *   Creates a signing request in Firestore (esign_requests collection) →
 *   Emails signing link to investor (via sp-email or Cloud Function) →
 *   Investor clicks link → sign.html loads the request + sub doc →
 *   Investor signs → status updated to "signed" → GP notified
 */

const SPEsign = (() => {
  const FIRMA_BASE = 'https://api.firma.dev/functions/v1/signing-request-api';
  let _firmaKey = null;
  let _firmaEnabled = false;

  // ─── INIT ──────────────────────────────────────────────────────────────
  async function init() {
    try {
      const db = firebase.firestore();
      const doc = await db.collection('_config').doc('esign').get();
      if (doc.exists && doc.data().firmaApiKey) {
        _firmaKey = doc.data().firmaApiKey;
        _firmaEnabled = true;
        console.log('SPEsign: Firma.dev configured');
      }
    } catch(e) {
      // _config not accessible from client — that's fine, use built-in
    }
    if (!_firmaEnabled) console.log('SPEsign: Using built-in signing flow');
  }

  // ─── GENERATE SUB DOC HTML ─────────────────────────────────────────────
  function generateSubDocHTML(deal, investor, settings) {
    const gpName = settings?.firmName || deal.companyName || '[GP NAME]';
    const gpRep = settings?.gpFullName || 'Managing Member';

    if (typeof SPDocs !== 'undefined' && SPDocs.generateSubDoc) {
      return SPDocs.generateSubDoc(deal, investor, gpName, gpRep);
    }

    // Fallback: basic sub doc if SPDocs not loaded
    const name = `${investor.firstName || ''} ${investor.lastName || ''}`.trim() || '[INVESTOR]';
    return `<div style="font-family: 'Times New Roman', serif; padding: 40px;">
      <h1>SUBSCRIPTION AGREEMENT</h1>
      <p>${deal.companyName || deal.name || '[COMPANY]'}</p>
      <p>Subscriber: ${name}</p>
      <p>Amount: $${(investor.committed || 0).toLocaleString()}</p>
      <p>This is a placeholder. The full subscription agreement will be generated when sp-documents.js is loaded.</p>
    </div>`;
  }

  // ─── CREATE SIGNING REQUEST (BUILT-IN) ─────────────────────────────────
  async function createSigningRequest(deal, investor, settings) {
    const db = firebase.firestore();
    const session = (typeof SP !== 'undefined') ? SP.getSession() : {};
    const orgId = session?.orgId || 'default';
    const gpName = settings?.firmName || deal.companyName || '';
    const gpRep = settings?.gpFullName || session?.name || '';
    const invName = `${investor.firstName || ''} ${investor.lastName || ''}`.trim();

    // Do NOT store the full sub doc HTML in Firestore — it contains PII.
    // sign.html will regenerate it on the fly from deal + investor data.

    // Create the request in Firestore (PII-minimal)
    const requestData = {
      orgId,
      dealId: deal.id,
      dealName: deal.name || '',
      investorId: investor.id,
      investorName: invName,
      investorEmail: investor.email || '',
      investorCommitted: investor.committed || investor._committed || 0,
      gpName,
      gpRep,
      docType: 'subscription_agreement',
      // Include wire instructions so investor can see them after signing
      // (investor can't read settings collection directly)
      wireInstructions: settings?.wireBankName ? {
        bankName: settings.wireBankName || '',
        routing: settings.wireRouting || '',
        acctNum: settings.wireAcctNum || '',
        acctName: settings.wireAcctName || '',
        reference: settings.wireReference || '',
        swift: settings.wireSwift || '',
        memo: settings.wireMemo || '',
      } : null,
      status: 'pending', // pending → sent → viewed → signed → countersigned
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: session?.uid || '',
      sentAt: null,
      viewedAt: null,
      signedAt: null,
      signedName: null,
      signedIP: null,
      countersignedAt: null,
    };

    const ref = await db.collection('esign_requests').add(requestData);
    const requestId = ref.id;

    // Generate the signing URL
    const baseUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    const signingUrl = `${baseUrl}sign.html?req=${requestId}`;

    // Update with the signing URL
    await ref.update({ signingUrl, status: 'sent', sentAt: firebase.firestore.FieldValue.serverTimestamp() });

    // Send email notification to investor
    await sendSigningEmail(deal, investor, signingUrl, gpName, gpRep);

    // Log activity
    if (typeof SP !== 'undefined' && SP.logActivity) {
      SP.logActivity('fa-pen-nib', 'purple',
        `E-sign request sent to <strong>${invName}</strong> for <strong>${deal.name}</strong>`);
    }

    return { success: true, requestId, signingUrl, sentTo: investor.email };
  }

  // ─── SEND SIGNING EMAIL ────────────────────────────────────────────────
  async function sendSigningEmail(deal, investor, signingUrl, gpName, gpRep) {
    const invName = `${investor.firstName || ''} ${investor.lastName || ''}`.trim();
    const amount = '$' + Number(investor.committed || investor._committed || 0).toLocaleString();
    
    // Try Cloud Function email
    if (typeof firebase !== 'undefined' && firebase.functions) {
      try {
        const sendEmail = firebase.functions().httpsCallable('sendEmail');
        await sendEmail({
          to: investor.email,
          subject: `Subscription Agreement — ${deal.name || 'Investment'} — Action Required`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1B1A19;">Subscription Agreement Ready for Signature</h2>
              <p>Dear ${invName},</p>
              <p>Your subscription agreement for <strong>${deal.name}</strong> is ready for your review and electronic signature.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Investment</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${deal.name}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Amount</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${amount}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Managing Member</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${gpName}</td></tr>
              </table>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${signingUrl}" style="display: inline-block; padding: 14px 40px; background: #F37925; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Review &amp; Sign</a>
              </div>
              <p style="font-size: 13px; color: #999;">This link is unique to you. Please do not forward it. If you have questions, contact ${gpRep} at ${gpName}.</p>
            </div>
          `
        });
        return true;
      } catch(e) {
        console.warn('SPEsign: Cloud Function email failed, investor will need direct link', e);
      }
    }
    return false;
  }

  // ─── FIRMA.DEV FLOW ────────────────────────────────────────────────────
  async function createViaFirma(deal, investor, settings) {
    const gpName = settings?.firmName || deal.companyName || '';
    const invName = `${investor.firstName || ''} ${investor.lastName || ''}`.trim();
    const payload = {
      name: `Subscription Agreement - ${invName} - ${deal.name}`,
      recipients: [{
        first_name: investor.firstName,
        last_name: investor.lastName,
        email: investor.email,
        role: 'signer'
      }]
    };

    // Try Cloud Function proxy first
    if (typeof firebase !== 'undefined' && firebase.functions) {
      try {
        const fn = firebase.functions().httpsCallable('createSigningRequest');
        const res = await fn(payload);
        if (res.data && !res.data.error) return { success: true, firmaId: res.data.id, sentTo: investor.email };
      } catch(e) {
        console.warn('SPEsign: Firma Cloud Function failed, falling back to built-in');
      }
    }

    // Fall back to built-in
    return createSigningRequest(deal, investor, settings);
  }

  // ─── MAIN SEND METHOD ─────────────────────────────────────────────────
  async function sendForSignature(dealId, investorId) {
    const deal = (typeof SP !== 'undefined') ? SP.getDeals().find(d => d.id === dealId) : null;
    const investorBase = (typeof SP !== 'undefined') ? SP.getInvestorById(investorId) : null;
    const settings = (typeof SP !== 'undefined') ? SP.load('settings', {}) : {};

    if (!deal) return { success: false, error: 'Deal not found' };
    if (!investorBase) return { success: false, error: 'Investor not found' };
    if (!investorBase.email) return { success: false, error: 'Investor has no email address' };

    // Merge deal-specific commitment data (committed amount, ownership %)
    // The committed amount lives on deal.investors[], not the investor record
    const dealEntry = (deal.investors || []).find(e => e.investorId === investorId) || {};
    const investor = {
      ...investorBase,
      committed: dealEntry.committed || investorBase.committed || 0,
      _committed: dealEntry.committed || 0,
      _ownership: dealEntry.ownership || 0,
    };

    try {
      if (_firmaEnabled) {
        return await createViaFirma(deal, investor, settings);
      }
      return await createSigningRequest(deal, investor, settings);
    } catch(e) {
      console.error('SPEsign error:', e);
      return { success: false, error: e.message };
    }
  }

  // ─── LOAD SIGNING REQUEST (for sign.html) ──────────────────────────────
  async function loadRequest(requestId) {
    try {
      const db = firebase.firestore();
      const doc = await db.collection('esign_requests').doc(requestId).get();
      if (!doc.exists) return null;

      const data = doc.data();

      // Mark as viewed if first time
      if (data.status === 'sent') {
        await db.collection('esign_requests').doc(requestId).update({
          status: 'viewed',
          viewedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        data.status = 'viewed';
      }

      return { id: requestId, ...data };
    } catch(e) {
      console.error('SPEsign loadRequest error:', e);
      return null;
    }
  }

  // ─── SUBMIT SIGNATURE (from sign.html) ─────────────────────────────────
  async function submitSignature(requestId, signedName) {
    try {
      const db = firebase.firestore();
      await db.collection('esign_requests').doc(requestId).update({
        status: 'signed',
        signedAt: firebase.firestore.FieldValue.serverTimestamp(),
        signedName,
        signedIP: '', // Could fetch from API, but privacy-sensitive
      });

      // Store a copy in the deal's document collection for GP access
      const reqDoc = await db.collection('esign_requests').doc(requestId).get();
      const reqData = reqDoc.data();

      // Save signed record to deal documents
      if (reqData?.dealId && reqData?.orgId) {
        await db.collection('orgs').doc(reqData.orgId).collection('documents').add({
          dealId: reqData.dealId,
          investorId: reqData.investorId,
          investorName: reqData.investorName,
          type: 'signed_subscription_agreement',
          signedAt: firebase.firestore.FieldValue.serverTimestamp(),
          signedName,
          esignRequestId: requestId,
        });
      }

      return { success: true };
    } catch(e) {
      console.error('SPEsign submitSignature error:', e);
      return { success: false, error: e.message };
    }
  }

  // ─── GP COUNTERSIGN ────────────────────────────────────────────────────
  async function countersign(requestId) {
    try {
      const db = firebase.firestore();
      const session = (typeof SP !== 'undefined') ? SP.getSession() : {};
      await db.collection('esign_requests').doc(requestId).update({
        status: 'countersigned',
        countersignedAt: firebase.firestore.FieldValue.serverTimestamp(),
        countersignedBy: session?.name || session?.uid || '',
      });
      return { success: true };
    } catch(e) {
      return { success: false, error: e.message };
    }
  }

  // ─── GET REQUESTS FOR A DEAL ───────────────────────────────────────────
  async function getRequestsForDeal(dealId) {
    try {
      const db = firebase.firestore();
      const session = (typeof SP !== 'undefined') ? SP.getSession() : {};
      const orgId = session?.orgId || 'default';
      const snap = await db.collection('esign_requests')
        .where('orgId', '==', orgId)
        .where('dealId', '==', dealId)
        .orderBy('createdAt', 'desc')
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
      console.error('SPEsign getRequestsForDeal error:', e);
      return [];
    }
  }

  // ─── GET REQUEST FOR SPECIFIC INVESTOR ─────────────────────────────────
  async function getRequestForInvestor(dealId, investorId) {
    try {
      const db = firebase.firestore();
      const session = (typeof SP !== 'undefined') ? SP.getSession() : {};
      const orgId = session?.orgId || 'default';
      const snap = await db.collection('esign_requests')
        .where('orgId', '==', orgId)
        .where('dealId', '==', dealId)
        .where('investorId', '==', investorId)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      if (snap.empty) return null;
      const d = snap.docs[0];
      return { id: d.id, ...d.data() };
    } catch(e) {
      console.error('SPEsign getRequestForInvestor error:', e);
      return null;
    }
  }

  // ─── RESEND ────────────────────────────────────────────────────────────
  async function resend(requestId) {
    try {
      const db = firebase.firestore();
      const doc = await db.collection('esign_requests').doc(requestId).get();
      if (!doc.exists) return { success: false, error: 'Request not found' };
      const data = doc.data();
      const deal = { name: data.dealName, id: data.dealId };
      const investor = { firstName: data.investorName.split(' ')[0], lastName: data.investorName.split(' ').slice(1).join(' '), email: data.investorEmail };
      await sendSigningEmail(deal, investor, data.signingUrl, data.gpName, data.gpRep);
      await db.collection('esign_requests').doc(requestId).update({ resentAt: firebase.firestore.FieldValue.serverTimestamp() });
      return { success: true };
    } catch(e) {
      return { success: false, error: e.message };
    }
  }

  return {
    init,
    sendForSignature,
    loadRequest,
    submitSignature,
    countersign,
    getRequestsForDeal,
    getRequestForInvestor,
    resend,
    generateSubDocHTML,
  };
})();

// Auto-init
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => SPEsign.init());
}
