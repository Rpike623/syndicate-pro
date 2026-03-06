/**
 * SP Webinars - Investor Webinar Management
 */
window.Webinars = {
  webinars: [],
  init: function() {
    const s = localStorage.getItem('sp_webinars');
    if (s) this.webinars = JSON.parse(s);
    else this.webinars = this.generateDemo();
    this.render();
  },
  generateDemo: function() {
    const now = new Date();
    const y = now.getFullYear();
    return [
      { id: '1', title: 'Q1 2026 Performance Review', date: `${y}-04-10`, time: '14:00', deal: 'All Deals', desc: 'Quarterly results and market outlook', registrations: 45, attendance: 38, status: 'upcoming' },
      { id: '2', title: 'Sunset Apartments Deal Deep Dive', date: `${y}-04-15`, time: '13:00', deal: 'Sunset Apartments', desc: 'Property tour and financials', registrations: 28, attendance: 0, status: 'upcoming' },
      { id: '3', title: '2026 Investment Strategy Call', date: `${y}-01-15`, time: '14:00', deal: 'All Deals', desc: 'Year ahead strategy', registrations: 52, attendance: 48, status: 'past' },
      { id: '4', title: 'Industrial Market Update', date: `${y}-02-20`, time: '11:00', deal: 'Industrial Portfolio', desc: 'Market analysis', registrations: 35, attendance: 31, status: 'past' }
    ];
  },
  save: function() { localStorage.setItem('sp_webinars', JSON.stringify(this.webinars)); },
  render: function() {
    const upcoming = this.webinars.filter(w => w.status === 'upcoming');
    const past = this.webinars.filter(w => w.status === 'past');
    const regs = this.webinars.reduce((s,w) => s + w.registrations, 0);
    const att = past.length ? Math.round(past.reduce((s,w) => s + (w.attendance/w.registrations*100),0) / past.length) : 0;
    
    document.getElementById('statRegs').textContent = regs;
    document.getElementById('statAttendance').textContent = att + '%';
    document.getElementById('statUpcoming').textContent = upcoming.length;
    document.getElementById('statPast').textContent = past.length;

    document.getElementById('upcomingList').innerHTML = upcoming.length ? upcoming.map(w => this.card(w)).join('') : '<p class="text-muted">No upcoming webinars</p>';
    document.getElementById('pastList').innerHTML = past.length ? past.map(w => this.card(w)).join('') : '<p class="text-muted">No past webinars</p>';
  },
  card: function(w) {
    return `<div class="webinar-card">
      <div class="webinar-date"><span class="date">${new Date(w.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span><span class="time">${w.time}</span></div>
      <div class="webinar-info"><h4>${w.title}</h4><p>${w.desc}</p><span class="badge badge-${w.status==='upcoming'?'success':'secondary'}">${w.deal}</span></div>
      <div class="webinar-stats">${w.status==='upcoming'?`<span>${w.registrations} registered</span>`:`<span>${w.attendance}/${w.registrations} attended</span>`}</div>
    </div>`;
  },
  showModal: function() { document.getElementById('webDate').value=new Date().toISOString().split('T')[0]; document.getElementById('webTime').value='14:00'; document.getElementById('webinarModal').style.display='flex'; },
  closeModal: function() { document.getElementById('webinarModal').style.display='none'; },
  save: function() {
    const title = document.getElementById('webTitle').value;
    if (!title) { alert('Title required'); return; }
    this.webinars.unshift({ id: Date.now().toString(), title, date: document.getElementById('webDate').value, time: document.getElementById('webTime').value, deal: document.getElementById('webDeal').value || 'All Deals', desc: document.getElementById('webDesc').value, registrations: 0, attendance: 0, status: 'upcoming' });
    this.save(); this.render(); this.closeModal();
  }
};
