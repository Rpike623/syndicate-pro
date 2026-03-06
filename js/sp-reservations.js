/**
 * SP Reservations - Soft Commitment Tracking
 */

window.Reservations = {
  reservations: [],
  investors: [],

  init: async function() {
    await this.loadInvestors();
    await this.loadReservations();
    this.populateInvestors();
    this.render();
  },

  loadInvestors: async function() {
    this.investors = SP.getInvestors ? SP.getInvestors() : [];
    if (!this.investors.length) {
      this.investors = [
        { id: 'inv1', firstName: 'John', lastName: 'Smith', email: 'jsmith@email.com' },
        { id: 'inv2', firstName: 'Sarah', lastName: 'Williams', email: 'swilliams@email.com' },
        { id: 'inv3', firstName: 'Mike', lastName: 'Johnson', email: 'mjohnson@email.com' },
        { id: 'inv4', firstName: 'Lisa', lastName: 'Brown', email: 'lbrown@email.com' },
        { id: 'inv5', firstName: 'David', lastName: 'Jones', email: 'djones@email.com' }
      ];
    }
  },

  loadReservations: async function() {
    const stored = localStorage.getItem('sp_reservations');
    if (stored) {
      this.reservations = JSON.parse(stored);
    } else {
      this.reservations = this.generateDemo();
    }
  },

  generateDemo: function() {
    const now = new Date();
    const year = now.getFullYear();
    return [
      { id: '1', investorId: 'inv1', investorName: 'John Smith', amount: 500000, dealType: 'multifamily', timeline: 'q2', status: 'confirmed', created: `${year}-02-15` },
      { id: '2', investorId: 'inv2', investorName: 'Sarah Williams', amount: 750000, dealType: 'any', timeline: 'immediate', status: 'converted', created: `${year}-01-20` },
      { id: '3', investorId: 'inv3', investorName: 'Mike Johnson', amount: 250000, dealType: 'industrial', timeline: 'q3', status: 'soft', created: `${year}-03-01` },
      { id: '4', investorId: 'inv4', investorName: 'Lisa Brown', amount: 350000, dealType: 'office', timeline: 'q2', status: 'interest', created: `${year}-02-28` },
      { id: '5', investorId: 'inv5', investorName: 'David Jones', amount: 150000, dealType: 'any', timeline: 'q4', status: 'soft', created: `${year}-03-05` },
      { id: '6', investorId: 'inv1', investorName: 'John Smith', amount: 200000, dealType: 'development', timeline: '2027', status: 'interest', created: `${year}-02-10` }
    ];
  },

  save: function() {
    localStorage.setItem('sp_reservations', JSON.stringify(this.reservations));
  },

  populateInvestors: function() {
    const options = this.investors.map(i => 
      `<option value="${i.id}">${i.firstName} ${i.lastName}</option>`
    ).join('');
    document.getElementById('resInvestor').innerHTML = options;
  },

  render: function() {
    const filter = document.getElementById('statusFilter').value;
    let list = this.reservations;
    if (filter) list = list.filter(r => r.status === filter);

    // Stats
    const total = this.reservations.reduce((s, r) => s + r.amount, 0);
    const soft = this.reservations.filter(r => r.status === 'soft').length;
    const confirmed = this.reservations.filter(r => ['confirmed', 'converted'].includes(r.status)).length;
    const converted = this.reservations.filter(r => r.status === 'converted').length;
    const conversion = confirmed ? Math.round(converted / confirmed * 100) : 0;

    document.getElementById('statReserved').textContent = this.formatCurrency(total);
    document.getElementById('statSoft').textContent = soft;
    document.getElementById('statConfirmed').textContent = confirmed;
    document.getElementById('statConversion').textContent = conversion + '%';

    // Table
    const tbody = document.getElementById('reservationTableBody');
    tbody.innerHTML = list.map(r => `
      <tr>
        <td><strong>${r.investorName}</strong></td>
        <td>${this.formatCurrency(r.amount)}</td>
        <td>${this.formatDealType(r.dealType)}</td>
        <td>${this.formatTimeline(r.timeline)}</td>
        <td><span class="badge badge-${this.getStatusColor(r.status)}">${this.formatStatus(r.status)}</span></td>
        <td>${this.formatDate(r.created)}</td>
        <td class="text-center">
          <button class="btn-icon" onclick="Reservations.edit('${r.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn-icon text-danger" onclick="Reservations.delete('${r.id}')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `).join('');

    // Pipeline bars
    const stages = ['soft', 'interest', 'confirmed', 'converted'];
    stages.forEach(s => {
      const stageTotal = this.reservations.filter(r => r.status === s).reduce((sum, r) => sum + r.amount, 0);
      const pct = total ? (stageTotal / total * 100) : 0;
      document.getElementById(`stage${s.charAt(0).toUpperCase() + s.slice(1)}Total`).textContent = this.formatCurrency(stageTotal);
      document.getElementById(`stage${s.charAt(0).toUpperCase() + s.slice(1)}Bar`).style.width = pct + '%';
    });
  },

  showAddModal: function() {
    document.getElementById('resForm').reset();
    document.getElementById('reservationModal').style.display = 'flex';
  },

  closeModal: function() {
    document.getElementById('reservationModal').style.display = 'none';
  },

  save: function() {
    const investorId = document.getElementById('resInvestor').value;
    const investor = this.investors.find(i => i.id === investorId);
    const amount = parseFloat(document.getElementById('resAmount').value) || 0;
    const dealType = document.getElementById('resDealType').value;
    const timeline = document.getElementById('resTimeline').value;
    const status = document.getElementById('resStatus').value;
    const notes = document.getElementById('resNotes').value;

    if (!investorId || !amount) {
      alert('Please fill required fields');
      return;
    }

    this.reservations.push({
      id: Date.now().toString(),
      investorId,
      investorName: `${investor.firstName} ${investor.lastName}`,
      amount, dealType, timeline, status, notes,
      created: new Date().toISOString().split('T')[0]
    });

    this.save();
    this.render();
    this.closeModal();
  },

  edit: function(id) {
    alert('Edit reservation: ' + id);
  },

  delete: function(id) {
    if (!confirm('Delete?')) return;
    this.reservations = this.reservations.filter(r => r.id !== id);
    this.save();
    this.render();
  },

  getStatusColor: function(s) {
    return { soft: 'warning', interest: 'info', confirmed: 'primary', converted: 'success' }[s] || 'secondary';
  },

  formatStatus: function(s) {
    return { soft: 'Soft', interest: 'Interest', confirmed: 'Confirmed', converted: 'Converted' }[s] || s;
  },

  formatDealType: function(t) {
    return { any: 'Any', multifamily: 'Multifamily', office: 'Office', industrial: 'Industrial', retail: 'Retail', development: 'Development' }[t] || t;
  },

  formatTimeline: function(t) {
    return { immediate: 'Immediate', q1: 'Q1 2026', q2: 'Q2 2026', q3: 'Q3 2026', q4: 'Q4 2026', '2027': '2027+' }[t] || t;
  },

  formatCurrency: function(amt) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amt);
  },

  formatDate: function(d) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
};
