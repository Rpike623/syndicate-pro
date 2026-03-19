/**
 * SP Portfolio - Fund-Level Reporting
 * Aggregate view across all deals
 */

window.Portfolio = {
  deals: [],
  investors: [],
  distributions: [],
  aumChart: null,
  allocationChart: null,

  init: async function() {
    await this.loadData();
    this.renderKPIs();
    this.renderCharts();
    this.renderPL();
    this.renderPerformance();
  },

  loadData: async function() {
    // Load real deals from Firestore/SP
    let rawDeals = SP.getDeals ? SP.getDeals() : [];

    // Normalize deal fields — real deals use 'raise'/'totalEquity', demo uses 'currentValue'/'purchasePrice'
    this.deals = rawDeals.map(d => ({
      ...d,
      currentValue: d.currentValue || d.raise || d.totalEquity || 0,
      purchasePrice: d.purchasePrice || d.raise || 0,
      equity: d.equity || d.totalEquity || d.raise || 0,
      noi: d.noi || 0,
      expenses: d.expenses || 0,
      debtService: d.debtService || 0,
      irr: d.irr || 0,
      moic: d.moic || (d.equity && d.equity > 0 ? d.equity : 0),
      occupancy: d.occupancy || 0,
      investorCount: (d.investors || []).length,
      name: d.name || 'Unnamed Deal',
      address: d.address || d.location || '',
      type: d.type || 'Real Estate',
      status: d.status || 'operating'
    }));

    if (!this.deals.length) {
      this.deals = this.generateDemoDeals();
    }

    // Load investors
    this.investors = SP.getInvestors ? SP.getInvestors() : [];
    if (!this.investors.length) {
      this.investors = this.generateDemoInvestors();
    }

    // Load distributions from Firestore/SP or generate demo
    let rawDists = SP.getDistributions ? SP.getDistributions() : [];
    if (rawDists.length) {
      // Normalize real distributions
      this.distributions = [];
      rawDists.forEach(d => {
        const amt = d.totalAmount || 0;
        if (amt > 0) {
          this.distributions.push({
            dealId: d.dealId,
            dealName: d.dealName || this.getDealName(d.dealId),
            date: d.date,
            amount: amt,
            type: 'distribution'
          });
        }
      });
    }
    if (!this.distributions.length) {
      this.distributions = this.generateDemoDistributions();
    }
  },

  getDealName: function(dealId) {
    const d = this.deals.find(x => x.id === dealId);
    return d ? d.name : 'Unknown Deal';
  },

  generateDemoDeals: function() {
    return [
      { 
        id: 'deal_1', name: 'Sunset Apartments', 
        address: 'Phoenix, AZ', type: 'Multifamily',
        purchasePrice: 12000000, currentValue: 14500000,
        noi: 850000, expenses: 320000, debtService: 480000,
        irr: 18.5, moic: 1.42, occupancy: 95,
        investorCount: 12, equity: 4500000, debt: 7500000,
        status: 'operating'
      },
      { 
        id: 'deal_2', name: 'Downtown Office', 
        address: 'Austin, TX', type: 'Office',
        purchasePrice: 8500000, currentValue: 9200000,
        noi: 620000, expenses: 280000, debtService: 380000,
        irr: 14.2, moic: 1.28, occupancy: 88,
        investorCount: 8, equity: 3500000, debt: 5000000,
        status: 'operating'
      },
      { 
        id: 'deal_3', name: 'Industrial Portfolio', 
        address: 'Dallas, TX', type: 'Industrial',
        purchasePrice: 18000000, currentValue: 21000000,
        noi: 1400000, expenses: 420000, debtService: 720000,
        irr: 16.8, moic: 1.35, occupancy: 100,
        investorCount: 15, equity: 7200000, debt: 10800000,
        status: 'operating'
      },
      { 
        id: 'deal_4', name: 'Coastal Retail', 
        address: 'Miami, FL', type: 'Retail',
        purchasePrice: 6500000, currentValue: 7100000,
        noi: 480000, expenses: 195000, debtService: 290000,
        irr: 12.1, moic: 1.18, occupancy: 92,
        investorCount: 6, equity: 2600000, debt: 3900000,
        status: 'value-add'
      }
    ];
  },

  generateDemoInvestors: function() {
    return Array.from({ length: 41 }, (_, i) => ({
      id: `inv_${i + 1}`,
      firstName: ['John', 'Sarah', 'Mike', 'Lisa', 'David', 'Jennifer', 'Robert'][i % 7],
      lastName: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller'][i % 7],
      email: `investor${i + 1}@email.com`,
      totalInvested: 50000 + Math.floor(Math.random() * 450000)
    }));
  },

  generateDemoDistributions: function() {
    const now = new Date();
    const year = now.getFullYear();
    return [
      { dealId: 'deal_1', dealName: 'Sunset Apartments', date: `${year}-01-15`, amount: 125000, type: 'distribution' },
      { dealId: 'deal_1', dealName: 'Sunset Apartments', date: `${year}-02-15`, amount: 125000, type: 'distribution' },
      { dealId: 'deal_1', dealName: 'Sunset Apartments', date: `${year}-03-15`, amount: 125000, type: 'distribution' },
      { dealId: 'deal_2', dealName: 'Downtown Office', date: `${year}-01-20`, amount: 85000, type: 'distribution' },
      { dealId: 'deal_2', dealName: 'Downtown Office', date: `${year}-02-20`, amount: 85000, type: 'distribution' },
      { dealId: 'deal_3', dealName: 'Industrial Portfolio', date: `${year}-01-10`, amount: 180000, type: 'distribution' },
      { dealId: 'deal_3', dealName: 'Industrial Portfolio', date: `${year}-02-10`, amount: 180000, type: 'distribution' },
      { dealId: 'deal_3', dealName: 'Industrial Portfolio', date: `${year}-03-10`, amount: 180000, type: 'distribution' },
      { dealId: 'deal_4', dealName: 'Coastal Retail', date: `${year}-02-25`, amount: 65000, type: 'distribution' },
    ];
  },

  renderKPIs: function() {
    const totalAUM = this.deals.reduce((sum, d) => sum + (d.currentValue || 0), 0);
    const totalInvestors = this.deals.reduce((sum, d) => sum + (d.investorCount || 0), 0) || this.investors.length;
    const validIrr = this.deals.filter(d => d.irr > 0);
    const avgIrr = validIrr.length ? validIrr.reduce((sum, d) => sum + d.irr, 0) / validIrr.length : 0;
    const totalDistributions = this.distributions.reduce((sum, d) => sum + (d.amount || 0), 0);
    const totalEquity = this.deals.reduce((sum, d) => sum + (d.equity || 0), 0);
    const avgMoic = totalEquity > 0 ? totalAUM / totalEquity : 0;

    document.getElementById('kpiAum').textContent = this.formatCurrency(totalAUM);
    document.getElementById('kpiInvestors').textContent = totalInvestors;
    document.getElementById('kpiIrr').textContent = avgIrr.toFixed(1) + '%';
    document.getElementById('kpiDistributions').textContent = this.formatCurrency(totalDistributions);
    document.getElementById('kpiMoic').textContent = (avgMoic > 0 ? avgMoic.toFixed(2) : '0.00') + 'x';
  },

  renderCharts: function() {
    // AUM Over Time Chart
    const aumCtx = document.getElementById('aumChart');
    if (!aumCtx) return;
    const ctx = aumCtx.getContext('2d');
    const totalAUM = this.deals.reduce((sum, d) => sum + (d.currentValue || 0), 0);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    // Generate reasonable curve based on actual AUM
    const base = Math.round(totalAUM * 0.75);
    const aumData = months.map((_, i) => Math.round(base + (totalAUM - base) * (i / (months.length - 1))));
    
    this.aumChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          label: 'AUM',
          data: aumData,
          borderColor: '#F37925',
          backgroundColor: 'rgba(243,121,37,0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { 
            ticks: { callback: v => '$' + (v >= 1e6 ? (v/1e6).toFixed(1) + 'M' : (v/1e3).toFixed(0) + 'K') }
          }
        }
      }
    });

    // Allocation Chart
    const allocCtx = document.getElementById('allocationChart');
    if (!allocCtx) return;
    const dealNames = this.deals.map(d => d.name);
    const dealValues = this.deals.map(d => d.currentValue || 0);
    
    // Only render if there's data
    if (dealValues.some(v => v > 0)) {
      this.allocationChart = new Chart(allocCtx.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: dealNames,
          datasets: [{
            data: dealValues,
            backgroundColor: ['#F37925', '#2D9A6B', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4']
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'right' }
          }
        }
      });
    }
  },

  renderPL: function() {
    const tbody = document.getElementById('plTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = this.deals.map(deal => {
      const noi = deal.noi || 0;
      const expenses = deal.expenses || 0;
      const debtService = deal.debtService || 0;
      const distributions = this.distributions
        .filter(d => d.dealId === deal.id)
        .reduce((sum, d) => sum + (d.amount || 0), 0);
      const netCashFlow = noi - expenses - debtService;
      const value = deal.currentValue || 0;

      return `
        <tr>
          <td>
            <strong>${deal.name}</strong><br>
            <small class="text-muted">${deal.address || deal.location || ''}</small>
          </td>
          <td class="text-success">${this.formatCurrency(noi)}</td>
          <td>${this.formatCurrency(expenses)}</td>
          <td>${this.formatCurrency(debtService)}</td>
          <td>${this.formatCurrency(distributions)}</td>
          <td class="${netCashFlow >= 0 ? 'text-success' : 'text-danger'}">${this.formatCurrency(netCashFlow)}</td>
          <td>${this.formatCurrency(value)}</td>
        </tr>
      `;
    }).join('');

    // Totals
    const totalNoi = this.deals.reduce((s, d) => s + (d.noi || 0), 0);
    const totalExpenses = this.deals.reduce((s, d) => s + (d.expenses || 0), 0);
    const totalDebt = this.deals.reduce((s, d) => s + (d.debtService || 0), 0);
    const totalDist = this.distributions.reduce((s, d) => s + (d.amount || 0), 0);
    const totalCashFlow = totalNoi - totalExpenses - totalDebt;
    const totalValue = this.deals.reduce((s, d) => s + (d.currentValue || 0), 0);

    const el = id => document.getElementById(id);
    if (el('totalNoi')) el('totalNoi').textContent = this.formatCurrency(totalNoi);
    if (el('totalExpenses')) el('totalExpenses').textContent = this.formatCurrency(totalExpenses);
    if (el('totalDebt')) el('totalDebt').textContent = this.formatCurrency(totalDebt);
    if (el('totalDist')) el('totalDist').textContent = this.formatCurrency(totalDist);
    if (el('totalCashFlow')) el('totalCashFlow').textContent = this.formatCurrency(totalCashFlow);
    if (el('totalValue')) el('totalValue').textContent = this.formatCurrency(totalValue);
  },

  renderPerformance: function() {
    const grid = document.getElementById('performanceGrid');
    if (!grid) return;
    
    grid.innerHTML = this.deals.map(deal => {
      const purchasePrice = deal.purchasePrice || 0;
      const currentValue = deal.currentValue || 0;
      const gain = purchasePrice > 0 ? ((currentValue - purchasePrice) / purchasePrice * 100) : 0;
      const irr = deal.irr || 0;
      const moic = deal.moic || 0;
      // For real deals that use equity multiple field
      const moicDisplay = typeof moic === 'number' && moic > 0 ? moic.toFixed(2) : '0.00';
      
      return `
        <div class="performance-card">
          <div class="perf-header">
            <h4>${deal.name}</h4>
            <span class="badge badge-${deal.status === 'operating' ? 'success' : deal.status === 'closed' ? 'info' : 'warning'}">${deal.status || '—'}</span>
          </div>
          <div class="perf-stats">
            <div class="perf-stat">
              <span class="perf-label">Value</span>
              <span class="perf-value">${this.formatCurrency(currentValue)}</span>
            </div>
            <div class="perf-stat">
              <span class="perf-label">Gain</span>
              <span class="perf-value ${gain >= 0 ? 'text-success' : 'text-danger'}">${gain >= 0 ? '+' : ''}${gain.toFixed(1)}%</span>
            </div>
            <div class="perf-stat">
              <span class="perf-label">IRR</span>
              <span class="perf-value">${irr > 0 ? irr.toFixed(1) + '%' : '—'}</span>
            </div>
            <div class="perf-stat">
              <span class="perf-label">MOIC</span>
              <span class="perf-value">${moicDisplay}x</span>
            </div>
          </div>
          <div class="perf-bar">
            <div class="perf-bar-fill" style="width: ${Math.min(Math.max(gain, 0) / 2, 100)}%"></div>
          </div>
        </div>
      `;
    }).join('');
  },

  exportReport: function() {
    const report = [
      'PORTFOLIO OVERVIEW REPORT',
      `Generated: ${new Date().toLocaleString()}`,
      '',
      '=== KEY METRICS ===',
      `Total AUM: ${document.getElementById('kpiAum').textContent}`,
      `Active Investors: ${document.getElementById('kpiInvestors').textContent}`,
      `Blended IRR: ${document.getElementById('kpiIrr').textContent}`,
      `Total Distributions: ${document.getElementById('kpiDistributions').textContent}`,
      `Avg MOIC: ${document.getElementById('kpiMoic').textContent}`,
      '',
      '=== DEAL PERFORMANCE ===',
      ...this.deals.map(d => `${d.name}: ${this.formatCurrency(d.currentValue)} | IRR: ${d.irr}% | MOIC: ${(d.moic||0).toFixed(2)}x`)
    ].join('\n');

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio_report_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  },

  formatCurrency: function(amt) {
    if (amt === undefined || amt === null || isNaN(amt)) return '$0';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amt);
  }
};
