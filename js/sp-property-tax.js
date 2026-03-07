/**
 * SP Property Tax
 */
window.Tax = {
  assessments: [],
  init: function() {
    this.assessments = [
      { property:'Sunset Apartments', value:12000000, rate:1.12, status:'paid', dueDate:'2026-01-31' },
      { property:'Downtown Office', value:8500000, rate:1.25, status:'paid', dueDate:'2026-01-31' },
      { property:'Industrial Portfolio', value:18000000, rate:0.98, status:'pending', dueDate:'2026-10-31' },
      { property:'Coastal Retail', value:6500000, rate:1.08, status:'paid', dueDate:'2026-01-31' }
    ];
    this.render();
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  render: function() {
    const annual = this.assessments.reduce((s,a) => s + a.value * a.rate / 100, 0);
    const paid = this.assessments.filter(a => a.status === 'paid').reduce((s,a) => s + a.value * a.rate / 100, 0);
    const due = annual - paid;
    const rate = this.assessments.reduce((s,a) => s + a.rate, 0) / this.assessments.length;
    document.getElementById('statAnnual').textContent = this.f(annual);
    document.getElementById('statPaid').textContent = this.f(paid);
    document.getElementById('statDue').textContent = this.f(due);
    document.getElementById('statRate').textContent = rate.toFixed(2) + '%';
    document.getElementById('taxTable').innerHTML = this.assessments.map(a => `<tr><td>${a.property}</td><td>${this.f(a.value)}</td><td>${a.rate}%</td><td><strong>${this.f(a.value * a.rate / 100)}</strong></td><td><span class="badge badge-${a.status==='paid'?'success':'warning'}">${a.status}</span></td><td>${new Date(a.dueDate).toLocaleDateString()}</td></tr>`).join('');
  },
  showModal: function() { document.getElementById('taxModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('taxModal').style.display = 'none'; },
  save: function() { alert('Assessment added!'); this.closeModal(); }
};
