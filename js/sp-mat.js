/**
 * SP Loan Maturity Watch
 */
window.Mat = {
  init: function() {
    const data = [
      { p:'Sunset Apartments', lender:'First Bank', bal:12500000, rate:4.5, date:'2026-09-15' },
      { p:'Downtown Lofts', lender:'Chase', bal:8200000, rate:5.2, date:'2027-02-01' },
      { p:'Industrial Portfolio', lender:'Wells Fargo', bal:15000000, rate:3.8, date:'2026-11-20' },
      { p:'Medical Center', lender:'Local CU', bal:4500000, rate:6.1, date:'2026-06-10' }
    ];
    document.getElementById('matTable').innerHTML = data.map(d => {
      const days = Math.round((new Date(d.date) - new Date()) / (1000*60*60*24));
      const cls = days < 180 ? 'text-danger' : days < 360 ? 'text-warning' : '';
      return `<tr class="${cls}"><td>${d.p}</td><td>${d.lender}</td><td>$${d.bal.toLocaleString()}</td><td>${d.rate}%</td><td>${d.date}</td><td>${days} days</td></tr>`;
    }).join('');
  }
};