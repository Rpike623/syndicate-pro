/**
 * SP Refinance Calculator
 */
window.Rofi = {
  init: function() { this.calc(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  calc: function() {
    const cBal = parseFloat(document.getElementById('cBalance').value) || 0;
    const cPay = parseFloat(document.getElementById('cPayment').value) || 0;
    const nAmt = parseFloat(document.getElementById('nAmount').value) || 0;
    const nRate = (parseFloat(document.getElementById('nRate').value) || 0) / 100 / 12;
    const nTerm = parseInt(document.getElementById('nTerm').value) || 30;
    const nPay = nAmt * (nRate * Math.pow(1+nRate, nTerm*12)) / (Math.pow(1+nRate, nTerm*12) - 1);
    const cashOut = nAmt - cBal;
    const monthly = nPay - cPay;
    const savings = (cPay - nPay) * nTerm * 12;
    const breakEven = monthly > 0 ? Math.ceil(cashOut / monthly) : 0;
    document.getElementById('rCashOut').textContent = this.f(cashOut);
    document.getElementById('rMonthly').textContent = (monthly >= 0 ? '+' : '') + this.f(monthly);
    document.getElementById('rMonthly').className = monthly >= 0 ? 'text-danger' : 'text-success';
    document.getElementById('rSavings').textContent = this.f(Math.abs(savings));
    document.getElementById('rBreak').textContent = breakEven + ' mo';
  }
};