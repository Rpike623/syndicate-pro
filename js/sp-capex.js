/**
 * SP CapEx Planner
 */
window.CapEx = {
  init: function() {
    const data = [
      { name:'Roof Replacement', cost:85000, date:'2026-06-15', prio:'High', status:'Planned' },
      { name:'Parking Lot Seal', cost:12500, date:'2026-04-01', prio:'Med', status:'Approved' },
      { name:'Unit 12 Full Rehab', cost:15000, date:'2026-03-20', prio:'High', status:'In Progress' },
      { name:'HVAC Replacement (3)', cost:18000, date:'2026-05-10', prio:'Low', status:'Planned' },
      { name:'Exterior Paint', cost:45000, date:'2027-02-01', prio:'Med', status:'Planned' }
    ];
    document.getElementById('capexTable').innerHTML = data.map(d => `<tr><td>${d.name}</td><td>$${d.cost.toLocaleString()}</td><td>${d.date}</td><td><span class="${d.prio==='High'?'text-danger':''}">${d.prio}</span></td><td><span class="badge ${d.status==='Approved'?'badge-success':d.status==='In Progress'?'badge-info':'badge-warning'}">${d.status}</span></td></tr>`).join('');
    const total = data.reduce((s,d) => s + d.cost, 0);
    document.getElementById('statPlanned').textContent = '$' + total.toLocaleString();
    document.getElementById('statReserve').textContent = '$' + (total * 0.4).toLocaleString();
  }
};