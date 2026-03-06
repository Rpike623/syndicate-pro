/**
 * SP Waterfall Explainer - Animated Visual Guide
 */
window.Waterfall = {
  tierInfo: [
    { title: 'Return of Capital', desc: 'First, investors get their original investment back. In this example: $10,000,000.', stats: '100% to LPs' },
    { title: 'LP Preferred Return', desc: 'LPs receive their preferred return (6% on $10M). This is $600,000 - a guaranteed return before the GP receives any promote.', stats: 'LP: $600,000' },
    { title: 'LP Catch-Up', desc: 'The GP catches up to receive their proportional share. LPs get $300,000 to match the GP catch-up amount.', stats: 'LP: $300,000, GP: $300,000' },
    { title: 'GP Promote', desc: 'Now profits are split! In a 80/20 waterfall, the GP receives 20% of remaining profits as carried interest.', stats: 'GP Promote: $820,000' },
    { title: 'Remaining LP Profits', desc: 'The remaining profits go to LPs. Total LP distributions: $10M + $600K + $300K + $3.28M = $14.18M', stats: 'LP Total: $14,180,000' }
  ],
  step: 0,
  init: function() { this.calculate(); },
  animate: function() {
    this.reset();
    const tiers = ['tier1','tier2','tier3','tier4','tier5'];
    const playBtn = document.getElementById('playBtn');
    playBtn.disabled = true;
    playBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Playing...';
    
    let i = 0;
    const interval = setInterval(() => {
      if (i >= tiers.length) {
        clearInterval(interval);
        playBtn.disabled = false;
        playBtn.innerHTML = '<i class="fas fa-play"></i> Play Animation';
        return;
      }
      document.getElementById(tiers[i]).classList.add('active');
      this.updateInfo(i);
      i++;
    }, 1500);
  },
  reset: function() {
    ['tier1','tier2','tier3','tier4','tier5'].forEach(t => document.getElementById(t).classList.remove('active'));
    document.getElementById('infoTitle').textContent = 'Click Play to Start';
    document.getElementById('infoDesc').textContent = 'See how distributions flow from gross proceeds to investors and sponsors.';
    document.getElementById('infoStats').textContent = '';
  },
  updateInfo: function(idx) {
    const info = this.tierInfo[idx];
    document.getElementById('infoTitle').textContent = info.title;
    document.getElementById('infoDesc').textContent = info.desc;
    document.getElementById('infoStats').textContent = info.stats;
  },
  calculate: function() {
    const price = parseInt(document.getElementById('calcPrice').value) || 0;
    const equity = parseInt(document.getElementById('calcEquity').value) || 0;
    const prefRate = parseFloat(document.getElementById('calcPref').value) / 100;
    const gpPromote = parseFloat(document.getElementById('calcPromote').value) / 100;
    
    const debt = price - equity;
    const grossProfit = price - debt;
    
    // Tier 1: Return of capital
    const returnOfCapital = equity;
    
    // Tier 2: Preferred return (simple 1 year)
    const prefReturn = equity * prefRate;
    
    // Tier 3: Catch-up (GP catches up to 50% of pref return)
    const catchUp = prefReturn * 0.5;
    
    // Tier 4: GP Promote (80/20 split of remaining)
    const remaining = grossProfit - returnOfCapital - prefReturn - catchUp;
    const gpCarry = remaining * gpPromote;
    
    // Tier 5: Remaining LP
    const lpRemaining = remaining - gpCarry;
    
    const totalLP = returnOfCapital + prefReturn + catchUp + lpRemaining;
    const totalGP = gpCarry;
    
    document.getElementById('calcResults').innerHTML = `
      <div class="calc-result-row"><span>Gross Sale Price:</span><strong>$${(price/1000000).toFixed(2)}M</strong></div>
      <div class="calc-result-row"><span>Debt Paid Off:</span><strong>$${(debt/1000000).toFixed(2)}M</strong></div>
      <div class="calc-result-row"><span>Gross Profit:</span><strong>$${(grossProfit/1000000).toFixed(2)}M</strong></div>
      <hr>
      <div class="calc-result-row highlight"><span>1. Return of Capital:</span><strong>$${(returnOfCapital/1000000).toFixed(2)}M</strong></div>
      <div class="calc-result-row"><span>2. LP Preferred Return:</span><strong>$${prefReturn.toLocaleString()}</strong></div>
      <div class="calc-result-row"><span>3. LP Catch-Up:</span><strong>$${catchUp.toLocaleString()}</strong></div>
      <div class="calc-result-row highlight"><span>4. GP Promote (${gpPromote*100}%):</span><strong>$${gpCarry.toLocaleString()}</strong></div>
      <div class="calc-result-row"><span>5. Remaining LP:</span><strong>$${lpRemaining.toLocaleString()}</strong></div>
      <hr>
      <div class="calc-result-row total"><span>Total to LPs:</span><strong class="text-success">$${totalLP.toLocaleString()}</strong></div>
      <div class="calc-result-row total"><span>Total to GP:</span><strong class="text-primary">$${totalGP.toLocaleString()}</strong></div>
    `;
  }
};
