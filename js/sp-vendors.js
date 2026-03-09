/**
 * SP Vendors - Vendor Management
 */
window.Vendors = {
  vendors: [],
  init: function() {
    const s = JSON.stringify(SP.load('vendors', null));
    if (s) this.vendors = JSON.parse(s);
    else this.vendors = this.generateDemo();
    this.render();
  },
  generateDemo: function() {
    return [
      { id: '1', company: 'ABC Construction', category: 'contractor', contact: 'John Smith', phone: '(555) 123-4567', email: 'john@abcconstruction.com', properties: 3, spend: 185000, rating: 4.5 },
      { id: '2', company: 'Premier Property Mgmt', category: 'pm', contact: 'Sarah Johnson', phone: '(555) 234-5678', email: 'sarah@premierpm.com', properties: 4, spend: 48000, rating: 4.8 },
      { id: '3', company: 'GreenField Maintenance', category: 'maintenance', contact: 'Mike Brown', phone: '(555) 345-6789', email: 'mike@greenfield.com', properties: 2, spend: 32000, rating: 4.2 },
      { id: '4', company: 'Smith & Associates', category: 'legal', contact: 'Lisa Smith', phone: '(555) 456-7890', email: 'lisa@smithlaw.com', properties: 4, spend: 25000, rating: 4.7 },
      { id: '5', company: 'ProBooks Accounting', category: 'accounting', contact: 'David Wilson', phone: '(555) 567-8901', email: 'david@probooks.com', properties: 4, spend: 18000, rating: 4.9 }
    ];
  },
  save: function() { SP.save('vendors', this.vendors); },
  render: function() {
    const filter = document.getElementById('catFilter').value;
    let list = this.vendors;
    if (filter) list = list.filter(v => v.category === filter);

    document.getElementById('statVendors').textContent = this.vendors.length;
    document.getElementById('statActive').textContent = this.vendors.filter(v => v.spend > 0).length;
    document.getElementById('statSpend').textContent = this.formatCurrency(this.vendors.reduce((s,v) => s + v.spend, 0));
    document.getElementById('statRating').textContent = (this.vendors.reduce((s,v) => s + v.rating, 0) / this.vendors.length).toFixed(1);

    document.getElementById('vendorTableBody').innerHTML = list.map(v => `
      <tr>
        <td><strong>${v.company}</strong></td>
        <td><span class="badge badge-info">${this.formatCat(v.category)}</span></td>
        <td>${v.contact}<br><small class="text-muted">${v.phone}</small></td>
        <td>${v.properties}</td>
        <td>${this.formatCurrency(v.spend)}</td>
        <td>${'★'.repeat(Math.floor(v.rating))}${'☆'.repeat(5-Math.floor(v.rating))} ${v.rating}</td>
        <td class="text-center"><button class="btn-icon" onclick="Vendors.edit('${v.id}')"><i class="fas fa-edit"></i></button></td>
      </tr>
    `).join('');
  },
  formatCat: function(c) { return { contractor: 'Contractor', pm: 'Property Manager', accounting: 'Accounting', legal: 'Legal', maintenance: 'Maintenance' }[c] || c; },
  formatCurrency: function(a) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(a); },
  showModal: function() { document.getElementById('vendorModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('vendorModal').style.display = 'none'; },
  save: function() {
    const company = document.getElementById('vCompany').value;
    if (!company) { alert('Company name required'); return; }
    this.vendors.push({ id: Date.now().toString(), company, category: document.getElementById('vCategory').value, contact: document.getElementById('vContact').value, phone: document.getElementById('vPhone').value, email: document.getElementById('vEmail').value, properties: 0, spend: 0, rating: 0 });
    this.save(); this.render(); this.closeModal();
  },
  edit: function(id) { alert('Edit vendor: ' + id); }
};
