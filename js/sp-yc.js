/**
 * SP Yield Converter
 */
window.YC = {
  init: function() { this.calc(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  calc: function() {
    const val = parseFloat(document.getElementById('yValue').value) || 1;
    const noi = parseFloat(document.getElementById('yNoi').value) || 0;
    const cap = (noi / val) * 100;
    const grm = val / noi;
    const egim = grm * 12;
    document.getElementById('yCap').textContent = cap.toFixed(2) + '%';
    document.getElementById('yCoc').textContent = (cap * 0.6).toFixed(2) + '%';
    document.getElementById('yGrm').textContent = grm.toFixed(1) + 'x';
    document.getElementById('yEgim').textContent = egim.toFixed(1) + 'x';
    // Table
    const caps = [4,5,6,7,8];
    let html = '';
    caps.forEach(c => { html += `<tr><td>${c}%</td><td>${this.f(noi/(c/100))}</td><td>${this.f(c/100*noi*10)}</td><td>${c}%</td></tr>`; });
    document.getElementById('yTable').innerHTML = html;
  }
};