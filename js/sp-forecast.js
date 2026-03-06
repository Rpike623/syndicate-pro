/**
 * SP Pipeline Forecast
 */
window.Forecast = {
  deals: [],
  init: function() {
    this.deals = [
      { name: 'Sunset Apartments', amount: 4500000, stage: 'due-diligence', closeDate: '2026-04-15', probability: 80 },
      { name: 'Harbor View Multifamily', amount: 6200000, stage: 'term-sheet', closeDate: '2026-05-01', probability: 65 },
      { name: 'Tech Campus Austin', amount: 8500000, stage: ' LOI', closeDate: '2026-04-30', probability: 50 },
      { name: 'Distribution Hub Dallas', amount: 5500000, stage: 'due-diligence', closeDate: '2026-06-15', probability: 75 },
      { name: 'Mixed-Use Phoenix', amount: 3800000, stage: 'marketing', closeDate: '2026-07-01', probability: 30 },
      { name: 'Office Portfolio TX', amount: 12000000, stage: 'term-sheet', closeDate: '2026-05-20', probability: 55 },
      { name: 'Retail Center Houston', amount: 4200000, stage: 'marketing', closeDate: '2026-08-15', probability: 25 },
      { name: 'Industrial Build TX', amount: 9500000, stage: 'LOI', closeDate: '2026-06-30', probability: 45 }
    ];
    this.render();
  },
  render: function() {
    const totalPipeline = this.deals.reduce((s,d) => s + d.amount, 0);
    const now = new Date();
    const thisQ = new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3 + 3, 0);
    const nextQ = new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3 + 6, 0);
    
    const thisQuarter = this.deals.filter(d => new Date(d.closeDate) <= thisQ).reduce((s,d) => s + d.amount * d.probability/100, 0);
    const nextQuarter = this.deals.filter(d => new Date(d.closeDate) > thisQ && new Date(d.closeDate) <= nextQ).reduce((s,d) => s + d.amount * d.probability/100, 0);
    const avgProb = this.deals.reduce((s,d) => s + d.probability, 0) / this.deals.length;

    document.getElementById('statPipeline').textContent = this.f(totalPipeline);
    document.getElementById('statThisQ').textContent = this.f(thisQuarter);
    document.getElementById('statNextQ').textContent = this.f(nextQuarter);
    document.getElementById('statProb').textContent = avgProb.toFixed(0) + '%';

    // Chart
    const months = ['Mar','Apr','May','Jun','Jul','Aug'];
    const data = months.map(m => {
      const mIdx = {Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7}[m];
      const monthDeals = this.deals.filter(d => new Date(d.closeDate).getMonth() === mIdx - 1);
      return { actual: monthDeals.reduce((s,d) => s + d.amount * d.probability/100, 0), total: monthDeals.reduce((s,d) => s + d.amount, 0) };
    });
    
    new Chart(document.getElementById('forecastChart').getContext('2d'), {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          { label: 'Weighted Expected', data: data.map(d => d.actual), backgroundColor: '#6366f1' },
          { label: 'Total Pipeline', data: data.map(d => d.total), backgroundColor: '#e2e8f0' }
        ]
      },
      options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { ticks: { callback: v => '$' + (v/1000000) + 'M' } } } }
    });

    // Stages
    const stages = { 'marketing': 'Marketing', 'LOI': 'LOI', 'term-sheet': 'Term Sheet', 'due-diligence': 'Due Diligence' };
    document.getElementById('forecastStages').innerHTML = Object.entries(stages).map(([k,v]) => {
      const deals = this.deals.filter(d => d.stage === k);
      const sum = deals.reduce((s,d) => s + d.amount, 0);
      return `<div class="forecast-stage"><div class="stage-header"><span>${v}</span><span>${deals.length} deals • ${this.f(sum)}</span></div><div class="stage-bar"><div class="fill" style="width:${totalPipeline ? sum/totalPipeline*100 : 0}%"></div></div></div>`;
    }).join('');

    // Monthly table
    const months2 = [];
    for (let i = 0; i < 6; i++) { const d = new Date(now.getFullYear(), now.getMonth() + i, 1); months2.push({ m: d.toLocaleDateString('en-US',{month:'short',year:'2-digit'}), deals: this.deals.filter(x => new Date(x.closeDate).getMonth() === d.getMonth() && new Date(x.closeDate).getFullYear() === d.getFullYear()) }); }
    document.getElementById('monthlyTable').innerHTML = months2.map(m => {
      const weighted = m.deals.reduce((s,d) => s + d.amount * d.probability/100, 0);
      const total = m.deals.reduce((s,d) => s + d.amount, 0);
      const prob = total ? Math.round(weighted/total*100) : 0;
      return `<tr><td>${m.m}</td><td>${m.deals.length}</td><td>${this.f(total)}</td><td>${prob}%</td><td><strong>${this.f(weighted)}</strong></td></tr>`;
    }).join('');
  },
  f: function(a) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(a); }
};
