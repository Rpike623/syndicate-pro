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
    const yr = now.getFullYear();
    const deal = this.currentDeal || {};
    const dealName = deal.name || 'Property';
    const gp = (typeof SP !== 'undefined' && SP.load) ? (SP.load('settings', {}).firmName || 'GP Firm') : 'GP Firm';

    // Generate simple HTML content for each doc type that can actually be viewed
    const makeDoc = (html) => 'data:text/html;charset=utf-8,' + encodeURIComponent(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Georgia,serif;max-width:760px;margin:40px auto;padding:20px;line-height:1.8;color:#0f172a;background:#fff;} h1{font-size:1.4rem;border-bottom:2px solid #0f172a;padding-bottom:8px;} table{width:100%;border-collapse:collapse;} th,td{padding:8px 12px;border:1px solid #ddd;text-align:left;} th{background:#f1f5f9;font-weight:700;} .label{font-weight:700;} .placeholder{background:#fef9c3;border:1px solid #fbbf24;border-radius:6px;padding:10px 14px;font-size:0.85rem;color:#92400e;margin-bottom:20px;font-family:sans-serif;}</style></head><body>${html}</body></html>`);

    return [
      {
        id: 'd_oa', name: 'Operating Agreement', category: 'legal',
        uploadedBy: 'GP', date: `${yr}-01-15`, size: 'HTML', access: 'all',
        fileUrl: makeDoc(`<div class="placeholder">⚠ DEMO DOCUMENT — for testing functionality only. Not for actual legal use.</div><h1>Operating Agreement — ${dealName}</h1><p><span class="label">Entity:</span> ${gp}</p><p><span class="label">Property:</span> ${dealName}</p><p><span class="label">Date:</span> January 15, ${yr}</p><h2>Capital Structure</h2><table><tr><th>Class</th><th>Ownership %</th><th>Investment</th></tr><tr><td>General Partner</td><td>10%</td><td>$${Math.round((deal.raise||1000000)*0.1).toLocaleString()}</td></tr><tr><td>Limited Partners</td><td>90%</td><td>$${Math.round((deal.raise||1000000)*0.9).toLocaleString()}</td></tr></table><h2>Distribution Waterfall</h2><p>1. Return of capital to all members pro-rata</p><p>2. ${deal.prefReturn||8}% preferred return to limited partners</p><p>3. GP catch-up (${deal.gpPromote||20}% of preferred paid)</p><p>4. Residual ${deal.gpPromote||20}% GP / ${100-(deal.gpPromote||20)}% LP</p>`)
      },
      {
        id: 'd_sub', name: 'Subscription Agreement (Template)', category: 'legal',
        uploadedBy: 'GP', date: `${yr}-01-18`, size: 'HTML', access: 'all',
        fileUrl: makeDoc(`<div class="placeholder">⚠ DEMO DOCUMENT — template only.</div><h1>Subscription Agreement — ${dealName}</h1><p>This Subscription Agreement is entered into by the undersigned Limited Partner ("Subscriber") and ${gp} (the "Company").</p><h2>1. Subscription</h2><p>Subscriber agrees to invest $[AMOUNT] representing [OWNERSHIP]% of total equity.</p><h2>2. Accredited Investor</h2><p>Subscriber certifies they are an Accredited Investor as defined under SEC Rule 501.</p><h2>3. Representations</h2><p>Subscriber acknowledges the investment is illiquid and speculative.</p>`)
      },
      {
        id: 'd_fin', name: 'Q1 2026 Financial Summary', category: 'financial',
        uploadedBy: 'GP', date: `${yr}-04-01`, size: 'HTML', access: 'all',
        fileUrl: makeDoc(`<div class="placeholder">⚠ DEMO — sample financial report format.</div><h1>Q1 ${yr} Financial Summary — ${dealName}</h1><table><tr><th>Metric</th><th>Q1 ${yr}</th><th>Budget</th></tr><tr><td>Gross Revenue</td><td>$${Math.round((deal.raise||1000000)*0.02).toLocaleString()}</td><td>$${Math.round((deal.raise||1000000)*0.019).toLocaleString()}</td></tr><tr><td>Operating Expenses</td><td>$${Math.round((deal.raise||1000000)*0.008).toLocaleString()}</td><td>$${Math.round((deal.raise||1000000)*0.009).toLocaleString()}</td></tr><tr><td>NOI</td><td>$${Math.round((deal.raise||1000000)*0.012).toLocaleString()}</td><td>$${Math.round((deal.raise||1000000)*0.01).toLocaleString()}</td></tr><tr><td>Occupancy</td><td>94.2%</td><td>95%</td></tr></table>`)
      },
      {
        id: 'd_rr', name: 'Rent Roll — Current', category: 'financial',
        uploadedBy: 'GP', date: `${yr}-04-05`, size: 'HTML', access: 'all',
        fileUrl: makeDoc(`<div class="placeholder">⚠ DEMO — sample rent roll format. Upload your actual rent roll using the Upload button above.</div><h1>Rent Roll — ${dealName}</h1><p>As of ${new Date().toLocaleDateString()}</p><table><tr><th>Unit</th><th>Tenant</th><th>Lease Start</th><th>Lease End</th><th>Monthly Rent</th><th>Status</th></tr><tr><td>101</td><td>[Tenant Name]</td><td>Jan 1, ${yr}</td><td>Dec 31, ${yr}</td><td>$2,400</td><td>Current</td></tr><tr><td>102</td><td>[Tenant Name]</td><td>Mar 1, ${yr}</td><td>Feb 28, ${yr+1}</td><td>$2,350</td><td>Current</td></tr><tr><td>103</td><td>VACANT</td><td>—</td><td>—</td><td>—</td><td>Vacant</td></tr></table>`)
      },
      {
        id: 'd_inspect', name: 'Property Inspection Report', category: 'property',
        uploadedBy: 'GP', date: `${yr}-01-12`, size: 'HTML', access: 'all',
        fileUrl: makeDoc(`<div class="placeholder">⚠ DEMO — sample inspection report. Replace with your actual report.</div><h1>Property Inspection Report — ${dealName}</h1><p><span class="label">Date:</span> January 12, ${yr}</p><p><span class="label">Inspector:</span> [Inspector Name & License]</p><h2>Summary</h2><p>Overall condition: <strong>Good</strong>. No major structural deficiencies identified.</p><h2>Items Requiring Attention</h2><table><tr><th>Item</th><th>Priority</th><th>Est. Cost</th></tr><tr><td>Roof — Minor repairs needed</td><td>Low</td><td>$8,000</td></tr><tr><td>HVAC Units — 3 units near end of life</td><td>Medium</td><td>$15,000</td></tr><tr><td>Parking lot resurfacing</td><td>Low</td><td>$12,000</td></tr></table>`)
      },
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
      
      const accessBadge = (d) => {
        if (d.access === 'gp') return '<span style="font-size:.67rem;font-weight:600;padding:2px 7px;border-radius:10px;background:#F0EDEA;color:#6B6560;white-space:nowrap;"><i class="fas fa-lock"></i> GP Only</span>';
        if (d.access === 'select') {
          const cnt = d.allowedInvestors?.length || 0;
          return `<span style="font-size:.67rem;font-weight:600;padding:2px 7px;border-radius:10px;background:rgba(99,102,241,.12);color:#6366f1;white-space:nowrap;"><i class="fas fa-users"></i> ${cnt} investor${cnt===1?'':'s'}</span>`;
        }
        return '<span style="font-size:.67rem;font-weight:600;padding:2px 7px;border-radius:10px;background:rgba(45,154,107,.12);color:#0F5C35;white-space:nowrap;"><i class="fas fa-eye"></i> All</span>';
      };
      document.getElementById(categories[cat]).innerHTML = docs.map(d => `
        <div class="doc-item" onclick="DealRoom.viewDoc('${d.id}')">
          <div class="doc-icon">
            <i class="fas fa-file-${this.getFileIcon(d.name)}"></i>
          </div>
          <div class="doc-info">
            <strong>${d.name}</strong>
            <span>${d.date} • ${d.size} &nbsp; ${accessBadge(d)}</span>
          </div>
          <div class="doc-actions">
            <button class="btn-icon" title="Manage access" onclick="event.stopPropagation(); DealRoom.manageDocAccess('${d.id}')"><i class="fas fa-user-lock"></i></button>
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
    
    // Seed with static demo events
    const staticEvents = [
      { id: '1', action: 'document uploaded', detail: 'Q1 2026 Financials', user: 'GP', date: `${year}-04-01`, ts: null },
      { id: '2', action: 'distribution posted', detail: '$125,000 to all investors', user: 'System', date: `${year}-03-15`, ts: null },
      { id: '3', action: 'document viewed', detail: 'Operating Agreement', user: 'John Smith', date: `${year}-03-14`, ts: null },
      { id: '4', action: 'investor added', detail: 'Lisa Brown - $750K', user: 'GP', date: `${year}-03-10`, ts: null },
      { id: '5', action: 'document uploaded', detail: 'Rent Roll - March 2026', user: 'GP', date: `${year}-04-05`, ts: null },
    ];

    // Pull real document view events from localStorage
    const realEvents = this.getDocActivity(dealId).map(e => ({
      id: e.id,
      action: 'document viewed',
      detail: e.docName,
      user: e.investorName,
      date: e.timestamp ? e.timestamp.split('T')[0] : '',
      ts: e.timestamp,
    }));

    // Merge + sort by timestamp descending (real events first if same date)
    this.activities = [...realEvents, ...staticEvents].sort((a, b) => {
      if (a.ts && b.ts) return new Date(b.ts) - new Date(a.ts);
      if (a.ts) return -1;
      if (b.ts) return 1;
      return b.date.localeCompare(a.date);
    });

    this.renderActivity();
  },

  renderActivity: function() {
    const feed = document.getElementById('activityFeed');
    if (!feed) return;
    if (!this.activities.length) {
      feed.innerHTML = '<p class="text-muted" style="padding:16px;text-align:center;">No activity yet</p>';
      return;
    }
    feed.innerHTML = this.activities.map(a => {
      const timeStr = a.ts ? new Date(a.ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : a.date;
      const isDocView = a.action === 'document viewed';
      return `
      <div class="activity-item" ${isDocView ? 'style="border-left:2px solid rgba(99,102,241,.4);padding-left:12px;"' : ''}>
        <div class="activity-icon" ${isDocView ? 'style="background:rgba(99,102,241,.1);color:#6366f1;"' : ''}>
          <i class="fas fa-${this.getActivityIcon(a.action)}"></i>
        </div>
        <div class="activity-content">
          <p><strong>${a.action}</strong> — ${a.detail}</p>
          <span class="activity-meta">${a.user} • ${timeStr}</span>
        </div>
      </div>`;
    }).join('');
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
    // Reset access controls
    const accEl = document.getElementById('docAccess');
    if (accEl) accEl.value = 'all';
    this.toggleInvestorSelect();
  },

  // Show/hide investor checkbox list based on access selection
  toggleInvestorSelect: function() {
    const access = document.getElementById('docAccess')?.value;
    const group = document.getElementById('investorSelectGroup');
    if (!group) return;
    if (access === 'select') {
      group.style.display = '';
      this._populateInvestorCheckboxes();
    } else {
      group.style.display = 'none';
    }
  },

  _populateInvestorCheckboxes: function() {
    const container = document.getElementById('investorCheckboxList');
    if (!container) return;
    const deal = this.currentDeal;
    let investors = [];
    if (deal) {
      const allInv = SP.getInvestors ? SP.getInvestors() : [];
      investors = (deal.investors || []).map(entry => {
        const inv = allInv.find(i => i.id === entry.investorId) || {};
        const name = [inv.firstName, inv.lastName].filter(Boolean).join(' ') || inv.name || inv.email || entry.investorId;
        return { id: entry.investorId, name };
      });
    }
    if (!investors.length) {
      container.innerHTML = '<span style="color:#9C9590;font-size:.82rem;">No investors linked to this deal yet.</span>';
      return;
    }
    container.innerHTML = investors.map(inv => `
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.82rem;color:#1B1A19;">
        <input type="checkbox" value="${inv.id}" checked style="accent-color:#F37925;">
        ${inv.name}
      </label>`).join('');
  },

  // Get array of selected investor IDs from the checkbox list
  _getSelectedInvestors: function() {
    const boxes = document.querySelectorAll('#investorCheckboxList input[type="checkbox"]');
    return Array.from(boxes).filter(b => b.checked).map(b => b.value);
  },

  // Manage access for an existing document
  manageDocAccess: function(docId) {
    const doc = this.documents.find(d => d.id === docId);
    if (!doc) return;
    // Re-open modal in "manage access" mode
    const modal = document.getElementById('uploadModal');
    if (modal) {
      document.getElementById('docName').value = doc.name;
      document.getElementById('docCategory').value = doc.category || 'legal';
      const accEl = document.getElementById('docAccess');
      if (accEl) {
        accEl.value = doc.access || 'all';
        this.toggleInvestorSelect();
        // Pre-check existing allowed investors
        if (doc.allowedInvestors?.length) {
          setTimeout(() => {
            const boxes = document.querySelectorAll('#investorCheckboxList input[type="checkbox"]');
            boxes.forEach(b => { b.checked = doc.allowedInvestors.includes(b.value); });
          }, 50);
        }
      }
      modal.style.display = 'flex';
      // Store doc id for update
      modal.dataset.editDocId = docId;
    }
  },

  // Record a document view event (called from investor portal)
  recordDocView: function(docId, investorName, investorId) {
    const doc = this.documents.find(d => d.id === docId);
    if (!doc) return;
    const event = {
      id: Date.now().toString(),
      type: 'document_viewed',
      docId,
      docName: doc.name,
      investorName: investorName || 'Unknown',
      investorId: investorId || null,
      dealId: this.currentDeal?.id,
      timestamp: new Date().toISOString(),
    };
    // Store in localStorage keyed by deal
    const key = 'dt_doc_activity_' + (this.currentDeal?.id || 'global');
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.unshift(event);
    if (existing.length > 200) existing.splice(200);
    localStorage.setItem(key, JSON.stringify(existing));
    // Push to activity feed
    this.activities.unshift({
      id: event.id,
      action: 'document viewed',
      detail: doc.name,
      user: investorName,
      date: new Date().toISOString().split('T')[0],
    });
    this.renderActivity();
  },

  // Load document view events for current deal
  getDocActivity: function(dealId) {
    const key = 'dt_doc_activity_' + (dealId || this.currentDeal?.id || 'global');
    return JSON.parse(localStorage.getItem(key) || '[]');
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

    const allowedInvestors = access === 'select' ? this._getSelectedInvestors() : null;

    const doSave = (fileUrl, fileSize, mimeType) => {
      // Check if we're editing an existing doc's access (manage access modal)
      const modal = document.getElementById('uploadModal');
      const editDocId = modal?.dataset?.editDocId;
      if (editDocId) {
        const idx = this.documents.findIndex(d => d.id === editDocId);
        if (idx >= 0) {
          this.documents[idx].access = access;
          this.documents[idx].allowedInvestors = allowedInvestors;
          this.saveDocuments();
          this.renderDocuments();
          delete modal.dataset.editDocId;
          this.closeModal();
          if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-upload"></i> Upload'; }
          this._showToast('Access settings updated!');
          return;
        }
      }
      const newDoc = {
        id: Date.now().toString(),
        name,
        category,
        access,
        allowedInvestors: allowedInvestors,
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
