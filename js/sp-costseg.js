/**
 * SP Cost Segregation Calculator
 */
window.CostSeg = {
  init: function() { this.calc(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  calc: function() {
    const building = parseFloat(document.getElementById('csBuilding').value) || 0;
    const land = parseFloat(document.getElementById('csLand').value) || 0;
    const tax = (parseFloat(document.getElementById('csTax').value) || 0) / 100;
    
    const bPct = parseInt(document.getElementById('csBuildPct').value) / 100;
    const lPct = parseInt(document.getElementById('csLandPct').value) / 100;
    const pPct = parseInt(document.getElementById('csPersPct').value) / 100;
    const l0Pct = parseInt(document.getElementById('csLand0Pct').value) / 100;
    
    document.getElementById('csBuildVal').textContent = (bPct*100) + '%';
    document.getElementById('csLandVal').textContent = (lPct*100) + '%';
    document.getElementById('csPersVal').textContent = (pPct*100) + '%';
    document.getElementById('csLand0Val').textContent = (l0Pct*100) + '%';
    
    const total = building + land;
    const bAmt = building * bPct;
    const lAmt = building * lPct;
    const pAmt = building * pPct;
    const l0Amt = building * l0Pct + land;
    
    // Standard straight-line
    const stdDep = (building / 39) + (land / 0); // Land not depreciable
    
    // Segregated
    const segDep = (bAmt / 39) + (lAmt / 15) + (pAmt / 7);
    const savings = (segDep - stdDep) * tax;
    const savings5 = savings * 5;
    
    document.getElementById('csStd').textContent = this.f(stdDep);
    document.getElementById('csSeg').textContent = this.f(segDep);
    document.getElementById('csSavings').textContent = this.f(savings);
    document.getElementById('cs5yr').textContent = this.f(savings5);
  }
};