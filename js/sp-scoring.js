/**
 * SP Deal Scoring - Investment Quality Scoring
 */
window.Scoring = {
  weights: { market: 25, financials: 35, risk: 25, valueAdd: 15 },
  calculate: function() {
    const type = document.getElementById('scoreType').value;
    const market = document.getElementById('scoreMarket').value;
    const price = parseInt(document.getElementById('scorePrice').value) || 0;
    const size = parseInt(document.getElementById('scoreSize').value) || 0;
    const cap = parseFloat(document.getElementById('scoreCap').value) || 0;
    const coc = parseFloat(document.getElementById('scoreCoC').value) || 0;
    const noi = parseInt(document.getElementById('scoreNOI').value) || 0;
    const dscr = parseFloat(document.getElementById('scoreDSCR').value) || 0;
    const vacancy = parseFloat(document.getElementById('scoreVacancy').value) || 0;
    const age = parseInt(document.getElementById('scoreAge').value) || 0;
    const valueAdd = document.getElementById('scoreValueAdd').value;

    // Market score
    let marketScore = 50;
    if (market === 'sun-belt' || market === 'texas') marketScore = 95;
    else if (market === 'sf' || market === 'nyc') marketScore = 75;
    else if (market === 'chicago') marketScore = 65;
    else marketScore = 60;

    // Financials score
    let finScore = 0;
    finScore += cap >= 6 ? 30 : cap >= 5 ? 25 : cap >= 4 ? 20 : 15;
    finScore += coc >= 10 ? 30 : coc >= 8 ? 25 : coc >= 6 ? 20 : 15;
    finScore += dscr >= 1.5 ? 25 : dscr >= 1.25 ? 20 : dscr >= 1.1 ? 15 : 10;
    finScore += (price > 0 && size > 0) ? (price/size < 150000 ? 15 : price/size < 250000 ? 10 : 5) : 0;

    // Risk score
    let riskScore = 100;
    riskScore -= vacancy > 10 ? 25 : vacancy > 5 ? 15 : 0;
    riskScore -= age > 30 ? 25 : age > 20 ? 15 : age > 10 ? 8 : 0;
    riskScore -= dscr < 1.2 ? 30 : dscr < 1.1 ? 20 : 0;

    // Value-add score
    let vaScore = { low: 95, medium: 70, high: 40 }[valueAdd];

    // Weighted total
    const total = Math.round((marketScore * this.weights.market + finScore * this.weights.financials + riskScore * this.weights.risk + vaScore * this.weights.valueAdd) / 100);

    document.getElementById('scoreResults').style.display = 'block';
    document.getElementById('totalScore').textContent = total;
    document.getElementById('scoreLabel').textContent = total >= 80 ? '⭐ Excellent' : total >= 65 ? '✓ Good' : total >= 50 ? '⚠ Fair' : '❌ Poor';
    document.getElementById('scoreLabel').className = 'score-label ' + (total >= 80 ? 'text-success' : total >= 65 ? 'text-primary' : total >= 50 ? 'text-warning' : 'text-danger');

    document.getElementById('scoreBreakdown').innerHTML = `
      <div class="breakdown-item"><span>Market</span><div class="breakdown-bar"><div class="fill" style="width:${marketScore}%"></div></div><span>${marketScore}</span></div>
      <div class="breakdown-item"><span>Financials</span><div class="breakdown-bar"><div class="fill" style="width:${finScore}%"></div></div><span>${finScore}</span></div>
      <div class="breakdown-item"><span>Risk Profile</span><div class="breakdown-bar"><div class="fill" style="width:${riskScore}%"></div></div><span>${riskScore}</span></div>
      <div class="breakdown-item"><span>Value-Add</span><div class="breakdown-bar"><div class="fill" style="width:${vaScore}%"></div></div><span>${vaScore}</span></div>
    `;

    let rec = '';
    if (total >= 80) rec = '<div class="rec-box rec-buy">✅ <strong>Strong Buy</strong> - This deal scores well across all metrics. Recommend moving forward quickly.</div>';
    else if (total >= 65) rec = '<div class="rec-box rec-maybe">✓ <strong>Consider</strong> - Solid deal with minor concerns. Proceed with standard due diligence.</div>';
    else if (total >= 50) rec = '<div class="rec-box rec-caution">⚠ <strong>Caution</strong> - Several risk factors. Need more analysis or price negotiation.</div>';
    else rec = '<div class="rec-box rec-pass">❌ <strong>Pass</strong> - Deal has significant issues. Recommend passing or major restructuring.';
    document.getElementById('scoreRec').innerHTML = rec;
  }
};
