/**
 * SP Rehab Estimator
 */
window.RehabEstimator = {
  init: function() { this.calc(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  calc: function() {
    const items = ['Kitchen','Bathrooms','Flooring','Paint','Roof','HVAC','Electrical','Plumbing','Exterior','Other'];
    let lineTotal = 0;
    items.forEach(item => {
      const val = parseFloat(document.getElementById('re' + item).value) || 0;
      lineTotal += val;
    });
    
    const contingency = lineTotal * 0.10;
    const subtotal = lineTotal + contingency;
    const overhead = subtotal * 0.08;
    const profit = (lineTotal + overhead) * 0.15;
    const total = lineTotal + contingency + overhead + profit;
    
    const sqft = parseInt(document.getElementById('reSqft').value) || 1;
    const psf = total / sqft;
    
    document.getElementById('reLineTotal').textContent = this.f(lineTotal);
    document.getElementById('reContingency').textContent = this.f(contingency);
    document.getElementById('reOverhead').textContent = this.f(overhead);
    document.getElementById('reProfit').textContent = this.f(profit);
    document.getElementById('reTotal').textContent = this.f(total);
    document.getElementById('rePSF').textContent = this.f(psf) + '/sqft';
  }
};