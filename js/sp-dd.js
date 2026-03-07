/**
 * SP Due Diligence Tracker
 */
window.DD = {
  items: [],
  init: function() {
    const y = new Date().getFullYear();
    this.items = [
      { category:'Financial', item:'Review rent roll', assignee:'CFO', due:`${y}-03-15`, status:'complete', notes:'90% occupancy' },
      { category:'Financial', item:'Review P&L statements', assignee:'CFO', due:`${y}-03-15`, status:'in-progress', notes:'' },
      { category:'Legal', item:'Title search', assignee:'Attorney', due:`${y}-03-20`, status:'pending', notes:'' },
      { category:'Legal', item:'Entity documents', assignee:'Attorney', due:`${y}-03-18`, status:'complete', notes:'LLC formed' },
      { category:'Physical', item:'Property inspection', assignee:'PM', due:`${y}-03-12`, status:'complete', notes:'Good condition' },
      { category:'Physical', item:'Appraisal', assignee:'Lender', due:`${y}-03-25`, status:'in-progress', notes:'' },
      { category:'Environmental', item:'Phase I ESA', assignee:'Consultant', due:`${y}-03-22`, status:'pending', notes:'' },
      { category:'Insurance', item:'Review coverage', assignee:'Broker', due:`${y}-03-18`, status:'complete', notes:'' },
      { category:'Title', item:'Survey review', assignee:'Attorney', due:`${y}-03-20`, status:'pending', notes:'' }
    ];
    this.render();
  },
  render: function() {
    const total = this.items.length;
    const done = this.items.filter(i => i.status === 'complete').length;
    const progress = this.items.filter(i => i.status === 'in-progress').length;
    const pending = this.items.filter(i => i.status === 'pending').length;
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statDone').textContent = done;
    document.getElementById('statProgress').textContent = progress;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('ddTable').innerHTML = this.items.map(i => `<tr><td>${i.category}</td><td>${i.item}</td><td>${i.assignee}</td><td>${new Date(i.due).toLocaleDateString()}</td><td><span class="badge badge-${i.status==='complete'?'success':i.status==='in-progress'?'warning':'secondary'}">${i.status}</span></td><td>${i.notes}</td></tr>`).join('');
  },
  showModal: function() { document.getElementById('ddDue').value = new Date().toISOString().split('T')[0]; document.getElementById('ddModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('ddModal').style.display = 'none'; },
  save: function() { alert('Item added!'); this.closeModal(); }
};