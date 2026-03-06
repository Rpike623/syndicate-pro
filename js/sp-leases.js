/**
 * SP Lease Tracking
 */
window.Lease = {
  leases: [],
  deals: [],
  init: function() {
    this.deals = [{id:'deal_1',name:'Sunset Apartments'},{id:'deal_2',name:'Downtown Office'},{id:'deal_3',name:'Industrial Portfolio'}];
    const s = localStorage.getItem('sp_leases');
    if (s) this.leases = JSON.parse(s);
    else this.leases = this.generateDemo();
    this.populate();
    this.render();
  },
  generateDemo: function() {
    const y = new Date().getFullYear();
    return [
      { id:'1', dealId:'deal_1', dealName:'Sunset Apartments', unit:'101', tenant:'John Smith', rent:1650, start:`${y}-04-01`, end:`${y+1}-03-31`, status:'active' },
      { id:'2', dealId:'deal_1', dealName:'Sunset Apartments', unit:'102', tenant:'Sarah Williams', rent:1250, start:`${y}-01-01`, end:`${y}-06-30`, status:'active' },
      { id:'3', dealId:'deal_1', dealName:'Sunset Apartments', unit:'103', tenant:'Mike Johnson', rent:1700, start:`${y}-05-01`, end:`${y+1}-04-30`, status:'active' },
      { id:'4', dealId:'deal_2', dealName:'Downtown Office', unit:'200', tenant:'Tech Corp', rent:4500, start:`${y}-03-01`, end:`${y+2}-02-28`, status:'active' },
      { id:'5', dealId:'deal_2', dealName:'Downtown Office', unit:'201', tenant:'Law Partners LLC', rent:3800, start:`${y-1}-06-01`, end:`${y+1}-05-31`, status:'active' },
      { id:'6', dealId:'deal_1', dealName:'Sunset Apartments', unit:'104', tenant:'Vacant', rent:0, start:'', end:'', status:'vacant' }
    ];
  },
  save: function() { localStorage.setItem('sp_leases', JSON.stringify(this.leases)); },
  populate: function() {
    const opts = this.deals.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    document.getElementById('dealFilter').innerHTML = '<option value="">All Properties</option>' + opts;
    document.getElementById('lDeal').innerHTML = opts;
  },
  loadDeal: function() { this.render(); },
  render: function() {
    const filter = document.getElementById('dealFilter').value;
    let list = filter ? this.leases.filter(l => l.dealId === filter) : this.leases;
    const occupied = list.filter(l => l.status === 'active').length;
    const thirtyDays = new Date(Date.now() + 30*24*60*60*1000);
    const expiring = list.filter(l => l.status === 'active' && new Date(l.end) <= thirtyDays).length;
    const rent = list.reduce((s,l) => s + (l.rent||0), 0);
    document.getElementById('statTotal').textContent = list.length;
    document.getElementById('statOccupied').textContent = occupied;
    document.getElementById('statExpiring').textContent = expiring;
    document.getElementById('statRent').textContent = this.f(rent);
    document.getElementById('leaseTable').innerHTML = list.map(l => {
      const daysLeft = l.end ? Math.ceil((new Date(l.end) - new Date()) / (1000*60*60*24)) : 0;
      const expiringSoon = daysLeft > 0 && daysLeft <= 60;
      return `<tr><td>${l.unit}</td><td>${l.tenant}</td><td>${l.dealName}</td><td>${l.rent ? this.f(l.rent) : '—'}</td><td>${l.start ? new Date(l.start).toLocaleDateString() : '—'}</td><td>${l.end ? new Date(l.end).toLocaleDateString() : '—'}</td><td><span class="badge badge-${l.status==='active'?'success':'secondary'}">${l.status}</span></td><td class="${expiringSoon ? 'text-warning' : ''}">${daysLeft > 0 ? daysLeft + ' days' : '—'}</td></tr>`;
    }).join('');
  },
  showModal: function() { document.getElementById('leaseModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('leaseModal').style.display = 'none'; },
  save: function() {
    const dealId = document.getElementById('lDeal').value;
    const deal = this.deals.find(d => d.id === dealId);
    if (!dealId) { alert('Select property'); return; }
    const term = document.getElementById('lTerm').value;
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + parseInt(term));
    this.leases.push({ id:Date.now().toString(), dealId, dealName:deal.name, unit:document.getElementById('lUnit').value, tenant:document.getElementById('lTenant').value, rent:parseInt(document.getElementById('lRent').value)||0, start:start.toISOString().split('T')[0], end:end.toISOString().split('T')[0], status:'active' });
    this.save(); this.render(); this.closeModal();
  },
  f: function(a) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(a); }
};
