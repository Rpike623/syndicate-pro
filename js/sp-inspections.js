/**
 * SP Property Inspections
 */
window.Inspections = {
  inspections: [],
  init: function() {
    const m = new Date().getMonth();
    this.inspections = [
      { property:'Sunset Apartments', type:'Annual', date:'2026-03-10', inspector:'Criterium', status:'completed', findings:2 },
      { property:'Sunset Apartments', type:'Move-out', date:'2026-03-15', inspector:'In-house', status:'scheduled', findings:0 },
      { property:'Downtown Office', type:'Quarterly', date:'2026-03-20', inspector:'Joffe', status:'scheduled', findings:0 },
      { property:'Industrial Portfolio', type:'Safety', date:'2026-02-28', inspector:'SafetyFirst', status:'completed', findings:0 },
      { property:'Coastal Retail', type:'Annual', date:'2026-04-01', inspector:'Criterium', status:'scheduled', findings:0 }
    ];
    this.render();
  },
  render: function() {
    const scheduled = this.inspections.filter(i => i.status === 'scheduled').length;
    const completed = this.inspections.filter(i => i.status === 'completed').length;
    const findings = this.inspections.reduce((s,i) => s + (i.findings||0), 0);
    const now = new Date();
    const overdue = this.inspections.filter(i => i.status === 'scheduled' && new Date(i.date) < now).length;
    document.getElementById('statScheduled').textContent = scheduled;
    document.getElementById('statCompleted').textContent = completed;
    document.getElementById('statFindings').textContent = findings;
    document.getElementById('statOverdue').textContent = overdue;
    document.getElementById('inspectionTable').innerHTML = this.inspections.map(i => `<tr><td>${i.property}</td><td>${i.type}</td><td>${new Date(i.date).toLocaleDateString()}</td><td>${i.inspector}</td><td><span class="badge badge-${i.status==='completed'?'success':'info'}">${i.status}</span></td><td>${i.findings}</td></tr>`).join('');
  },
  showModal: function() { document.getElementById('iDate').value = new Date().toISOString().split('T')[0]; document.getElementById('inspModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('inspModal').style.display = 'none'; },
  save: function() { this.inspections.push({ property:document.getElementById('iProperty').value, type:document.getElementById('iType').value, date:document.getElementById('iDate').value, inspector:document.getElementById('iInspector').value, status:'scheduled', findings:0 }); this.render(); this.closeModal(); }
};
