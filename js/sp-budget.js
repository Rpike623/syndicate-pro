/**
 * SP Budget vs Actual
 */
window.Budget = {
  data: {},
  init: function() {
    this.data = {
      deal_1: {
        name: 'Sunset Apartments',
        income: { budget: [45000,45000,45000], actual: [48000,46500,47200] },
        operating: { budget: [12000,12000,12000], actual: [11500,12800,11200] },
        taxes: { budget: [4200,4200,4200], actual: [4200,4200,4200] },
        insurance: { budget: [700,700,700], actual: [700,700,700] },
        maintenance: { budget: [2000,2000,2000], actual: [2800,1900,2200] }
      },
      deal_2: {
        name: 'Downtown Office',
        income: { budget: [35000,35000,35000], actual: [34200,35800,35100] },
        operating: { budget: [8000,8000,8000], actual: [7800,8200,7900] },
        taxes: { budget: [3000,3000,3000], actual: [3000,3000,3000] },
        insurance: { budget: [500,500,500], actual: [500,500,500] },
        maintenance: { budget: [1500,1500,1500], actual: [1200,1600,1400] }
      },
      deal_3: {
        name: 'Industrial Portfolio',
        income: { budget: [65000,65000,65000], actual: [68000,67200,68500] },
        operating: { budget: [15000,15000,15000], actual: [14500,15200,14800] },
        taxes: { budget: [6000,6000,6000], actual: [6000,6000,6000] },
        insurance: { budget: [900,900,900], actual: [900,900,900] },
        maintenance: { budget: [3000,3000,3000], actual: [3200,2800,3100] }
      }
    };
  },
  loadDeal: function() {
    const id = document.getElementById('dealSelect').value;
    if (!id) { document.getElementById('budgetContent').style.display = 'none'; return; }
    document.getElementById('budgetContent').style.display = 'block';
    const d = this.data[id];
    const cats = ['income','operating','taxes','insurance','maintenance'];
    const catNames = { income: 'Rental Income', operating: 'Operating Expenses', taxes: 'Property Taxes', insurance: 'Insurance', maintenance: 'Maintenance' };
    
    let rows = '';
    let budgetNOI = 0, actualNOI = 0;
    
    cats.forEach(cat => {
      const b = d[cat].budget, a = d[cat].actual;
      const bQ = b.reduce((s,x)=>s+x,0), aQ = a.reduce((s,x)=>s+x,0);
      const varQ = aQ - bQ;
      if (cat === 'income') { budgetNOI = bQ; actualNOI = aQ; }
      else { budgetNOI -= bQ; actualNOI -= aQ; }
      
      rows += `<tr>
        <td><strong>${catNames[cat]}</strong></td>
        <td>${this.f(b[0])}</td><td>${this.f(b[1])}</td><td>${this.f(b[2])}</td>
        <td>${this.f(bQ)}</td>
        <td>${this.f(aQ)}</td>
        <td class="${varQ>=0?'text-success':'text-danger'}">${this.f(varQ)}</td>
      </tr>`;
    });
    
    document.getElementById('budgetTableBody').innerHTML = rows;
    const variance = actualNOI - budgetNOI;
    const pct = budgetNOI ? Math.round(actualNOI/budgetNOI*100) : 0;
    
    document.getElementById('statBudgetNOI').textContent = this.f(budgetNOI);
    document.getElementById('statActualNOI').textContent = this.f(actualNOI);
    document.getElementById('statVariance').textContent = (variance>=0?'+':'') + this.f(variance);
    document.getElementById('statVariance').className = 'stat-value ' + (variance>=0?'text-success':'text-danger');
    document.getElementById('statPct').textContent = pct + '%';
  },
  f: function(a) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(a); }
};
