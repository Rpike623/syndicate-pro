/**
 * SP Unit Mix
 */
window.UnitMix = {
  units: [],
  init: function() {
    this.units = [
      { type:'Studio', count:10, sfMin:450, sfMax:500, rentMin:1200, rentMax:1400 },
      { type:'1BR/1BA', count:35, sfMin:600, sfMax:750, rentMin:1450, rentMax:1700 },
      { type:'2BR/1BA', count:25, sfMin:850, sfMax:950, rentMin:1650, rentMax:1900 },
      { type:'2BR/2BA', count:20, sfMin:950, sfMax:1100, rentMin:1850, rentMax:2200 },
      { type:'3BR/2BA', count:10, sfMin:1200, sfMax:1400, rentMin:2200, rentMax:2600 }
    ];
    this.render();
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  render: function() {
    const total = this.units.reduce((s,u) => s + u.count, 0);
    const avgSf = Math.round(this.units.reduce((s,u) => s + (u.sfMin+u.sfMax)/2 * u.count, 0) / total);
    const avgRent = Math.round(this.units.reduce((s,u) => s + (u.rentMin+u.rentMax)/2 * u.count, 0) / total);
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statAvgSf').textContent = avgSf;
    document.getElementById('statAvgRent').textContent = this.f(avgRent);
    document.getElementById('statSfRent').textContent = '$' + Math.round(avgRent / avgSf);
    document.getElementById('mixTable').innerHTML = this.units.map(u => {
      const avgSf = Math.round((u.sfMin + u.sfMax) / 2);
      const avgRent = Math.round((u.rentMin + u.rentMax) / 2);
      const share = Math.round(u.count / total * 100);
      return `<tr><td>${u.type}</td><td>${u.count}</td><td>${u.sfMin}-${u.sfMax}</td><td>${avgSf}</td><td>${this.f(avgRent)}</td><td>$${Math.round(avgRent/avgSf)}</td><td>${share}%</td></tr>`;
    }).join('');
  }
};