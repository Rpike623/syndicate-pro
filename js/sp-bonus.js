/**
 * SP Bonus Depreciation Calculator
 */
window.Bonus = {
  init: function() { this.calc(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  calc: function() {
    const cost = parseFloat(document.getElementById('bCost').value) || 0;
    const year = parseInt(document.getElementById('bYear').value);
    const income = parseFloat(document.getElementById('bIncome').value) || 0;
    
    const pct = {2023:0.6, 2024:0.6, 2025:0.6, 2026:0.6, 2027:0.4, 2028:0.2, 2029:0.1, 2030:0}[year] || 0.6;
    
    const bonus = cost * pct;
    const regular = (cost - bonus) / 7;
    const total = bonus + regular;
    
    // Estimate effective rate based on income
    let rate = 0.20;
    if (income > 250000) rate = 0.24;
    if (income > 500000) rate = 0.32;
    if (income > 1000000) rate = 0.35;
    if (income > 2000000) rate = 0.37;
    
    const saved = total * rate;
    
    document.getElementById('bBonus').textContent = this.f(bonus);
    document.getElementById('bReg').textContent = this.f(regular);
    document.getElementById('bTotal').textContent = this.f(total);
    document.getElementById('bSaved').textContent = this.f(saved);
    document.getElementById('bRate').textContent = (rate * 100) + '%';
    
    // Schedule
    const schedule = [
      {y:year, pct:60},
      {y:year+1, pct:60},
      {y:year+2, pct:60},
      {y:year+3, pct:60},
      {y:year+4, pct:60},
      {y:year+5, pct:60},
      {y:year+6, pct:60}
    ];
    document.getElementById('bTable').innerHTML = schedule.map((s,i) => {
      const b = i === 0 ? bonus : 0;
      const r = (cost - b) / 7;
      return `<tr><td>${s.y}</td><td>${i===0?pct*100+'%':'—'}</td><td>${this.f(b)}</td><td>${this.f(r)}</td><td>${this.f(b+r)}</td></tr>`;
    }).join('');
  }
};