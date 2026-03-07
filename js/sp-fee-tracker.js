/**
 * SP Fee Tracker
 */
window.FeeTracker = {
  fees: [],
  init: function() {
    this.fees = [
      { type:'Asset Management', property:'Sunset Apartments', rate:1.0, freq:'Monthly', annual:198000, status:'active' },
      { type:'Asset Management', property:'Downtown Office', rate:1.0, freq:'Monthly', annual:110400, status:'active' },
      { type:'Acquisition', property:'All Properties', rate:1.5, freq:'One-time', annual:0, status:'active' },
      { type:'Disposition', property:'All Properties', rate:1.0, freq:'One-time', annual:0, status:'active' },
      { type:'Construction Management', property:'Sunset Apartments', rate:3.0, freq:'Monthly', annual:144000, status:'active' }
    ];
    this.render();
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  render: function() {
    const total = this.fees.reduce((s,f) => s + f.annual, 0);
    const am = this.fees.filter(f => f.type === 'Asset Management').reduce((s,f) => s + f.annual, 0);
    const acq = this.fees.filter(f => f.type === 'Acquisition').reduce((s,f) => s + f.annual, 0);
    const disp = this.fees.filter(f => f.type === 'Disposition').reduce((s,f) => s + f.annual, 0);
    document.getElementById('statTotal').textContent = this.f(total);
    document.getElementById('statAM').textContent = this.f(am);
    document.getElementById('statAcq').textContent = this.f(acq);
    document.getElementById('statDisp').textContent = this.f(disp);
    document.getElementById('feeTable').innerHTML = this.fees.map(f => `<tr><td>${f.type}</td><td>${f.property}</td><td>${f.rate}%</td><td>${f.freq}</td><td>${f.annual ? this.f(f.annual) : '—'}</td><td><span class="badge badge-success">${f.status}</span></td></tr>`).join('');
  },
  showModal: function() { document.getElementById('feeModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('feeModal').style.display = 'none'; },
  save: function() { alert('Fee added!'); this.closeModal(); }
};