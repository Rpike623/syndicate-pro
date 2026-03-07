/**
 * SP Maintenance Log
 */
window.Maint = {
  init: function() {
    const data = [
      { unit:'101', type:'Plumbing', date:'2026-03-01', status:'Open', cost:250 },
      { unit:'214', type:'HVAC', date:'2026-02-28', status:'In Progress', cost:1200 },
      { unit:'305', type:'Electrical', date:'2026-03-05', status:'Open', cost:150 },
      { unit:'112', type:'Appliance', date:'2026-02-20', status:'Completed', cost:450 },
      { unit:'402', type:'Pest Control', date:'2026-03-06', status:'Open', cost:100 }
    ];
    document.getElementById('maintTable').innerHTML = data.map(d => `<tr><td>${d.unit}</td><td>${d.type}</td><td>${d.date}</td><td><span class="badge ${d.status==='Completed'?'badge-success':d.status==='In Progress'?'badge-info':'badge-warning'}">${d.status}</span></td><td>$${d.cost}</td></tr>`).join('');
    document.getElementById('statOpenWO').textContent = data.filter(d => d.status !== 'Completed').length;
    document.getElementById('statAvgDays').textContent = '2.4';
  }
};