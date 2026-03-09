/**
 * SP Market Comps
 */
window.Comps = {
  comps: [],
  init: function() {
    const s = JSON.stringify(SP.load('comps', null));
    if (s) this.comps = JSON.parse(s);
    else this.comps = this.sample();
    this.render();
  },
  sample: function() {
    return [
      { name:'The Residences at Midtown', location:'Austin, TX', type:'Multifamily', price:18500000, sf:85000, cap:5.2, noi:962000, status:'Sold' },
      { name:'Park Central Apartments', location:'Phoenix, AZ', type:'Multifamily', price:14200000, sf:72000, cap:5.5, noi:781000, status:'Sold' },
      { name:'Gateway Office Plaza', location:'Dallas, TX', type:'Office', price:9200000, sf:45000, cap:6.8, noi:625600, status:'Active' },
      { name:'Distribution Center IV', location:'Houston, TX', type:'Industrial', price:21000000, sf:150000, cap:4.9, noi:1029000, status:'Sold' },
      { name:'Sunset View Apartments', location:'Phoenix, AZ', type:'Multifamily', price:16800000, sf:78000, cap:5.3, noi:890400, status:'Active' },
      { name:'Retail Commons', location:'Austin, TX', type:'Retail', price:7500000, sf:38000, cap:6.5, noi:487500, status:'Sold' }
    ];
  },
  save: function() { SP.save('comps', this.comps); },
  sampleData: function() { this.comps = this.sample(); this.save(); this.render(); },
  render: function() {
    const total = this.comps.length;
    const avgPrice = this.comps.reduce((s,c) => s + (c.price/c.sf), 0) / total;
    const avgCap = this.comps.reduce((s,c) => s + c.cap, 0) / total;
    const avgNoi = this.comps.reduce((s,c) => s + c.noi, 0) / total;
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statPrice').textContent = '$' + avgPrice.toFixed(0);
    document.getElementById('statCap').textContent = avgCap.toFixed(1) + '%';
    document.getElementById('statNoi').textContent = this.f(avgNoi);
    document.getElementById('compTable').innerHTML = this.comps.map(c => `<tr><td><strong>${c.name}</strong></td><td>${c.location}</td><td>${c.type}</td><td>${this.f(c.price)}</td><td>${c.sf.toLocaleString()}</td><td>$${Math.round(c.price/c.sf)}</td><td>${c.cap}%</td><td>${this.f(c.noi)}</td><td><span class="badge badge-${c.status==='Sold'?'success':'info'}">${c.status}</span></td></tr>`).join('');
  },
  showModal: function() { document.getElementById('compModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('compModal').style.display = 'none'; },
  save: function() {
    this.comps.push({ name:document.getElementById('cName').value, location:document.getElementById('cLocation').value, type:document.getElementById('cType').value, price:parseInt(document.getElementById('cPrice').value)||0, sf:parseInt(document.getElementById('cSf').value)||0, cap:parseFloat(document.getElementById('cCap').value)||0, noi:parseInt(document.getElementById('cNoi').value)||0, status:'Active' });
    this.save(); this.render(); this.closeModal();
  },
  f: function(a) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(a); }
};
