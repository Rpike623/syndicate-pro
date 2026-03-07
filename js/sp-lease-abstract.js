/**
 * SP Lease Abstractor
 */
window.LeaseAbs = {
  leases: [],
  init: function() { this.render(); },
  loadSample: function() {
    const y = new Date().getFullYear();
    this.leases = [
      { tenant:'Tech Corp', property:'Downtown Office', term:36, rent:54000, psf:36, renewal:'1 x 5yr', expiration:`${y+2}-03-01` },
      { tenant:'Law Partners LLC', property:'Downtown Office', term:60, rent:45600, psf:38, renewal:'1 x 5yr', expiration:`${y+4}-05-31` },
      { tenant:'Logistics Co', property:'Industrial Portfolio', term:60, rent:102000, psf:6.8, renewal:'2 x 5yr', expiration:`${y+4}-09-30` },
      { tenant:'Coffee Shop', property:'Coastal Retail', term:24, rent:26400, psf:42, renewal:'None', expiration:`${y+1}-12-31` },
      { tenant:'Retail Co', property:'Coastal Retail', term:36, rent:38000, psf:32, renewal:'1 x 5yr', expiration:`${y+2}-06-30` }
    ];
    this.render();
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  render: function() {
    if (!this.leases.length) { this.loadSample(); return; }
    const total = this.leases.length;
    const com = this.leases.filter(l => l.psf > 10).length;
    const term = Math.round(this.leases.reduce((s,l) => s + l.term, 0) / total);
    const now = new Date();
    const sixMo = new Date(now.getTime() + 180*24*60*60*1000);
    const expiring = this.leases.filter(l => new Date(l.expiration) <= sixMo).length;
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statCom').textContent = com;
    document.getElementById('statTerm').textContent = term + ' mo';
    document.getElementById('statExpiring').textContent = expiring;
    document.getElementById('absTable').innerHTML = this.leases.map(l => `<tr><td>${l.tenant}</td><td>${l.property}</td><td>${l.term} mo</td><td>${this.f(l.rent)}</td><td>$${l.psf}</td><td>${l.renewal}</td><td>${new Date(l.expiration).toLocaleDateString()}</td></tr>`).join('');
  },
  showModal: function() { document.getElementById('absModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('absModal').style.display = 'none'; },
  save: function() { alert('Lease added!'); this.closeModal(); }
};
