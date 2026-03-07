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
    const name = document.getElementById('docName').value.trim();
    const category = document.getElementById('docCategory').value;
    const access = document.getElementById('docAccess').value;
    const fileInput = document.getElementById('docFile');
    const file = fileInput.files[0];

    if (!name) { alert('Please enter a document name.'); return; }

    const dealId = this.currentDeal?.id;
    if (!dealId) { alert('No deal selected.'); return; }

    const saveBtn = document.querySelector('#uploadModal .btn-primary');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading…'; }

    const doSave = (fileUrl, fileSize, mimeType) => {
      const newDoc = {
        id: Date.now().toString(),
        name,
        category,
        access,
        uploadedBy: SP.getSession()?.name || 'GP',
        date: new Date().toISOString().split('T')[0],
        size: fileSize || '—',
        fileUrl: fileUrl || null,
        mimeType: mimeType || null,
        storagePath: null,
      };
      this.documents.unshift(newDoc);
      this.saveDocuments();
      this.renderDocuments();
      this.closeModal();
      fileInput.value = '';
      document.getElementById('docName').value = '';
      if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-upload"></i> Upload'; }
      SP.logActivity('fa-file-upload', 'blue', `Document <strong>${name}</strong> uploaded to <strong>${this.currentDeal.name}</strong>`);
      this._showToast('Document uploaded!');
    };

    const formatSize = (bytes) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1048576).toFixed(1) + ' MB';
    };

    if (file) {
      // Try Firebase Storage first, fall back to base64 in localStorage
      if (typeof SPFB !== 'undefined' && SPFB.isReady() && !SPFB.isOffline() && typeof SPFB.uploadFile === 'function') {
        SPFB.uploadFile(file, dealId, category, access === 'all' ? 'all_investors' : 'gp')
          .then(({ docId, fileUrl }) => doSave(fileUrl, formatSize(file.size), file.type))
          .catch(err => {
            console.warn('Firebase upload failed, falling back to local:', err);
            const reader = new FileReader();
            reader.onload = (ev) => doSave(ev.target.result, formatSize(file.size), file.type);
            reader.readAsDataURL(file);
          });
      } else {
        // Store as base64 data URL (localStorage — works offline)
        if (file.size > 10 * 1024 * 1024) { alert('File too large for local storage (max 10MB). Connect to Firebase for larger files.'); if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-upload"></i> Upload'; } return; }
        const reader = new FileReader();
        reader.onload = (ev) => doSave(ev.target.result, formatSize(file.size), file.type);
        reader.readAsDataURL(file);
      }
    } else {
      // No file — save metadata only (e.g., linked generated document)
      doSave(null, '—', null);
    }
  },

  _showToast: function(msg) {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:8px;font-size:.875rem;font-weight:600;background:#10b981;color:white;box-shadow:0 8px 24px rgba(0,0,0,.15);display:flex;align-items:center;gap:8px;font-family:Inter,sans-serif;';
    t.innerHTML = '<i class="fas fa-check-circle"></i>' + msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2500);
  },

  viewDoc: function(id) {
    const doc = this.documents.find(d => d.id === id);
    if (!doc) return;
    if (doc.fileUrl) {
      // Base64 or Firebase URL
      const w = window.open();
      if (doc.fileUrl.startsWith('data:')) {
        w.document.write(`<!DOCTYPE html><html><head><title>${doc.name}</title></head><body style="margin:0;background:#000;">
          <iframe src="${doc.fileUrl}" style="width:100%;height:100vh;border:none;"></iframe>
        </body></html>`);
        w.document.close();
      } else {
        w.location.href = doc.fileUrl;
      }
    } else {
      alert('No file attached to this document record. Please re-upload with a file.');
    }
  },

  downloadDoc: function(id) {
    const doc = this.documents.find(d => d.id === id);
    if (!doc) return;
    if (doc.fileUrl) {
      const a = document.createElement('a');
      a.href = doc.fileUrl;
      a.download = doc.name + (doc.mimeType === 'application/pdf' ? '.pdf' : '');
      a.click();
    } else {
      alert('No file to download. Re-upload this document with an attached file.');
    }
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
