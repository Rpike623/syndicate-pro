/**
 * SP Compliance - Compliance Center Module
 * Form D, State Filings, Accreditation Tracking
 */

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
];

window.Compliance = {
  deals: [],
  formDFilings: [],
  stateFilings: [],
  investors: [],
  currentTab: 'formd',

  init: async function() {
    await this.loadDeals();
    await this.loadFilings();
    await this.loadInvestors();
    this.populateDropdowns();
    this.updateStats();
    this.renderFormD();
  },

  loadDeals: async function() {
    // SP.getDeals() may return [] if SPData cache not ready — retry once via Firestore
    let deals = SP.getDeals ? SP.getDeals() : [];
    if (!deals.length && window.SPFB && SPFB.isReady && SPFB.isReady()) {
      try { deals = await SPFB.getDeals(); } catch(e) {}
    }
    this.deals = deals.length ? deals : this.generateDemoDeals();
  },

  generateDemoDeals: function() {
    return [
      { id: 'deal_1', name: 'Sunset Apartments', propertyAddress: '123 Sunset Blvd, Phoenix, AZ' },
      { id: 'deal_2', name: 'Downtown Office', propertyAddress: '456 Main St, Austin, TX' },
      { id: 'deal_3', name: 'Industrial Portfolio', propertyAddress: '789 Warehouse Dr, Dallas, TX' }
    ];
  },

  loadFilings: async function() {
    // Try Firestore
    if (window.SPFB && SPFB.db) {
      try {
        const orgId = SP.getOrgId();
        const [formdSnap, stateSnap] = await Promise.all([
          SPFB.db.collection('orgs').doc(orgId).collection('formd').get(),
          SPFB.db.collection('orgs').doc(orgId).collection('stateFilings').get()
        ]);
        
        if (!formdSnap.empty) {
          this.formDFilings = formdSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        if (!stateSnap.empty) {
          this.stateFilings = stateSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        return;
      } catch(e) {
        console.log('Firestore lookup failed:', e);
      }
    }
    
    // Fallback to localStorage
    const formdStored = localStorage.getItem('sp_formd_filings');
    const stateStored = localStorage.getItem('sp_state_filings');
    
    if (formdStored) {
      this.formDFilings = JSON.parse(formdStored);
    } else {
      this.formDFilings = this.generateDemoFormD();
    }
    
    if (stateStored) {
      this.stateFilings = JSON.parse(stateStored);
    } else {
      this.stateFilings = this.generateDemoState();
    }
  },

  generateDemoFormD: function() {
    const now = new Date();
    const year = now.getFullYear();
    return [
      { id: '1', dealId: 'deal_1', dealName: 'Sunset Apartments', filingDate: `${year}-01-15`, amount: 5000000, investors: 12, status: 'effective', amended: false, exemption: '506(b)' },
      { id: '2', dealId: 'deal_2', dealName: 'Downtown Office', filingDate: `${year}-02-20`, amount: 8500000, investors: 18, status: 'effective', amended: true, exemption: '506(c)' },
      { id: '3', dealId: 'deal_3', dealName: 'Industrial Portfolio', filingDate: `${year}-03-01`, amount: 12000000, investors: 25, status: 'filed', amended: false, exemption: '506(b)' }
    ];
  },

  generateDemoState: function() {
    const now = new Date();
    const year = now.getFullYear();
    return [
      { id: '1', dealId: 'deal_1', dealName: 'Sunset Apartments', state: 'AZ', filingType: 'Qualification', filingDate: `${year}-01-20`, effectiveDate: `${year}-01-25`, status: 'effective' },
      { id: '2', dealId: 'deal_1', dealName: 'Sunset Apartments', state: 'TX', filingType: 'Notice', filingDate: `${year}-01-18`, effectiveDate: `${year}-01-23`, status: 'effective' },
      { id: '3', dealId: 'deal_2', dealName: 'Downtown Office', state: 'TX', filingType: 'Qualification', filingDate: `${year}-02-25`, effectiveDate: `${year}-03-01`, status: 'effective' },
      { id: '4', dealId: 'deal_3', dealName: 'Industrial Portfolio', state: 'TX', filingType: 'Notice', filingDate: `${year}-03-05`, effectiveDate: null, status: 'pending' },
      { id: '5', dealId: 'deal_3', dealName: 'Industrial Portfolio', state: 'OK', filingType: 'Notice', filingDate: `${year}-03-05`, effectiveDate: null, status: 'pending' }
    ];
  },

  loadInvestors: async function() {
    this.investors = SP.getInvestors ? SP.getInvestors() : [];
    if (!this.investors.length) {
      this.investors = this.generateDemoInvestors();
    }
  },

  generateDemoInvestors: function() {
    const now = new Date();
    const year = now.getFullYear();
    return [
      { id: 'inv1', firstName: 'John', lastName: 'Smith', email: 'jsmith@email.com', accreditation: { method: 'Net Worth', verifiedDate: `${year}-01-10`, expiryDate: `${year + 1}-01-10`, status: 'verified' } },
      { id: 'inv2', firstName: 'Jane', lastName: 'Doe', email: 'jdoe@email.com', accreditation: { method: 'Income', verifiedDate: `${year}-02-15`, expiryDate: `${year + 1}-02-15`, status: 'verified' } },
      { id: 'inv3', firstName: 'Bob', lastName: 'Wilson', email: 'bwilson@email.com', accreditation: { method: 'None', verifiedDate: null, expiryDate: null, status: 'not_verified' } },
      { id: 'inv4', firstName: 'Alice', lastName: 'Brown', email: 'abrown@email.com', accreditation: { method: 'Net Worth', verifiedDate: `${year - 1}-06-01`, expiryDate: `${year}-06-01`, status: 'expired' } },
      { id: 'inv5', firstName: 'Charlie', lastName: 'Davis', email: 'cdavis@email.com', accreditation: { method: 'IRS Letter', verifiedDate: null, expiryDate: null, status: 'pending' } }
    ];
  },

  populateDropdowns: function() {
    // Deal dropdowns
    const options = '<option value="">Select deal...</option>' + 
      this.deals.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    
    document.getElementById('formdDealFilter').innerHTML = options;
    document.getElementById('stateDealFilter').innerHTML = options;
    document.getElementById('filingDeal').innerHTML = options.replace('Select deal...', 'Select deal... *');
    
    // State dropdown
    const stateOptions = '<option value="">Select state...</option>' + 
      US_STATES.map(s => `<option value="${s}">${s}</option>`).join('');
    document.getElementById('filingState').innerHTML = stateOptions;
  },

  updateStats: function() {
    const activeDeals = this.deals.length;
    const pendingFilings = this.stateFilings.filter(f => f.status === 'pending').length;
    const filedThisYear = this.formDFilings.filter(f => {
      const d = new Date(f.filingDate);
      return d.getFullYear() === new Date().getFullYear();
    }).length;
    const accredited = this.investors.filter(i => i.accreditation?.status === 'verified').length;
    const exemptions = [...new Set(this.formDFilings.map(f => f.exemption))].length;

    document.getElementById('statDeals').textContent = activeDeals;
    document.getElementById('statPending').textContent = pendingFilings;
    document.getElementById('statFiled').textContent = filedThisYear;
    document.getElementById('statAccredited').textContent = accredited;
    document.getElementById('statExemptions').textContent = exemptions;

    // Exemption counts
    const counts = { '506(b)': 0, '506(c)': 0, '504': 0, '505': 0 };
    this.formDFilings.forEach(f => {
      if (counts[f.exemption] !== undefined) counts[f.exemption]++;
    });
    document.getElementById('stat506b').textContent = counts['506(b)'];
    document.getElementById('stat506c').textContent = counts['506(c)'];
    document.getElementById('stat504').textContent = counts['504'];
    document.getElementById('stat505').textContent = counts['505'];
  },

  switchTab: function(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.getElementById(`tab-${tab}`).style.display = 'block';
    
    if (tab === 'formd') this.renderFormD();
    if (tab === 'state') this.renderState();
    if (tab === 'accreditation') this.renderAccreditation();
  },

  renderFormD: function() {
    const dealFilter = document.getElementById('formdDealFilter').value;
    let filings = this.formDFilings;
    if (dealFilter) filings = filings.filter(f => f.dealId === dealFilter);

    const tbody = document.getElementById('formdTableBody');
    if (!filings.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No Form D filings found</td></tr>';
      return;
    }

    tbody.innerHTML = filings.map(f => `
      <tr>
        <td>${this.escapeHtml(f.dealName)}</td>
        <td>${this.formatDate(f.filingDate)}</td>
        <td>${this.formatCurrency(f.amount)}</td>
        <td>${f.investors}</td>
        <td><span class="badge badge-${f.status === 'effective' ? 'success' : f.status === 'filed' ? 'info' : 'warning'}">${f.status}</span></td>
        <td>${f.amended ? '<i class="fas fa-check text-success"></i>' : '<i class="fas fa-minus text-muted"></i>'}</td>
        <td class="text-center">
          <button class="btn-icon" onclick="Compliance.editFiling('${f.id}', 'formd')"><i class="fas fa-edit"></i></button>
          <button class="btn-icon text-danger" onclick="Compliance.deleteFiling('${f.id}', 'formd')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  },

  renderState: function() {
    const dealFilter = document.getElementById('stateDealFilter').value;
    let filings = this.stateFilings;
    if (dealFilter) filings = filings.filter(f => f.dealId === dealFilter);

    const tbody = document.getElementById('stateTableBody');
    if (!filings.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No state filings found</td></tr>';
      return;
    }

    tbody.innerHTML = filings.map(f => `
      <tr>
        <td>${this.escapeHtml(f.dealName)}</td>
        <td><span class="badge badge-secondary">${f.state}</span></td>
        <td>${f.filingType}</td>
        <td>${this.formatDate(f.filingDate)}</td>
        <td>${f.effectiveDate ? this.formatDate(f.effectiveDate) : '<span class="text-muted">—</span>'}</td>
        <td><span class="badge badge-${f.status === 'effective' ? 'success' : f.status === 'pending' ? 'warning' : 'info'}">${f.status}</span></td>
        <td class="text-center">
          <button class="btn-icon" onclick="Compliance.editFiling('${f.id}', 'state')"><i class="fas fa-edit"></i></button>
          <button class="btn-icon text-danger" onclick="Compliance.deleteFiling('${f.id}', 'state')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  },

  renderAccreditation: function() {
    const statusFilter = document.getElementById('accredFilter').value;
    let investors = this.investors.filter(i => i.accreditation);
    if (statusFilter) investors = investors.filter(i => i.accreditation.status === statusFilter);

    const tbody = document.getElementById('accredTableBody');
    if (!investors.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No investor accreditation data</td></tr>';
      return;
    }

    tbody.innerHTML = investors.map(i => `
      <tr>
        <td>${this.escapeHtml(i.firstName)} ${this.escapeHtml(i.lastName)}</td>
        <td>${i.accreditation.method || 'N/A'}</td>
        <td>${i.accreditation.verifiedDate ? this.formatDate(i.accreditation.verifiedDate) : '—'}</td>
        <td>${i.accreditation.expiryDate ? this.formatDate(i.accreditation.expiryDate) : '—'}</td>
        <td><span class="badge badge-${i.accreditation.status === 'verified' ? 'success' : i.accreditation.status === 'pending' ? 'warning' : i.accreditation.status === 'expired' ? 'danger' : 'secondary'}">${i.accreditation.status.replace('_', ' ')}</span></td>
        <td>${i.accreditation.docUrl ? '<a href="#" onclick="return false"><i class="fas fa-file-pdf"></i></a>' : '—'}</td>
        <td class="text-center">
          <button class="btn-icon"><i class="fas fa-edit"></i></button>
        </td>
      </tr>
    `).join('');
  },

  showAddModal: function() {
    document.getElementById('filingId').value = '';
    document.getElementById('filingForm').reset();
    document.getElementById('filingDate').value = new Date().toISOString().split('T')[0];
    
    const isState = this.currentTab === 'state';
    document.getElementById('filingType').value = isState ? 'state' : 'formd';
    document.getElementById('stateField').style.display = isState ? 'block' : 'none';
    document.getElementById('amountField').style.display = isState ? 'none' : 'block';
    document.getElementById('investorField').style.display = isState ? 'none' : 'block';
    
    document.getElementById('filingModal').style.display = 'flex';
  },

  closeModal: function() {
    document.getElementById('filingModal').style.display = 'none';
  },

  saveFiling: function() {
    const id = document.getElementById('filingId').value;
    const type = document.getElementById('filingType').value;
    const dealId = document.getElementById('filingDeal').value;
    const deal = this.deals.find(d => d.id === dealId);
    const filingDate = document.getElementById('filingDate').value;
    const status = document.getElementById('filingStatus').value;
    const notes = document.getElementById('filingNotes').value;

    if (!dealId || !filingDate) {
      alert('Please fill in required fields');
      return;
    }

    if (type === 'formd') {
      const amount = parseFloat(document.getElementById('filingAmount').value) || 0;
      const investors = parseInt(document.getElementById('filingInvestors').value) || 0;

      if (id) {
        const idx = this.formDFilings.findIndex(f => f.id === id);
        if (idx >= 0) this.formDFilings[idx] = { ...this.formDFilings[idx], dealId, dealName: deal.name, filingDate, amount, investors, status, notes };
      } else {
        this.formDFilings.push({
          id: Date.now().toString(), dealId, dealName: deal.name, filingDate, amount, investors, status, notes, exemption: '506(b)', amended: false
        });
      }
      this.saveFormD();
      this.renderFormD();
    } else {
      const state = document.getElementById('filingState').value;
      const effectiveDate = filingDate; // Simplified

      if (id) {
        const idx = this.stateFilings.findIndex(f => f.id === id);
        if (idx >= 0) this.stateFilings[idx] = { ...this.stateFilings[idx], dealId, dealName: deal.name, state, filingDate, effectiveDate, status, notes };
      } else {
        this.stateFilings.push({
          id: Date.now().toString(), dealId, dealName: deal.name, state, filingType: 'Notice', filingDate, effectiveDate, status, notes
        });
      }
      this.saveState();
      this.renderState();
    }

    this.updateStats();
    this.closeModal();
  },

  editFiling: function(id, type) {
    const filing = type === 'formd' 
      ? this.formDFilings.find(f => f.id === id)
      : this.stateFilings.find(f => f.id === id);
    
    if (!filing) return;

    document.getElementById('filingId').value = id;
    document.getElementById('filingType').value = type;
    document.getElementById('filingDeal').value = filing.dealId;
    document.getElementById('filingDate').value = filing.filingDate;
    document.getElementById('filingStatus').value = filing.status;
    document.getElementById('filingNotes').value = filing.notes || '';

    if (type === 'formd') {
      document.getElementById('filingAmount').value = filing.amount;
      document.getElementById('filingInvestors').value = filing.investors;
      document.getElementById('stateField').style.display = 'none';
      document.getElementById('amountField').style.display = 'block';
      document.getElementById('investorField').style.display = 'block';
    } else {
      document.getElementById('filingState').value = filing.state;
      document.getElementById('stateField').style.display = 'block';
      document.getElementById('amountField').style.display = 'none';
      document.getElementById('investorField').style.display = 'none';
    }

    document.getElementById('filingModal').style.display = 'flex';
  },

  deleteFiling: function(id, type) {
    if (!confirm('Delete this filing?')) return;
    
    if (type === 'formd') {
      this.formDFilings = this.formDFilings.filter(f => f.id !== id);
      this.saveFormD();
      this.renderFormD();
    } else {
      this.stateFilings = this.stateFilings.filter(f => f.id !== id);
      this.saveState();
      this.renderState();
    }
    this.updateStats();
  },

  saveFormD: function() {
    localStorage.setItem('sp_formd_filings', JSON.stringify(this.formDFilings));
    // TODO: Sync to Firestore
  },

  saveState: function() {
    localStorage.setItem('sp_state_filings', JSON.stringify(this.stateFilings));
    // TODO: Sync to Firestore
  },

  exportReport: function() {
    const report = [
      'COMPLIANCE REPORT',
      `Generated: ${new Date().toLocaleString()}`,
      '',
      '=== FORM D FILINGS ===',
      ...this.formDFilings.map(f => `${f.dealName} | ${f.filingDate} | ${this.formatCurrency(f.amount)} | ${f.status}`),
      '',
      '=== STATE FILINGS ===',
      ...this.stateFilings.map(f => `${f.dealName} | ${f.state} | ${f.filingDate} | ${f.status}`),
      '',
      '=== ACCREDITATION ===',
      ...this.investors.map(i => `${i.firstName} ${i.lastName} | ${i.accreditation?.status || 'N/A'}`)
    ].join('\n');

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance_report_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  },

  formatCurrency: function(amt) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amt);
  },

  formatDate: function(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  escapeHtml: function(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
