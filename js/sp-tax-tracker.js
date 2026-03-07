/**
 * SP Property Tax Tracker
 */
window.Tax = {
  init: function() {
    const data = [
      { year:2026, val:2500000, tax:55000, date:'2026-01-10', status:'Paid' },
      { year:2025, val:2250000, tax:51500, date:'2025-01-15', status:'Paid' },
      { year:2024, val:2100000, tax:48000, date:'2024-01-12', status:'Paid' },
      { year:2023, val:1950000, tax:44500, date:'2023-01-20', status:'Paid' }
    ];
    document.getElementById('taxTable').innerHTML = data.map(d => `<tr><td>${d.year}</td><td>$${d.val.toLocaleString()}</td><td>$${d.tax.toLocaleString()}</td><td>${d.date}</td><td><span class="badge badge-success">${d.status}</span></td></tr>`).join('');
    document.getElementById('statTaxProj').textContent = '$58,500';
    document.getElementById('statTaxRate').textContent = '2.2%';
  }
};