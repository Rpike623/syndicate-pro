/**
 * SP Cap Table V2 - Enhanced with charts & scenarios
 */
window.CapTable = {
  data: {},
  chart: null,
  init: function() {
    this.data = {
      deal_1: { name: 'Sunset Apartments', equity: 4500000, gpOwnership: 20, investors: [
        { name: 'Robert Pike (GP)', type: 'GP', investment: 900000, status: 'active' },
        { name: 'John Smith', type: 'LP', investment: 500000, status: 'active' },
        { name: 'Sarah Williams', type: 'LP', investment: 350000, status: 'active' },
        { name: 'Mike Johnson', type: 'LP', investment: 400000, status: 'active' },
        { name: 'Lisa Brown', type: 'LP', investment: 250000, status: 'active' },
        { name: 'David Jones', type: 'LP', investment: 300000, status: 'active' },
        { name: 'Jennifer Lee', type: 'LP', investment: 450000, status: 'active' },
        { name: 'Tom Wilson', type: 'LP', investment: 200000, status: 'inactive' },
        { name: 'Amy Garcia', type: 'LP', investment: 350000, status: 'active' },
        { name: 'Chris Martinez', type: 'LP', investment: 250000, status: 'active' },
        { name: 'Rachel Kim', type: 'LP', investment: 300000, status: 'active' },
        { name: 'Steve Taylor', type: 'LP', investment: 200000, status: 'active' }
      ]},
      deal_2: { name: 'Downtown Office', equity: 3500000, gpOwnership: 20, investors: [
        { name: 'Robert Pike (GP)', type: 'GP', investment: 700000, status: 'active' },
        { name: 'John Smith', type: 'LP', investment: 400000, status: 'active' },
        { name: 'Sarah Williams', type: 'LP', investment: 300000, status: 'active' },
        { name: 'Mike Johnson', type: 'LP', investment: 500000, status: 'active' },
        { name: 'Lisa Brown', type: 'LP', investment: 400000, status: 'active' },
        { name: 'David Jones', type: 'LP', investment: 300000, status: 'active' },
        { name: 'Tom Wilson', type: 'LP', investment: 250000, status: 'active' },
        { name: 'Amy Garcia', type: 'LP', investment: 250000, status: 'active' }
      ]},
      deal_3: { name: 'Industrial Portfolio', equity: 7200000, gpOwnership: 20, investors: [
        { name: 'Robert Pike (GP)', type: 'GP', investment: 1440000, status: 'active' },
        { name: 'John Smith', type: 'LP', investment: 750000, status: 'active' },
        { name: 'Sarah Williams', type: 'LP', investment: 600000, status: 'active' },
        { name: 'Mike Johnson', type: 'LP', investment: 500000, status: 'active' },
        { name: 'Lisa Brown', type: 'LP', investment: 450000, status: 'active' },
        { name: 'David Jones', type: 'LP', investment: 400000, status: 'active' },
        { name: 'Jennifer Lee', type: 'LP', investment: 350000, status: 'active' },
        { name: 'Tom Wilson', type: 'LP', investment: 300000, status: 'active' },
        { name: 'Amy Garcia', type: 'LP', investment: 350000, status: 'active' },
        { name: 'Chris Martinez', type: 'LP', investment: 250000, status: 'active' },
        { name: 'Rachel Kim', type: 'LP', investment: 300000, status: 'active' },
        { name: 'Steve Taylor', type: 'LP', investment: 250000, status: 'active' },
        { name: 'Nancy White', type: 'LP', investment: 300000, status: 'active' },
        { name: 'Paul Harris', type: 'LP', investment: 250000, status: 'active' },
        { name: 'Mary Clark', type: 'LP', investment: 350000, status: 'active' }
      ]}
    };
  },
  loadDeal: function() {
    const id = document.getElementById('dealSelect').value;
    if (!id) { document.getElementById('capContent').style.display = 'none'; document.getElementById('emptyState').style.display = 'block'; return; }
    document.getElementById('capContent').style.display = 'block'; document.getElementById('emptyState').style.display = 'none';
    const deal = this.data[id];
    const gpInv = deal.investors.find(i => i.type === 'GP');
    const gpShare = gpInv ? (gpInv.investment / deal.equity * 100) : deal.gpOwnership;
    const lpShare = 100 - gpShare;
    
    document.getElementById('totalEquity').textContent = this.f(deal.equity);
    document.getElementById('totalInvestors').textContent = deal.investors.length;
    document.getElementById('lpPct').textContent = lpShare.toFixed(1) + '%';
    document.getElementById('gpPct').textContent = gpShare.toFixed(1) + '%';
    
    document.getElementById('capTableBody').innerHTML = deal.investors.map(i => {
      const pct = (i.investment / deal.equity * 100).toFixed(2);
      return `<tr><td><strong>${i.name}</strong></td><td><span class="badge badge-${i.type==='GP'?'warning':'info'}">${i.type}</span></td><td>${this.f(i.investment)}</td><td>${pct}%</td><td>${i.type === 'GP' ? 'Class A' : 'Class B'}</td><td><span class="badge badge-${i.status==='active'?'success':'secondary'}">${i.status}</span></td></tr>`;
    }).join('');
    
    // Chart
    if (this.chart) this.chart.destroy();
    const ctx = document.getElementById('capChart').getContext('2d');
    const gpData = deal.investors.filter(i => i.type === 'GP').reduce((s,i) => s + i.investment, 0);
    const lpData = deal.investors.filter(i => i.type === 'LP').reduce((s,i) => s + i.investment, 0);
    this.chart = new Chart(ctx, { type: 'doughnut', data: { labels: ['GP', 'LPs'], datasets: [{ data: [gpData, lpData], backgroundColor: ['#f59e0b', '#6366f1'] }] }, options: { plugins: { legend: { position: 'bottom' } } } });
    
    this.scenario();
  },
  scenario: function() {
    const dealId = document.getElementById('dealSelect').value;
    if (!dealId) return;
    const deal = this.data[dealId];
    const newInvest = parseInt(document.getElementById('newInvest').value) || 0;
    const gpContrib = parseInt(document.getElementById('gpContrib').value) || 0;
    const newName = document.getElementById('newInvestor').value || 'New Investor';
    
    const oldTotal = deal.equity;
    const newTotal = oldTotal + newInvest + gpContrib;
    const oldGp = deal.investors.find(i => i.type === 'GP').investment;
    const newGp = oldGp + gpContrib;
    const oldLp = oldTotal - oldGp;
    const newLp = oldLp + newInvest;
    
    const gpOldPct = (oldGp / oldTotal * 100).toFixed(1);
    const gpNewPct = (newGp / newTotal * 100).toFixed(1);
    const lpOldPct = (oldLp / oldTotal * 100).toFixed(1);
    const lpNewPct = (newLp / newTotal * 100).toFixed(1);
    const dilGP = (gpOldPct - gpNewPct).toFixed(1);
    const dilLP = (lpNewPct - lpOldPct).toFixed(1);
    
    document.getElementById('scenarioResults').innerHTML = `<div class="scenario-table"><table class="data-table"><thead><tr><th>Class</th><th>Before</th><th>After</th><th>Change</th></tr></thead><tbody>
      <tr><td><strong>GP</strong></td><td>${gpOldPct}%</td><td>${gpNewPct}%</td><td class="${dilGP>0?'text-danger':'text-success'}">${dilGP > 0 ? '-' + dilGP : '+' + Math.abs(dilGP)}%</td></tr>
      <tr><td><strong>LPs</strong></td><td>${lpOldPct}%</td><td>${lpNewPct}%</td><td class="text-success">+${dilLP}%</td></tr>
    </tbody></table></div><p class="scenario-note">${newInvest ? 'Adding ' + newName + ' dilutes existing ownership by ' + dilGP + '%' : ''}</p>`;
  },
  f: function(a) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(a); }
};
