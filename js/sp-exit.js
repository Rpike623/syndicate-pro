/**
 * SP Exit Strategy
 */
window.Exit = {
  init: function() { this.calc(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  calc: function() {
    const val = parseFloat(document.getElementById('eValue').value) || 0;
    const yrs = parseInt(document.getElementById('eYears').value) || 5;
    const cap = (parseFloat(document.getElementById('eCap').value) || 5.5) / 100;
    const growth = (parseFloat(document.getElementById('eNoiGrowth').value) || 3) / 100;
    const capex = parseFloat(document.getElementById('eCapex').value) || 0;
    const noi = val * 0.065; // Assume 6.5% cap
    const exitNoi = noi * Math.pow(1 + growth, yrs);
    const exitVal = exitNoi / cap;
    const profit = exitVal - val - capex;
    const irr = Math.pow(exitVal / val, 1/yrs) - 1;
    const moic = exitVal / val;
    document.getElementById('eExitValue').textContent = this.f(exitVal);
    document.getElementById('eProfit').textContent = this.f(profit);
    document.getElementById('eIrr').textContent = (irr * 100).toFixed(1) + '%';
    document.getElementById('eMoic').textContent = moic.toFixed(2) + 'x';
    // Options comparison
    const strategies = [
      { name:'Traditional Sale', exit:exitVal, profit:exitVal - val - capex, irr:irr*100, pros:'Clean exit, full liquidity', cons:'Cap gains tax' },
      { name:'Refinance & Hold', exit:val * 0.7, profit:(val * 0.7) - val - capex, irr:8, pros:'Defer tax, keep asset', cons:'Leverage risk' },
      { name:'1031 Exchange', exit:exitVal, profit:exitVal - val - capex, irr:irr*100, pros:'Tax deferred', cons:'Strict timelines' },
      { name:'IPO/REIT', exit:exitVal * 1.1, profit:(exitVal * 1.1) - val - capex, irr:(irr + 3), pros:'Premium valuation', cons:'High complexity' }
    ];
    document.getElementById('exitTable').innerHTML = strategies.map(s => `<tr><td>${s.name}</td><td>${this.f(s.exit)}</td><td>${this.f(s.profit)}</td><td>${s.irr.toFixed(1)}%</td><td>${s.pros}</td><td>${s.cons}</td></tr>`).join('');
  }
};