/**
 * SP Capital Events
 */
window.CapEvents = {
  init: function() {
    const events = [
      { date:'2026-03-01', event:'Capital Call', deal:'Sunset Apartments', amount:2500000, source:'LP Investors' },
      { date:'2026-02-15', event:'Distribution', deal:'Industrial Portfolio', amount:425000, source:'Operations' },
      { date:'2026-02-01', event:'Acquisition', deal:'Sunset Apartments', amount:16500000, source:'Senior Loan' },
      { date:'2026-01-15', event:'Distribution', deal:'Downtown Office', amount:180000, source:'Operations' },
      { date:'2025-12-20', event:'Refinance', deal:'Industrial Portfolio', amount:8000000, source:'New Loan' },
      { date:'2025-12-01', event:'Capital Call', deal:'Industrial Portfolio', amount:5500000, source:'LP Investors' }
    ];
    const fmt = v => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v);
    document.getElementById('capTable').innerHTML = events.map(e => `<tr><td>${e.date}</td><td>${e.event}</td><td>${e.deal}</td><td>${fmt(e.amount)}</td><td>${e.source}</td></tr>`).join('');
  }
};