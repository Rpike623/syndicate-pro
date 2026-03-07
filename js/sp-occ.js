/**
 * SP Occupancy Tracker
 */
window.Occ = {
  init: function() {
    let html = '', occ=0, total=48;
    for(let i=1; i<=total; i++) {
      const isOcc = Math.random() > 0.1;
      if(isOcc) occ++;
      const color = isOcc ? '#10b981' : '#ef4444';
      html += `<div title="Unit ${i}" style="background:${color};height:60px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:12px;">${i}</div>`;
    }
    document.getElementById('occGrid').innerHTML = html;
    document.getElementById('physOcc').textContent = Math.round((occ/total)*100) + '%';
    document.getElementById('econOcc').textContent = Math.round((occ/total)*0.95*100) + '%';
  }
};