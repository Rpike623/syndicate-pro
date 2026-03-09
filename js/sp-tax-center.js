/**
 * SP Tax Center - Comprehensive Tax Management
 */

window.TaxCenter = {
  k1s: [],
  deals: [],

  init: async function() {
    this.loadData();
    this.renderK1s();
  },

  loadData: async function() {
    const k1Stored = JSON.stringify(SP.load('tax_k1s', null));
    if (k1Stored) this.k1s = JSON.parse(k1Stored);
    else this.k1s = this.generateDemo();

    this.deals = [
      { id: 'deal_1', name: 'Sunset Apartments', basis: 12000000, depreciation: 240000 },
      { id: 'deal_2', name: 'Downtown Office', basis: 8500000, depreciation: 170000 },
      { id: 'deal_3', name: 'Industrial Portfolio', basis: 18000000, depreciation: 360000 }
    ];

    // Stats
    const totalIncome = this.k1s.reduce((s, k) => s + k.ordinaryIncome + k.capitalGains, 0);
    document.getElementById('statK1s').textContent = this.k1s.length;
    document.getElementById('statIncome').textContent = this.formatCurrency(totalIncome);
    document.getElementById('statDeductions').textContent = this.formatCurrency(totalIncome * 0.3);
    document.getElementById('statTaxDue').textContent = this.formatCurrency(totalIncome * 0.25);
  },

  generateDemo: function() {
    return [
      { investor: 'John Smith', deal: 'Sunset Apartments', ordinaryIncome: 45000, interest: 1200, dividends: 0, capitalGains: 8500, status: 'generated' },
      { investor: 'Sarah Williams', deal: 'Downtown Office', ordinaryIncome: 32000, interest: 800, dividends: 500, capitalGains: 4200, status: 'generated' },
      { investor: 'Mike Johnson', deal: 'Industrial Portfolio', ordinaryIncome: 58000, interest: 1500, dividends: 0, capitalGains: 12000, status: 'pending' },
      { investor: 'Lisa Brown', deal: 'Sunset Apartments', ordinaryIncome: 28000, interest: 600, dividends: 200, capitalGains: 0, status: 'generated' },
      { investor: 'David Jones', deal: 'Industrial Portfolio', ordinaryIncome: 42000, interest: 900, dividends: 0, capitalGains: 6800, status: 'generated' }
    ];
  },

  switchTab: function(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.getElementById(`tab-${tab}`).style.display = 'block';
    
    if (tab === 'k1s') this.renderK1s();
    if (tab === 'depreciation') this.renderDepreciation();
    if (tab === 'estimates') this.renderEstimates();
  },

  renderK1s: function() {
    document.getElementById('k1TableBody').innerHTML = this.k1s.map(k => {
      const total = k.ordinaryIncome + k.interest + k.dividends + k.capitalGains;
      return `
        <tr>
          <td><strong>${k.investor}</strong></td>
          <td>${k.deal}</td>
          <td>${this.formatCurrency(k.ordinaryIncome)}</td>
          <td>${this.formatCurrency(k.interest)}</td>
          <td>${this.formatCurrency(k.dividends)}</td>
          <td>${this.formatCurrency(k.capitalGains)}</td>
          <td><strong>${this.formatCurrency(total)}</strong></td>
          <td><span class="badge badge-${k.status === 'generated' ? 'success' : 'warning'}">${k.status}</span></td>
        </tr>
      `;
    }).join('');
  },

  renderDepreciation: function() {
    document.getElementById('deprecTableBody').innerHTML = this.deals.map(d => {
      const accumulated = d.depreciation * 2; // 2 years
      const remaining = d.basis - accumulated;
      return `
        <tr>
          <td><strong>${d.name}</strong></td>
          <td>${this.formatCurrency(d.basis)}</td>
          <td>Straight Line</td>
          <td>${this.formatCurrency(d.depreciation)}</td>
          <td>${this.formatCurrency(accumulated)}</td>
          <td>${this.formatCurrency(remaining)}</td>
        </tr>
      `;
    }).join('');
  },

  renderEstimates: function() {
    const now = new Date();
    const year = now.getFullYear();
    const estimates = [
      { quarter: 'Q1 2026', dueDate: `${year}-04-15`, estimated: 45000, paid: 45000, status: 'paid' },
      { quarter: 'Q2 2026', dueDate: `${year}-06-15`, estimated: 45000, paid: 0, status: 'upcoming' },
      { quarter: 'Q3 2026', dueDate: `${year}-09-15`, estimated: 45000, paid: 0, status: 'upcoming' },
      { quarter: 'Q4 2026', dueDate: `${year + 1}-01-15`, estimated: 45000, paid: 0, status: 'upcoming' }
    ];

    document.getElementById('estTableBody').innerHTML = estimates.map(e => `
      <tr>
        <td><strong>${e.quarter}</strong></td>
        <td>${this.formatDate(e.dueDate)}</td>
        <td>${this.formatCurrency(e.estimated)}</td>
        <td>${this.formatCurrency(e.paid)}</td>
        <td><span class="badge badge-${e.status === 'paid' ? 'success' : 'info'}">${e.status}</span></td>
      </tr>
    `).join('');
  },

  generateK1s: function() {
    this.k1s.forEach(k => k.status = 'generated');
    SP.save('tax_k1s', this.k1s);
    this.renderK1s();
    alert('All K-1s generated!');
  },

  exportAll: function() {
    alert('Exporting all tax documents...');
  },

  formatCurrency: function(amt) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amt);
  },

  formatDate: function(d) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
};
