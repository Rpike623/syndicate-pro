/**
 * SP Renovation Tracker
 */
window.Renovation = {
  units: [],
  init: function() {
    const y = new Date().getFullYear();
    this.units = [
      { unit:'101', scope:'Full Gut', budget:12000, spent:12000, start:'2026-01-15', complete:'2026-02-01', status:'complete' },
      { unit:'102', scope:'Partial', budget:6000, spent:4500, start:'2026-02-20', complete:'', status:'in-progress' },
      { unit:'103', scope:'Kitchen', budget:4000, spent:0, start:'', complete:'', status:'pending' },
      { unit:'104', scope:'Full Gut', budget:12000, spent:11000, start:'2026-02-10', complete:'2026-02-28', status:'complete' },
      { unit:'105', scope:'Bathroom', budget:3500, spent:0, start:'', complete:'', status:'pending' },
      { unit:'106', scope:'Cosmetic', budget:2000, spent:1800, start:'2026-03-01', complete:'', status:'in-progress' }
    ];
    this.render();
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  render: function() {
    const total = this.units.length;
    const done = this.units.filter(u => u.status === 'complete').length;
    const progress = this.units.filter(u => u.status === 'in-progress').length;
    const budget = this.units.reduce((s,u) => s + u.budget, 0);
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statDone').textContent = done;
    document.getElementById('statProgress').textContent = progress;
    document.getElementById('statBudget').textContent = this.f(budget);
    document.getElementById('renoTable').innerHTML = this.units.map(u => `<tr><td>Unit ${u.unit}</td><td>${u.scope}</td><td>${this.f(u.budget)}</td><td>${this.f(u.spent)}</td><td>${u.start ? new Date(u.start).toLocaleDateString() : '—'}</td><td>${u.complete ? new Date(u.complete).toLocaleDateString() : '—'}</td><td><span class="badge badge-${u.status==='complete'?'success':u.status==='in-progress'?'warning':'secondary'}">${u.status}</span></td></tr>`).join('');
  },
  showModal: function() { document.getElementById('rStart').value = new Date().toISOString().split('T')[0]; document.getElementById('renoModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('renoModal').style.display = 'none'; },
  save: function() { alert('Renovation added!'); this.closeModal(); }
};