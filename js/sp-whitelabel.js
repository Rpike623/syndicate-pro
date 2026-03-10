/**
 * sp-whitelabel.js — White-label branding for LP portals
 *
 * Reads GP branding settings from Firestore and applies:
 * - Custom firm name in header/footer
 * - Custom logo URL
 * - Custom accent color
 * - Custom favicon
 * - Hides "deeltrack" branding (replaces with GP brand)
 *
 * Loads automatically on portal pages. GP configures in Settings → Branding.
 * Falls back to deeltrack defaults if no custom branding set.
 */

const SPWhiteLabel = (() => {
  'use strict';

  let _applied = false;
  let _brand = null;

  function init() {
    if (_applied) return;

    // Only apply on portal pages (LP-facing)
    const page = window.location.pathname.split('/').pop() || '';
    const portalPages = ['portal.html', 'investor-portal.html', 'invest.html', 'sign.html'];
    if (!portalPages.includes(page)) return;

    // Wait for SP data
    if (typeof SP !== 'undefined' && SP.onDataReady) {
      SP.onDataReady(_loadAndApply);
    } else {
      window.addEventListener('spdata-ready', _loadAndApply);
    }
  }

  async function _loadAndApply() {
    if (_applied) return;

    // Try loading from Firestore settings
    try {
      let settings = null;
      if (typeof SP !== 'undefined' && SP.load) {
        settings = SP.load('settings', {});
      }

      // Also try direct Firestore load for invest/sign pages (may not have SP session)
      if ((!settings || !settings.firmName) && typeof firebase !== 'undefined') {
        const db = firebase.firestore();
        // Try to determine orgId from URL params or session
        let orgId = null;
        if (typeof SP !== 'undefined' && SP.getSession) {
          orgId = SP.getSession()?.orgId;
        }
        if (!orgId) orgId = 'deeltrack_demo'; // fallback

        const doc = await db.collection('orgs').doc(orgId).collection('settings').doc('main').get();
        if (doc.exists) settings = doc.data();
      }

      if (!settings) return;

      _brand = {
        firmName:    settings.brandFirmName || settings.firmName || null,
        logoUrl:     settings.brandLogoUrl || null,
        accentColor: settings.brandAccentColor || null,
        favicon:     settings.brandFavicon || null,
        hideDeeltrack: settings.brandHideDeeltrack || false,
        tagline:     settings.brandTagline || null,
      };

      if (!_brand.firmName && !_brand.logoUrl && !_brand.accentColor) return; // No branding configured

      _applyBranding();
      _applied = true;
    } catch(e) {
      // Branding load failed — use defaults
    }
  }

  function _applyBranding() {
    const b = _brand;

    // Replace logo
    if (b.logoUrl) {
      document.querySelectorAll('.portal-logo img, .logo img').forEach(img => {
        img.src = b.logoUrl;
        img.alt = b.firmName || 'Logo';
      });
    }

    // Replace firm name in text
    if (b.firmName) {
      document.querySelectorAll('.portal-logo, .logo').forEach(el => {
        // Keep image, replace text
        const img = el.querySelector('img');
        if (img && !b.logoUrl) {
          el.textContent = '';
          el.appendChild(img);
          el.appendChild(document.createTextNode(' ' + b.firmName));
        } else if (!img) {
          el.textContent = b.firmName;
        }
      });

      // Update page title
      document.title = document.title.replace('deeltrack', b.firmName);
    }

    // Custom accent color
    if (b.accentColor) {
      const root = document.documentElement;
      root.style.setProperty('--accent', b.accentColor);
      root.style.setProperty('--accent-hover', _darken(b.accentColor, 15));
      root.style.setProperty('--accent-light', b.accentColor + '1f');
    }

    // Custom favicon
    if (b.favicon) {
      let link = document.querySelector('link[rel="icon"]');
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = b.favicon;
    }

    // Hide deeltrack branding
    if (b.hideDeeltrack) {
      // Remove "Powered by deeltrack" / disclaimer references
      document.querySelectorAll('[class*="disclaimer"], [id*="disclaimer"]').forEach(el => {
        if (el.textContent.includes('deeltrack')) el.style.display = 'none';
      });
      // Update login gate branding
      const loginTitle = document.querySelector('#portal-login-gate h2, .login-box h2');
      if (loginTitle && loginTitle.textContent.includes('Investor Portal')) {
        loginTitle.textContent = (b.firmName || '') + ' Investor Portal';
      }
    }

    // Footer / legal text replacement
    document.querySelectorAll('footer, .legal-footer, [class*="footer"]').forEach(el => {
      if (b.firmName && el.innerHTML.includes('deeltrack')) {
        el.innerHTML = el.innerHTML.replace(/deeltrack/gi, b.firmName);
      }
    });

    console.log('SPWhiteLabel: Applied branding for', b.firmName || 'custom brand');
  }

  function _darken(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - Math.round(2.55 * percent));
    const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(2.55 * percent));
    const b = Math.max(0, (num & 0x0000FF) - Math.round(2.55 * percent));
    return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
  }

  function getBrand() { return _brand ? { ..._brand } : null; }
  function isApplied() { return _applied; }

  // Auto-init
  if (typeof document !== 'undefined') {
    if (document.readyState === 'complete' || document.readyState === 'interactive') init();
    else document.addEventListener('DOMContentLoaded', init);
  }

  return { init, getBrand, isApplied };
})();
