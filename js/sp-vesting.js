/**
 * SP Vesting - GP Carry & Vesting Schedules
 */

window.Vesting = {
  gps: [],
  deals: [],

  init: async function() {
    await this.loadData();
    this.render();
  },

  loadData: async function() {
    const gpsStored = JSON.stringify(SP.load('gp_vesting', null));
    if (gpsStored) this.gps = JSON.parse(gpsStored);
    else this.gps = this.generateDemo();

    this.deals = [
      { id: 'deal_1', name: 'Sunset Apartments', profit: 2500000, lpReturn: 1800000, carryPool: 700000 },
      { id: 'deal_2', name: 'Downtown Office', profit: 1800000, lpReturn: 1400000, carryPool: 400000 },
      { id: 'deal_3', name: 'Industrial Portfolio', profit: 3500000, lpReturn: 2500000, carryPool: 1000000 }
    ];
  },

  generateDemo: function() {
    const now = new Date();
    const year = now.getFullYear();
    return [
      { id: '1', name: 'Robert Pike', ownership: 60, carry: 20, vesting: '4yr', startDate: `${year - 1}-01-01`, carryEarned: 420000, carryVested: 210000 },
      { id: '2', name: 'Mike Johnson', ownership: 25, carry: 20, vesting: '3yr', startDate: `${year - 1}-06-01`, carryEarned: 350000, carryVested: 175000 },
      { id: '3', name: 'Sarah Williams', ownership: 15, carry: 20, vesting: 'cliff', startDate: `${year - 2}-01-01`, carryEarned: 280000, carryVested: 280000 }
    ];
  },

  save: function() {
    SP.save('gp_vesting', this.gps);
  },

  render: function() {
    // Stats
    const totalGPs = this.gps.length;
    const carryEarned = this.gps.reduce((s, g) => s + g.carryEarned, 0);
    const carryVested = this.gps.reduce((s, g) => s + g.carryVested, 0);
    const carryPending = carryEarned - carryVested;

    document.getElementById('statGPs').textContent = totalGPs;
    document.getElementById('statCarryEarned').textContent = this.formatCurrency(carryEarned);
    document.getElementById('statCarryVested').textContent = this.formatCurrency(carryVested);
    document.getElementById('statCarryPending').textContent = this.formatCurrency(carryPending);

    // GP Table
    document.getElementById('gpTableBody').innerHTML = this.gps.map(g => `
      <tr>
        <td><strong>${g.name}</strong></td>
        <td>${g.ownership}%</td>
        <td>${g.carry}%</td>
        <td>${this.formatVesting(g.vesting)}</td>
        <td>${this.formatCurrency(g.carryEarned)}</td>
        <td class="text-success">${this.formatCurrency(g.carryVested)}</td>
        <td class="text-warning">${this.formatCurrency(g.carryEarned - g.carryVested)}</td>
        <td class="text-center">
          <button class="btn-icon" onclick="Vesting.edit('${g.id}')"><i class="fas fa-edit"></i></button>
        </td>
      </tr>
    `).join('');

    // Deal Carry Table
    document.getElementById('dealCarryBody').innerHTML = this.deals.map(d => {
      const gpCarry = d.carryPool * 0.20; // 20% of carry pool to GPs
      const perGP = gpCarry / this.gps.length;
      return `
        <tr>
          <td><strong>${d.name}</strong></td>
          <td>${this.formatCurrency(d.profit)}</td>
          <td>${this.formatCurrency(d.lpReturn)}</td>
          <td>${this.formatCurrency(d.carryPool)}</td>
          <td class="text-success">${this.formatCurrency(gpCarry)}</td>
          <td>${this.formatCurrency(perGP)}/GP</td>
        </tr>
      `;
    }).join('');
  },

  showAddModal: function() {
    document.getElementById('gpName').value = '';
    document.getElementById('gpOwnership').value = '';
    document.getElementById('gpCarry').value = '';
    document.getElementById('gpStart').value = new Date().toISOString().split('T')[0];
    document.getElementById('gpModal').style.display = 'flex';
  },

  closeModal: function() {
    document.getElementById('gpModal').style.display = 'none';
  },

  save: function() {
    const name = document.getElementById('gpName').value;
    const ownership = parseFloat(document.getElementById('gpOwnership').value) || 0;
    const carry = parseFloat(document.getElementById('gpCarry').value) || 0;
    const vesting = document.getElementById('gpVesting').value;
    const startDate = document.getElementById('gpStart').value;

    if (!name || !ownership) { alert('Fill required fields'); return; }

    this.gps.push({
      id: Date.now().toString(), name, ownership, carry, vesting, startDate, carryEarned: 0, carryVested: 0
    });

    this.save();
    this.render();
    this.closeModal();
  },

  edit: function(id) { alert('Edit GP: ' + id); },

  formatVesting: function(v) {
    return { '4yr': '4 Year', '3yr': '3 Year', '2yr': '2 Year', cliff: '3 Year Cliff', immediate: 'Immediate' }[v] || v;
  },

  formatCurrency: function(amt) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amt);
  }
};
