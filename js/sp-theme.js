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
      /* Glassmorphism & High-Fidelity Layers */
      .card, .kpi-card { 
        backdrop-filter: blur(8px); 
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(226, 232, 240, 0.8);
      }
      
      /* Active Navigation Polish */
      .nav-item.active {
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
        background: linear-gradient(135deg, var(--accent), #2563eb) !important;
      }

      /* Unified Form Focus States */
      input:focus, select:focus, textarea:focus {
        border-color: var(--accent) !important;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1) !important;
        outline: none !important;
      }

      /* Consistent Layout Spacing */
      .content { padding: 40px !important; }
      @media (max-width: 768px) { .content { padding: 20px !important; } }
      
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
