/**
 * SP Investor ROI
 */
window.InvestorROI = {
  investors: [],
  init: function() {
    this.investors = [
      { name:'John Smith', invested:250000, dist:85000, value:280000 },
      { name:'Sarah Williams', invested:500000, dist:180000, value:520000 },
      { name:'Mike Johnson', invested:100000, dist:22000, value:115000 },
      { name:'Lisa Brown', invested:350000, dist:95000, value:380000 }
    ];
    this.render();
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  render: function() {
    const totalInv = this.investors.reduce((s,i) => s + i.invested, 0);
    const totalDist = this.investors.reduce((s,i) => s + i.dist, 0);
    const totalVal = this.investors.reduce((s,i) => s + i.value, 0);
    const avgIrr = 16.5;
    document.getElementById('statInvested').textContent = this.f(totalInv);
    document.getElementById('statDist').textContent = this.f(totalDist);
    document.getElementById('statValue').textContent = this.f(totalVal);
    document.getElementById('statIrr').textContent = avgIrr + '%';
    // ROI pie
    new Chart(document.getElementById('roiChart').getContext('2d'), {
      type:'doughnut',
      data:{ labels:this.investors.map(i => i.name), datasets:[{ data:this.investors.map(i => i.value), backgroundColor:['#6366f1','#22c55e','#f59e0b','#ef4444'] }] },
      options:{ plugins:{ legend:{ position:'right' } } }
    });
    // Perf bar
    new Chart(document.getElementById('perfChart').getContext('2d'), {
      type:'bar',
      data:{ labels:this.investors.map(i => i.name), datasets:[
        { label:'Invested', data:this.investors.map(i => i.invested), backgroundColor:'#6366f1' },
        { label:'Current Value', data:this.investors.map(i => i.value), backgroundColor:'#22c55e' }
      ]},
      options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ ticks:{ callback:v => '$'+(v/1000)+'K' } } } }
    });
    // Table
    document.getElementById('roiTable').innerHTML = this.investors.map(i => {
      const gain = i.value + i.dist - i.invested;
      const irr = 15 + Math.random() * 4;
      return `<tr><td>${i.name}</td><td>${this.f(i.invested)}</td><td>${this.f(i.dist)}</td><td>${this.f(i.value)}</td><td class="text-success">${this.f(gain)}</td><td>${irr.toFixed(1)}%</td></tr>`;
    }).join('');
  }
};