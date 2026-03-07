/**
 * SP Property Comparator
 */
window.Comparator = {
  init: function() {
    const props = [
      { name:'Sunset Apts', price:16500000, noi:1030000, units:100, sf:85000, cap:6.2, occup:96 },
      { name:'Harbor View', price:14200000, noi:920000, units:85, sf:72000, cap:6.5, occup:94 }
    ];
    const metrics = [
      { label:'Price', key:'price', format:'$', lower:false },
      { label:'NOI', key:'noi', format:'$', lower:false },
      { label:'Price/Unit', key:'price', div:'units', format:'$', lower:true },
      { label:'Price/SF', key:'price', div:'sf', format:'$', lower:true },
      { label:'Cap Rate', key:'cap', format:'%', lower:false },
      { label:'Occupancy', key:'occup', format:'%', lower:false }
    ];
    let html = '';
    let aWins = 0;
    metrics.forEach(m => {
      const a = props[0][m.key] / (m.div ? props[0][m.div] : 1);
      const b = props[1][m.key] / (m.div ? props[1][m.div] : 1);
      const diff = ((a - b) / b * 100).toFixed(1);
      const winner = m.lower ? (a < b ? 'A' : 'B') : (a > b ? 'A' : 'B');
      if (winner === 'A') aWins++;
      html += `<tr><td>${m.label}</td><td>${m.format === '$' ? '$' + (a/1000).toFixed(0) + 'K' : a.toFixed(1) + '%'}</td><td>${m.format === '$' ? '$' + (b/1000).toFixed(0) + 'K' : b.toFixed(1) + '%'}</td><td class="${winner === 'A' ? 'text-success' : 'text-danger'}">${diff}% ${winner}</td></tr>`;
    });
    document.getElementById('compTable').innerHTML = html;
    document.getElementById('winner').innerHTML = `<div class="winner-box ${aWins > 3 ? 'winner-a' : 'winner-b'}"><strong>Winner: Property ${aWins > 3 ? 'A (Sunset)' : 'B (Harbor)'}</strong><p>${aWins} of 6 metrics</p></div>`;
  }
};