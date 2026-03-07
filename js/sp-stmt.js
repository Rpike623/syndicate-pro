/**
 * SP Investor Statement
 */
window.Stmt = {
  init: function() { this.generate(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  generate: function() {
    const inv = document.getElementById('sInv').value;
    document.getElementById('stmtPreview').innerHTML = `<h3>INVESTOR STATEMENT</h3><p><strong>Investor:</strong> ${inv}</p><p><strong>Period:</strong> Q1 2026</p><hr>
<h4>Investment Summary</h4><table style="width:100%"><tr><td>Beginning Balance</td><td>${this.f(250000)}</td></tr><tr><td>Capital Called</td><td>${this.f(0)}</td></tr><tr><td>Distributions</td><td>${this.f(18500)}</td></tr><tr><td><strong>Ending Balance</strong></td><td><strong>${this.f(231500)}</strong></td></tr></table>
<h4>Property Performance</h4><table style="width:100%"><tr><td>Sunset Apartments</td><td>IRR: 18.5%</td><td>${this.f(85000)}</td></tr><tr><td>Industrial Portfolio</td><td>IRR: 16.2%</td><td>${this.f(100000)}</td></tr></table>
<h4>Distributions</h4><table style="width:100%"><tr><td>Q1 Regular</td><td>${this.f(12500)}</td></tr><tr><td>Q1 Supplemental</td><td>${this.f(6000)}</td></tr></table>`;
  }
};