/**
 * SP IRR Calculator
 */
window.IRR = {
  flows: [],
  init: function() {
    this.flows = [-1000000, 50000, 60000, 70000, 1200000];
    this.render();
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  addYear: function() {
    this.flows.splice(this.flows.length-1, 0, 60000 + Math.random()*20000);
    this.render();
  },
  render: function() {
    let html = '';
    this.flows.forEach((cf, i) => {
      html += `<tr><td>Year ${i}</td><td><input type="number" value="${cf}" onchange="IRR.flows[${i}]=parseFloat(this.value);IRR.calc()" class="form-input" style="width:120px"></td></tr>`;
    });
    document.getElementById('cfTable').innerHTML = html;
    this.calc();
  },
  calc: function() {
    const flows = this.flows;
    let irr = 0.1;
    for (let iter = 0; iter < 100; iter++) {
      let npv = 0, npv2 = 0;
      for (let t = 0; t < flows.length; t++) { npv += flows[t] / Math.pow(1+irr, t); npv2 += flows[t] / Math.pow(1+irr+0.0001, t); }
      const deriv = (npv2 - npv) / 0.0001;
      if (Math.abs(deriv) < 0.0001) break;
      irr = irr - npv / deriv;
    }
    irr = irr * 100;
    const totalIn = flows.slice(0,-1).reduce((s,v) => s + Math.abs(v), 0);
    const totalOut = flows[flows.length-1];
    const moic = (totalOut + flows.slice(0,-1).reduce((s,v) => s+v,0)) / totalIn;
    document.getElementById('irrResult').textContent = irr.toFixed(1) + '%';
    document.getElementById('irrResult').className = irr > 0 ? 'text-success' : 'text-danger';
    const npv = flows.reduce((s,v,t) => s + v/Math.pow(1.08,t), 0);
    document.getElementById('npvResult').textContent = this.f(npv);
    document.getElementById('moicResult').textContent = moic.toFixed(2) + 'x';
  }
};