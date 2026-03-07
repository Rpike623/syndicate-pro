/**
 * SP OpEx Benchmark
 */
window.OpEx = {
  data: [],
  init: function() {
    this.data = [
      { cat:'Utilities', actual:185000, budget:180000, market:195000 },
      { cat:'Insurance', actual:142000, budget:140000, market:145000 },
      { cat:'Property Tax', actual:258000, budget:260000, market:270000 },
      { cat:'Repairs & Maint', actual:165000, budget:150000, market:160000 },
      { cat:'Payroll', actual:98000, budget:100000, market:105000 },
      { cat:'Management Fee', actual:85000, budget:82000, market:90000 },
      { cat:'Other', actual:42000, budget:40000, market:45000 }
    ];
    this.render();
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  render: function() {
    const total = this.data.reduce((s,d) => s + d.actual, 0);
    const budget = this.data.reduce((s,d) => s + d.budget, 0);
    const market = this.data.reduce((s,d) => s + d.market, 0);
    const ratio = (total / (total * 2.6)) * 100; // Assuming revenue
    const unit = total / 165; // 165 units
    document.getElementById('statOpex').textContent = this.f(total);
    document.getElementById('statRatio').textContent = Math.round(ratio) + '%';
    document.getElementById('statVs').textContent = ((total - market) / market * 100).toFixed(0) + '%';
    document.getElementById('statUnit').textContent = this.f(unit);
    // Breakdown pie
    new Chart(document.getElementById('opexChart').getContext('2d'), {
      type:'doughnut',
      data:{ labels:this.data.map(d => d.cat), datasets:[{ data:this.data.map(d => d.actual), backgroundColor:['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#6b7280'] }] },
      options:{ plugins:{ legend:{ position:'right', labels:{ boxWidth:12 } } } }
    });
    // vs Market bar
    new Chart(document.getElementById('vsChart').getContext('2d'), {
      type:'bar',
      data:{ labels:this.data.map(d => d.cat), datasets:[
        { label:'Actual', data:this.data.map(d => d.actual), backgroundColor:'#6366f1' },
        { label:'Market', data:this.data.map(d => d.market), backgroundColor:'#e2e8f0' }
      ]},
      options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ ticks:{ callback:v => '$'+(v/1000)+'K' } } } }
    });
    // Table
    document.getElementById('opexTable').innerHTML = this.data.map(d => {
      const varPct = ((d.actual - d.budget) / d.budget * 100).toFixed(0);
      const vsMkt = ((d.actual - d.market) / d.market * 100).toFixed(0);
      return `<tr><td>${d.cat}</td><td>${this.f(d.actual)}</td><td>${this.f(d.budget)}</td><td class="${varPct>0?'text-danger':'text-success'}">${varPct}%</td><td>${this.f(d.market)}</td><td class="${vsMkt<0?'text-success':'text-danger'}">${vsMkt}%</td></tr>`;
    }).join('');
  }
};