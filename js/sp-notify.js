/**
 * sp-notify.js — Automatic LP notification triggers
 *
 * Listens for data changes and sends emails automatically:
 * - Distribution posted → email all recipients
 * - Capital call created → email investors on the deal
 * - Docs sent for signing → email investor with signing link
 * - Accreditation expiring → email warning (checked on GP dashboard load)
 * - Commitment approved → email investor confirmation
 *
 * All notifications are idempotent — tracks sent notifications to avoid duplicates.
 */

const SPNotify = (() => {
  'use strict';

  let _initialized = false;
  const _sentKey = 'sp_notifications_sent';

  function init() {
    if (_initialized) return;
    _initialized = true;

    // Listen for distribution posts
    window.addEventListener('spdata-ready', () => {
      // Only run for GP role
      const s = typeof SP !== 'undefined' ? SP.getSession() : null;
      if (!s || s.role === 'Investor') return;
      // Check for expiring accreditations on dashboard loads
      _checkAccredExpiry();
    });
  }

  function _getSentLog() {
    try { return JSON.parse(localStorage.getItem(_sentKey) || '{}'); } catch(e) { return {}; }
  }

  function _markSent(key) {
    const log = _getSentLog();
    log[key] = Date.now();
    // Prune old entries (>30 days)
    const cutoff = Date.now() - 30 * 86400000;
    Object.keys(log).forEach(k => { if (log[k] < cutoff) delete log[k]; });
    try { localStorage.setItem(_sentKey, JSON.stringify(log)); } catch(e) {}
  }

  function _wasSent(key) {
    return !!_getSentLog()[key];
  }

  // ── Distribution posted notification ────────────────────────────────────
  async function onDistributionPosted(dist) {
    if (!dist || !dist.id) return;
    const key = `dist_${dist.id}`;
    if (_wasSent(key)) return;

    if (typeof SPEmail === 'undefined' || !SPEmail.sendDistribution) {
      console.log('SPNotify: SPEmail not available, skipping dist notification');
      return;
    }

    const recipients = (dist.recipients || []).map(r => {
      const inv = typeof SP !== 'undefined' ? SP.getInvestorById(r.investorId) : null;
      return inv ? { ...inv, amount: r.amount || r.totalThisDist || 0 } : null;
    }).filter(Boolean);

    if (!recipients.length) return;

    try {
      await SPEmail.sendDistribution(dist, recipients);
      _markSent(key);
      console.log(`SPNotify: Distribution notification sent to ${recipients.length} investors`);
    } catch(e) {
      console.warn('SPNotify: Failed to send distribution notification:', e.message);
    }
  }

  // ── Capital call notification ───────────────────────────────────────────
  async function onCapitalCallCreated(call) {
    if (!call || !call.id) return;
    const key = `call_${call.id}`;
    if (_wasSent(key)) return;

    if (typeof SPEmail === 'undefined' || !SPEmail.sendCapitalCall) return;

    const deal = typeof SP !== 'undefined' ? SP.getDealById(call.dealId) : null;
    if (!deal) return;

    const investors = (deal.investors || []).map(entry => {
      const inv = typeof SP !== 'undefined' ? SP.getInvestorById(entry.investorId) : null;
      return inv ? { ...inv, committed: entry.committed, ownership: entry.ownership } : null;
    }).filter(Boolean);

    if (!investors.length) return;

    try {
      await SPEmail.sendCapitalCall(call, investors);
      _markSent(key);
      console.log(`SPNotify: Capital call notification sent to ${investors.length} investors`);
    } catch(e) {
      console.warn('SPNotify: Failed to send capital call notification:', e.message);
    }
  }

  // ── Commitment approved notification ────────────────────────────────────
  async function onCommitmentApproved(commitment) {
    if (!commitment || !commitment.id) return;
    const key = `commit_approved_${commitment.id}`;
    if (_wasSent(key)) return;

    if (typeof SPEmail === 'undefined' || !SPEmail.send) return;

    try {
      await SPEmail.send('welcome', commitment.investorEmail, {
        investorName: commitment.investorName || commitment.investorEmail,
        dealName: commitment.dealName,
        commitmentFormatted: Number(commitment.amount).toLocaleString(),
        ownershipPct: commitment.ownership || '—',
        portalUrl: `${window.location.origin}/portal.html`,
      });
      _markSent(key);
      console.log(`SPNotify: Commitment approved notification sent to ${commitment.investorEmail}`);
    } catch(e) {
      console.warn('SPNotify: Failed to send commitment notification:', e.message);
    }
  }

  // ── Sub docs / signing link notification ────────────────────────────────
  async function onDocsSent(commitment, signUrl) {
    if (!commitment || !commitment.id) return;
    const key = `docs_sent_${commitment.id}`;
    if (_wasSent(key)) return;

    if (typeof SPEmail === 'undefined' || !SPEmail.send) return;

    try {
      await SPEmail.send('docShared', commitment.investorEmail, {
        investorName: commitment.investorName || commitment.investorEmail,
        dealName: commitment.dealName,
        docName: 'Subscription Agreement',
        docType: 'E-Sign Required',
        sharedDate: new Date().toLocaleDateString(),
        portalUrl: signUrl,
      });
      _markSent(key);
      console.log(`SPNotify: Signing link sent to ${commitment.investorEmail}`);
    } catch(e) {
      console.warn('SPNotify: Failed to send signing notification:', e.message);
    }
  }

  // ── Accreditation expiry check ──────────────────────────────────────────
  async function _checkAccredExpiry() {
    if (typeof SP === 'undefined' || typeof SPEmail === 'undefined') return;

    const investors = SP.getInvestors();
    const today = new Date();
    const thirtyDays = 30 * 86400000;

    for (const inv of investors) {
      if (inv.accredStatus !== 'verified' || !inv.accredExpiry) continue;

      let expiry;
      if (inv.accredExpiry.toDate) expiry = inv.accredExpiry.toDate();
      else if (inv.accredExpiry.seconds) expiry = new Date(inv.accredExpiry.seconds * 1000);
      else expiry = new Date(inv.accredExpiry);
      if (isNaN(expiry.getTime())) continue;

      const daysLeft = Math.ceil((expiry - today) / 86400000);
      if (daysLeft > 0 && daysLeft <= 30) {
        const key = `accred_expiry_${inv.id}_${expiry.toISOString().split('T')[0]}`;
        if (_wasSent(key)) continue;

        try {
          await SPEmail.send('dealUpdate', inv.email, {
            investorName: `${inv.firstName} ${inv.lastName}`,
            dealName: 'Accreditation Renewal',
            messageBody: `Your accredited investor certification expires on ${expiry.toLocaleDateString()} (${daysLeft} days). Please log in to your portal and re-certify to maintain your status.`,
            keyMetrics: `Expiry Date: ${expiry.toLocaleDateString()}\nDays Remaining: ${daysLeft}\nStatus: Expiring Soon`,
            updateDate: today.toLocaleDateString(),
          });
          _markSent(key);
          console.log(`SPNotify: Accreditation expiry warning sent to ${inv.email} (${daysLeft} days left)`);
        } catch(e) {
          console.warn('SPNotify: Failed to send accred expiry warning:', e.message);
        }
      }
    }
  }

  // Auto-init
  if (typeof document !== 'undefined') {
    if (document.readyState === 'complete' || document.readyState === 'interactive') init();
    else document.addEventListener('DOMContentLoaded', init);
  }

  return {
    init,
    onDistributionPosted,
    onCapitalCallCreated,
    onCommitmentApproved,
    onDocsSent,
  };
})();
