/**
 * SP Escrow Tracker
 */
window.Escrow = {
  escrows: [],
  init: function() {
    const y = new Date().getFullYear();
    this.escrows = [
      { property:'Sunset Apartments', type:'Purchase Price', amount:1650000, opened:'2026-02-15', milestone:'Closing', status:'active' },
      { property:'Sunset Apartments', type:'Repairs', amount:480000, opened:'2026-02-20', milestone:'Renovation Complete', status:'active' },
      { property:'Downtown Office', type:'Security Deposit', amount:95000, opened:'2026-03-01', milestone:'Lease Start', status:'active' },
      { property:'Industrial Portfolio', type:'Tax & Insurance', amount:125000, opened:'2026-02-01', milestone:'Annual', status:'closed' },
      { property:'Coastal Retail', type:'Purchase Price', amount:710000, opened:'2026-01-15', milestone:'Closing', status:'closed' }
    ];
    this.render();
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  render: function() {
    const active = this.escrows.filter(e => e.status === 'active');
    const total = this.escrows.reduce((s,e) => s + e.amount, 0);
    const inEscrow = active.reduce((s,e) => s + e.amount, 0);
    const closed = this.escrows.filter(e => e.status === 'closed').length;
    document.getElementById('statActive').textContent = active.length;
    document.getElementById('statValue').textContent = this.f(total);
    document.getElementById('statInEscrow').textContent = this.f(inEscrow);
    document.getElementById('statClosed').textContent = closed;
    document.getElementById('escrowTable').innerHTML = this.escrows.map(e => `<tr><td>${e.property}</td><td>${e.type}</td><td>${this.f(e.amount)}</td><td>${new Date(e.opened).toLocaleDateString()}</td><td>${e.milestone}</td><td><span class="badge badge-${e.status==='active'?'warning':'success'}">${e.status}</span></td></tr>`).join('');
  },
  showModal: function() { document.getElementById('escrowModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('escrowModal').style.display = 'none'; },
  save: function() { alert('Escrow created!'); this.closeModal(); }
};