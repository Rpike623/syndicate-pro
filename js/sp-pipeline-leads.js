/**
 * SP Pipeline Leads - Investor Lead Management
 * Track prospects through conversion pipeline
 */

const LEAD_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'committed'];

const INTEREST_COLORS = {
  low: '#94a3b8',
  medium: '#f59e0b',
  high: '#6366f1',
  hot: '#ef4444'
};

window.InvestorPipeline = {
  leads: [],
  currentDragId: null,

  init: async function() {
    await this.loadLeads();
    this.renderBoard();
    this.updateStats();
  },

  loadLeads: async function() {
    // Try Firestore first
    if (window.SPFB && SPFB.db) {
      try {
        const orgId = SP.getOrgId();
        const snapshot = await SPFB.db.collection('orgs').doc(orgId)
          .collection('leads').get();
        
        if (!snapshot.empty) {
          this.leads = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          return;
        }
      } catch(e) {
        console.log('Firestore lookup failed:', e);
      }
    }
    
    // Fallback to localStorage with demo data
    const stored = JSON.stringify(SP.load('investor_leads', null));
    if (stored) {
      this.leads = JSON.parse(stored);
    } else {
      this.leads = this.generateDemoData();
      this.saveToStorage();
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
        email: 'mchen@venturecap.com',
        phone: '(415) 555-0123',
        company: 'Venture Capital Partners',
        source: 'referral',
        interest: 'hot',
        dealType: 'multifamily',
        investment: 500000,
        timeline: 'q2',
        stage: 'qualified',
        notes: 'Interested in 50+ unit properties in Sun Belt. Has $2M deployable.',
        createdAt: `${year}-02-15`,
        lastContact: `${year}-03-01`
      },
      {
        id: '2',
        firstName: 'Sarah',
        lastName: 'Williams',
        email: 'swilliams@familyoffice.io',
        phone: '(212) 555-0456',
        company: 'Williams Family Office',
        source: 'conference',
        interest: 'high',
        dealType: 'value-add',
        investment: 750000,
        timeline: 'q3',
        stage: 'proposal',
        notes: 'Met at IMN conference. Looking for opportunistic plays.',
        createdAt: `${year}-01-20`,
        lastContact: `${year}-03-05`
      },
      {
        id: '3',
        firstName: 'David',
        lastName: 'Rodriguez',
        email: 'drodriguez@texasinvest.com',
        phone: '(214) 555-0789',
        company: 'Texas Invest Group',
        source: 'website',
        interest: 'medium',
        dealType: 'industrial',
        investment: 350000,
        timeline: 'q4',
        stage: 'contacted',
        notes: 'Submitted inquiry via website. Focus on DFW market.',
        createdAt: `${year}-02-28`,
        lastContact: `${year}-03-02`
      },
      {
        id: '4',
        firstName: 'Jennifer',
        lastName: 'Park',
        email: 'jpark@pacificam.com',
        phone: '(310) 555-0234',
        company: 'Pacific Asset Management',
        source: 'linkedin',
        interest: 'high',
        dealType: 'development',
        investment: 1000000,
        timeline: 'q1',
        stage: 'committed',
        notes: 'Signed LOI for Sunset Apartments deal. Closing next week.',
        createdAt: `${year}-01-05`,
        lastContact: `${year}-03-06`
      },
      {
        id: '5',
        firstName: 'Robert',
        lastName: 'Martinez',
        email: 'rmartinez@wealthplus.com',
        phone: '(305) 555-0567',
        company: 'Wealth Plus Advisors',
        source: 'referral',
        interest: 'low',
        dealType: 'multifamily',
        investment: 150000,
        timeline: 'unknown',
        stage: 'new',
        notes: 'Referred by existing LP. Smaller check size, needs education.',
        createdAt: `${year}-03-05`,
        lastContact: null
      },
      {
        id: '6',
        firstName: 'Amanda',
        lastName: 'Thompson',
        email: 'athompson@greylake.com',
        phone: '(512) 555-0890',
        company: 'Greylake Capital',
        source: 'webinar',
        interest: 'medium',
        dealType: 'office',
        investment: 400000,
        timeline: '2027',
        stage: 'new',
        notes: 'Attended recent webinar. Wants to see more deal flow first.',
        createdAt: `${year}-03-06`,
        lastContact: null
      }
    ];
  },

  saveToStorage: function() {
    SP.save('investor_leads', this.leads);
    
    // Also sync to Firestore if available
    if (window.SPFB && SPFB.db) {
      this.syncToFirestore();
    }
  },

  syncToFirestore: async function() {
    try {
      const orgId = SP.getOrgId();
      const batch = SPFB.db.batch();
      const ref = SPFB.db.collection('orgs').doc(orgId).collection('leads');
      
      this.leads.forEach(lead => {
        if (lead.id) {
          batch.set(ref.doc(lead.id), lead);
        }
      });
      
      await batch.commit();
    } catch(e) {
      console.log('Firestore sync failed:', e);
    }
  },

  renderBoard: function() {
    LEAD_STAGES.forEach(stage => {
      const container = document.getElementById(`cards-${stage}`);
      if (!container) return;
      
      const stageLeads = this.leads.filter(l => l.stage === stage);
      document.getElementById(`count-${stage}`).textContent = stageLeads.length;
      
      container.innerHTML = stageLeads.map(lead => this.renderCard(lead)).join('');
    });
  },

  renderCard: function(lead) {
    const investment = lead.investment ? this.formatCurrency(lead.investment) : 'TBD';
    const interestColor = INTEREST_COLORS[lead.interest] || INTEREST_COLORS.medium;
    const lastContact = lead.lastContact ? this.formatDate(lead.lastContact) : 'Never';
    
    return `
      <div class="pipeline-card" draggable="true" ondragstart="InvestorPipeline.drag(event, '${lead.id}')" onclick="InvestorPipeline.showDetail('${lead.id}')">
        <div class="card-header">
          <span class="card-name">${this.escapeHtml(lead.firstName)} ${this.escapeHtml(lead.lastName)}</span>
          <span class="interest-dot" style="background:${interestColor}" title="${lead.interest} interest"></span>
        </div>
        <div class="card-company">${lead.company ? this.escapeHtml(lead.company) : 'Individual'}</div>
        <div class="card-details">
          <div class="card-detail">
            <i class="fas fa-dollar-sign"></i> ${investment}
          </div>
          <div class="card-detail">
            <i class="fas fa-clock"></i> ${lead.timeline || 'TBD'}
          </div>
        </div>
        <div class="card-footer">
          <span class="card-source">${this.formatSource(lead.source)}</span>
          <span class="card-date">${lastContact}</span>
        </div>
      </div>
    `;
  },

  updateStats: function() {
    const total = this.leads.length;
    const qualified = this.leads.filter(l => ['qualified', 'proposal', 'committed'].includes(l.stage)).length;
    const inProgress = this.leads.filter(l => l.stage === 'contacted').length;
    const converted = this.leads.filter(l => l.stage === 'committed').length;
    const pipelineValue = this.leads.reduce((sum, l) => sum + (parseFloat(l.investment) || 0), 0);

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statQualified').textContent = qualified;
    document.getElementById('statProgress').textContent = inProgress;
    document.getElementById('statConverted').textContent = converted;
    document.getElementById('statValue').textContent = this.formatCurrency(pipelineValue);
  },

  showAddModal: function() {
    document.getElementById('leadId').value = '';
    document.getElementById('modalTitle').textContent = 'Add New Lead';
    document.getElementById('leadForm').reset();
    document.getElementById('leadModal').style.display = 'flex';
  },

  closeModal: function() {
    document.getElementById('leadModal').style.display = 'none';
  },

  saveLead: function() {
    const id = document.getElementById('leadId').value;
    const firstName = document.getElementById('leadFirstName').value;
    const lastName = document.getElementById('leadLastName').value;
    const email = document.getElementById('leadEmail').value;
    const phone = document.getElementById('leadPhone').value;
    const company = document.getElementById('leadCompany').value;
    const source = document.getElementById('leadSource').value;
    const interest = document.getElementById('leadInterest').value;
    const dealType = document.getElementById('leadDealType').value;
    const investment = parseFloat(document.getElementById('leadInvestment').value) || 0;
    const timeline = document.getElementById('leadTimeline').value;
    const notes = document.getElementById('leadNotes').value;

    if (!firstName || !lastName || !email) {
      alert('Please fill in required fields');
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    if (id) {
      // Update existing
      const idx = this.leads.findIndex(l => l.id === id);
      if (idx >= 0) {
        this.leads[idx] = { 
          ...this.leads[idx], 
          firstName, lastName, email, phone, company, source, interest, 
          dealType, investment, timeline, notes, lastContact: today 
        };
      }
    } else {
      // Add new
      const newId = Date.now().toString();
      this.leads.push({
        id: newId,
        firstName, lastName, email, phone, company, source, interest,
        dealType, investment, timeline, notes,
        stage: 'new',
        createdAt: today,
        lastContact: null
      });
    }

    this.saveToStorage();
    this.renderBoard();
    this.updateStats();
    this.closeModal();
  },

  showDetail: function(id) {
    const lead = this.leads.find(l => l.id === id);
    if (!lead) return;

    const investment = lead.investment ? this.formatCurrency(lead.investment) : 'TBD';
    const interestColor = INTEREST_COLORS[lead.interest] || INTEREST_COLORS.medium;

    document.getElementById('detailContent').innerHTML = `
      <div class="detail-grid">
        <div class="detail-section">
          <h4>Contact Information</h4>
          <p><strong>Name:</strong> ${lead.firstName} ${lead.lastName}</p>
          <p><strong>Email:</strong> <a href="mailto:${lead.email}">${lead.email}</a></p>
          <p><strong>Phone:</strong> ${lead.phone || 'N/A'}</p>
          <p><strong>Company:</strong> ${lead.company || 'Individual'}</p>
        </div>
        <div class="detail-section">
          <h4>Investment Profile</h4>
          <p><strong>Target Investment:</strong> ${investment}</p>
          <p><strong>Deal Type:</strong> ${lead.dealType ? this.formatDealType(lead.dealType) : 'Any'}</p>
          <p><strong>Timeline:</strong> ${this.formatTimeline(lead.timeline)}</p>
          <p><strong>Interest Level:</strong> <span class="badge" style="background:${interestColor};color:white">${lead.interest.toUpperCase()}</span></p>
        </div>
        <div class="detail-section">
          <h4>Pipeline Status</h4>
          <p><strong>Stage:</strong> ${this.formatStage(lead.stage)}</p>
          <p><strong>Source:</strong> ${this.formatSource(lead.source)}</p>
          <p><strong>Created:</strong> ${this.formatDate(lead.createdAt)}</p>
          <p><strong>Last Contact:</strong> ${lead.lastContact ? this.formatDate(lead.lastContact) : 'Never'}</p>
        </div>
        <div class="detail-section" style="grid-column: 1/-1;">
          <h4>Notes</h4>
          <p>${lead.notes || 'No notes yet.'}</p>
        </div>
      </div>
    `;

    this.currentDetailId = id;
    document.getElementById('detailModal').style.display = 'flex';
  },

  closeDetailModal: function() {
    document.getElementById('detailModal').style.display = 'none';
  },

  editFromDetail: function() {
    const lead = this.leads.find(l => l.id === this.currentDetailId);
    if (!lead) return;

    this.closeDetailModal();

    document.getElementById('leadId').value = lead.id;
    document.getElementById('modalTitle').textContent = 'Edit Lead';
    document.getElementById('leadFirstName').value = lead.firstName;
    document.getElementById('leadLastName').value = lead.lastName;
    document.getElementById('leadEmail').value = lead.email;
    document.getElementById('leadPhone').value = lead.phone || '';
    document.getElementById('leadCompany').value = lead.company || '';
    document.getElementById('leadSource').value = lead.source || 'referral';
    document.getElementById('leadInterest').value = lead.interest || 'medium';
    document.getElementById('leadDealType').value = lead.dealType || '';
    document.getElementById('leadInvestment').value = lead.investment || '';
    document.getElementById('leadTimeline').value = lead.timeline || 'unknown';
    document.getElementById('leadNotes').value = lead.notes || '';

    document.getElementById('leadModal').style.display = 'flex';
  },

  deleteLead: function(id) {
    if (!confirm('Delete this lead?')) return;
    this.leads = this.leads.filter(l => l.id !== id);
    this.saveToStorage();
    this.renderBoard();
    this.updateStats();
  },

  // Drag and drop
  drag: function(ev, id) {
    this.currentDragId = id;
    ev.dataTransfer.setData('text', id);
  },

  allowDrop: function(ev) {
    ev.preventDefault();
  },

  drop: function(ev, stage) {
    ev.preventDefault();
    const id = this.currentDragId || ev.dataTransfer.getData('text');
    
    const lead = this.leads.find(l => l.id === id);
    if (!lead) return;

    lead.stage = stage;
    lead.lastContact = new Date().toISOString().split('T')[0];
    
    this.saveToStorage();
    this.renderBoard();
    this.updateStats();
  },

  formatCurrency: function(amt) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amt);
  },

  formatDate: function(dateStr) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  formatSource: function(source) {
    const sources = {
      'referral': 'Referral',
      'website': 'Website',
      'webinar': 'Webinar',
      'conference': 'Conference',
      'cold-outreach': 'Cold Outreach',
      'linkedin': 'LinkedIn',
      'other': 'Other'
    };
    return sources[source] || source;
  },

  formatStage: function(stage) {
    const stages = {
      'new': 'New Lead',
      'contacted': 'Contacted',
      'qualified': 'Qualified',
      'proposal': 'Proposal',
      'committed': 'Committed'
    };
    return stages[stage] || stage;
  },

  formatTimeline: function(timeline) {
    const timelines = {
      'immediate': 'Immediate',
      'q1': 'Q1 2026',
      'q2': 'Q2 2026',
      'q3': 'Q3 2026',
      'q4': 'Q4 2026',
      '2027': '2027+',
      'unknown': 'Unknown'
    };
    return timelines[timeline] || timeline;
  },

  formatDealType: function(type) {
    const types = {
      'multifamily': 'Multifamily',
      'office': 'Office',
      'industrial': 'Industrial',
      'retail': 'Retail',
      'mixed-use': 'Mixed-Use',
      'development': 'Development',
      'value-add': 'Value-Add'
    };
    return types[type] || type;
  },

  escapeHtml: function(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
