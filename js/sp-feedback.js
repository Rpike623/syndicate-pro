/**
 * SP Investor Feedback
 */
window.Feedback = {
  surveys: [],
  responses: [],
  init: function() {
    this.surveys = [
      { id:'1', type:'quarterly', subject:'Q4 2025 Check-in', sent:'2026-01-15', responses:8, nps:72, status:'closed' },
      { id:'2', type:'nps', subject:'Investor Satisfaction', sent:'2025-10-01', responses:15, nps:68, status:'closed' },
      { id:'3', type:'post-invest', subject:'Welcome Survey', sent:'2026-02-01', responses:3, nps:85, status:'active' }
    ];
    this.responses = [
      { investor:'John Smith', rating:5, nps:10, feedback:'Very happy with returns. Would invest again.', date:'2026-01-20' },
      { investor:'Sarah Williams', rating:4, nps:9, feedback:'Great communication. Quick responses.', date:'2026-01-18' },
      { investor:'Mike Johnson', rating:5, nps:10, feedback:'Excellent team. Very professional.', date:'2025-12-15' },
      { investor:'Lisa Brown', rating:4, nps:8, feedback:'Satisfied but want more frequent updates.', date:'2025-11-20' },
      { investor:'David Jones', rating:3, nps:6, feedback:'Performance is good but fees seem high.', date:'2025-10-25' }
    ];
    this.render();
  },
  render: function() {
    const sent = this.surveys.reduce((s,x) => s + x.responses, 0);
    const nps = Math.round(this.surveys.reduce((s,x) => s + x.nps, 0) / this.surveys.length);
    const rating = (this.responses.reduce((s,x) => s + x.rating, 0) / this.responses.length).toFixed(1);
    document.getElementById('statSent').textContent = this.surveys.length;
    document.getElementById('statResp').textContent = sent;
    document.getElementById('statNps').textContent = nps;
    document.getElementById('statRating').textContent = rating;
    document.getElementById('responseList').innerHTML = this.responses.map(r => `<div class="response-card"><div class="response-header"><strong>${r.investor}</strong><span>${r.nps >= 9 ? '⭐ Promoter' : r.nps >= 7 ? '✓ Passive' : '⚠ Detractor'}</span></div><p>${r.feedback}</p><span class="text-muted">${new Date(r.date).toLocaleDateString()}</span></div>`).join('');
    document.getElementById('surveyTable').innerHTML = this.surveys.map(s => `<tr><td><strong>${s.subject}</strong><br><small>${s.type}</small></td><td>${new Date(s.sent).toLocaleDateString()}</td><td>${s.responses}</td><td>${s.nps}</td><td><span class="badge badge-${s.status==='active'?'success':'secondary'}">${s.status}</span></td></tr>`).join('');
  },
  showModal: function() { document.getElementById('surveyModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('surveyModal').style.display = 'none'; },
  save: function() {
    this.surveys.unshift({ id:Date.now().toString(), type:document.getElementById('sType').value, subject:document.getElementById('sSubject').value, sent:new Date().toISOString().split('T')[0], responses:0, nps:0, status:'active' });
    this.render(); this.closeModal(); alert('Survey sent!');
  }
};
