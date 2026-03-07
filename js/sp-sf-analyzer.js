/**
 * SP SF Analyzer
 */
window.SFAnalyzer = {
  data: [],
  init: function() {
    this.data = [
      { name:'Sunset Apartments', sf:85000, price:16500000, noi:1030000 },
      { name:'Downtown Office', sf:45000, price:9200000, noi:620000 },
      { name:'Industrial Portfolio', sf:150000, price:21000000, noi:1400000 },
      { name:'Coastal Retail', sf:38000, price:7100000, noi:480000 }
    ];
    this.render();
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  render: function() {
    const totalSf = this.data.reduce((s,d) => s + d.sf, 0);
    const totalPrice = this.data.reduce((s,d) => s + d.price, 0);
    const totalNoi = this.data.reduce((s,d) => s + d.noi, 0);
    document.getElementById('statTotal').textContent = totalSf.toLocaleString() + ' SF';
    document.getElementById('statSf').textContent = '$' + Math.round(totalPrice / totalSf);
    document.getElementById('statValue').textContent = '$' + Math.round(totalPrice / totalSf);
    document.getElementById('statNoi').textContent = '$' + Math.round(totalNoi / totalSf);
    document.getElementById('sfTable').innerHTML = this.data.map(d => {
      const psf = Math.round(d.price / d.sf);
      const nsf = Math.round(d.noi / d.sf);
      const cap = (d.noi / d.price * 100).toFixed(1);
      return `<tr><td>${d.name}</td><td>${d.sf.toLocaleString()}</td><td>${this.f(d.price)}</td><td>$${psf}</td><td>${this.f(d.noi)}</td><td>$${nsf}</td><td>${cap}%</td></tr>`;
    }).join('');
  }
};