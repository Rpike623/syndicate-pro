/**
 * SP Lease Expiry
 */
window.LeaseExpiry = {
  leases: [],
  init: function() {
    const y = new Date().getFullYear();
    this.leases = [
      { property:'Sunset Apartments', unit:'101', tenant:'John Smith', rent:1650, expiry:'2026-03-15' },
      { property:'Sunset Apartments', unit:'102', tenant:'Sarah Williams', rent:1250, expiry:'2026-04-30' },
      { property:'Sunset Apartments', unit:'103', tenant:'Mike Johnson', rent:1700, expiry:'2026-05-15' },
      { property:'Downtown Office', unit:'200', tenant:'Tech Corp', rent:4500, expiry:'2026-03-28' },
      { property:'Downtown Office', unit:'201', tenant:'Law Partners', rent:3800, expiry:'2026-06-30' },
      { property:'Industrial Portfolio', unit:'A1', tenant:'Logistics Co', rent:8500, expiry:'2026-09-30' },
      { property:'Industrial Portfolio', unit:'A2', tenant:'Warehouse Inc', rent:7200, expiry:'2026-12-31' },
      { property:'Coastal Retail', unit:'R1', tenant:'Coffee Shop', rent:2200, expiry:'2026-03-20' }
    ];
    this.render();
  },
  render: function() {
    const now = new Date();
    document.getElementById('expiryTable').innerHTML = this.leases.map(l => {
      const exp = new Date(l.expiry);
      const days = Math.ceil((exp - now) / (1000*60*60*24));
      const status = days <= 30 ? 'urgent' : days <= 90 ? 'warning' : 'ok';
      return `<tr><td>${l.property}</td><td>${l.unit}</td><td>${l.tenant}</td><td>$${l.rent}</td><td>${exp.toLocaleDateString()}</td><td class="text-${status==='urgent'?'danger':status==='warning'?'warning':'muted'}">${days} days</td><td><span class="badge badge-${status==='urgent'?'danger':status==='warning'?'warning':'success'}">${status==='urgent'?'Expiring':status==='warning'?'Soon':'OK'}</span></td></tr>`;
    }).join('');
  }
};
