/**
 * SP Equity Multiple
 */
window.EM = {
  init: function() { this.calc(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  calc: function() {
    const inv = parseFloat(document.getElementById('eInv').value) || 0;
    const yrs = parseFloat(document.getElementById('eYears').value) || 1;
    const dist = parseFloat(document.getElementById('eDist').value) || 0;
    const exit = parseFloat(document.getElementById('eExit').value) || 0;
    const total = dist + exit;
    const mult = inv > 0 ? total / inv : 0;
    const cagr = Math.pow(mult, 1/yrs) - 1;
    document.getElementById('eTotal').textContent = this.f(total);
    document.getElementById('eMultiple').textContent = mult.toFixed(2) + 'x';
    document.getElementById('eCagr').textContent = (cagr * 100).toFixed(1) + '%';
  }
};