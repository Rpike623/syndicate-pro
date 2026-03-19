(function initDeeltrackAnalytics() {
  var MEASUREMENT_ID = 'G-T5QKV9PQQC';
  if (!MEASUREMENT_ID) return;

  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function(){ window.dataLayer.push(arguments); };
  }

  if (!document.getElementById('dt-ga')) {
    var s = document.createElement('script');
    s.id = 'dt-ga';
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID);
    document.head.appendChild(s);
  }

  if (!window.__dtGAInitialized) {
    window.__dtGAInitialized = true;
    window.gtag('js', new Date());
    window.gtag('config', MEASUREMENT_ID, {
      page_title: document.title,
      page_path: window.location.pathname + window.location.search,
      send_page_view: true
    });
  }

  window.dtTrack = function(eventName, params) {
    try {
      window.gtag('event', eventName, params || {});
    } catch (_) {}
  };
})();
