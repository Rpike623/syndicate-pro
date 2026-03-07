/**
 * SP Turnover Report
 */
window.Turnover = {
  init: function() {
    const data = [
      { unit:'102', out:'2026-01-15', in:'2026-02-01', days:17, cost:2500, reason:'Job Relocation' },
      { unit:'105', out:'2026-01-28', in:'2026-02-15', days:18, cost:3200, reason:'Rent Increase' },
      { unit:'108', out:'2026-02-10', in:'', days:25, cost:4500, reason:'Buying Home' },
      { unit:'201', out:'2025-12-20', in:'2026-01-10', days:21, cost:2800, reason:'Job Relocation' },
      { unit:'205', out:'2025-11-15', in:'2025-12-15', days:30, cost:5100, reason:'Eviction' }
    ];
    const total = data.reduce((s,t) => s + t.cost, 0);
    const avgDays = Math.round(data.reduce((s,t) => s + t.days, 0) / data.length);
    document.getElementById('statTurn').textContent = data.length;
    document.getElementById('statRate').textContent = '18%';
    document.getElementById('statDays').textContent = avgDays;
    document.getElementById('statCost').textContent = '$' + total.toLocaleString();
    const fmt = v => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v);
    document.getElementById('turnTable').innerHTML = data.map(t => `<tr><td>${t.unit}</td><td>${t.out}</td><td>${t.in || '—'}</td><td>${t.days}</td><td>${fmt(t.cost)}</td><td>${t.reason}</td></tr>`).join('');
  }
};