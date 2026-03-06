/**
 * SP Lenders CRM - Lender Relationship Management
 */
window.Lenders = {
  lenders: [],
  termSheets: [],
  init: function() {
    const s = localStorage.getItem('sp_lenders');
    if (s) this.lenders = JSON.parse(s);
    else this.lenders = this.generateDemo();
    const ts = localStorage.getItem('sp_lender_termsheets');
    if (ts) this.termSheets = JSON.parse(ts);
    else this.termSheets = this.generateTermSheets();
    this.render();
  },
  generateDemo: function() {
    return [
      { id:'1', name:'First Horizon Bank', type:'bank', contact:'John Miller', email:'jmiller@firsthorizon.com', phone:'(214) 555-0123', website:'https://firsthorizon.com', products:'Multifamily, Office, Retail', minLoan:1000000, maxLoan:30000000, dealsFunded:5, totalVolume:45000000, avgRate:6.25, status:'active' },
      { id:'2', name:'Berkadia', type:'cmbs', contact:'Sarah Chen', email:'schen@berkadia.com', phone:'(212) 555-0456', website:'https://berkadia.com', products:'Multifamily, Industrial', minLoan:5000000, maxLoan:100000000, dealsFunded:8, totalVolume:125000000, avgRate:5.875, status:'active' },
      { id:'3', name:'MetLife Investment Management', type:'life', contact:'David Park', email:'dpark@metlife.com', phone:'(212) 555-0789', website:'https://metlife.com', products:'Core Multifamily, Industrial', minLoan:10000000, maxLoan:150000000, dealsFunded:3, totalVolume:85000000, avgRate:5.5, status:'active' },
      { id:'4', name:'Insight Real Estate Credit', type:'mezz', contact:'Lisa Wong', email:'lwong@insightrec.com', phone:'(310) 555-0234', website:'https://insightrec.com', products:'Mezzanine, Preferred Equity', minLoan:3000000, maxLoan:25000000, dealsFunded:4, totalVolume:52000000, avgRate:9.5, status:'active' },
      { id:'5', name:'Silver Hill Funding', type:'hard', contact:'Mike Johnson', email:'mjohnson@silverhill.com', phone:'(305) 555-0567', website:'https://silverhillfunding.com', products:'Bridge, Fix & Flip', minLoan:500000, maxLoan:15000000, dealsFunded:6, totalVolume:38000000, avgRate:11.25, status:'active' },
      { id:'6', name:'Northwest Bank', type:'bank', contact:'Jennifer Smith', email:'jsmith@nwbank.com', phone:'(206) 555-0890', website:'https://nwbank.com', products:'Multifamily, Mixed-Use', minLoan:2000000, maxLoan:25000000, dealsFunded:2, totalVolume:18000000, avgRate:6.75, status:'inactive' }
    ];
  },
  generateTermSheets: function() {
    const y = new Date().getFullYear();
    return [
      { id:'1', lenderId:'1', lenderName:'First Horizon Bank', dealId:'deal_3', dealName:'Industrial Portfolio', amount:8500000, rate:6.125, term:10, ltv:65, status:'pending', submitted:`${y}-03-01`, expires:`${y}-03-15` },
      { id:'2', lenderId:'2', lenderName:'Berkadia', dealId:'deal_1', dealName:'Sunset Apartments', amount:6500000, rate:5.75, term:10, ltv:62, status:'approved', submitted:`${y}-02-20`, expires:`${y}-04-20` },
      { id:'3', lenderId:'4', lenderName:'Insight Real Estate', dealId:'deal_2', dealName:'Downtown Office', amount:3000000, rate:9.0, term:5, ltv:70, status:'review', submitted:`${y}-03-05`, expires:`${y}-03-25` }
    ];
  },
  save: function() { localStorage.setItem('sp_lenders', JSON.stringify(this.lenders)); },
  render: function() {
    const filter = document.getElementById('typeFilter').value;
    let list = filter ? this.lenders.filter(l => l.type === filter) : this.lenders;
    const active = this.lenders.filter(l => l.status === 'active').length;
    const pipeline = this.termSheets.filter(t => t.status === 'pending' || t.status === 'review').reduce((s,t) => s + t.amount, 0);
    const avgRate = this.lenders.reduce((s,l) => s + l.avgRate, 0) / this.lenders.length;
    document.getElementById('statTotal').textContent = this.lenders.length;
    document.getElementById('statActive').textContent = active;
    document.getElementById('statPipeline').textContent = this.f(pipeline);
    document.getElementById('statRate').textContent = avgRate.toFixed(2) + '%';
    document.getElementById('lenderTableBody').innerHTML = list.map(l => `<tr>
      <td><strong>${l.name}</strong></td>
      <td><span class="badge badge-info">${this.type(l.type)}</span></td>
      <td>${l.contact}<br><small class="text-muted">${l.email}</small></td>
      <td>${l.products}</td>
      <td>${l.dealsFunded}</td>
      <td>${this.f(l.totalVolume)}</td>
      <td>${l.avgRate}%</td>
      <td><span class="badge badge-${l.status==='active'?'success':'secondary'}">${l.status}</span></td>
      <td class="text-center"><button class="btn-icon" onclick="Lenders.view('${l.id}')"><i class="fas fa-eye"></i></button></td>
    </tr>`).join('');
    document.getElementById('termSheetList').innerHTML = this.termSheets.map(ts => `<div class="termsheet-card">
      <div class="ts-header"><strong>${ts.dealName}</strong><span class="badge badge-${ts.status==='approved'?'success':ts.status==='pending'?'warning':'info'}">${ts.status}</span></div>
      <div class="ts-details"><span>Lender: ${ts.lenderName}</span><span>Amount: ${this.f(ts.amount)}</span><span>Rate: ${ts.rate}%</span><span>Term: ${ts.term}yr</span><span>LTV: ${ts.ltv}%</span></div>
      <div class="ts-dates"><span>Submitted: ${new Date(ts.submitted).toLocaleDateString()}</span><span>Expires: ${new Date(ts.expires).toLocaleDateString()}</span></div>
    </div>`).join('');
  },
  type: function(t) { return {bank:'Bank',cmbs:'CMBS',life:'Life Insurance',mezz:'Mezzanine',hard:'Hard Money'}[t]||t; },
  f: function(a) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(a); },
  showModal: function() { document.getElementById('lenderModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('lenderModal').style.display = 'none'; },
  save: function() {
    const name = document.getElementById('lName').value;
    if (!name) { alert('Name required'); return; }
    this.lenders.push({id:Date.now().toString(),name,type:document.getElementById('lType').value,contact:document.getElementById('lContact').value,email:document.getElementById('lEmail').value,phone:document.getElementById('lPhone').value,website:document.getElementById('lWebsite').value,products:document.getElementById('lProducts').value,minLoan:parseInt(document.getElementById('lMin').value)||0,maxLoan:parseInt(document.getElementById('lMax').value)||0,dealsFunded:0,totalVolume:0,avgRate:0,status:'active',notes:document.getElementById('lNotes').value});
    this.save(); this.render(); this.closeModal();
  },
  view: function(id) { const l = this.lenders.find(x => x.id === id); alert(`${l.name}\n${l.products}\nContact: ${l.contact} (${l.email})`); }
};
