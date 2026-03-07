/**
 * SP Cap Rate Calculator
 */
window.CapR = {
  init: function() { this.calc(); },
  calc: function() {
    const price = parseFloat(document.getElementById('crPrice').value) || 0;
    const noi = parseFloat(document.getElementById('crNOI').value) || 0;
    const rate = (noi / price * 100).toFixed(2);
    document.getElementById('crRate').textContent = rate + '%';
    document.getElementById('crValue65').textContent = '$' + Math.round(noi / 0.065).toLocaleString();
    document.getElementById('crValue55').textContent = '$' + Math.round(noi / 0.055).toLocaleString();
  }
};