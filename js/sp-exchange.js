/**
 * SP 1031 Exchange Calculator
 */
window.Exchange = {
  init: function() { this.calc(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  calc: function() {
    const orig = parseFloat(document.getElementById('x1Orig').value) || 0;
    const sale = parseFloat(document.getElementById('x1Sale').value) || 0;
    const loan1 = parseFloat(document.getElementById('x1Loan').value) || 0;
    const price2 = parseFloat(document.getElementById('x2Price').value) || 0;
    const loan2 = parseFloat(document.getElementById('x2Loan').value) || 0;
    
    const gain = sale - orig;
    const depr = (orig * 0.0361 * 5); // Assume 5 years, 3.61% per year
    const taxGain = gain + depr;
    const boot = Math.max(0, sale - price2);
    const mBoot = Math.max(0, loan1 - loan2);
    
    document.getElementById('xGain').textContent = this.f(gain);
    document.getElementById('xDepr').textContent = this.f(depr);
    document.getElementById('xTaxGain').textContent = this.f(taxGain);
    document.getElementById('xBoot').textContent = this.f(boot);
    document.getElementById('xMboot').textContent = this.f(mBoot);
    document.getElementById('xValue').textContent = this.f(price2);
    document.getElementById('xDeferred').textContent = this.f(taxGain - boot - mBoot);
    
    // Timeline
    const today = new Date();
    const day45 = new Date(today.getTime() + 45*24*60*60*1000);
    const day180 = new Date(today.getTime() + 180*24*60*60*1000);
    document.getElementById('xTimeline').innerHTML = `
      <tr><td>Sale Close</td><td>${today.toLocaleDateString()}</td><td><span class="badge badge-success">Done</span></td></tr>
      <tr><td>Identify Properties (45 days)</td><td>${day45.toLocaleDateString()}</td><td><span class="badge badge-warning">${Math.ceil((day45-today)/86400000)} days left</span></td></tr>
      <tr><td>Close Replacement (180 days)</td><td>${day180.toLocaleDateString()}</td><td><span class="badge badge-info">${Math.ceil((day180-today)/86400000)} days left</span></td></tr>
    `;
  }
};