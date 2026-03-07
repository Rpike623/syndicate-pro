/**
 * SP Insurance Summary
 */
window.Ins = {
  policies: [],
  init: function() {
    const y = new Date().getFullYear();
    this.policies = [
      { property:'Sunset Apartments', type:'Property', carrier:'Liberty Mutual', limit:15000000, premium:42000, expiry:`${y+1}-03-15`, status:'active' },
      { property:'Sunset Apartments', type:'Liability', carrier:'Liberty Mutual', limit:5000000, premium:12000, expiry:`${y+1}-03-15`, status:'active' },
      { property:'Downtown Office', type:'Property', carrier:'Travelers', limit:10000000, premium:28000, expiry:`${y+1}-06-30`, status:'active' },
      { property:'Downtown Office', type:'Umbrella', carrier:'Travelers', limit:5000000, premium:8500, expiry:`${y+1}-06-30`, status:'active' },
      { property:'Industrial Portfolio', type:'Property', carrier:'MetLife', limit:25000000, premium:55000, expiry:`${y}-11-30`, status:'renewal' }
    ];
    this.render();
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  render: function() {
    const totalPrem = this.policies.reduce((s,p) => s + p.premium, 0);
    const totalCov = this.policies.reduce((s,p) => s + p.limit, 0);
    const renew = this.policies.filter(p => p.status === 'renewal').length;
    document.getElementById('statPremium').textContent = this.f(totalPrem);
    document.getElementById('statPolicies').textContent = this.policies.length;
    document.getElementById('statCoverage').textContent = this.f(totalCov);
    document.getElementById('statRenew').textContent = renew;
    document.getElementById('insTable').innerHTML = this.policies.map(p => `<tr><td>${p.property}</td><td>${p.type}</td><td>${p.carrier}</td><td>${this.f(p.limit)}</td><td>${this.f(p.premium)}</td><td>${new Date(p.expiry).toLocaleDateString()}</td><td><span class="badge badge-${p.status==='active'?'success':'warning'}">${p.status}</span></td></tr>`).join('');
  },
  showModal: function() { document.getElementById('insModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('insModal').style.display = 'none'; },
  save: function() { alert('Policy added!'); this.closeModal(); }
};