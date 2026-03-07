/**
 * SP Rent Comps
 */
window.RC = {
  comps: [
    { name:'The Vue', dist:0.2, br1:1450, br2:1850, br3:2400 },
    { name:'Parkside Gardens', dist:0.4, br1:1350, br2:1750, br3:2250 },
    { name:'Westwood Apts', dist:0.6, br1:1425, br2:1825, br3:2350 },
    { name:'Urban Edge', dist:0.8, br1:1550, br2:1950, br3:2550 },
    { name:'Riverside Living', dist:1.1, br1:1250, br2:1650, br3:2100 }
  ],
  init: function() {
    const a1 = Math.round(this.comps.reduce((s,c) => s + c.br1, 0) / this.comps.length);
    const a2 = Math.round(this.comps.reduce((s,c) => s + c.br2, 0) / this.comps.length);
    const a3 = Math.round(this.comps.reduce((s,c) => s + c.br3, 0) / this.comps.length);
    document.getElementById('avg1').textContent = '$' + a1;
    document.getElementById('avg2').textContent = '$' + a2;
    document.getElementById('avg3').textContent = '$' + a3;
    document.getElementById('rcTable').innerHTML = this.comps.map(c => `<tr><td>${c.name}</td><td>${c.dist} mi</td><td>$${c.br1}</td><td>$${c.br2}</td><td>$${c.br3}</td></tr>`).join('');
  },
  add: function() { alert('Add comp functionality - wire to Firestore'); }
};