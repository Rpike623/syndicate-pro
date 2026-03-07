/**
 * SP Tenant Directory
 */
window.Tenant = {
  tenants: [],
  init: function() {
    const y = new Date().getFullYear();
    this.tenants = [
      { name:'John Smith', property:'Sunset Apartments', unit:'101', type:'Residential', rent:1650, leaseEnd:`${y+1}-03-31`, status:'active' },
      { name:'Sarah Williams', property:'Sunset Apartments', unit:'102', type:'Residential', rent:1250, leaseEnd:`${y}-06-30`, status:'active' },
      { name:'Mike Johnson', property:'Sunset Apartments', unit:'103', type:'Residential', rent:1700, leaseEnd:`${y+1}-04-30`, status:'active' },
      { name:'Tech Corp', property:'Downtown Office', unit:'200', type:'Commercial', rent:4500, leaseEnd:`${y+2}-02-28`, status:'active' },
      { name:'Law Partners LLC', property:'Downtown Office', unit:'201', type:'Commercial', rent:3800, leaseEnd:`${y+1}-05-31`, status:'active' },
      { name:'Logistics Co', property:'Industrial Portfolio', unit:'A1', type:'Commercial', rent:8500, leaseEnd:`${y+1}-09-30`, status:'active' },
      { name:'Coffee Shop', property:'Coastal Retail', unit:'R1', type:'Commercial', rent:2200, leaseEnd:`${y+1}-12-31`, status:'active' }
    ];
    this.render();
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  render: function() {
    const total = this.tenants.length;
    const res = this.tenants.filter(t => t.type === 'Residential').length;
    const com = this.tenants.filter(t => t.type === 'Commercial').length;
    const avg = this.tenants.reduce((s,t) => s + t.rent, 0) / total;
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statRes').textContent = res;
    document.getElementById('statCom').textContent = com;
    document.getElementById('statAvg').textContent = this.f(avg);
    document.getElementById('tenantTable').innerHTML = this.tenants.map(t => `<tr><td>${t.name}</td><td>${t.property}</td><td>${t.unit}</td><td>${t.type}</td><td>${this.f(t.rent)}</td><td>${new Date(t.leaseEnd).toLocaleDateString()}</td><td><span class="badge badge-success">${t.status}</span></td></tr>`).join('');
  },
  search: function() {
    const q = document.getElementById('search').value.toLowerCase();
    const filtered = this.tenants.filter(t => t.name.toLowerCase().includes(q) || t.property.toLowerCase().includes(q));
    document.getElementById('tenantTable').innerHTML = filtered.map(t => `<tr><td>${t.name}</td><td>${t.property}</td><td>${t.unit}</td><td>${t.type}</td><td>${this.f(t.rent)}</td><td>${new Date(t.leaseEnd).toLocaleDateString()}</td><td><span class="badge badge-success">${t.status}</span></td></tr>`).join('');
  },
  showModal: function() { document.getElementById('tenantModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('tenantModal').style.display = 'none'; },
  save: function() { alert('Tenant added!'); this.closeModal(); }
};
