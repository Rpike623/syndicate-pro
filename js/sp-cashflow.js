/**
 * SP Cash Flow Forecast
 */
window.CF = {
  months: [],
  init: function() {
    const m = ['Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb'];
    this.months = m.map((month, i) => ({
      month: i < 10 ? `2026-${month}` : `2027-${month}`,
      income: 280000 + Math.random() * 20000,
      expenses: 180000 + Math.random() * 15000
    }));
    this.render();
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  render: function() {
    const totalIn = this.months.reduce((s,m) => s + m.income, 0);
    const totalOut = this.months.reduce((s,m) => s + m.expenses, 0);
    const net = totalIn - totalOut;
    document.getElementById('statIn').textContent = this.f(totalIn);
    document.getElementById('statOut').textContent = this.f(totalOut);
    document.getElementById('statNet').textContent = this.f(net);
    // Chart
    new Chart(document.getElementById('cfChart').getContext('2d'), {
      type:'bar',
      data:{ labels:this.months.map(m => m.month), datasets:[
        { label:'Income', data:this.months.map(m => m.income), backgroundColor:'#22c55e' },
        { label:'Expenses', data:this.months.map(m => m.expenses), backgroundColor:'#ef4444' }
      ]},
      options:{ plugins:{ legend:{ position:'bottom' } }, scales:{ y:{ ticks:{ callback:v => '$'+(v/1000)+'K' } } } }
    });
    // Table
    let cum = 0;
    document.getElementById('cfTable').innerHTML = this.months.map(m => {
      const n = m.income - m.expenses;
      cum += n;
      return `<tr><td>${m.month}</td><td class="text-success">${this.f(m.income)}</td><td class="text-danger">${this.f(m.expenses)}</td><td>${this.f(n)}</td><td>${this.f(cum)}</td></tr>`;
    }).join('');
  }
};
