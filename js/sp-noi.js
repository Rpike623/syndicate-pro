/**
 * SP NOI Analysis
 */
window.NOI = {
  data: [],
  init: function() {
    this.data = [
      { name:'Sunset Apartments', income:1650000, expenses:620000, noi:1030000 },
      { name:'Downtown Office', income:1100000, expenses:480000, noi:620000 },
      { name:'Industrial Portfolio', income:2100000, expenses:700000, noi:1400000 },
      { name:'Coastal Retail', income:780000, expenses:300000, noi:480000 }
    ];
    this.render();
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  render: function() {
    const totalNoi = this.data.reduce((s,p) => s + p.noi, 0);
    const avgCap = 6.1;
    const value = totalNoi / (avgCap / 100);
    document.getElementById('statNoi').textContent = this.f(totalNoi);
    document.getElementById('statCap').textContent = avgCap + '%';
    document.getElementById('statValue').textContent = this.f(value);
    // Pie chart
    new Chart(document.getElementById('noiChart').getContext('2d'), {
      type:'doughnut',
      data:{ labels:this.data.map(p => p.name), datasets:[{ data:this.data.map(p => p.noi), backgroundColor:['#6366f1','#22c55e','#f59e0b','#ef4444'] }] },
      options:{ plugins:{ legend:{ position:'right' } } }
    });
    // Trend chart
    new Chart(document.getElementById('trendChart').getContext('2d'), {
      type:'line',
      data:{ labels:['Q1','Q2','Q3','Q4','Q1'], datasets:[{ label:'NOI', data:[2.1,2.3,2.4,2.5,2.53], borderColor:'#6366f1', fill:true, backgroundColor:'rgba(99,102,241,0.1)' }] },
      options:{ plugins:{legend:{display:false}}, scales:{y:{ticks:{callback:v=>'$'+v+'M'}}} }
    });
    // Table
    document.getElementById('noiTable').innerHTML = this.data.map(p => {
      const cap = (p.noi / (p.income - p.expenses)) * 100 || 0;
      const val = p.noi / (avgCap/100);
      return `<tr><td>${p.name}</td><td>${this.f(p.income)}</td><td>${this.f(p.expenses)}</td><td><strong>${this.f(p.noi)}</strong></td><td>${avgCap}%</td><td>${this.f(val)}</td></tr>`;
    }).join('');
  }
};
