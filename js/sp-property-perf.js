/**
 * SP Property Performance
 */
window.PropertyPerf = {
  data: [],
  init: function() {
    this.data = [
      { name:'Sunset Apartments', occupancy:96, revenue:1650000, expenses:620000, noi:1030000, cashFlow:850000, dscr:1.45 },
      { name:'Downtown Office', occupancy:88, revenue:1100000, expenses:480000, noi:620000, cashFlow:480000, dscr:1.28 },
      { name:'Industrial Portfolio', occupancy:100, revenue:2100000, expenses:700000, noi:1400000, cashFlow:1200000, dscr:1.85 },
      { name:'Coastal Retail', occupancy:92, revenue:780000, expenses:300000, noi:480000, cashFlow:390000, dscr:1.32 }
    ];
    this.render();
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  render: function() {
    document.getElementById('perfTable').innerHTML = this.data.map(p => `<tr><td><strong>${p.name}</strong></td><td class="text-success">${p.occupancy}%</td><td>${this.f(p.revenue)}</td><td>${this.f(p.expenses)}</td><td><strong>${this.f(p.noi)}</strong></td><td>${this.f(p.cashFlow)}</td><td>${p.dscr.toFixed(2)}x</td></tr>`).join('');
    document.getElementById('vacancyList').innerHTML = this.data.map(p => `<div class="metric-row"><span>${p.name}</span><span class="text-warning">${(100-p.occupancy)}% lost</span></div>`).join('');
    document.getElementById('expenseList').innerHTML = '<div class="metric-row"><span>Utilities</span><span>$185K</span></div><div class="metric-row"><span>Insurance</span><span>$142K</span></div><div class="metric-row"><span>Property Tax</span><span>$98K</span></div><div class="metric-row"><span>Repairs</span><span>$76K</span></div>';
  }
};
