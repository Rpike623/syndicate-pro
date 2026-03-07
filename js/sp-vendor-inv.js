/**
 * SP Vendor Invoice
 */
window.Inv = {
  init: function() {
    const invs = [
      { vendor:'ABC Plumbing', num:'INV-2026-001', date:'2026-03-01', amount:2500, due:'2026-03-31', status:'pending' },
      { vendor:'Sparky Electric', num:'INV-1042', date:'2026-02-28', amount:1800, due:'2026-03-30', status:'approved' },
      { vendor:'CleanCo Services', num:'CC-5521', date:'2026-03-05', amount:4200, due:'2026-04-04', status:'pending' },
      { vendor:'RoofMasters', num:'RM-889', date:'2026-02-15', amount:12500, due:'2026-03-17', status:'paid' },
      { vendor:'HVAC Solutions', num:'HVAC-221', date:'2026-02-01', amount:8500, due:'2026-03-01', status:'overdue' }
    ];
    const pending = invs.filter(i => i.status === 'pending').reduce((s,i) => s + i.amount, 0);
    const approved = invs.filter(i => i.status === 'approved').reduce((s,i) => s + i.amount, 0);
    const paid = invs.filter(i => i.status === 'paid').reduce((s,i) => s + i.amount, 0);
    const overdue = invs.filter(i => i.status === 'overdue').reduce((s,i) => s + i.amount, 0);
    const fmt = v => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v);
    document.getElementById('statPending').textContent = fmt(pending);
    document.getElementById('statApproved').textContent = fmt(approved);
    document.getElementById('statPaid').textContent = fmt(paid);
    document.getElementById('statOverdue').textContent = fmt(overdue);
    document.getElementById('invTable').innerHTML = invs.map(i => `<tr><td>${i.vendor}</td><td>${i.num}</td><td>${i.date}</td><td>${fmt(i.amount)}</td><td>${i.due}</td><td><span class="badge badge-${i.status==='paid'?'success':i.status==='approved'?'info':i.status==='overdue'?'danger':'warning'}">${i.status}</span></td></tr>`).join('');
  },
  showModal: function() { document.getElementById('invModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('invModal').style.display = 'none'; },
  save: function() { alert('Invoice submitted!'); this.closeModal(); }
};