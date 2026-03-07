/**
 * SP Purchase & Sale
 */
window.PS = {
  init: function() { this.calc(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  calc: function() {
    const price = parseFloat(document.getElementById('psPrice').value) || 0;
    const closingPct = (parseFloat(document.getElementById('psClosing').value) || 0) / 100;
    const prepaid = parseFloat(document.getElementById('psPrepaid').value) || 0;
    const renov = parseFloat(document.getElementById('psRenov').value) || 0;
    const depositPct = (parseFloat(document.getElementById('psDeposit').value) || 0) / 100;
    const deposit = price * depositPct;
    const closing = price * closingPct;
    const total = deposit + closing + prepaid + renov;
    const effective = price + closing;
    document.getElementById('psPriceOut').textContent = this.f(price);
    document.getElementById('psClosingOut').textContent = this.f(closing);
    document.getElementById('psTotal').textContent = this.f(total);
    document.getElementById('psEffective').textContent = this.f(effective);
  }
};