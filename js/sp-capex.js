/**
 * SP CAPEX Tracker
 */
window.Capex = {
  projects: [],
  init: function() {
    this.projects = [
      { name:'Unit Renovations', property:'Sunset Apartments', budget:480000, spent:320000, progress:67, status:'In Progress' },
      { name:'Roof Replacement', property:'Downtown Office', budget:180000, spent:175000, progress:97, status:'In Progress' },
      { name:'Parking Lot Resurface', property:'Coastal Retail', budget:65000, spent:0, progress:0, status:'Planning' },
      { name:'HVAC Upgrade', property:'Industrial Portfolio', budget:120000, spent:120000, progress:100, status:'Completed' },
      { name:'Fitness Center', property:'Sunset Apartments', budget:85000, spent:82000, progress:96, status:'In Progress' }
    ];
    this.render();
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  render: function() {
    const active = this.projects.filter(p => p.status === 'In Progress').length;
    const spent = this.projects.reduce((s,p) => s + p.spent, 0);
    const budget = this.projects.reduce((s,p) => s + p.budget, 0);
    const complete = Math.round(this.projects.reduce((s,p) => s + p.progress, 0) / this.projects.length);
    document.getElementById('statActive').textContent = active;
    document.getElementById('statSpent').textContent = this.f(spent);
    document.getElementById('statBudget').textContent = this.f(budget - spent);
    document.getElementById('statComplete').textContent = complete + '%';
    document.getElementById('capexTable').innerHTML = this.projects.map(p => `<tr><td>${p.name}</td><td>${p.property}</td><td>${this.f(p.budget)}</td><td>${this.f(p.spent)}</td><td><div class="progress-bar"><div class="fill" style="width:${p.progress}%"></div></div> ${p.progress}%</td><td><span class="badge badge-${p.status==='Completed'?'success':p.status==='In Progress'?'warning':'secondary'}">${p.status}</span></td></tr>`).join('');
  },
  showModal: function() { document.getElementById('capexModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('capexModal').style.display = 'none'; },
  save: function() { alert('Project added!'); this.closeModal(); }
};
