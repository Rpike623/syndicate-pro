/**
 * SP Onboarding V2 - Enhanced Investor Onboarding
 */
window.Onboarding = {
  onboardings: [],
  deals: [],
  currentStep: 1,

  init: async function() {
    await this.loadDeals();
    await this.loadData();
    this.populateDeals();
    this.render();
  },

  loadDeals: async function() {
    this.deals = SP.getDeals ? SP.getDeals() : [];
    if (!this.deals.length) {
      this.deals = [
        { id: 'deal_1', name: 'Sunset Apartments', min: 100000, targetReturn: '16-18%' },
        { id: 'deal_2', name: 'Downtown Office', min: 250000, targetReturn: '14-16%' },
        { id: 'deal_3', name: 'Industrial Portfolio', min: 500000, targetReturn: '12-14%' }
      ];
    }
  },

  loadData: async function() {
    const s = JSON.stringify(SP.load('onboarding_v2', null));
    if (s) this.onboardings = JSON.parse(s);
    else this.onboardings = this.generateDemo();
  },

  generateDemo: function() {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    return [
      { id: '1', firstName: 'Michael', lastName: 'Chen', email: 'mchen@email.com', entity: '', dealId: 'deal_1', dealName: 'Sunset Apartments', investment: 500000, entityType: 'Individual', stage: 'verify', progress: 75, docsSent: ['sub','w9','ppm'], docsReceived: ['sub','w9'], accreditation: { status: 'pending', method: 'net-worth' }, startDate: `${y}-03-01`, lastUpdate: `${y}-03-05` },
      { id: '2', firstName: 'Sarah', lastName: 'Williams', email: 'swilliams@email.com', entity: 'Williams LLC', dealId: 'deal_2', dealName: 'Downtown Office', investment: 350000, entityType: 'LLC', stage: 'docs', progress: 50, docsSent: ['sub','accred','w9','corp'], docsReceived: ['sub','w9'], accreditation: { status: 'verified', method: 'income' }, startDate: `${y}-02-25`, lastUpdate: `${y}-03-04` },
      { id: '3', firstName: 'David', lastName: 'Rodriguez', email: 'drodriguez@email.com', entity: '', dealId: 'deal_1', dealName: 'Sunset Apartments', investment: 150000, entityType: 'IRA', stage: 'invite', progress: 25, docsSent: ['sub'], docsReceived: [], accreditation: { status: 'pending', method: '' }, startDate: `${y}-03-05`, lastUpdate: `${y}-03-05` },
      { id: '4', firstName: 'Jennifer', lastName: 'Park', email: 'jpark@email.com', entity: 'Park Family Trust', dealId: 'deal_3', dealName: 'Industrial Portfolio', investment: 750000, entityType: 'Trust', stage: 'complete', progress: 100, docsSent: ['sub','accred','w9','ppm','bank','corp'], docsReceived: ['sub','accred','w9','ppm','bank','corp'], accreditation: { status: 'verified', method: 'net-worth' }, startDate: `${y}-02-01`, lastUpdate: `${y}-02-20` },
      { id: '5', firstName: 'Robert', lastName: 'Martinez', email: 'rmartinez@email.com', entity: '', dealId: 'deal_2', dealName: 'Downtown Office', investment: 200000, entityType: 'Individual', stage: 'docs', progress: 40, docsSent: ['sub','accred','w9'], docsReceived: ['sub'], accreditation: { status: 'pending', method: '' }, startDate: `${y}-03-03`, lastUpdate: `${y}-03-04` }
    ];
  },

  save: function() { SP.save('onboarding_v2', this.onboardings); },

  populateDeals: function() {
    const opts = this.deals.map(d => `<option value="${d.id}">${d.name} (Min: $${(d.min/1000)}K)</option>`).join('');
    document.getElementById('invDeal').innerHTML = opts;
  },

  render: function() {
    // Stats
    const active = this.onboardings.filter(o => o.stage !== 'complete').length;
    const awaitingDocs = this.onboardings.filter(o => o.stage === 'docs').length;
    const verifying = this.onboardings.filter(o => o.stage === 'verify').length;
    const completed = this.onboardings.filter(o => o.stage === 'complete').length;
    
    const completedOnboardings = this.onboardings.filter(o => o.stage === 'complete');
    let avgDays = 0;
    if (completedOnboardings.length) {
      avgDays = Math.round(completedOnboardings.reduce((sum, o) => sum + (new Date(o.lastUpdate) - new Date(o.startDate)) / (1000*60*60*24), 0) / completedOnboardings.length);
    }

    document.getElementById('statActive').textContent = active;
    document.getElementById('statDocs').textContent = awaitingDocs;
    document.getElementById('statVerify').textContent = verifying;
    document.getElementById('statCompleted').textContent = completed;
    document.getElementById('statDays').textContent = avgDays;

    // Pipeline
    const stages = ['invite','docs','verify','complete'];
    stages.forEach(s => {
      const items = this.onboardings.filter(o => o.stage === s);
      document.getElementById(`count-${s}`).textContent = items.length;
      document.getElementById(`cards-${s}`).innerHTML = items.slice(0,3).map(o => this.pipelineCard(o)).join('') + (items.length > 3 ? `<div class="more">+${items.length - 3} more</div>` : '');
    });

    this.renderList();
  },

  pipelineCard: function(o) {
    return `<div class="onboard-card" onclick="Onboarding.view('${o.id}')">
      <div class="onboard-name">${o.firstName} ${o.lastName}</div>
      <div class="onboard-deal">${o.dealName}</div>
      <div class="onboard-amount">${this.f(o.investment)}</div>
      <div class="onboard-progress"><div class="progress-bar-mini"><div class="fill" style="width:${o.progress}%"></div></div></div>
    </div>`;
  },

  renderList: function() {
    const filter = document.getElementById('statusFilter').value;
    let list = this.onboardings;
    if (filter) list = list.filter(o => o.stage === filter);

    document.getElementById('onboardingTableBody').innerHTML = list.map(o => {
      const daysActive = Math.ceil((new Date() - new Date(o.startDate)) / (1000*60*60*24));
      const stageLabels = { invite: 'Invited', docs: 'Awaiting Docs', verify: 'Verification', complete: 'Ready' };
      return `<tr>
        <td><strong>${o.firstName} ${o.lastName}</strong><br><small class="text-muted">${o.email}</small></td>
        <td>${o.dealName}</td>
        <td>${this.f(o.investment)}</td>
        <td><div class="progress-bar-mini"><div class="fill" style="width:${o.progress}%"></div></div> ${o.progress}%</td>
        <td><span class="badge badge-${this.stageColor(o.stage)}">${stageLabels[o.stage]}</span></td>
        <td>${daysActive} days</td>
        <td class="text-center">
          <button class="btn-icon" onclick="Onboarding.view('${o.id}')"><i class="fas fa-eye"></i></button>
          <button class="btn-icon" onclick="Onboarding.sendReminder('${o.id}')"><i class="fas fa-bell"></i></button>
        </td>
      </tr>`;
    }).join('');
  },

  stageColor: function(s) { return { invite: 'info', docs: 'warning', verify: 'primary', complete: 'success' }[s]; },

  startNew: function() {
    this.currentStep = 1;
    this.showStep(1);
    document.getElementById('newModal').style.display = 'flex';
  },

  closeModal: function() { document.getElementById('newModal').style.display = 'none'; },

  showStep: function(step) {
    this.currentStep = step;
    document.querySelectorAll('.onboarding-stepper .step').forEach((el, i) => {
      el.classList.toggle('active', i+1 === step);
    });
    for (let i = 1; i <= 4; i++) {
      document.getElementById(`step${i}`).style.display = i === step ? 'block' : 'none';
    }
    document.getElementById('prevBtn').style.display = step > 1 ? 'inline-block' : 'none';
    document.getElementById('nextBtn').textContent = step === 4 ? 'Send Invitation' : 'Continue';
    
    if (step === 4) this.updateReview();
  },

  nextStep: function() {
    if (this.currentStep === 1) {
      if (!document.getElementById('invFirstName').value || !document.getElementById('invLastName').value || !document.getElementById('invEmail').value) {
        alert('Name and email required'); return;
      }
    }
    if (this.currentStep === 2) {
      if (!document.getElementById('invDeal').value || !document.getElementById('invAmount').value) {
        alert('Deal and amount required'); return;
      }
    }
    if (this.currentStep === 4) { this.submit(); return; }
    this.showStep(this.currentStep + 1);
  },

  prevStep: function() { if (this.currentStep > 1) this.showStep(this.currentStep - 1); },

  updateReview: function() {
    const deal = this.deals.find(d => d.id === document.getElementById('invDeal').value);
    document.getElementById('revName').textContent = `${document.getElementById('invFirstName').value} ${document.getElementById('invLastName').value}`;
    document.getElementById('revEmail').textContent = document.getElementById('invEmail').value;
    document.getElementById('revDeal').textContent = deal?.name || '—';
    document.getElementById('revAmount').textContent = this.f(parseInt(document.getElementById('invAmount').value) || 0);
    
    let docCount = 0;
    if (document.getElementById('docSub').checked) docCount++;
    if (document.getElementById('docAccred').checked) docCount++;
    if (document.getElementById('docW9').checked) docCount++;
    if (document.getElementById('docPpm').checked) docCount++;
    if (document.getElementById('docBank').checked) docCount++;
    if (document.getElementById('docCorp').checked) docCount++;
    document.getElementById('revDocs').textContent = docCount + ' documents';
  },

  submit: function() {
    const deal = this.deals.find(d => d.id === document.getElementById('invDeal').value);
    const docs = [];
    if (document.getElementById('docSub').checked) docs.push('sub');
    if (document.getElementById('docAccred').checked) docs.push('accred');
    if (document.getElementById('docW9').checked) docs.push('w9');
    if (document.getElementById('docPpm').checked) docs.push('ppm');
    if (document.getElementById('docBank').checked) docs.push('bank');
    if (document.getElementById('docCorp').checked) docs.push('corp');

    const newOn = {
      id: Date.now().toString(),
      firstName: document.getElementById('invFirstName').value,
      lastName: document.getElementById('invLastName').value,
      email: document.getElementById('invEmail').value,
      phone: document.getElementById('invPhone').value,
      entity: document.getElementById('invEntity').value,
      ein: document.getElementById('invEin').value,
      address: document.getElementById('invAddress').value,
      dealId: document.getElementById('invDeal').value,
      dealName: deal?.name || '',
      investment: parseInt(document.getElementById('invAmount').value),
      entityType: document.getElementById('invEntityType').value,
      investmentSource: document.getElementById('invSource').value,
      stage: 'invite',
      progress: 25,
      docsSent: docs,
      docsReceived: [],
      accreditation: { status: 'pending', method: '' },
      startDate: new Date().toISOString().split('T')[0],
      lastUpdate: new Date().toISOString().split('T')[0]
    };

    this.onboardings.unshift(newOn);
    this.save();
    this.render();
    this.closeModal();

    if (document.getElementById('sendWelcome').checked) {
      alert(`Welcome email sent to ${newOn.email}`);
    }
    if (document.getElementById('sendReminder').checked) {
      alert('Reminder set for 3 days');
    }
  },

  view: function(id) { alert('View onboarding: ' + id); },
  sendReminder: function(id) { const o = this.onboardings.find(x => x.id === id); if (o) alert(`Reminder sent to ${o.email}`); },
  exportAll: function() { alert('Exporting all onboarding data...'); },

  f: function(a) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(a); }
};
