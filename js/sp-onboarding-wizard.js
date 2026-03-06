/**
 * SP Onboarding Wizard - Investor Subscription Workflow
 * Multi-step wizard for investor onboarding
 */

window.Onboarding = {
  onboardings: [],
  deals: [],
  currentStep: 1,
  totalSteps: 4,

  init: async function() {
    await this.loadDeals();
    await this.loadOnboardings();
    this.populateDeals();
    this.updateStats();
    this.renderList();
  },

  loadDeals: async function() {
    this.deals = SP.getDeals ? SP.getDeals() : [];
    if (!this.deals.length) {
      this.deals = [
        { id: 'deal_1', name: 'Sunset Apartments', address: '123 Sunset Blvd, Phoenix, AZ', targetReturn: '16-18%', minInvestment: 100000, holdPeriod: '3-5 years' },
        { id: 'deal_2', name: 'Downtown Office', address: '456 Main St, Austin, TX', targetReturn: '14-16%', minInvestment: 250000, holdPeriod: '5-7 years' },
        { id: 'deal_3', name: 'Industrial Portfolio', address: '789 Warehouse Dr, Dallas, TX', targetReturn: '12-14%', minInvestment: 500000, holdPeriod: '7-10 years' }
      ];
    }
  },

  loadOnboardings: async function() {
    const stored = localStorage.getItem('sp_onboardings');
    if (stored) {
      this.onboardings = JSON.parse(stored);
    } else {
      this.onboardings = this.generateDemoData();
    }
  },

  generateDemoData: function() {
    const now = new Date();
    const year = now.getFullYear();
    return [
      {
        id: '1',
        firstName: 'Michael',
        lastName: 'Chen',
        email: 'mchen@email.com',
        dealId: 'deal_1',
        dealName: 'Sunset Apartments',
        investment: 500000,
        entityType: 'LLC',
        status: 'completed',
        progress: 100,
        startedDate: `${year}-02-01`,
        completedDate: `${year}-02-15`,
        docsSent: ['subscription', 'w9', 'ppm', 'risk'],
        docsReceived: ['subscription', 'w9', 'ppm', 'risk']
      },
      {
        id: '2',
        firstName: 'Sarah',
        lastName: 'Williams',
        email: 'swilliams@email.com',
        dealId: 'deal_2',
        dealName: 'Downtown Office',
        investment: 250000,
        entityType: 'Individual',
        status: 'verification',
        progress: 75,
        startedDate: `${year}-02-20`,
        completedDate: null,
        docsSent: ['subscription', 'accreditation', 'w9', 'ppm'],
        docsReceived: ['subscription', 'w9']
      },
      {
        id: '3',
        firstName: 'David',
        lastName: 'Rodriguez',
        email: 'drodriguez@email.com',
        dealId: 'deal_1',
        dealName: 'Sunset Apartments',
        investment: 150000,
        entityType: 'IRA',
        status: 'docs_pending',
        progress: 50,
        startedDate: `${year}-03-01`,
        completedDate: null,
        docsSent: ['subscription', 'accreditation', 'w9'],
        docsReceived: []
      },
      {
        id: '4',
        firstName: 'Jennifer',
        lastName: 'Park',
        email: 'jpark@email.com',
        dealId: 'deal_3',
        dealName: 'Industrial Portfolio',
        investment: 750000,
        entityType: 'Trust',
        status: 'started',
        progress: 25,
        startedDate: `${year}-03-05`,
        completedDate: null,
        docsSent: [],
        docsReceived: []
      }
    ];
  },

  save: function() {
    localStorage.setItem('sp_onboardings', JSON.stringify(this.onboardings));
  },

  populateDeals: function() {
    const options = '<option value="">Select a deal...</option>' + 
      this.deals.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    document.getElementById('invDeal').innerHTML = options;
  },

  updateStats: function() {
    const active = this.onboardings.filter(o => o.status !== 'completed').length;
    const awaiting = this.onboardings.filter(o => o.status === 'docs_pending').length;
    const completed = this.onboardings.filter(o => o.status === 'completed').length;
    
    // Calculate average completion time
    const completedOnboardings = this.onboardings.filter(o => o.completedDate);
    let avgDays = 0;
    if (completedOnboardings.length) {
      const totalDays = completedOnboardings.reduce((sum, o) => {
        const start = new Date(o.startedDate);
        const end = new Date(o.completedDate);
        return sum + Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      }, 0);
      avgDays = Math.round(totalDays / completedOnboardings.length);
    }

    document.getElementById('statActive').textContent = active;
    document.getElementById('statAwaiting').textContent = awaiting;
    document.getElementById('statCompleted').textContent = completed;
    document.getElementById('statAvgTime').textContent = avgDays + ' days';
  },

  renderList: function() {
    const statusFilter = document.getElementById('statusFilter').value;
    let list = this.onboardings;
    if (statusFilter) list = list.filter(o => o.status === statusFilter);

    const tbody = document.getElementById('onboardingTableBody');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No onboardings found</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(o => `
      <tr>
        <td><strong>${o.firstName} ${o.lastName}</strong><br><small class="text-muted">${o.email}</small></td>
        <td>${o.dealName}</td>
        <td>${this.formatCurrency(o.investment)}</td>
        <td>${this.formatDate(o.startedDate)}</td>
        <td>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${o.progress}%"></div>
          </div>
          <small>${o.progress}%</small>
        </td>
        <td><span class="badge badge-${this.getStatusColor(o.status)}">${this.formatStatus(o.status)}</span></td>
        <td class="text-center">
          <button class="btn-icon" onclick="Onboarding.viewDetails('${o.id}')"><i class="fas fa-eye"></i></button>
          ${o.status !== 'completed' ? `<button class="btn-icon" onclick="Onboarding.sendReminder('${o.id}')"><i class="fas fa-bell"></i></button>` : ''}
        </td>
      </tr>
    `).join('');
  },

  getStatusColor: function(status) {
    const colors = {
      'started': 'info',
      'docs_pending': 'warning',
      'verification': 'primary',
      'completed': 'success'
    };
    return colors[status] || 'secondary';
  },

  formatStatus: function(status) {
    const labels = {
      'started': 'Started',
      'docs_pending': 'Awaiting Docs',
      'verification': 'Verification',
      'completed': 'Completed'
    };
    return labels[status] || status;
  },

  startNew: function() {
    this.currentStep = 1;
    this.showStep(1);
    document.getElementById('wizardModal').style.display = 'flex';
  },

  closeModal: function() {
    document.getElementById('wizardModal').style.display = 'none';
    document.getElementById('onboardingForm')?.reset();
  },

  showStep: function(step) {
    // Update step indicators
    document.querySelectorAll('.wizard-step').forEach(el => {
      el.classList.remove('active');
      if (parseInt(el.dataset.step) === step) el.classList.add('active');
    });

    // Show/hide content
    for (let i = 1; i <= 4; i++) {
      document.getElementById(`step${i}`).style.display = i === step ? 'block' : 'none';
    }

    // Update buttons
    document.getElementById('prevBtn').style.display = step > 1 ? 'inline-block' : 'none';
    document.getElementById('nextBtn').textContent = step === 4 ? 'Send Invitation' : 'Next';

    // Update review on step 4
    if (step === 4) this.updateReview();
  },

  nextStep: function() {
    // Validate current step
    if (this.currentStep === 1) {
      const firstName = document.getElementById('invFirstName').value;
      const lastName = document.getElementById('invLastName').value;
      const email = document.getElementById('invEmail').value;
      if (!firstName || !lastName || !email) {
        alert('Please fill in required fields');
        return;
      }
    }
    if (this.currentStep === 2) {
      const deal = document.getElementById('invDeal').value;
      const amount = document.getElementById('invAmount').value;
      if (!deal || !amount) {
        alert('Please select a deal and investment amount');
        return;
      }
    }

    if (this.currentStep === 4) {
      this.submitOnboarding();
      return;
    }

    this.currentStep++;
    this.showStep(this.currentStep);
  },

  prevStep: function() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.showStep(this.currentStep);
    }
  },

  updateDealInfo: function() {
    const dealId = document.getElementById('invDeal').value;
    const preview = document.getElementById('dealPreview');
    
    if (!dealId) {
      preview.style.display = 'none';
      return;
    }

    const deal = this.deals.find(d => d.id === dealId);
    if (deal) {
      document.getElementById('previewDealName').textContent = deal.name;
      document.getElementById('previewDealAddress').textContent = deal.address;
      document.getElementById('previewReturn').textContent = deal.targetReturn;
      document.getElementById('previewMin').textContent = this.formatCurrency(deal.minInvestment);
      document.getElementById('previewHold').textContent = deal.holdPeriod;
      preview.style.display = 'block';
    }
  },

  updateReview: function() {
    const firstName = document.getElementById('invFirstName').value;
    const lastName = document.getElementById('invLastName').value;
    const email = document.getElementById('invEmail').value;
    const entity = document.getElementById('invEntity').value;
    const dealId = document.getElementById('invDeal').value;
    const amount = document.getElementById('invAmount').value;
    const entityType = document.getElementById('invEntityType').value;

    const deal = this.deals.find(d => d.id === dealId);

    document.getElementById('reviewName').textContent = `${firstName} ${lastName}`;
    document.getElementById('reviewEmail').textContent = email;
    document.getElementById('reviewEntity').textContent = entity || 'Individual';
    document.getElementById('reviewDeal').textContent = deal?.name || '—';
    document.getElementById('reviewAmount').textContent = this.formatCurrency(amount);
    document.getElementById('reviewType').textContent = entityType;

    // Documents
    const docs = [];
    if (document.getElementById('docSubscription').checked) docs.push('Subscription Agreement');
    if (document.getElementById('docAccreditation').checked) docs.push('Accreditation Certificate');
    if (document.getElementById('docW9').checked) docs.push('W-9 Form');
    if (document.getElementById('docBankInfo').checked) docs.push('Bank Information');
    if (document.getElementById('docPpm').checked) docs.push('PPM Acknowledgment');
    if (document.getElementById('docRisk').checked) docs.push('Risk Disclosure');

    document.getElementById('reviewDocs').innerHTML = docs.map(d => `<li>${d}</li>`).join('');
  },

  submitOnboarding: function() {
    const firstName = document.getElementById('invFirstName').value;
    const lastName = document.getElementById('invLastName').value;
    const email = document.getElementById('invEmail').value;
    const entity = document.getElementById('invEntity').value;
    const dealId = document.getElementById('invDeal').value;
    const deal = this.deals.find(d => d.id === dealId);
    const amount = parseFloat(document.getElementById('invAmount').value);
    const entityType = document.getElementById('invEntityType').value;

    const docsSent = [];
    if (document.getElementById('docSubscription').checked) docsSent.push('subscription');
    if (document.getElementById('docAccreditation').checked) docsSent.push('accreditation');
    if (document.getElementById('docW9').checked) docsSent.push('w9');
    if (document.getElementById('docBankInfo').checked) docsSent.push('bank');
    if (document.getElementById('docPpm').checked) docsSent.push('ppm');
    if (document.getElementById('docRisk').checked) docsSent.push('risk');

    const newOnboarding = {
      id: Date.now().toString(),
      firstName, lastName, email, entity,
      dealId, dealName: deal?.name || '',
      investment: amount, entityType,
      status: 'started',
      progress: docsSent.length > 0 ? 25 : 10,
      startedDate: new Date().toISOString().split('T')[0],
      completedDate: null,
      docsSent,
      docsReceived: []
    };

    this.onboardings.unshift(newOnboarding);
    this.save();
    this.updateStats();
    this.renderList();
    this.closeModal();

    alert('Onboarding invitation sent to ' + email);
  },

  viewDetails: function(id) {
    const o = this.onboardings.find(x => x.id === id);
    if (!o) return;

    let msg = `${o.firstName} ${o.lastName}\n`;
    msg += `Email: ${o.email}\n`;
    msg += `Deal: ${o.dealName}\n`;
    msg += `Investment: ${this.formatCurrency(o.investment)}\n`;
    msg += `Status: ${this.formatStatus(o.status)}\n`;
    msg += `Progress: ${o.progress}%\n`;
    msg += `Docs Sent: ${o.docsSent.length}\n`;
    msg += `Docs Received: ${o.docsReceived.length}`;

    alert(msg);
  },

  sendReminder: function(id) {
    const o = this.onboardings.find(x => x.id === id);
    if (!o) return;
    alert(`Reminder sent to ${o.email}`);
  },

  formatCurrency: function(amt) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amt);
  },

  formatDate: function(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
};
