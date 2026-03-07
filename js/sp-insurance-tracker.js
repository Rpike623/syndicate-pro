/**
 * SP Insurance Tracker
 */
window.InsuranceTracker = {
  STORAGE_KEY: 'dt_insurance_policies',
  init: function() {
    // Set default dates
    const today = new Date();
    const oneYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
    document.getElementById('itStart').value = today.toISOString().split('T')[0];
    document.getElementById('itRenewal').value = oneYear.toISOString().split('T')[0];
    this.render();
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  getPolicies: function() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
    } catch(e) { return []; }
  },
  savePolicies: function(policies) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(policies));
  },
  add: function() {
    const property = document.getElementById('itProperty').value.trim();
    const type = document.getElementById('itType').value;
    const carrier = document.getElementById('itCarrier').value.trim();
    const policyNum = document.getElementById('itPolicyNum').value.trim();
    const premium = parseFloat(document.getElementById('itPremium').value) || 0;
    const coverage = parseFloat(document.getElementById('itCoverage').value) || 0;
    const start = document.getElementById('itStart').value;
    const renewal = document.getElementById('itRenewal').value;
    
    if (!property || !carrier) {
      alert('Please enter property and carrier');
      return;
    }
    
    const policies = this.getPolicies();
    policies.push({
      id: Date.now(),
      property, type, carrier, policyNum, premium, coverage, start, renewal
    });
    this.savePolicies(policies);
    
    // Clear form
    document.getElementById('itProperty').value = '';
    document.getElementById('itCarrier').value = '';
    document.getElementById('itPolicyNum').value = '';
    document.getElementById('itPremium').value = '2500';
    document.getElementById('itCoverage').value = '500000';
    
    this.render();
  },
  remove: function(id) {
    let policies = this.getPolicies();
    policies = policies.filter(p => p.id !== id);
    this.savePolicies(policies);
    this.render();
  },
  render: function() {
    const policies = this.getPolicies();
    const tbody = document.querySelector('#itTable tbody');
    tbody.innerHTML = '';
    
    let totalPremium = 0;
    let totalCoverage = 0;
    let expiringSoon = 0;
    
    const today = new Date();
    
    policies.forEach(p => {
      totalPremium += p.premium;
      totalCoverage += p.coverage;
      
      let daysUntil = 0;
      if (p.renewal) {
        const renewalDate = new Date(p.renewal);
        const diffTime = renewalDate - today;
        daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      
      if (daysUntil > 0 && daysUntil <= 30) expiringSoon++;
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${p.property}</td>
        <td>${p.type}</td>
        <td>${p.carrier}</td>
        <td>${this.f(p.premium)}</td>
        <td>${p.renewal || '-'}</td>
        <td class="${daysUntil <= 30 ? 'text-warning' : ''}">${daysUntil > 0 ? daysUntil : 'Expired'}</td>
        <td><button class="btn btn-sm btn-danger" onclick="InsuranceTracker.remove(${p.id})"><i class="fas fa-trash"></i></button></td>
      `;
      tbody.appendChild(row);
    });
    
    document.getElementById('itTotalPolicies').textContent = policies.length;
    document.getElementById('itTotalPremium').textContent = this.f(totalPremium);
    document.getElementById('itExpiringSoon').textContent = expiringSoon;
    document.getElementById('itTotalCoverage').textContent = this.f(totalCoverage);
  }
};