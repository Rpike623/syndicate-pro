/**
 * js/sp-theme.js — deeltrack Global Design System Engine
 * Manages institutional branding, accessibility, and high-fidelity transitions.
 */

const SPTheme = (() => {
  const _brand = {
    primary: '#0f172a',
    accent: '#3b82f6',
    success: '#10b981',
    radius: '12px'
  };

  function applyInstitutionalDefaults() {
    const style = document.createElement('style');
    style.id = 'sp-theme-institutional';
    style.textContent = `
      :root {
        --primary: ${_brand.primary};
        --accent: ${_brand.accent};
        --success: ${_brand.success};
        --radius-md: ${_brand.radius};
        --bg-glass: rgba(255, 255, 255, 0.7);
      }
      
      body { background-color: #f1f5f9; }
      
      /* Glassmorphism & High-Fidelity Layers */
      .card, .kpi-card { 
        background: var(--bg-glass) !important;
        backdrop-filter: blur(12px); 
        -webkit-backdrop-filter: blur(12px);
      }
      
      /* Institutional Typography & Spacing */
      body { letter-spacing: -0.011em; font-feature-settings: "cv02", "cv03", "cv04", "ss01"; }
      /* 8px Golden Baseline Grid & Type Scale */
      h1, h2, h3, h4 { font-family: 'Inter', sans-serif; font-weight: 800; letter-spacing: -0.025em; line-height: 1.2; }
      h1 { font-size: 2.25rem !important; margin-bottom: 24px !important; }
      h2 { font-size: 1.5rem !important; margin-bottom: 16px !important; }
      h3 { font-size: 1.125rem !important; margin-bottom: 12px !important; }
      p { margin-bottom: 16px; color: #475569; }

      /* Institutional Data Rows (Consistent 8px multiples) */
      .deal-row, .lp-row, .activity-item, .dist-item { 
        padding: 16px 24px !important; 
        border-bottom: 1px solid rgba(226, 232, 240, 0.4) !important;
      }

      /* High-End Skeleton Shimmer (v2.3) */
      .skeleton {
        position: relative; overflow: hidden; background: #f1f5f9; border-radius: 4px;
      }
      .skeleton::after {
        content: ""; position: absolute; inset: 0;
        transform: translateX(-100%);
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
        animation: shimmer 2s infinite;
      }

      /* Unified Selection Logic */
      ::selection { background: var(--accent-light); color: var(--accent); }
      
      /* High-Precision Data Rendering */
      .money-val, .currency, .math-val, .res-val, .hero-num, .kpi-value { 
        font-family: 'JetBrains Mono', monospace !important; 
        font-variant-numeric: tabular-nums; 
        letter-spacing: -0.02em;
      }
      
      /* Global UI Controls Transitions */
      .btn, .nav-item, .action-btn, .card, .kpi-card {
        transition: all 0.25s cubic-bezier(0.2, 0, 0, 1) !important;
      }
      .btn:active { transform: scale(0.96); }
    `;
    document.head.appendChild(style);
  }

  return { init: applyInstitutionalDefaults };
})();

if (typeof document !== 'undefined') SPTheme.init();
