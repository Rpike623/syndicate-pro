/**
 * SP Debt Service Calculator
 */
window.Debt = {
  init: function() { this.calc(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  calc: function() {
    const P = parseFloat(document.getElementById('dAmount').value) || 0;
    const r = (parseFloat(document.getElementById('dRate').value) || 0) / 100 / 12;
    const n = (parseFloat(document.getElementById('dTerm').value) || 0) * 12;
    const a = (parseFloat(document.getElementById('dAmort').value) || 0) * 12;
    let monthly = 0;
    if (r > 0 && a > 0) monthly = P * (r * Math.pow(1+r, a)) / (Math.pow(1+r, a) - 1);
    const annual = monthly * 12;
    const total = monthly * n;
    const totalInt = total - P;
    document.getElementById('dMonthly').textContent = this.f(monthly);
    document.getElementById('dAnnual').textContent = this.f(annual);
    document.getElementById('dTotalInt').textContent = this.f(totalInt);
    document.getElementById('dTotal').textContent = this.f(total);
    // Amort schedule
    let balance = P;
    let html = '';
    for (let y = 1; y <= Math.min(10, document.getElementById('dTerm').value); y++) {
      let yrPay = 0, yrPrin = 0, yrInt = 0;
      for (let m = 0; m < 12; m++) {
        const int = balance * r;
        const prin = monthly - int;
        yrPay += monthly; yrPrin += prin; yrInt += int;
        balance -= prin;
      }
      html += `<tr><td>Year ${y}</td><td>${this.f(yrPay)}</td><td>${this.f(yrPrin)}</td><td>${this.f(yrInt)}</td><td>${this.f(Math.max(0,balance))}</td></tr>`;
    }
    document.getElementById('amortTable').innerHTML = html;
  }
};
