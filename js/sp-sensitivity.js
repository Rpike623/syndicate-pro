/**
 * SP ROI Sensitivity
 */
window.Sensitivity = {
  init: function() { this.calc(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  calc: function() {
    const price = parseFloat(document.getElementById('sPrice').value) || 0;
    const cap = (parseFloat(document.getElementById('sCap').value) || 5.5) / 100;
    const growth = (parseFloat(document.getElementById('sGrowth').value) || 3) / 100;
    const years = parseInt(document.getElementById('sYears').value) || 5;
    const noi = price * 0.065; // Assume 6.5% cap
    const exitNoi = noi * Math.pow(1 + growth, years);
    const exit = exitNoi / cap;
    const profit = exit - price;
    const irr = Math.pow(exit / price, 1 / years) - 1;
    const mult = exit / price;
    document.getElementById('sExit').textContent = this.f(exit);
    document.getElementById('sProfit').textContent = this.f(profit);
    document.getElementById('sIrr').textContent = (irr * 100).toFixed(1) + '%';
    document.getElementById('sMult').textContent = mult.toFixed(2) + 'x';
    // Matrix
    const caps = [4.5, 5.0, 5.5, 6.0, 6.5];
    const growths = [1, 2, 3, 4, 5];
    let html = '<thead><tr><th>Cap \\ Growth</th>' + growths.map(g => '<th>' + g + '%</th>').join('') + '</tr></thead><tbody>';
    caps.forEach(c => {
      html += '<tr><td><strong>' + c + '%</strong></td>';
      growths.forEach(g => {
        const exitVal = (noi * Math.pow(1 + g/100, years)) / (c/100);
        const ir = Math.pow(exitVal / price, 1/years) - 1;
        html += '<td class="' + (ir > 0.15 ? 'text-success' : ir > 0.1 ? '' : 'text-danger') + '">' + (ir*100).toFixed(1) + '%</td>';
      });
      html += '</tr>';
    });
    html += '</tbody>';
    document.getElementById('sMatrix').innerHTML = html;
  }
};