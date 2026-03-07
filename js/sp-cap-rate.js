/**
 * SP Cap Rate Calculator
 */
window.CapRateCalc = {
  init: function() { this.calc(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  calc: function() {
    const price = parseFloat(document.getElementById('crPrice').value) || 0;
    const grossIncome = parseFloat(document.getElementById('crGross').value) || 0;
    const expenses = parseFloat(document.getElementById('crExpenses').value) || 0;
    const vacancyRate = (parseFloat(document.getElementById('crVacancy').value) || 0) / 100;
    
    const effectiveGross = grossIncome * (1 - vacancyRate);
    const noi = effectiveGross - expenses;
    const capRate = price > 0 ? (noi / price) * 100 : 0;
    const oer = effectiveGross > 0 ? (expenses / effectiveGross) * 100 : 0;
    
    document.getElementById('crNOI').textContent = this.f(noi);
    document.getElementById('crCapRate').textContent = capRate.toFixed(2) + '%';
    document.getElementById('crEGI').textContent = this.f(effectiveGross);
    document.getElementById('crOER').textContent = oer.toFixed(1) + '%';
    
    // Also update valuation
    this.valuation();
  },
  valuation: function() {
    const targetRate = (parseFloat(document.getElementById('crTarget').value) || 0) / 100;
    const grossIncome = parseFloat(document.getElementById('crGross').value) || 0;
    const expenses = parseFloat(document.getElementById('crExpenses').value) || 0;
    const vacancyRate = (parseFloat(document.getElementById('crVacancy').value) || 0) / 100;
    
    const effectiveGross = grossIncome * (1 - vacancyRate);
    const noi = effectiveGross - expenses;
    const impliedValue = targetRate > 0 ? noi / targetRate : 0;
    
    document.getElementById('crValue').textContent = this.f(impliedValue);
  }
};