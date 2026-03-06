/**
 * SP Deal Room - Secure Document Sharing per Deal
 */

window.DealRoom = {
  deals: [],
  currentDeal: null,
  documents: [],
  activities: [],

  init: async function() {
    await this.loadDeals();
    this.populateDeals();
  },

  loadDeals: async function() {
    this.deals = SP.getDeals ? SP.getDeals() : [];
    if (!this.deals.length) {
      this.deals = [
        { id: 'deal_1', name: 'Sunset Apartments', address: '123 Sunset Blvd, Phoenix, AZ', type: 'Multifamily', equity: 4500000, investors: 12 },
        { id: 'deal_2', name: 'Downtown Office', address: '456 Main St, Austin, TX', type: 'Office', equity: 3500000, investors: 8 },
        { id: 'deal_3', name: 'Industrial Portfolio', address: '789 Warehouse Dr, Dallas, TX', type: 'Industrial', equity: 7200000, investors: 15 }
      ];
    }
  },

  populateDeals: function() {
    const select = document.getElementById('dealSelect');
    select.innerHTML = '<option value="">Select a deal...</option>' +
      this.deals.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  },

  loadDeal: function() {
    const dealId = document.getElementById('dealSelect').value;
    if (!dealId) {
      document.getElementById('dealContent').style.display = 'none';
      document.getElementById('emptyState').style.display = 'block';
      return;
    }

    this.currentDeal = this.deals.find(d => d.id === dealId);
    this.loadDocuments(dealId);
    this.loadInvestors(dealId);
    this.loadActivity(dealId);
    
    // Show content
    document.getElementById('dealContent').style.display = 'block';
    document.getElementById('emptyState').style.display = 'none';

    // Update header
    document.getElementById('dealName').textContent = this.currentDeal.name;
    document.getElementById('dealAddress').textContent = this.currentDeal.address;
    document.getElementById('dealInvestors').textContent = this.currentDeal.investors;
    document.getElementById('dealEquity').textContent = this.formatCurrency(this.currentDeal.equity);
    document.getElementById('dealType').textContent = this.currentDeal.type;
  },

  loadDocuments: function(dealId) {
    const stored = localStorage.getItem(`sp_dealroom_docs_${dealId}`);
    if (stored) {
      this.documents = JSON.parse(stored);
    } else {
      this.documents = this.generateDemoDocs();
    }
    this.renderDocuments();
  },

  generateDemoDocs: function() {
    const now = new Date();
    const year = now.getFullYear();
    return [
      { id: '1', name: 'Purchase Agreement', category: 'legal', uploadedBy: 'GP', date: `${year}-01-15`, size: '2.4 MB', access: 'all' },
      { id: '2', name: 'Operating Agreement', category: 'legal', uploadedBy: 'GP', date: `${year}-01-18`, size: '1.1 MB', access: 'all' },
      { id: '3', name: 'Title Policy', category: 'legal', uploadedBy: 'GP', date: `${year}-01-20`, size: '850 KB', access: 'all' },
      { id: '4', name: 'Q1 2026 Financials', category: 'financial', uploadedBy: 'GP', date: `${year}-04-01`, size: '320 KB', access: 'all' },
      { id: '5', name: 'Q4 2025 Financials', category: 'financial', uploadedBy: 'GP', date: `${year}-01-15`, size: '290 KB', access: 'all' },
      { id: '6', name: 'Rent Roll - March 2026', category: 'financial', uploadedBy: 'GP', date: `${year}-04-05`, size: '180 KB', access: 'all' },
      { id: '7', name: 'Property Photos', category: 'property', uploadedBy: 'GP', date: `${year}-01-10`, size: '15.2 MB', access: 'all' },
      { id: '8', name: 'Inspection Report', category: 'property', uploadedBy: 'GP', date: `${year}-01-12`, size: '4.8 MB', access: 'all' },
      { id: '9', name: 'Insurance Certificate', category: 'property', uploadedBy: 'GP', date: `${year}-01-15`, size: '420 KB', access: 'all' },
      { id: '10', name: 'Investor Call Notes - Feb', category: 'correspondence', uploadedBy: 'GP', date: `${year}-02-28`, size: '45 KB', access: 'all' }
    ];
  },

  saveDocuments: function() {
    if (this.currentDeal) {
      localStorage.setItem(`sp_dealroom_docs_${this.currentDeal.id}`, JSON.stringify(this.documents));
    }
  },

  renderDocuments: function() {
    const categories = {
      legal: 'docsLegal',
      financial: 'docsFinancial',
      property: 'docsProperty',
      correspondence: 'docsCorrespondence'
    };

    Object.keys(categories).forEach(cat => {
      const docs = this.documents.filter(d => d.category === cat);
      document.getElementById(`count${cat.charAt(0).toUpperCase() + cat.slice(1)}`).textContent = docs.length;
      
      document.getElementById(categories[cat]).innerHTML = docs.map(d => `
        <div class="doc-item" onclick="DealRoom.viewDoc('${d.id}')">
          <div class="doc-icon">
            <i class="fas fa-file-${this.getFileIcon(d.name)}"></i>
          </div>
          <div class="doc-info">
            <strong>${d.name}</strong>
            <span>${d.date} • ${d.size}</span>
          </div>
          <div class="doc-actions">
            <button class="btn-icon" onclick="event.stopPropagation(); DealRoom.downloadDoc('${d.id}')"><i class="fas fa-download"></i></button>
            <button class="btn-icon text-danger" onclick="event.stopPropagation(); DealRoom.deleteDoc('${d.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `).join('') || '<p class="text-muted" style="padding:12px;">No documents</p>';
    });
  },

  loadInvestors: function(dealId) {
    const investors = SP.getInvestors ? SP.getInvestors() : [];
    const demoInvestors = [
      { id: 'inv1', firstName: 'John', lastName: 'Smith', investment: 500000, status: 'active' },
      { id: 'inv2', firstName: 'Sarah', lastName: 'Williams', investment: 350000, status: 'active' },
      { id: 'inv3', firstName: 'Mike', lastName: 'Johnson', investment: 250000, status: 'active' },
      { id: 'inv4', firstName: 'Lisa', lastName: 'Brown', investment: 750000, status: 'active' },
      { id: 'inv5', firstName: 'David', lastName: 'Jones', investment: 150000, status: 'pending' }
    ];

    const totalEquity = demoInvestors.reduce((s, i) => s + i.investment, 0);
    
    document.getElementById('investorTableBody').innerHTML = demoInvestors.map(inv => {
      const ownership = ((inv.investment / totalEquity) * 100).toFixed(1);
      return `
        <tr>
          <td><strong>${inv.firstName} ${inv.lastName}</strong></td>
          <td>${this.formatCurrency(inv.investment)}</td>
          <td>${ownership}%</td>
          <td><span class="badge badge-${inv.status === 'active' ? 'success' : 'warning'}">${inv.status}</span></td>
          <td class="text-center">
            <button class="btn-icon"><i class="fas fa-file-pdf"></i></button>
          </td>
        </tr>
      `;
    }).join('');
  },

  loadActivity: function(dealId) {
    const now = new Date();
    const year = now.getFullYear();
    
    this.activities = [
      { id: '1', action: 'document uploaded', detail: 'Q1 2026 Financials', user: 'GP', date: `${year}-04-01` },
      { id: '2', action: 'distribution posted', detail: '$125,000 to all investors', user: 'System', date: `${year}-03-15` },
      { id: '3', action: 'document viewed', detail: 'Operating Agreement', user: 'John Smith', date: `${year}-03-14` },
      { id: '4', action: 'investor added', detail: 'Lisa Brown - $750K', user: 'GP', date: `${year}-03-10` },
      { id: '5', action: 'document uploaded', detail: 'Rent Roll - March 2026', user: 'GP', date: `${year}-04-05` },
      { id: '6', action: 'report generated', detail: 'Monthly Performance Report', user: 'System', date: `${year}-04-01` }
    ];

    document.getElementById('activityFeed').innerHTML = this.activities.map(a => `
      <div class="activity-item">
        <div class="activity-icon">
          <i class="fas fa-${this.getActivityIcon(a.action)}"></i>
        </div>
        <div class="activity-content">
          <p><strong>${a.action}</strong> - ${a.detail}</p>
          <span class="activity-meta">${a.user} • ${a.date}</span>
        </div>
      </div>
    `).join('');
  },

  switchTab: function(tab) {
    document.querySelectorAll('.dr-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    
    document.querySelectorAll('.dr-tab-content').forEach(c => c.style.display = 'none');
    document.getElementById(`tab-${tab}`).style.display = 'block';
  },

  uploadDoc: function() {
    document.getElementById('uploadModal').style.display = 'flex';
  },

  closeModal: function() {
    document.getElementById('uploadModal').style.display = 'none';
  },

  saveDoc: function() {
    const name = document.getElementById('docName').value;
    const category = document.getElementById('docCategory').value;
    const access = document.getElementById('docAccess').value;
    
    if (!name) {
      alert('Please enter document name');
      return;
    }

    const newDoc = {
      id: Date.now().toString(),
      name,
      category,
      access,
      uploadedBy: 'GP',
      date: new Date().toISOString().split('T')[0],
      size: '0 KB'
    };

    this.documents.unshift(newDoc);
    this.saveDocuments();
    this.renderDocuments();
    this.closeModal();
    
    // Clear form
    document.getElementById('docName').value = '';
  },

  viewDoc: function(id) {
    alert('Opening document viewer...');
  },

  downloadDoc: function(id) {
    alert('Downloading document...');
  },

  deleteDoc: function(id) {
    if (!confirm('Delete this document?')) return;
    this.documents = this.documents.filter(d => d.id !== id);
    this.saveDocuments();
    this.renderDocuments();
  },

  shareRoom: function() {
    alert(`Deal room link copied to clipboard!\n\nhttps://deeltrack.com/room/${this.currentDeal?.id}`);
  },

  getFileIcon: function(name) {
    const ext = name.split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx'].includes(ext)) return 'word';
    if (['xls', 'xlsx'].includes(ext)) return 'excel';
    if (['jpg', 'jpeg', 'png'].includes(ext)) return 'image';
    return 'alt';
  },

  getActivityIcon: function(action) {
    if (action.includes('upload')) return 'upload';
    if (action.includes('view')) return 'eye';
    if (action.includes('distribution')) return 'hand-holding-dollar';
    if (action.includes('investor')) return 'user-plus';
    if (action.includes('report')) return 'chart-bar';
    return 'info-circle';
  },

  formatCurrency: function(amt) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amt);
  }
};
