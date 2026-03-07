/**
 * SP JV Partnership Calculator
 */
window.JV = {
  init: function() { this.calc(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  calc: function() {
    const gpCash = parseFloat(document.getElementById('jGPCash').value) || 0;
    const lpCash = parseFloat(document.getElementById('jLPCash').value) || 0;
    const promote = (parseFloat(document.getElementById('jGPPromote').value) || 0) / 100;
    const pref = (parseFloat(document.getElementById('jGPPref').value) || 0) / 100;
    const price = parseFloat(document.getElementById('jPrice').value) || 0;
    const exit = parseFloat(document.getElementById('jExit').value) || 0;
    const years = parseFloat(document.getElementById('jYears').value) || 5;
    const annualDist = parseFloat(document.getElementById('jDist').value) || 0;
    
    const totalCap = gpCash + lpCash;
    const gpPct = gpCash / totalCap;
    const lpPct = lpCash / totalCap;
    
    // Distributions
    const totalDist = annualDist * years;
    const lpPref = lpCash * pref;
    const gpPref = gpCash * pref;
    const prefTotal = lpPref + gpPref;
    
    // Return of capital
    const lpRoc = lpCash;
    const gpRoc = gpCash;
    
    // Profit split
    const exitGain = exit - price;
    const gpGain = exitGain * promote;
    const lpGain = exitGain - gpGain;
    
    // LP totals
    const lpTotal = lpRoc + lpPref + lpGain;
    const lpMult = lpTotal / lpCash;
    const lpIrr = (Math.pow(lpMult, 1/years) - 1) * 100;
    
    // GP totals
    const gpTotal = gpRoc + gpPref + gpGain;
    const gpMult = gpTotal / gpCash;
    const gpIrr = (Math.pow(gpMult, 1/years) - 1) * 100;
    
    document.getElementById('jTotal').textContent = this.f(totalCap);
    document.getElementById('jLPMult').textContent = lpMult.toFixed(2) + 'x';
    document.getElementById('jGPMult').textContent = gpMult.toFixed(2) + 'x';
    document.getElementById('jLPIrrResult').textContent = lpIrr.toFixed(1) + '%';
    document.getElementById('jGPIrrResult').textContent = gpIrr.toFixed(1) + '%';
    
    // Waterfall table
    const rows = [
      { tranche: '1. Return of Capital', lp: lpRoc, gp: gpRoc },
      { tranche: '2. Preferred Return (' + (pref*100) + '%)', lp: lpPref, gp: gpPref },
      { tranche: '3. Profit Split (LP ' + ((1-promote)*100) + '% / GP ' + (promote*100) + '%)', lp: lpGain, gp: gpGain }
    ];
    document.getElementById('jTable').innerHTML = rows.map(r => `<tr><td>${r.tranche}</td><td>${this.f(r.lp)}</td><td>${this.f(r.gp)}</td><td>—</td><td>—</td></tr>`).join('') + 
      `<tr><td><strong>Total</strong></td><td><strong>${this.f(lpTotal)}</strong></td><td><strong>${this.f(gpTotal)}</strong></td><td><strong>${lpIrr.toFixed(1)}%</strong></td><td><strong>${gpIrr.toFixed(1)}%</strong></td></tr>`;
  }
};