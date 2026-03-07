/**
 * SP Rent Escalator
 */
window.Escalator = {
  chart: null,
  init: function() { this.calc(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  calc: function() {
    const current = parseFloat(document.getElementById('rCurrent').value) || 0;
    const rate = (parseFloat(document.getElementById('rRate').value) || 0) / 100;
    const years = parseInt(document.getElementById('rYears').value) || 5;
    const freq = parseFloat(document.getElementById('rFreq').value);
    const periods = years / freq;
    const final = current * Math.pow(1 + rate, periods);
    let total = 0;
    const data = [];
    for (let y = 1; y <= years; y++) {
      const yrRent = current * Math.pow(1 + rate, y);
      data.push(yrRent);
      total += yrRent * 12;
    }
    const gain = total - (current * 12 * years);
    const cagr = (Math.pow(final/current, 1/years) - 1) * 100;
    document.getElementById('rFinal').textContent = this.f(final);
    document.getElementById('rTotal').textContent = this.f(total);
    document.getElementById('rGain').textContent = this.f(gain);
    document.getElementById('rCagr').textContent = cagr.toFixed(1) + '%';
    // Chart
    if (this.chart) this.chart.destroy();
    this.chart = new Chart(document.getElementById('rChart').getContext('2d'), {
      type:'line',
      data:{ labels:Array.from({length:years},(_,i)=>'Year '+(i+1)), datasets:[{ label:'Monthly Rent', data, borderColor:'#6366f1', fill:true, backgroundColor:'rgba(99,102,241,0.1)' }] },
      options:{ plugins:{ legend:{display:false} }, scales:{ y:{ ticks:{ callback:v => '$'+(v/1000)+'K' } } } }
    });
  }
};