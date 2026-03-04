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
      }
      
      /* Institutional Typography & Spacing */
      body { letter-spacing: -0.011em; font-feature-settings: "cv02", "cv03", "cv04", "ss01"; }
      .card { transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s ease; }
      .card:hover { transform: translateY(-2px); box-shadow: 0 12px 24px -8px rgba(0,0,0,0.1); }
      
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
