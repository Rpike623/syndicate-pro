/**
 * SP Lead Calculator
 */
window.LeadCalc = {
  init: function() { this.calc(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  calc: function() {
    const leads = parseInt(document.getElementById('lLeads').value) || 0;
    const conv = (parseFloat(document.getElementById('lConv').value) || 0) / 100;
    const avg = parseFloat(document.getElementById('lAvg').value) || 0;
    const hold = (parseFloat(document.getElementById('lHold').value) || 0) / 100;
    const years = parseInt(document.getElementById('lYears').value) || 5;
    const fee = (parseFloat(document.getElementById('lFee').value) || 0) / 100;
    const investors = Math.round(leads * conv);
    const capital = investors * avg * hold;
    const revenue = capital * fee;
    const totalRev = revenue * years;
    const carry = (capital * 0.08 * 0.2 * years); // Assume 8% return, 20% carry
    document.getElementById('lInv').textContent = investors;
    document.getElementById('lCap').textContent = this.f(capital);
    document.getElementById('lRev').textContent = this.f(totalRev);
    document.getElementById('lCarry').textContent = this.f(carry);
    document.getElementById('lTotal').textContent = this.f(totalRev + carry);
  }
};