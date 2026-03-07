/**
 * js/sp-theme.js — deeltrack Global Design System Engine
 * Manages institutional branding, accessibility, and high-fidelity transitions.
 */

const SPTheme = (() => {
  const _brand = {
    primary: '#1B1A19',
    accent: '#F37925',
    success: '#2D9A6B',
    radius: '12px'
  };

  function applyInstitutionalDefaults() {
    const style = document.createElement('style');
    style.id = 'sp-theme-institutional';
    style.textContent = `
      /* sp-theme-institutional v20260308 — safe non-color styles only */
      :root {
        --radius-md: ${_brand.radius};
        --bg-glass: rgba(255, 255, 255, 0.85);
      }

      /* Typography spacing — no color overrides */
      body { letter-spacing: -0.011em; font-feature-settings: "cv02", "cv03", "cv04", "ss01"; }
      h1, h2, h3, h4 { font-family: 'Inter', sans-serif; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; }

      /* High-End Skeleton Shimmer */
      .skeleton { position: relative; overflow: hidden; border-radius: 4px; }
      .skeleton::after {
        content: ""; position: absolute; inset: 0;
        transform: translateX(-100%);
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
        animation: shimmer 2s infinite;
      }
      @keyframes shimmer { to { transform: translateX(100%); } }

      /* Text selection */
      ::selection { background: rgba(243,121,37,0.15); color: #7A3200; }

      /* Monospace data values */
      .money-val, .currency, .math-val, .res-val, .hero-num, .kpi-value {
        font-family: 'JetBrains Mono', monospace !important;
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.02em;
      }

      /* Smooth transitions */
      .btn, .nav-item, .action-btn { transition: all 0.2s ease !important; }
      .btn:active { transform: scale(0.97); }
    `;
    document.head.appendChild(style);
  }

  return { init: applyInstitutionalDefaults };
})();

if (typeof document !== 'undefined') SPTheme.init();
