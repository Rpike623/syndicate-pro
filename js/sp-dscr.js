/**
 * SP DSCR Calculator
 */
window.DSCR = {
  init: function() { this.calc(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  calc: function() {
    const inc = parseFloat(document.getElementById('dIncome').value) || 0;
    const vac = (parseFloat(document.getElementById('dVacancy').value) || 0) / 100;
    const op = (parseFloat(document.getElementById('dOpex').value) || 0) / 100;
    const loan = parseFloat(document.getElementById('dLoan').value) || 0;
    const rate = (parseFloat(document.getElementById('dRate').value) || 0) / 100 / 12;
    const term = parseInt(document.getElementById('dTerm').value) || 30;
    const effInc = inc * (1 - vac);
    const noi = effInc * (1 - op);
    const pmt = loan * (rate * Math.pow(1+rate, term*12)) / (Math.pow(1+rate, term*12) - 1);
    const dscr = pmt > 0 ? noi / (pmt * 12) : 0;
    document.getElementById('dNoi').textContent = this.f(noi);
    document.getElementById('dDebt').textContent = this.f(pmt * 12);
    document.getElementById('dDscr').textContent = dscr.toFixed(2) + 'x';
    const el = document.getElementById('dStatus');
    if (dscr >= 1.25) { el.textContent = '✓ Approved'; el.className = 'text-success'; }
    else if (dscr >= 1.0) { el.textContent = '⚠ Marginal'; el.className = 'text-warning'; }
    else { el.textContent = '✗ Declined'; el.className = 'text-danger'; }
  }
};