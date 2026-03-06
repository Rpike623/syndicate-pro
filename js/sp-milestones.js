/**
 * SP Deal Milestones
 */
window.Milestones = {
  milestones: [],
  deals: [],
  init: function() {
    this.deals = [{id:'deal_1',name:'Sunset Apartments'},{id:'deal_2',name:'Downtown Office'},{id:'deal_3',name:'Industrial Portfolio'}];
    const s = localStorage.getItem('sp_milestones');
    if (s) this.milestones = JSON.parse(s);
    else this.milestones = this.generate();
    this.populate();
    this.render();
  },
  generate: function() {
    const y = new Date().getFullYear();
    return [
      { dealId:'deal_1', dealName:'Sunset Apartments', name:'Underwriting Complete', targetDate:`${y}-03-15`, status:'completed' },
      { dealId:'deal_1', dealName:'Sunset Apartments', name:'Loan Commitment', targetDate:`${y}-04-01`, status:'in-progress' },
      { dealId:'deal_1', dealName:'Sunset Apartments', name:'Due Diligence', targetDate:`${y}-04-15`, status:'pending' },
      { dealId:'deal_1', dealName:'Sunset Apartments', name:'Closing', targetDate:`${y}-05-01`, status:'pending' },
      { dealId:'deal_2', dealName:'Downtown Office', name:'LOI Signed', targetDate:`${y}-03-01`, status:'completed' },
      { dealId:'deal_2', dealName:'Downtown Office', name:'Contract Execution', targetDate:`${y}-03-20`, status:'delayed' },
      { dealId:'deal_3', dealName:'Industrial Portfolio', name:'Acquisition Closed', targetDate:`${y}-02-15`, status:'completed' },
      { dealId:'deal_3', dealName:'Industrial Portfolio', name:'Renovation Complete', targetDate:`${y}-06-30`, status:'pending' }
    ];
  },
  save: function() { localStorage.setItem('sp_milestones', JSON.stringify(this.milestones)); },
  populate: function() {
    const opts = this.deals.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    document.getElementById('dealFilter').innerHTML = '<option value="">All Deals</option>' + opts;
    document.getElementById('mDeal').innerHTML = opts;
  },
  load: function() { this.render(); },
  render: function() {
    const filter = document.getElementById('dealFilter').value;
    let list = filter ? this.milestones.filter(m => m.dealId === filter) : this.milestones;
    list.sort((a,b) => new Date(a.targetDate) - new Date(b.targetDate));
    
    const timeline = document.getElementById('timeline');
    if (!list.length) { timeline.innerHTML = '<p class="text-muted">No milestones</p>'; return; }
    
    let html = '';
    let currentDeal = '';
    list.forEach(m => {
      if (m.dealName !== currentDeal) { if (currentDeal) html += '</div>'; html += `<div class="milestone-deal"><h3>${m.dealName}</h3><div class="deal-milestones">`; currentDeal = m.dealName; }
      const isPast = new Date(m.targetDate) < new Date() && m.status !== 'completed';
      html += `<div class="milestone-item milestone-${m.status}">
        <div class="milestone-marker"></div>
        <div class="milestone-content">
          <span class="milestone-date">${new Date(m.targetDate).toLocaleDateString()}</span>
          <strong>${m.name}</strong>
          <span class="badge badge-${m.status==='completed'?'success':m.status==='delayed'?'danger':m.status==='in-progress'?'primary':'secondary'}">${m.status}</span>
        </div>
      </div>`;
    });
    if (currentDeal) html += '</div></div>';
    timeline.innerHTML = html;
  },
  showModal: function() { document.getElementById('mDate').value = new Date().toISOString().split('T')[0]; document.getElementById('mileModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('mileModal').style.display = 'none'; },
  save: function() {
    const dealId = document.getElementById('mDeal').value;
    const deal = this.deals.find(d => d.id === dealId);
    this.milestones.push({ dealId, dealName:deal.name, name:document.getElementById('mName').value, targetDate:document.getElementById('mDate').value, status:document.getElementById('mStatus').value });
    this.save(); this.render(); this.closeModal();
  }
};