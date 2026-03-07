/**
 * SP LTC Calculator
 */
window.LTC = {
  init: function() { this.calc(); },
  calc: function() {
    const price = parseFloat(document.getElementById('ltcPrice').value) || 0;
    const rehab = parseFloat(document.getElementById('ltcRehab').value) || 0;
    const soft = parseFloat(document.getElementById('ltcSoft').value) || 0;
    const loan = parseFloat(document.getElementById('ltcLoan').value) || 0;
    const total = price + rehab + soft;
    const ltc = total > 0 ? (loan / total * 100).toFixed(2) : 0;
    const equity = total - loan;
    const fmt = v => '$' + Math.round(v).toLocaleString();
    document.getElementById('ltcTotal').textContent = fmt(total);
    document.getElementById('ltcRatio').textContent = ltc + '%';
    document.getElementById('ltcEquity').textContent = fmt(equity);
  }
};