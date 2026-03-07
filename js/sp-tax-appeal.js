/**
 * SP Property Tax Appeal Helper
 */
window.TaxAppeal = {
  init: function() { this.calc(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  calc: function() {
    const assessed = parseFloat(document.getElementById('taAssessed').value) || 0;
    const market = parseFloat(document.getElementById('taMarket').value) || 0;
    const rate = (parseFloat(document.getElementById('taRate').value) || 0) / 1000;
    
    const currentTax = assessed * rate;
    const fairTax = market * rate;
    const ratio = assessed > 0 ? (market / assessed) * 100 : 0;
    const savings = Math.max(0, currentTax - fairTax);
    
    document.getElementById('taCurrentTax').textContent = this.f(currentTax);
    document.getElementById('taFairTax').textContent = this.f(fairTax);
    document.getElementById('taRatio').textContent = ratio.toFixed(1) + '%';
    document.getElementById('taSavings').textContent = this.f(savings);
    
    this.strategy();
  },
  strategy: function() {
    const comps = parseInt(document.getElementById('taComps').value) || 0;
    const avgComp = parseFloat(document.getElementById('taAvgComp').value) || 0;
    const compSqft = parseInt(document.getElementById('taCompSqft').value) || 1;
    const subjectSqft = parseInt(document.getElementById('taSubjectSqft').value) || 1;
    const market = parseFloat(document.getElementById('taMarket').value) || 0;
    
    let recommend = market;
    if (comps > 0 && avgComp > 0) {
      // Use comps if available
      const subjectValue = avgComp * (subjectSqft / compSqft);
      recommend = Math.min(market, subjectValue);
    }
    
    // Appeal range: 85% - 95% of recommended value
    const lowRange = recommend * 0.85;
    const highRange = recommend * 0.95;
    
    document.getElementById('taRecommend').textContent = this.f(recommend);
    document.getElementById('taRange').textContent = this.f(lowRange) + ' - ' + this.f(highRange);
  }
};