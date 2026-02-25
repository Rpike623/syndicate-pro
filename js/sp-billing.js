/**
 * sp-billing.js — deeltrack Stripe Billing
 *
 * Handles subscription management via Stripe Checkout (client-side redirect).
 * Uses Stripe Payment Links — no backend required.
 *
 * Architecture:
 *   - Stripe Payment Links → hosted checkout → webhook (optional) or manual activation
 *   - Subscription state stored in Firebase (users/{uid}.subscription)
 *   - Trial period tracked in localStorage + Firebase
 *   - Feature gates enforced client-side (backed by Firebase for real enforcement)
 *
 * Setup:
 *   1. Create products/prices in Stripe Dashboard
 *   2. Create Payment Links for each plan
 *   3. Add ?client_reference_id={orgId} to each Payment Link
 *   4. Enter Payment Link URLs in Settings → Billing
 *   OR use Stripe Customer Portal for upgrades/downgrades
 */

const SPBilling = (function () {
  'use strict';

  // ── Plans ────────────────────────────────────────────────────────────────────
  const PLANS = {
    free: {
      id:        'free',
      name:      'Free Trial',
      price:     0,
      interval:  null,
      limits: {
        deals:      3,
        investors:  10,
        documents:  5,
        storage_mb: 50,
        users:      1,
      },
      features: ['Basic waterfall calculator', 'Up to 3 deals', 'Up to 10 investors', 'Document generation', '14-day trial'],
    },
    starter: {
      id:        'starter',
      name:      'Starter',
      price:     49,
      interval:  'month',
      priceId:   null, // set from settings
      limits: {
        deals:      10,
        investors:  50,
        documents:  50,
        storage_mb: 500,
        users:      2,
      },
      features: ['Everything in Free', '10 deals', '50 investors', 'Email notifications', 'Deal room uploads', 'Priority support'],
    },
    pro: {
      id:        'pro',
      name:      'Pro',
      price:     149,
      interval:  'month',
      priceId:   null,
      limits: {
        deals:      -1, // unlimited
        investors:  -1,
        documents:  -1,
        storage_mb: 5000,
        users:      5,
      },
      features: ['Everything in Starter', 'Unlimited deals & investors', 'Advanced waterfall types', 'K-1 generator', 'Investor portal', 'API access'],
    },
    enterprise: {
      id:        'enterprise',
      name:      'Enterprise',
      price:     499,
      interval:  'month',
      priceId:   null,
      limits: {
        deals:      -1,
        investors:  -1,
        documents:  -1,
        storage_mb: -1,
        users:      -1,
      },
      features: ['Everything in Pro', 'Unlimited users', 'Custom branding', 'Dedicated support', 'SLA', 'Custom integrations'],
    },
  };

  // ── State ────────────────────────────────────────────────────────────────────
  let _sub = null; // current subscription state

  // ── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    _sub = _loadSubscription();

    // Check URL params for Stripe redirect callbacks
    const params = new URLSearchParams(window.location.search);
    if (params.get('billing') === 'success') {
      _handleCheckoutSuccess(params);
    } else if (params.get('billing') === 'cancel') {
      _handleCheckoutCancel();
    }

    // Start trial if not already started
    if (!_sub.trialStarted) {
      _sub.trialStarted = Date.now();
      _sub.trialEnd     = Date.now() + (14 * 24 * 60 * 60 * 1000);
      _sub.plan         = 'free';
      _saveSub();
    }
  }

  // ── Subscription state ────────────────────────────────────────────────────────

  function _loadSubscription() {
    // Try Firebase first (source of truth), fall back to localStorage
    const local = (typeof SP !== 'undefined') ? SP.load('subscription', {}) : {};
    return {
      plan:         local.plan         || 'free',
      status:       local.status       || 'trialing',
      trialStarted: local.trialStarted || null,
      trialEnd:     local.trialEnd     || null,
      currentPeriodEnd: local.currentPeriodEnd || null,
      stripeCustomerId: local.stripeCustomerId || null,
      cancelAtPeriodEnd: local.cancelAtPeriodEnd || false,
      ...local,
    };
  }

  function _saveSub() {
    if (typeof SP !== 'undefined') SP.save('subscription', _sub);
    // Sync to Firebase
    if (typeof SPFB !== 'undefined' && SPFB.isReady() && !SPFB.isOffline()) {
      const user = SPFB.getUser();
      if (user?.uid) {
        firebase.firestore().collection('users').doc(user.uid)
          .update({ subscription: _sub })
          .catch(() => {});
      }
    }
  }

  async function loadFromFirebase() {
    if (typeof SPFB === 'undefined' || !SPFB.isReady()) return _sub;
    try {
      const user = SPFB.getUser();
      if (!user?.uid) return _sub;
      const doc = await firebase.firestore().collection('users').doc(user.uid).get();
      if (doc.exists && doc.data().subscription) {
        _sub = { ..._sub, ...doc.data().subscription };
        if (typeof SP !== 'undefined') SP.save('subscription', _sub);
      }
    } catch (e) { /* use local cache */ }
    return _sub;
  }

  // ── Getters ──────────────────────────────────────────────────────────────────

  function getSubscription() { return { ..._sub }; }

  function getCurrentPlan() { return PLANS[_sub.plan] || PLANS.free; }

  function getPlan(planId) { return PLANS[planId] || null; }

  function getAllPlans() { return Object.values(PLANS); }

  function isTrialing() {
    return _sub.status === 'trialing' && _sub.trialEnd && Date.now() < _sub.trialEnd;
  }

  function isTrialExpired() {
    return _sub.plan === 'free' && _sub.trialEnd && Date.now() > _sub.trialEnd;
  }

  function trialDaysLeft() {
    if (!_sub.trialEnd) return 0;
    return Math.max(0, Math.ceil((_sub.trialEnd - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  function isPaid() {
    return ['starter','pro','enterprise'].includes(_sub.plan) && _sub.status === 'active';
  }

  function canAccess(feature) {
    // Always allow in trial
    if (isTrialing()) return { allowed: true, reason: 'trial' };
    // Always allow for paid
    if (isPaid()) return { allowed: true, reason: 'paid' };
    // Trial expired
    if (isTrialExpired()) return { allowed: false, reason: 'trial_expired' };
    return { allowed: true, reason: 'free' };
  }

  function checkLimit(resource, currentCount) {
    const plan = getCurrentPlan();
    const limit = plan.limits[resource];
    if (limit === -1) return { allowed: true, limit: -1, remaining: Infinity };
    if (isTrialing()) return { allowed: true, limit, remaining: limit - currentCount, trial: true };
    if (!isPaid() && isTrialExpired()) return { allowed: false, limit, remaining: 0, expired: true };
    const allowed = currentCount < limit;
    return { allowed, limit, remaining: limit - currentCount };
  }

  // ── Stripe Checkout ───────────────────────────────────────────────────────────

  function getPaymentLinks() {
    const settings = (typeof SP !== 'undefined') ? SP.load('settings', {}) : {};
    return {
      starter:    settings.stripeStarterLink    || null,
      pro:        settings.stripeProLink         || null,
      enterprise: settings.stripeEnterpriseLink  || null,
      portal:     settings.stripePortalLink      || null,
    };
  }

  function checkout(planId) {
    const links = getPaymentLinks();
    const link  = links[planId];

    if (!link) {
      // Show setup modal for admin / show upgrade page for users
      _showNoLinkModal(planId);
      return;
    }

    // Append org/user info as client_reference_id
    const orgId = (typeof SPFB !== 'undefined' && SPFB.getOrgId()) ||
                  (typeof SP !== 'undefined' && SP.load('settings', {}).orgId) || 'unknown';
    const email = (typeof SPFB !== 'undefined' && SPFB.getUser()?.email) ||
                  (typeof SP !== 'undefined' && SP.getSession()?.email) || '';

    const url = new URL(link);
    url.searchParams.set('client_reference_id', orgId);
    if (email) url.searchParams.set('prefilled_email', email);
    // Add success/cancel redirect back to billing settings
    const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    url.searchParams.set('success_url', base + 'settings.html?billing=success&plan=' + planId);
    url.searchParams.set('cancel_url',  base + 'settings.html?billing=cancel');

    window.location.href = url.toString();
  }

  function openCustomerPortal() {
    const links = getPaymentLinks();
    if (links.portal) {
      window.open(links.portal, '_blank');
    } else {
      alert('Customer portal not configured. Contact support to manage your subscription.');
    }
  }

  // ── Checkout callbacks ────────────────────────────────────────────────────────

  function _handleCheckoutSuccess(params) {
    const plan = params.get('plan') || 'starter';
    _sub.plan   = plan;
    _sub.status = 'active';
    _sub.currentPeriodEnd = Date.now() + (30 * 24 * 60 * 60 * 1000);
    _saveSub();

    // Show success banner
    setTimeout(() => {
      const banner = document.createElement('div');
      banner.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:14px 28px;border-radius:8px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.2);';
      banner.innerHTML = `<i class="fas fa-check-circle"></i> 🎉 Welcome to deeltrack ${PLANS[plan]?.name || plan}! Your subscription is active.`;
      document.body.appendChild(banner);
      setTimeout(() => banner.remove(), 6000);
    }, 500);

    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
  }

  function _handleCheckoutCancel() {
    setTimeout(() => {
      const banner = document.createElement('div');
      banner.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:var(--card);border:1px solid var(--border);color:var(--text);padding:14px 28px;border-radius:8px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.2);';
      banner.innerHTML = '<i class="fas fa-info-circle" style="color:var(--accent);"></i> Checkout cancelled. Your trial is still active.';
      document.body.appendChild(banner);
      setTimeout(() => banner.remove(), 4000);
    }, 300);
    window.history.replaceState({}, '', window.location.pathname);
  }

  function _showNoLinkModal(planId) {
    const plan = PLANS[planId];
    const existing = document.getElementById('spBillingModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'spBillingModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = `
      <div style="background:var(--card);border-radius:var(--radius-lg);padding:32px;max-width:440px;width:100%;box-shadow:var(--shadow-xl);">
        <h2 style="margin:0 0 8px;font-size:1.25rem;">Upgrade to ${plan?.name || planId}</h2>
        <p style="color:var(--text-secondary);margin:0 0 20px;font-size:.9rem;">Stripe payment links aren't configured yet. To activate billing:</p>
        <ol style="color:var(--text-secondary);font-size:.875rem;padding-left:20px;line-height:2;">
          <li>Create a product in your Stripe Dashboard</li>
          <li>Create a Payment Link for this plan ($${plan?.price}/mo)</li>
          <li>Go to <strong>Settings → Billing</strong> and paste the link</li>
        </ol>
        <div style="display:flex;gap:10px;margin-top:24px;">
          <a href="https://dashboard.stripe.com/payment-links" target="_blank" class="btn btn-primary" style="flex:1;text-align:center;">Open Stripe Dashboard →</a>
          <button onclick="document.getElementById('spBillingModal').remove();window.location.href='settings.html';" class="btn btn-secondary">Settings</button>
          <button onclick="document.getElementById('spBillingModal').remove();" class="btn btn-secondary">Close</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  // ── Trial expired gate ────────────────────────────────────────────────────────

  /**
   * Show upgrade prompt when trial expires.
   * Call this at the top of protected pages.
   */
  function enforceTrialGate(options = {}) {
    if (isPaid() || isTrialing()) return false; // all good

    const { soft = false, redirectTo = 'pricing.html' } = options;

    const overlay = document.createElement('div');
    overlay.id = 'trialGateOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.85);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);';
    overlay.innerHTML = `
      <div style="background:var(--card);border-radius:var(--radius-lg);padding:40px;max-width:480px;width:100%;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,.3);">
        <div style="font-size:3rem;margin-bottom:16px;">⏰</div>
        <h2 style="margin:0 0 8px;font-size:1.5rem;">Your trial has ended</h2>
        <p style="color:var(--text-secondary);margin:0 0 24px;">Subscribe to continue using deeltrack and keep all your deals, investors, and documents.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
          <div style="background:var(--border-light);border-radius:var(--radius);padding:16px;">
            <div style="font-weight:700;font-size:1.1rem;">Starter</div>
            <div style="font-size:1.5rem;font-weight:700;color:var(--accent);">$49<span style="font-size:.9rem;color:var(--text-secondary);">/mo</span></div>
            <button onclick="SPBilling.checkout('starter')" class="btn btn-secondary" style="width:100%;margin-top:10px;font-size:.8rem;">Choose Starter</button>
          </div>
          <div style="background:var(--accent);border-radius:var(--radius);padding:16px;color:white;">
            <div style="font-weight:700;font-size:1.1rem;">Pro</div>
            <div style="font-size:1.5rem;font-weight:700;">$149<span style="font-size:.9rem;opacity:.8;">/mo</span></div>
            <button onclick="SPBilling.checkout('pro')" style="width:100%;margin-top:10px;padding:8px;background:white;color:var(--accent);border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:.8rem;">Choose Pro</button>
          </div>
        </div>
        ${soft ? `<button onclick="document.getElementById('trialGateOverlay').remove();" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:.875rem;">Continue without subscribing →</button>` : ''}
      </div>`;
    document.body.appendChild(overlay);
    return true;
  }

  // ── Trial banner ─────────────────────────────────────────────────────────────

  function injectTrialBanner() {
    if (isPaid()) return;
    const days = trialDaysLeft();
    if (days <= 0 && !isPaid()) {
      // Already expired — enforceTrialGate handles it
      return;
    }
    if (days > 7) return; // Only show banner when < 7 days left

    const banner = document.createElement('div');
    banner.id = 'trialBanner';
    banner.style.cssText = `background:${days <= 2 ? '#ef4444' : '#f59e0b'};color:white;text-align:center;padding:8px 16px;font-size:.85rem;font-weight:600;position:relative;z-index:100;`;
    banner.innerHTML = `
      <i class="fas fa-clock"></i>
      ${days === 0 ? 'Your trial expires today!' : `${days} day${days !== 1 ? 's' : ''} left in your free trial.`}
      <a href="pricing.html" style="color:white;margin-left:12px;text-decoration:underline;">Upgrade now →</a>
      <button onclick="this.parentElement.remove()" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:white;cursor:pointer;font-size:1rem;">✕</button>`;

    const topBar = document.querySelector('.top-bar') || document.querySelector('header') || document.body.firstChild;
    topBar?.parentNode?.insertBefore(banner, topBar) || document.body.prepend(banner);
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  return {
    init,
    loadFromFirebase,

    // Plan info
    PLANS,
    getSubscription,
    getCurrentPlan,
    getPlan,
    getAllPlans,

    // Status
    isTrialing,
    isTrialExpired,
    trialDaysLeft,
    isPaid,
    canAccess,
    checkLimit,

    // Stripe
    checkout,
    openCustomerPortal,
    getPaymentLinks,

    // UI
    enforceTrialGate,
    injectTrialBanner,
  };
})();

// Auto-init
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    SPBilling.init();
    SPBilling.injectTrialBanner();
  });
}
