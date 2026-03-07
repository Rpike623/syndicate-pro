/**
 * SP Valuation Model
 */
window.Valuation = {
  sf: 100000, // Assume 100k SF
  init: function() { this.calc(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  calc: function() {
    const noi = parseFloat(document.getElementById('vNoi').value) || 0;
    const cap = (parseFloat(document.getElementById('vCap').value) || 5.5) / 100;
    const exitCap = (parseFloat(document.getElementById('vExitCap').value) || 6.0) / 100;
    const growth = (parseFloat(document.getElementById('vGrowth').value) || 3) / 100;
    // Direct Cap
    const direct = noi / cap;
    // DCF (5 year)
    let dcf = 0;
    for (let i = 1; i <= 5; i++) { dcf += (noi * Math.pow(1+growth, i)) / Math.pow(1.08, i); }
    dcf += (noi * Math.pow(1+growth, 5) * 1.03) / exitCap / Math.pow(1.08, 5);
    // Sales Comparison
    const comp = direct * 1.1; // Assume 10% premium
    // GRM
    const grm = 8;
    const gross = noi / 0.12; // Assume 12% gross rent multiplier
    document.getElementById('vTable').innerHTML = `
      <tr><td>Direct Capitalization</td><td><strong>${this.f(direct)}</strong></td><td>$${Math.round(direct/this.sf)}</td><td>NOI / Cap Rate</td></tr>
      <tr><td>DCF (5 Year)</td><td><strong>${this.f(dcf)}</strong></td><td>$${Math.round(dcf/this.sf)}</td><td>Discounted Cash Flow</td></tr>
      <tr><td>Sales Comparison</td><td><strong>${this.f(comp)}</strong></td><td>$${Math.round(comp/this.sf)}</td><td>Market Comps</td></tr>
      <tr><td>Average</td><td><strong class="text-success">${this.f((direct+dcf+comp)/3)}</strong></td><td>$${Math.round((direct+dcf+comp)/3/this.sf)}</strong></td><td>Blended Value</td></tr>
    `;
  }
};