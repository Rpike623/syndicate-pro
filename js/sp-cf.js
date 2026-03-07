/**
 * SP Cash Forecast
 */
window.CF = {
  init: function() {
    const months = ['Mar 2026','Apr 2026','May 2026','Jun 2026','Jul 2026','Aug 2026','Sep 2026','Oct 2026','Nov 2026','Dec 2026','Jan 2027','Feb 2027'];
    const fmt = v => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v);
    let html = '';
    months.forEach((m,i) => {
      const op = 45000 + Math.floor(Math.random() * 10000);
      const dist = 25000 + Math.floor(Math.random() * 15000);
      const debt = 18000;
      const net = op - dist - debt;
      html += `<tr><td>${m}</td><td>${fmt(op)}</td><td>${fmt(dist)}</td><td>${fmt(debt)}</td><td class="${net>=0?'text-success':'text-danger'}">${fmt(net)}</td></tr>`;
    });
    document.getElementById('cfTable').innerHTML = html;
  }
};