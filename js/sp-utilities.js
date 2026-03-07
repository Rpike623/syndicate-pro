/**
 * SP Utility Tracker
 */
window.Utils = {
  bills: [],
  init: function() {
    this.bills = [
      { property:'Sunset Apartments', type:'Electric', period:'2026-02', usage:45000, cost:5400, status:'paid' },
      { property:'Sunset Apartments', type:'Water', period:'2026-02', usage:12000, cost:1800, status:'paid' },
      { property:'Downtown Office', type:'Electric', period:'2026-02', usage:28000, cost:3360, status:'pending' },
      { property:'Downtown Office', type:'Gas', period:'2026-02', usage:4500, cost:680, status:'paid' },
      { property:'Industrial Portfolio', type:'Electric', period:'2026-02', usage:85000, cost:10200, status:'paid' },
      { property:'Coastal Retail', type:'Electric', period:'2026-02', usage:12000, cost:1440, status:'paid' }
    ];
    this.render();
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  render: function() {
    const now = this.bills.filter(b => b.period === '2026-02');
    const month = now.reduce((s,b) => s + b.cost, 0);
    const ytd = this.bills.reduce((s,b) => s + b.cost, 0);
    document.getElementById('statMonth').textContent = this.f(month);
    document.getElementById('statYtd').textContent = this.f(ytd);
    document.getElementById('statAvg').textContent = this.f(month / 4);
    document.getElementById('utilTable').innerHTML = this.bills.map(b => `<tr><td>${b.property}</td><td>${b.type}</td><td>${b.period}</td><td>${b.usage.toLocaleString()} kWh</td><td>${this.f(b.cost)}</td><td><span class="badge badge-${b.status==='paid'?'success':'warning'}">${b.status}</span></td></tr>`).join('');
  },
  showModal: function() { document.getElementById('utilModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('utilModal').style.display = 'none'; },
  save: function() { alert('Utility added!'); this.closeModal(); }
};
