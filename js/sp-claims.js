/**
 * SP Insurance Claims
 */
window.Claims = {
  claims: [],
  init: function() {
    this.claims = [
      { property:'Sunset Apartments', type:'Water Damage', date:'2026-01-15', amount:12500, status:'closed', resolution:'Paid in full', paid:12500 },
      { property:'Downtown Office', type:'Liability', date:'2025-11-20', amount:8500, status:'closed', resolution:'Settled', paid:8500 },
      { property:'Industrial Portfolio', type:'Storm', date:'2026-02-28', amount:22000, status:'open', resolution:'', paid:0 },
      { property:'Coastal Retail', type:'Water Damage', date:'2026-03-01', amount:4500, status:'pending', resolution:'', paid:0 }
    ];
    this.render();
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  render: function() {
    const open = this.claims.filter(c => c.status === 'open').length;
    const closed = this.claims.filter(c => c.status === 'closed').length;
    const paid = this.claims.reduce((s,c) => s + (c.paid||0), 0);
    const pending = this.claims.filter(c => c.status !== 'closed').reduce((s,c) => s + c.amount, 0);
    document.getElementById('statOpen').textContent = open;
    document.getElementById('statClosed').textContent = closed;
    document.getElementById('statPaid').textContent = this.f(paid);
    document.getElementById('statPending').textContent = this.f(pending);
    document.getElementById('claimsTable').innerHTML = this.claims.map(c => `<tr><td>${c.property}</td><td>${c.type}</td><td>${new Date(c.date).toLocaleDateString()}</td><td>${this.f(c.amount)}</td><td><span class="badge badge-${c.status==='closed'?'success':c.status==='open'?'warning':'secondary'}">${c.status}</span></td><td>${c.resolution || '—'}</td></tr>`).join('');
  },
  showModal: function() { document.getElementById('claimModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('claimModal').style.display = 'none'; },
  save: function() { alert('Claim filed!'); this.closeModal(); }
};
