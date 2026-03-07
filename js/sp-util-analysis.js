/**
 * SP Utility Analysis
 */
window.UtilAnalysis = {
  init: function() {
    const data = [
      { util:'Electric', q1_25:42000, q1_26:45000 },
      { util:'Gas', q1_25:18000, q1_26:16500 },
      { util:'Water', q1_25:22000, q1_26:24000 },
      { util:'Trash', q1_25:8500, q1_26:9200 },
      { util:'Internet/Cable', q1_25:12000, q1_26:14500 }
    ];
    const fmt = v => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v);
    document.getElementById('utilTable').innerHTML = data.map(d => {
      const change = d.q1_26 - d.q1_25;
      const pct = ((change / d.q1_25) * 100).toFixed(1);
      return `<tr><td>${d.util}</td><td>${fmt(d.q1_25)}</td><td>${fmt(d.q1_26)}</td><td class="${change>0?'text-danger':'text-success'}">${change>0?'+':''}${fmt(change)}</td><td class="${change>0?'text-danger':'text-success'}">${pct}%</td></tr>`;
    }).join('');
  }
};