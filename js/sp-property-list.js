/**
 * SP Property List
 */
window.PropList = {
  properties: [],
  init: function() {
    this.properties = [
      { name:'Sunset Apartments', type:'Multifamily', units:100, sf:85000, occupancy:96, noi:1030000, value:14500000 },
      { name:'Downtown Office', type:'Office', units:50, sf:45000, occupancy:88, noi:620000, value:9200000 },
      { name:'Industrial Portfolio', type:'Industrial', units:3, sf:150000, occupancy:100, noi:1400000, value:21000000 },
      { name:'Coastal Retail', type:'Retail', units:12, sf:38000, occupancy:92, noi:480000, value:7100000 }
    ];
    this.render();
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  render: function() {
    const count = this.properties.length;
    const units = this.properties.reduce((s,p) => s + p.units, 0);
    const sf = this.properties.reduce((s,p) => s + p.sf, 0);
    const occ = Math.round(this.properties.reduce((s,p) => s + p.occupancy, 0) / count);
    document.getElementById('statCount').textContent = count;
    document.getElementById('statUnits').textContent = units;
    document.getElementById('statSf').textContent = sf.toLocaleString();
    document.getElementById('statOcc').textContent = occ + '%';
    document.getElementById('propTable').innerHTML = this.properties.map(p => `<tr><td>${p.name}</td><td>${p.type}</td><td>${p.units}</td><td>${p.sf.toLocaleString()}</td><td class="text-success">${p.occupancy}%</td><td>${this.f(p.noi)}</td><td>${this.f(p.value)}</td></tr>`).join('');
  },
  showModal: function() { document.getElementById('propModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('propModal').style.display = 'none'; },
  save: function() { alert('Property added!'); this.closeModal(); }
};