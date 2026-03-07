/**
 * SP DSCR Calculator
 */
window.DSCR = {
  init: function() { this.calc(); },
  calc: function() {
    const noi = parseFloat(document.getElementById('dsNOI').value) || 0;
    const debt = parseFloat(document.getElementById('dsDebt').value) || 0;
    const ratio = debt > 0 ? (noi / debt).toFixed(2) : 0;
    const maxDebt = noi / 1.25;
    const reqNoi = debt * 1.25;
    const fmt = v => '$' + Math.round(v).toLocaleString();
    document.getElementById('dsRatio').textContent = ratio + 'x';
    document.getElementById('dsMax').textContent = fmt(maxDebt);
    document.getElementById('dsReq').textContent = fmt(reqNoi);
    const rv = document.getElementById('dsRatio');
    if(ratio < 1.25) rv.className = 'stat-value text-danger';
    else if(ratio < 1.4) rv.className = 'stat-value text-warning';
    else rv.className = 'stat-value text-success';
  }
};