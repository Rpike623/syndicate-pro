/**
 * SP Investor Portal V2 - Enhanced LP Experience
 */
window.Portal = {
  investor: { name: 'John Smith', email: 'john.smith@email.com', phone: '(555) 123-4567' },
  investments: [],
  chart: null,

  init: function() {
    this.investments = [
      { id: 1, name: 'Sunset Apartments', location: 'Phoenix, AZ', type: 'Multifamily', invested: 500000, currentValue: 620000, irr: 18.5, distributions: 45000, status: 'active' },
      { id: 2, name: 'Downtown Office', location: 'Austin, TX', type: 'Office', invested: 350000, currentValue: 398000, irr: 14.2, distributions: 28000, status: 'active' },
      { id: 3, name: 'Industrial Portfolio', location: 'Dallas, TX', type: 'Industrial', invested: 200000, currentValue: 245000, irr: 16.8, distributions: 15000, status: 'active' }
    ];
    this.render();
  },

  render: function() {
    document.getElementById('investorName').textContent = this.investor.name;
    document.getElementById('welcomeName').textContent = this.investor.name.split(' ')[0];
    
    const totalInvested = this.investments.reduce((s,i) => s + i.invested, 0);
    const totalValue = this.investments.reduce((s,i) => s + i.currentValue, 0);
    const totalDist = this.investments.reduce((s,i) => s + i.distributions, 0);
    const avgIrr = this.investments.reduce((s,i) => s + i.irr, 0) / this.investments.length;

    document.getElementById('kpiInvested').textContent = this.f(totalInvested);
    document.getElementById('kpiValue').textContent = this.f(totalValue);
    document.getElementById('kpiDist').textContent = this.f(totalDist);
    document.getElementById('kpiIrr').textContent = avgIrr.toFixed(1) + '%';

    // Property list
    document.getElementById('propertyList').innerHTML = this.investments.map(i => `
      <div class="property-card">
        <div class="property-info">
          <h3>${i.name}</h3>
          <p>${i.location} • ${i.type}</p>
        </div>
        <div class="property-stats">
          <div><span>Invested</span><strong>${this.f(i.invested)}</strong></div>
          <div><span>Value</span><strong>${this.f(i.currentValue)}</strong></div>
          <div><span>Return</span><strong class="text-success">+${((i.currentValue - i.invested)/i.invested*100).toFixed(0)}%</strong></div>
          <div><span>IRR</span><strong>${i.irr}%</strong></div>
        </div>
      </div>
    `).join('');

    // Activity
    document.getElementById('activityList').innerHTML = [
      { action: 'Distribution Received', detail: 'Sunset Apartments - Q4 2025', date: '2026-01-15', type: 'success' },
      { action: 'Distribution Received', detail: 'Downtown Office - Q4 2025', date: '2026-01-20', type: 'success' },
      { action: 'Statement Available', detail: 'December 2025 Statement', date: '2026-01-05', type: 'info' },
      { action: 'Distribution Received', detail: 'Industrial Portfolio - Q4 2025', date: '2025-12-15', type: 'success' },
      { action: 'Document Updated', detail: 'PPM Amendment - Sunset Apartments', date: '2025-12-01', type: 'info' }
    ].map(a => `<div class="activity-item"><div class="activity-icon activity-${a.type}"><i class="fas fa-${a.type === 'success' ? 'dollar-sign' : 'file'}"></i></div><div class="activity-content"><strong>${a.action}</strong><p>${a.detail}</p><span>${new Date(a.date).toLocaleDateString()}</span></div></div>`).join('');

    // Investments page
    document.getElementById('investmentsGrid').innerHTML = this.investments.map(i => `
      <div class="investment-card">
        <div class="inv-header"><h3>${i.name}</h3><span class="badge badge-success">${i.status}</span></div>
        <p class="inv-location">${i.location}</p>
        <div class="inv-metrics">
          <div class="metric"><span>Invested</span><strong>${this.f(i.invested)}</strong></div>
          <div class="metric"><span>Current Value</span><strong>${this.f(i.currentValue)}</strong></div>
          <div class="metric"><span>Gain/Loss</span><strong class="${i.currentValue > i.invested ? 'text-success' : 'text-danger'}">${i.currentValue > i.invested ? '+' : ''}${this.f(i.currentValue - i.invested)}</strong></div>
          <div class="metric"><span>IRR</span><strong>${i.irr}%</strong></div>
        </div>
      </div>
    `).join('');

    // Documents
    const docs = [
      { name: 'Sunset Apartments PPM', type: 'ppm', date: '2025-12-01' },
      { name: 'Subscription Agreement', type: 'agreement', date: '2025-06-15' },
      { name: 'Operating Agreement', type: 'agreement', date: '2025-06-15' },
      { name: '2025 K-1 - Sunset', type: 'tax', date: '2026-02-15' },
      { name: '2025 K-1 - Office', type: 'tax', date: '2026-02-15' },
      { name: 'Q4 2025 Statement', type: 'statement', date: '2026-01-15' }
    ];
    document.getElementById('docGrid').innerHTML = docs.map(d => `<div class="doc-card"><i class="fas fa-file-pdf"></i><div class="doc-info"><strong>${d.name}</strong><span>${new Date(d.date).toLocaleDateString()}</span></div><button class="btn-icon"><i class="fas fa-download"></i></button></div>`).join('');

    // Statements
    document.getElementById('statementsList').innerHTML = [
      { month: 'December 2025', date: '2026-01-15' },
      { month: 'November 2025', date: '2025-12-15' },
      { month: 'October 2025', date: '2025-11-15' },
      { month: 'Q3 2025', date: '2025-10-15' }
    ].map(s => `<div class="statement-item"><div><strong>${s.month}</strong><span>Generated ${new Date(s.date).toLocaleDateString()}</span></div><button class="btn btn-secondary btn-sm"><i class="fas fa-download"></i> PDF</button></div>`).join('');

    // Profile
    document.getElementById('profName').value = this.investor.name;
    document.getElementById('profEmail').value = this.investor.email;
    document.getElementById('profPhone').value = this.investor.phone;

    // Chart
    if (this.chart) this.chart.destroy();
    const ctx = document.getElementById('perfChart').getContext('2d');
    this.chart = new Chart(ctx, { type: 'line', data: { labels: ['Jan','Feb','Mar','Apr','May','Jun'], datasets: [{ label: 'Portfolio Value', data: [950000, 980000, 1020000, 1050000, 1100000, 1263000], borderColor: '#6366f1', fill: true, backgroundColor: 'rgba(99,102,241,0.1)' }] }, options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => '$' + (v/1000) + 'K' } } } } });

    // Nav
    document.querySelectorAll('.portal-nav a').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        document.querySelectorAll('.portal-nav a').forEach(x => x.classList.remove('active'));
        a.classList.add('active');
        document.querySelectorAll('.portal-page').forEach(p => p.style.display = 'none');
        document.getElementById('page-' + a.dataset.page).style.display = 'block';
      });
    });
  },

  saveProfile: function() {
    this.investor.name = document.getElementById('profName').value;
    this.investor.email = document.getElementById('profEmail').value;
    this.investor.phone = document.getElementById('profPhone').value;
    alert('Profile saved!');
  },

  logout: function() { window.location.href = 'login.html'; },
  f: function(a) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(a); }
};
