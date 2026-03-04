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
      /* High-Precision Data Rendering */
      .money-val, .currency, .math-val, .res-val { 
        font-family: 'JetBrains Mono', monospace !important; 
        font-variant-numeric: tabular-nums; 
        letter-spacing: -0.02em;
      }
      
      /* Global Card Polish */
      .card {
        border: 1px solid rgba(226, 232, 240, 0.6) !important;
        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
      }
      .card:hover {
        border-color: rgba(59, 130, 246, 0.3) !important;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
      }

      /* Animated Transitions for Actions */
      .btn, .nav-item, .action-btn {
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
      .btn:active { transform: scale(0.98); }

      /* Table Header Polish */
      th {
        letter-spacing: 0.05em !important;
        color: #475569 !important;
        font-weight: 700 !important;
      }
      
      /* Scrollbar Hardening */
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; border: 2px solid transparent; background-clip: content-box; }
      ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

      /* Global Loading State */
      .loading-shimmer {
        background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
      }
      @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    `;
    document.head.appendChild(style);
  }

  return { init: applyInstitutionalDefaults };
})();

if (typeof document !== 'undefined') SPTheme.init();
