/**
 * SP Maintenance - Property Maintenance Tracking
 */
window.Maintenance = {
  requests: [],
  deals: [],
  init: function() {
    this.deals = SP.getDeals ? SP.getDeals() : [];
    if (!this.deals.length) this.deals = [{id:'deal_1',name:'Sunset Apartments'},{id:'deal_2',name:'Downtown Office'},{id:'deal_3',name:'Industrial Portfolio'}];
    const s = JSON.stringify(SP.load('maintenance', null));
    if (s) this.requests = JSON.parse(s);
    else this.requests = this.generateDemo();
    this.populate();
    this.render();
  },
  generateDemo: function() {
    const y = new Date().getFullYear();
    return [
      { id:'1', dealId:'deal_1', dealName:'Sunset Apartments', unit:'Unit 101', category:'hvac', desc:'AC not cooling properly', priority:'high', status:'in_progress', cost:350, created:`${y}-03-05` },
      { id:'2', dealId:'deal_1', dealName:'Sunset Apartments', unit:'Unit 205', category:'plumbing', desc:'Kitchen faucet leaking', priority:'low', status:'open', cost:150, created:`${y}-03-06` },
      { id:'3', dealId:'deal_2', dealName:'Downtown Office', unit:'Floor 2', category:'electrical', desc:'Light fixture replacement', priority:'medium', status:'completed', cost:200, created:`${y}-03-01` },
      { id:'4', dealId:'deal_3', dealName:'Industrial Portfolio', unit:'Building A', category:'roofing', desc:'Minor leak in warehouse', priority:'high', status:'in_progress', cost:800, created:`${y}-03-04` },
      { id:'5', dealId:'deal_1', dealName:'Sunset Apartments', unit:'Unit 302', category:'appliance', desc:'Dishwasher not draining', priority:'medium', status:'open', cost:250, created:`${y}-03-06` }
    ];
  },
  save: function() { SP.save('maintenance', this.requests); },
  populate: function() {
    const opts = this.deals.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    document.getElementById('dealFilter').innerHTML = '<option value="">All Properties</option>' + opts;
    document.getElementById('mDeal').innerHTML = opts;
  },
  loadDeal: function() { this.render(); },
  render: function() {
    const filter = document.getElementById('dealFilter').value;
    let list = filter ? this.requests.filter(r => r.dealId === filter) : this.requests;
    const open = list.filter(r => r.status === 'open').length;
    const progress = list.filter(r => r.status === 'in_progress').length;
    const complete = list.filter(r => r.status === 'completed').length;
    const spend = list.reduce((s,r) => s + (r.cost||0), 0);
    document.getElementById('statOpen').textContent = open;
    document.getElementById('statProgress').textContent = progress;
    document.getElementById('statComplete').textContent = complete;
    document.getElementById('statSpend').textContent = this.f(spend);
    document.getElementById('maintTableBody').innerHTML = list.map(r => `<tr><td>${r.dealName}</td><td>${r.unit}</td><td>${this.cat(r.category)}</td><td>${r.desc}</td><td><span class="badge badge-${this.priColor(r.priority)}">${r.priority}</span></td><td><span class="badge badge-${this.staColor(r.status)}">${r.status.replace('_',' ')}</span></td><td>${this.f(r.cost)}</td><td>${new Date(r.created).toLocaleDateString()}</td></tr>`).join('');
  },
  cat: function(c) { return {plumbing:'Plumbing',hvac:'HVAC',electrical:'Electrical',appliance:'Appliance',roofing:'Roofing',pest:'Pest',landscaping:'Landscape',general:'General'}[c]||c; },
  priColor: function(p) { return {low:'secondary',medium:'warning',high:'danger',emergency:'danger'}[p]; },
  staColor: function(s) { return {open:'warning',in_progress:'primary',completed:'success'}[s]; },
  f: function(a) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(a); },
  showModal: function() { document.getElementById('maintModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('maintModal').style.display = 'none'; },
  save: function() {
    const dealId = document.getElementById('mDeal').value;
    const deal = this.deals.find(d => d.id === dealId);
    if (!dealId) { alert('Select property'); return; }
    this.requests.unshift({id:Date.now().toString(),dealId,dealName:deal.name,unit:document.getElementById('mUnit').value,category:document.getElementById('mCategory').value,desc:document.getElementById('mDesc').value,priority:document.getElementById('mPriority').value,status:'open',cost:parseInt(document.getElementById('mCost').value)||0,created:new Date().toISOString().split('T')[0]});
    this.save(); this.render(); this.closeModal();
  }
};
