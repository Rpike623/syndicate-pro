/**
 * SP Rent Roll Analyzer
 */
window.RentRoll = {
  data: [],
  sampleData: `Unit,Type,Beds,Baths,SqFt,Current Rent,Market Rent,Status,Tenant
101,2BR,2,1,950,1650,1750,Occupied,Smith
102,1BR,1,1,650,1250,1300,Vacant,
103,2BR,2,1,950,1700,1750,Occupied,Johnson
104,3BR,3,2,1200,2100,2200,Occupied,Williams
105,1BR,1,1,650,1200,1300,Occupied,Brown
106,2BR,2,1,950,1680,1750,Occupied,Jones
107,3BR,3,2,1200,2150,2200,Occupied,Garcia
108,1BR,1,1,650,1100,1300,Vacant,
109,2BR,2,1,950,1725,1750,Occupied,Miller
110,1BR,1,1,650,1280,1300,Occupied,Davis
111,2BR,2,1,950,1690,1750,Occupied,Rodriguez
112,3BR,3,2,1200,2050,2200,Occupied,Martinez`,
  sample: function() { document.getElementById('rentData').value = this.sampleData; },
  parse: function() {
    const lines = document.getElementById('rentData').value.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const vals = line.split(',');
      const obj = {};
      headers.forEach((h, i) => obj[h] = vals[i]?.trim());
      return obj;
    }).filter(u => u.unit);
  },
  analyze: function() {
    const units = this.parse();
    if (!units.length) { alert('Enter rent roll data first'); return; }
    
    const total = units.length;
    const occupied = units.filter(u => u.status?.toLowerCase() === 'occupied').length;
    const occupancy = Math.round(occupied / total * 100);
    const currentRent = units.reduce((s, u) => s + (parseInt(u['current rent']?.replace(/[^0-9]/g,'')) || 0), 0);
    const marketRent = units.reduce((s, u) => s + (parseInt(u['market rent']?.replace(/[^0-9]/g,'')) || 0), 0);
    const loss = marketRent - currentRent;

    document.getElementById('results').style.display = 'block';
    document.getElementById('statUnits').textContent = total;
    document.getElementById('statOccupancy').textContent = occupancy + '%';
    document.getElementById('statCurrent').textContent = this.f(currentRent);
    document.getElementById('statMarket').textContent = this.f(marketRent);
    document.getElementById('statLoss').textContent = this.f(loss);

    // Type breakdown
    const types = {};
    units.forEach(u => {
      const t = u.type || 'Unknown';
      if (!types[t]) types[t] = { count: 0, current: 0, market: 0, occupied: 0 };
      types[t].count++;
      types[t].current += parseInt(u['current rent']?.replace(/[^0-9]/g,'')) || 0;
      types[t].market += parseInt(u['market rent']?.replace(/[^0-9]/g,'')) || 0;
      if (u.status?.toLowerCase() === 'occupied') types[t].occupied++;
    });
    document.getElementById('typeBreakdown').innerHTML = Object.entries(types).map(t => `<div class="type-card">
      <div class="type-header"><strong>${t[0]}</strong><span>${t[1].count} units</span></div>
      <div class="type-stats"><span>Current: ${this.f(t[1].current)}</span><span>Market: ${this.f(t[1].market)}</span></div>
    </div>`).join('');

    // Vacancy detail
    const vacant = units.filter(u => u.status?.toLowerCase() !== 'occupied');
    const vacantRent = vacant.reduce((s, u) => s + (parseInt(u['market rent']?.replace(/[^0-9]/g,'')) || 0), 0);
    document.getElementById('vacancyDetail').innerHTML = vacant.length ? `<div class="vacancy-list">
      ${vacant.map(v => `<div class="vacancy-item"><span>${v.unit}</span><span>${v.type}</span><span>${this.f(parseInt(v['market rent']?.replace(/[^0-9]/g,'')||0))}/mo</span></div>`).join('')}
      <div class="vacancy-total"><strong>Monthly Loss: ${this.f(vacantRent)}</strong></div>
    </div>` : '<p>No vacancies!</p>';
  },
  f: function(a) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(a); }
};
