/**
 * SP Capital Stack
 */
window.CapitalStack = {
  data: {},
  init: function() {
    this.data = {
      sunset: { total:16500000, senior:9500000, mezz:2500000, equity:4500000, tranches:[
        { type:'Senior', lender:'KeyBank', amount:9500000, rate:6.5, term:30, ltv:58 },
        { type:'Mezzanine', lender:'Spruce', amount:2500000, rate:10.5, term:5, ltv:73 },
        { type:'LP Equity', lender:'Various', amount:3500000, rate:0, term:0, ltv:0 },
        { type:'GP Equity', lender:'Sponsor', amount:1000000, rate:0, term:0, ltv:0 }
      ]},
      downtown: { total:10500000, senior:5500000, mezz:1500000, equity:3500000, tranches:[
        { type:'Senior', lender:'Wells Fargo', amount:5500000, rate:6.8, term:25, ltv:52 },
        { type:'Mezzanine', lender:'Arena', amount:1500000, rate:11.2, term:5, ltv:66 },
        { type:'LP Equity', lender:'Various', amount:2800000, rate:0, term:0, ltv:0 },
        { type:'GP Equity', lender:'Sponsor', amount:700000, rate:0, term:0, ltv:0 }
      ]},
      industrial: { total:28000000, senior:16000000, mezz:4000000, equity:8000000, tranches:[
        { type:'Senior', lender:'MetLife', amount:16000000, rate:5.9, term:30, ltv:57 },
        { type:'Mezzanine', lender:'Fund II', amount:4000000, rate:9.5, term:7, ltv:71 },
        { type:'LP Equity', lender:'Various', amount:6500000, rate:0, term:0, ltv:0 },
        { type:'GP Equity', lender:'Sponsor', amount:1500000, rate:0, term:0, ltv:0 }
      ]}
    };
    this.render();
  },
  load: function() { this.render(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  render: function() {
    const deal = document.getElementById('dealFilter').value || 'sunset';
    const d = this.data[deal];
    document.getElementById('statTotal').textContent = this.f(d.total);
    document.getElementById('statSenior').textContent = this.f(d.senior);
    document.getElementById('statMezz').textContent = this.f(d.mezz);
    document.getElementById('statEquity').textContent = this.f(d.equity);
    const pct = (amount,total) => Math.round(amount/total*100);
    document.getElementById('stackVisual').innerHTML = `<div class="stack-bar"><div class="stack-segment" style="width:${pct(d.senior,d.total)}%;background:#ef4444">Senior ${pct(d.senior,d.total)}%</div><div class="stack-segment" style="width:${pct(d.mezz,d.total)}%;background:#f59e0b">Mezz ${pct(d.mezz,d.total)}%</div><div class="stack-segment" style="width:${pct(d.equity,d.total)}%;background:#22c55e">Equity ${pct(d.equity,d.total)}%</div></div>`;
    document.getElementById('stackTable').innerHTML = d.tranches.map(t => `<tr><td>${t.type}</td><td>${t.lender}</td><td>${this.f(t.amount)}</td><td>${t.rate ? t.rate + '%' : '—'}</td><td>${t.term ? t.term + 'yr' : '—'}</td><td>${t.ltv ? t.ltv + '%' : '—'}</td></tr>`).join('');
  }
};
