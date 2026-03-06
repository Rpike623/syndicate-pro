/**
 * SP Tasks - Task Management
 */
window.Tasks = {
  tasks: [],
  init: function() {
    const s = localStorage.getItem('sp_tasks');
    if (s) this.tasks = JSON.parse(s);
    else this.tasks = this.generateDemo();
    this.render();
  },
  generateDemo: function() {
    const y = new Date().getFullYear(), m = new Date().getMonth(), d = new Date().getDate();
    return [
      { id:'1', title:'Complete Q1 investor report', deal:'deal_1', dealName:'Sunset Apartments', priority:'high', status:'todo', assignee:'me', due:`${y}-03-15`, created:`${y}-03-01` },
      { id:'2', title:'Review capital call for Industrial', deal:'deal_3', dealName:'Industrial Portfolio', priority:'high', status:'todo', assignee:'me', due:`${y}-03-10`, created:`${y}-03-05` },
      { id:'3', title:'Send PPM to new investors', deal:'', dealName:'General', priority:'medium', status:'in_progress', assignee:'me', due:`${y}-03-08`, created:`${y}-03-04` },
      { id:'4', title:'Schedule property inspection', deal:'deal_2', dealName:'Downtown Office', priority:'low', status:'in_progress', assignee:'team', due:`${y}-03-20`, created:`${y}-03-03` },
      { id:'5', title:'Update waterfall calculations', deal:'', dealName:'General', priority:'medium', status:'done', assignee:'me', due:`${y}-03-01`, created:`${y}-02-28` },
      { id:'6', title:'Submit Form D for new deal', deal:'deal_1', dealName:'Sunset Apartments', priority:'high', status:'done', assignee:'me', due:`${y}-02-25`, created:`${y}-02-20` }
    ];
  },
  save: function() { localStorage.setItem('sp_tasks', JSON.stringify(this.tasks)); },
  render: function() {
    const todo = this.tasks.filter(t => t.status === 'todo');
    const progress = this.tasks.filter(t => t.status === 'in_progress');
    const done = this.tasks.filter(t => t.status === 'done');
    const myTasks = this.tasks.filter(t => t.assignee === 'me' && t.status !== 'done');
    const now = new Date();
    const week = new Date(now.getTime() + 7*24*60*60*1000);
    const overdue = myTasks.filter(t => new Date(t.due) < now).length;
    const dueWeek = myTasks.filter(t => new Date(t.due) >= now && new Date(t.due) <= week).length;
    document.getElementById('statMy').textContent = myTasks.length;
    document.getElementById('statOverdue').textContent = overdue;
    document.getElementById('statWeek').textContent = dueWeek;
    document.getElementById('statDone').textContent = done.length;
    document.getElementById('todo-count').textContent = todo.length;
    document.getElementById('progress-count').textContent = progress.length;
    document.getElementById('done-count').textContent = done.length;
    document.getElementById('todo-list').innerHTML = todo.map(t => this.card(t)).join('');
    document.getElementById('progress-list').innerHTML = progress.map(t => this.card(t)).join('');
    document.getElementById('done-list').innerHTML = done.map(t => this.card(t)).join('');
  },
  card: function(t) {
    const isOverdue = new Date(t.due) < new Date() && t.status !== 'done';
    return `<div class="task-card ${isOverdue?'overdue':''}" onclick="Tasks.toggle('${t.id}')">
      <div class="task-priority priority-${t.priority}"></div>
      <div class="task-content">
        <div class="task-title">${t.title}</div>
        <div class="task-meta">
          <span>${t.dealName}</span>
          <span class="${isOverdue?'text-danger':'text-muted'}">${new Date(t.due).toLocaleDateString()}</span>
        </div>
      </div>
    </div>`;
  },
  toggle: function(id) {
    const t = this.tasks.find(x => x.id === id);
    if (t.status === 'done') t.status = 'todo';
    else if (t.status === 'in_progress') t.status = 'done';
    else t.status = 'in_progress';
    this.save(); this.render();
  },
  showModal: function() {
    document.getElementById('tDue').value = new Date(Date.now()+7*24*60*60*1000).toISOString().split('T')[0];
    document.getElementById('taskModal').style.display = 'flex';
  },
  closeModal: function() { document.getElementById('taskModal').style.display = 'none'; },
  save: function() {
    const title = document.getElementById('tTitle').value;
    if (!title) { alert('Title required'); return; }
    const dealId = document.getElementById('tDeal').value;
    const deal = {'':'General','deal_1':'Sunset Apartments','deal_2':'Downtown Office','deal_3':'Industrial Portfolio'}[dealId];
    this.tasks.unshift({id:Date.now().toString(),title,deal:dealId,dealName:deal,priority:document.getElementById('tPriority').value,status:'todo',assignee:document.getElementById('tAssignee').value,due:document.getElementById('tDue').value,notes:document.getElementById('tNotes').value,created:new Date().toISOString().split('T')[0]});
    this.save(); this.render(); this.closeModal();
  }
};
