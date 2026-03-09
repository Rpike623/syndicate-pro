/**
 * SP Insurance - Policy Tracking
 */

window.Insurance = {
  policies: [],
  deals: [],

  init: async function() {
    await this.loadDeals();
    await this.loadPolicies();
    this.populateDeals();
    this.render();
  },

  loadDeals: async function() {
    this.deals = SP.getDeals ? SP.getDeals() : [];
    if (!this.deals.length) {
      this.deals = [
        { id: 'deal_1', name: 'Sunset Apartments' },
        { id: 'deal_2', name: 'Downtown Office' },
        { id: 'deal_3', name: 'Industrial Portfolio' }
      ];
    }
  },

  loadPolicies: async function() {
    const stored = JSON.stringify(SP.load('insurance', null));
    if (stored) this.policies = JSON.parse(stored);
    else this.policies = this.generateDemo();
  },

  generateDemo: function() {
    const now = new Date();
    const year = now.getFullYear();
    return [
      { id: '1', dealId: 'deal_1', dealName: 'Sunset Apartments', type: 'property', carrier: 'State Farm', premium: 18500, coverage: 8000000, start: `${year}-01-01`, expiry: `${year + 1}-01-01`, status: 'active' },
      { id: '2', dealId: 'deal_1', dealName: 'Sunset Apartments', type: 'liability', carrier: 'Travelers', premium: 4500, coverage: 2000000, start: `${year}-01-01`, expiry: `${year + 1}-01-01`, status: 'active' },
      { id: '3', dealId: 'deal_2', dealName: 'Downtown Office', type: 'property', carrier: 'Chubb', premium: 22000, coverage: 12000000, start: `${year}-02-01`, expiry: `${year + 1}-02-01`, status: 'active' },
      { id: '4', dealId: 'deal_2', dealName: 'Downtown Office', type: 'umbrella', carrier: 'Chubb', premium: 3500, coverage: 5000000, start: `${year}-02-01`, expiry: `${year + 1}-02-01`, status: 'active' },
      { id: '5', dealId: 'deal_3', dealName: 'Industrial Portfolio', type: 'property', carrier: 'Hartford', premium: 28000, coverage: 15000000, start: `${year}-01-15`, expiry: `${year + 1}-01-15`, status: 'active' },
      { id: '6', dealId: 'deal_1', dealName: 'Sunset Apartments', type: 'workers-comp', carrier: 'BWC', premium: 6500, coverage: 500000, start: `${year}-01-01`, expiry: `${year + 1}-01-01`, status: 'active' },
      { id: '7', dealId: 'deal_2', dealName: 'Downtown Office', type: 'liability', carrier: 'AIG', premium: 5200, coverage: 3000000, start: `${year - 1}-08-01`, expiry: `${year}-08-01`, status: 'expiring' }
    ];
  },

  save: function() {
    SP.save('insurance', this.policies);
  },

  populateDeals: function() {
    const opts = '<option value="">Select property...</option>' + 
      this.deals.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    document.getElementById('dealFilter').innerHTML = opts;
    document.getElementById('policyDeal').innerHTML = opts;
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('policyStart').value = today;
    document.getElementById('policyExpiry').value = new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0];
  },

  render: function() {
    const dealFilter = document.getElementById('dealFilter').value;
    const typeFilter = document.getElementById('typeFilter').value;
    let list = this.policies;
    if (dealFilter) list = list.filter(p => p.dealId === dealFilter);
    if (typeFilter) list = list.filter(p => p.type === typeFilter);

    const active = this.policies.filter(p => p.status === 'active').length;
    const premium = this.policies.reduce((s, p) => s + p.premium, 0);
    const coverage = this.policies.reduce((s, p) => s + p.coverage, 0);
    
    const thirtyDays = new Date(Date.now() + 30*24*60*60*1000);
    const expiring = this.policies.filter(p => new Date(p.expiry) <= thirtyDays && p.status === 'active').length;

    document.getElementById('statActive').textContent = active;
    document.getElementById('statPremium').textContent = this.formatCurrency(premium);
    document.getElementById('statExpiring').textContent = expiring;
    document.getElementById('statCoverage').textContent = this.formatCurrency(coverage);

    const tbody = document.getElementById('policyTableBody');
    tbody.innerHTML = list.map(p => `
      <tr>
        <td>${p.dealName}</td>
        <td><span class="badge badge-info">${this.formatType(p.type)}</span></td>
        <td>${p.carrier}</td>
        <td>${this.formatCurrency(p.premium)}</td>
        <td>${this.formatCurrency(p.coverage)}</td>
        <td>${this.formatDate(p.expiry)}</td>
        <td><span class="badge badge-${p.status === 'active' ? 'success' : 'warning'}">${p.status}</span></td>
        <td class="text-center">
          <button class="btn-icon" onclick="Insurance.edit('${p.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn-icon text-danger" onclick="Insurance.delete('${p.id}')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  },

  showAddModal: function() {
    document.getElementById('policyModal').style.display = 'flex';
  },

  closeModal: function() {
    document.getElementById('policyModal').style.display = 'none';
  },

  save: function() {
    const dealId = document.getElementById('policyDeal').value;
    const deal = this.deals.find(d => d.id === dealId);
    const type = document.getElementById('policyType').value;
    const carrier = document.getElementById('policyCarrier').value;
    const premium = parseFloat(document.getElementById('policyPremium').value) || 0;
    const coverage = parseFloat(document.getElementById('policyCoverage').value) || 0;
    const start = document.getElementById('policyStart').value;
    const expiry = document.getElementById('policyExpiry').value;

    if (!dealId || !carrier) { alert('Fill required fields'); return; }

    this.policies.push({
      id: Date.now().toString(), dealId, dealName: deal.name, type, carrier, premium, coverage, start, expiry, status: 'active'
    });

    this.save();
    this.render();
    this.closeModal();
  },

  edit: function(id) { alert('Edit: ' + id); },
  delete: function(id) {
    if (!confirm('Delete?')) return;
    this.policies = this.policies.filter(p => p.id !== id);
    this.save();
    this.render();
  },

  formatType: function(t) {
    return { property: 'Property', liability: 'Liability', umbrella: 'Umbrella', 'workers-comp': 'Workers Comp' }[t] || t;
  },

  formatCurrency: function(amt) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amt);
  },

  formatDate: function(d) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
};
