/**
 * SP Recapitalization - Track Refinances and Major Events
 */

window.Recap = {
  events: [],
  deals: [],

  init: async function() {
    await this.loadDeals();
    await this.loadEvents();
    this.populateFilters();
    this.updateStats();
    this.renderTimeline();
    this.renderTable();
  },

  loadDeals: async function() {
    this.deals = SP.getDeals ? SP.getDeals() : [];
    if (!this.deals.length) {
      this.deals = [
        { id: 'deal_1', name: 'Sunset Apartments' },
        { id: 'deal_2', name: 'Downtown Office' },
        { id: 'deal_3', name: 'Industrial Portfolio' },
        { id: 'deal_4', name: 'Coastal Retail' }
      ];
    }
  },

  loadEvents: async function() {
    const stored = localStorage.getItem('sp_recapitalization_events');
    if (stored) {
      this.events = JSON.parse(stored);
    } else {
      this.events = this.generateDemoData();
    }
  },

  generateDemoData: function() {
    const now = new Date();
    const year = now.getFullYear();
    return [
      {
        id: '1', dealId: 'deal_1', dealName: 'Sunset Apartments',
        type: 'refinance', date: `${year}-02-15`,
        dealValue: 14500000, newDebt: 8000000, equityOut: 2500000,
        rate: 6.25, term: 10,
        notes: 'Refinanced from 7.5% to 6.25%, extended term to 10 years'
      },
      {
        id: '2', dealId: 'deal_2', dealName: 'Downtown Office',
        type: 'cash-out', date: `${year}-03-01`,
        dealValue: 9200000, newDebt: 5500000, equityOut: 1200000,
        rate: 6.75, term: 7,
        notes: 'Cash-out refinance to fund next acquisition'
      },
      {
        id: '3', dealId: 'deal_3', dealName: 'Industrial Portfolio',
        type: 'refinance', date: `${year}-01-20`,
        dealValue: 21000000, newDebt: 12000000, equityOut: 4800000,
        rate: 5.875, term: 10,
        notes: 'Major refinance, locked in low rates'
      },
      {
        id: '4', dealId: 'deal_1', dealName: 'Sunset Apartments',
        type: 'recapitalization', date: `${year}-03-15`,
        dealValue: 16000000, newDebt: 8500000, equityOut: 3500000,
        rate: 6.0, term: 10,
        notes: 'GP contribution, value-add completion'
      }
    ];
  },

  save: function() {
    localStorage.setItem('sp_recapitalization_events', JSON.stringify(this.events));
  },

  populateFilters: function() {
    const dealOptions = '<option value="">All Deals</option>' + 
      this.deals.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    document.getElementById('dealFilter').innerHTML = dealOptions;
    document.getElementById('eventDeal').innerHTML = dealOptions.replace('All Deals', 'Select deal...');
    
    document.getElementById('eventDate').value = new Date().toISOString().split('T')[0];
  },

  updateStats: function() {
    const refiCount = this.events.filter(e => e.type === 'refinance').length;
    const totalNewDebt = this.events.reduce((s, e) => s + (e.newDebt || 0), 0);
    const totalEquityOut = this.events.reduce((s, e) => s + (e.equityOut || 0), 0);
    
    // Calculate avg rate (assuming 7.5% as previous rate for demo)
    const prevRate = 7.5;
    const avgNewRate = this.events.reduce((s, e) => s + (e.rate || 0), 0) / (this.events.length || 1);
    const avgReduction = prevRate - avgNewRate;

    document.getElementById('statRefi').textContent = refiCount;
    document.getElementById('statNewDebt').textContent = this.formatCurrency(totalNewDebt);
    document.getElementById('statEquityOut').textContent = this.formatCurrency(totalEquityOut);
    document.getElementById('statRateReduction').textContent = avgReduction.toFixed(2) + '%';
  },

  renderTimeline: function() {
    const sorted = [...this.events].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    document.getElementById('recapTimeline').innerHTML = sorted.map((e, i) => {
      const icons = {
        'refinance': 'fa-money-bill-wave',
        'recapitalization': 'fa-arrows-rotate',
        'sale': 'fa-handshake',
        'cash-out': 'fa-sack-dollar'
      };
      
      return `
        <div class="timeline-item">
          <div class="timeline-marker">
            <i class="fas ${icons[e.type] || 'fa-dollar-sign'}"></i>
          </div>
          <div class="timeline-content">
            <div class="timeline-header">
              <strong>${e.dealName}</strong>
              <span class="badge badge-${this.getTypeColor(e.type)}">${this.formatType(e.type)}</span>
            </div>
            <p>${this.formatCurrency(e.equityOut)} equity taken out • ${e.rate}% rate • ${e.term}yr term</p>
            <span class="timeline-date">${this.formatDate(e.date)}</span>
          </div>
        </div>
      `;
    }).join('');
  },

  renderTable: function() {
    const dealFilter = document.getElementById('dealFilter').value;
    const typeFilter = document.getElementById('typeFilter').value;
    
    let filtered = this.events;
    if (dealFilter) filtered = filtered.filter(e => e.dealId === dealFilter);
    if (typeFilter) filtered = filtered.filter(e => e.type === typeFilter);

    const tbody = document.getElementById('recapTableBody');
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center">No events found</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(e => `
      <tr>
        <td>${this.formatDate(e.date)}</td>
        <td>${e.dealName}</td>
        <td><span class="badge badge-${this.getTypeColor(e.type)}">${this.formatType(e.type)}</span></td>
        <td>${this.formatCurrency(e.dealValue)}</td>
        <td>${this.formatCurrency(e.newDebt)}</td>
        <td class="text-success">${this.formatCurrency(e.equityOut)}</td>
        <td>${e.rate}%</td>
        <td>${e.term} years</td>
        <td class="text-center">
          <button class="btn-icon" onclick="Recap.editEvent('${e.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn-icon text-danger" onclick="Recap.deleteEvent('${e.id}')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  },

  showAddModal: function() {
    document.getElementById('eventId').value = '';
    document.getElementById('recapForm').reset();
    document.getElementById('eventDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('recapModal').style.display = 'flex';
  },

  closeModal: function() {
    document.getElementById('recapModal').style.display = 'none';
  },

  saveEvent: function() {
    const id = document.getElementById('eventId').value;
    const dealId = document.getElementById('eventDeal').value;
    const deal = this.deals.find(d => d.id === dealId);
    const type = document.getElementById('eventType').value;
    const date = document.getElementById('eventDate').value;
    const dealValue = parseFloat(document.getElementById('eventDealValue').value) || 0;
    const newDebt = parseFloat(document.getElementById('eventNewDebt').value) || 0;
    const equityOut = parseFloat(document.getElementById('eventEquityOut').value) || 0;
    const rate = parseFloat(document.getElementById('eventRate').value) || 0;
    const term = parseInt(document.getElementById('eventTerm').value) || 0;
    const notes = document.getElementById('eventNotes').value;

    if (!dealId || !date) {
      alert('Please fill in required fields');
      return;
    }

    if (id) {
      const idx = this.events.findIndex(e => e.id === id);
      if (idx >= 0) {
        this.events[idx] = { ...this.events[idx], dealId, dealName: deal.name, type, date, dealValue, newDebt, equityOut, rate, term, notes };
      }
    } else {
      this.events.push({
        id: Date.now().toString(), dealId, dealName: deal.name, type, date, dealValue, newDebt, equityOut, rate, term, notes
      });
    }

    this.save();
    this.updateStats();
    this.renderTimeline();
    this.renderTable();
    this.closeModal();
  },

  editEvent: function(id) {
    const e = this.events.find(ev => ev.id === id);
    if (!e) return;

    document.getElementById('eventId').value = e.id;
    document.getElementById('eventDeal').value = e.dealId;
    document.getElementById('eventType').value = e.type;
    document.getElementById('eventDate').value = e.date;
    document.getElementById('eventDealValue').value = e.dealValue;
    document.getElementById('eventNewDebt').value = e.newDebt;
    document.getElementById('eventEquityOut').value = e.equityOut;
    document.getElementById('eventRate').value = e.rate;
    document.getElementById('eventTerm').value = e.term;
    document.getElementById('eventNotes').value = e.notes || '';

    document.getElementById('recapModal').style.display = 'flex';
  },

  deleteEvent: function(id) {
    if (!confirm('Delete this event?')) return;
    this.events = this.events.filter(e => e.id !== id);
    this.save();
    this.updateStats();
    this.renderTimeline();
    this.renderTable();
  },

  getTypeColor: function(type) {
    const colors = {
      'refinance': 'success',
      'recapitalization': 'primary',
      'sale': 'warning',
      'cash-out': 'info'
    };
    return colors[type] || 'secondary';
  },

  formatType: function(type) {
    const types = {
      'refinance': 'Refinance',
      'recapitalization': 'Recap',
      'sale': 'Sale',
      'cash-out': 'Cash Out'
    };
    return types[type] || type;
  },

  formatCurrency: function(amt) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amt);
  },

  formatDate: function(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
};
