/**
 * sp-esign.js — Digital Signature Integration Handler
 * Bridges deeltrack documents with external e-sign providers (DocuSign/Dropbox Sign).
 */

const SPEsign = (() => {
  const _config = {
    provider: 'dropbox_sign', // placeholder for logic selection
    apiKey: '', // stored in Firestore _config/esign
  };

  async function sendForSignature(dealId, investorId, docType) {
    if (typeof SPData === 'undefined' || !SPData.isReady()) return { success: false, error: 'System not ready' };
    
    const deal = SP.getDealById(dealId);
    const investor = SP.getInvestorById(investorId);
    
    if (!deal || !investor) return { success: false, error: 'Identity verification failed' };

    // 1. Log the initiation in Audit Trail
    if (typeof SPAudit !== 'undefined') {
      SPAudit.log('esign_request', docType, dealId, deal.name, { investorEmail: investor.email });
    }

    // 2. Mock API call (simulate Dropbox Sign / HelloSign API)
    // In production, this calls a Firebase Cloud Function to protect the API Secret
    console.log(`[ESIGN] Initiating ${docType} for ${investor.email} on deal ${deal.name}`);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        // Update subStatus to 'sent' automatically
        if (docType === 'subscription_agreement') {
          const deals = SP.getDeals();
          const dIdx = deals.findIndex(d => d.id === dealId);
          const iIdx = deals[dIdx].investors.findIndex(i => i.investorId === investorId);
          if (iIdx >= 0) {
            deals[dIdx].investors[iIdx].subStatus = 'sent';
            deals[dIdx].investors[iIdx].esignEnvelopId = 'env_' + Math.random().toString(36).slice(2, 10);
            SP.saveDeals(deals);
          }
        }
        resolve({ success: true, envelopeId: 'env_mock_123', status: 'sent' });
      }, 1200);
    });
  }

  function getStatusBadge(status) {
    const map = {
      'sent': { bg: '#dbeafe', clr: '#2563eb', lbl: 'Sent for Sign' },
      'viewed': { bg: '#fef3c7', clr: '#d97706', lbl: 'Viewed by LP' },
      'signed': { bg: '#f3e8ff', clr: '#9333ea', lbl: 'Digitally Signed' },
      'declined': { bg: '#fee2e2', clr: '#dc2626', lbl: 'Sign Declined' }
    };
    return map[status] || { bg: '#f1f5f9', clr: '#64748b', lbl: status };
  }

  return { sendForSignature, getStatusBadge };
})();
