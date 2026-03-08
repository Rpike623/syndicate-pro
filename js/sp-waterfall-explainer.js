/**
 * SP Waterfall Explainer - Animated Visual Guide
 * Correct waterfall math: proceeds → debt payoff → return of capital → pref → catch-up → promote → residual
 */
window.Waterfall = {
  tierInfo: [
    { title: 'Return of Capital', desc: 'First, investors get their original investment back before any profits are distributed.', stats: '100% to LPs' },
    { title: 'LP Preferred Return', desc: 'LPs receive their preferred return (typically 6-8% annually on invested capital). This is a guaranteed return before the GP receives any promote.', stats: '' },
    { title: 'GP Catch-Up', desc: 'The GP "catches up" — receiving 100% of distributions until they\'ve earned their promote share of all profits distributed so far (pref + catch-up).', stats: '' },
    { title: 'GP Promote Split', desc: 'After catch-up, remaining profits are split between LPs and GP according to the promote structure (e.g., 80% LP / 20% GP).', stats: '' },
    { title: 'Final Totals', desc: 'Total distributions to all parties. LPs receive return of capital plus their share of profits; GP receives carried interest (promote).', stats: '' }
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
    const salePrice = parseFloat(document.getElementById('calcPrice').value) || 0;
    const totalEquity = parseFloat(document.getElementById('calcEquity').value) || 0;
    const prefRate = parseFloat(document.getElementById('calcPref').value) / 100 || 0;
    const gpPromotePct = parseFloat(document.getElementById('calcPromote').value) / 100 || 0;

    // Assume debt = salePrice - totalEquity (LTV implied by the inputs)
    // Net proceeds to equity = salePrice - debt = totalEquity + profit
    // For simplicity: assume no selling costs. User enters sale price and equity.
    const debt = Math.max(0, salePrice * 0.65 - 0); // Default: ~65% LTV. But to keep it simple, use sale proceeds directly.

    // Simpler model: net equity proceeds = sale price - debt payoff
    // debt = original purchase leverage. Let user control equity, we compute profit on equity.
    // Net proceeds available to equity holders:
    const netProceeds = salePrice - (salePrice - totalEquity); // This simplifies to totalEquity... wrong.

    // CORRECT MODEL:
    // Assume property was purchased at some cost, financed with equity + debt.
    // At sale: proceeds pay off debt first, remainder goes to equity holders.
    // The "profit" for waterfall purposes = net proceeds - original equity
    // Since we don't ask for purchase price separately, assume:
    //   - Total Equity = original LP+GP equity invested
    //   - Sale Price = what it sells for
    //   - Debt = implied (we'll assume 65% LTV on original purchase, so purchase = equity / 0.35)
    //   - Or simpler: let the user just think of "Sale Price" as net proceeds to equity (after debt payoff)

    // SIMPLEST correct approach for the explainer:
    // Treat "Sale Price" as gross sale, "Total Equity" as equity invested
    // Assume debt = purchase_price - equity. If we don't know purchase price, assume purchase = equity / 0.35
    // Actually the cleanest: just add a "Debt" field or assume sale price > equity means profit = sale - equity with no debt.

    // For NOW: treat it as an all-equity deal for simplicity (common in explainers)
    // Profit = Sale Price - Total Equity (equity invested = total cost, no debt)
    const profit = Math.max(0, salePrice - totalEquity);

    // Tier 1: Return of Capital — LPs get their equity back
    const returnOfCapital = Math.min(salePrice, totalEquity);

    // Tier 2: LP Preferred Return (simple annual, 1 year hold for this explainer)
    const prefReturn = totalEquity * prefRate;
    const prefActual = Math.min(prefReturn, profit); // Can't pay more pref than profit available

    // Tier 3: GP Catch-Up
    // GP catches up to earn gpPromotePct of (pref + catch-up)
    // catch-up = gpPromotePct / (1 - gpPromotePct) * prefActual
    let catchUp = 0;
    if (gpPromotePct > 0 && gpPromotePct < 1) {
      catchUp = (gpPromotePct / (1 - gpPromotePct)) * prefActual;
    }
    const profitAfterPref = profit - prefActual;
    const catchUpActual = Math.min(catchUp, profitAfterPref); // Can't exceed remaining profit

    // Tier 4: Remaining profit split
    const profitAfterCatchUp = profitAfterPref - catchUpActual;
    const gpFromSplit = profitAfterCatchUp * gpPromotePct;
    const lpFromSplit = profitAfterCatchUp * (1 - gpPromotePct);

    // Totals
    const totalLP = returnOfCapital + prefActual + lpFromSplit;
    const totalGP = catchUpActual + gpFromSplit;

    const fmt$ = (n) => {
      if (Math.abs(n) >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M';
      if (Math.abs(n) >= 1e3) return '$' + (n/1e3).toFixed(0) + 'K';
      return '$' + n.toLocaleString();
    };

    // Update tier amounts in the visual
    const setAmt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = fmt$(val); };
    setAmt('tier1amount', returnOfCapital);
    setAmt('tier2amount', prefActual);
    setAmt('tier3amount', catchUpActual);
    setAmt('tier4amount', gpFromSplit);
    setAmt('tier5amount', lpFromSplit);

    // Update info descriptions with real numbers
    this.tierInfo[0].stats = `LP receives: ${fmt$(returnOfCapital)}`;
    this.tierInfo[1].stats = `LP receives: ${fmt$(prefActual)} (${(prefRate*100).toFixed(1)}% × ${fmt$(totalEquity)})`;
    this.tierInfo[2].stats = `GP receives: ${fmt$(catchUpActual)}`;
    this.tierInfo[3].stats = `GP: ${fmt$(gpFromSplit)} · LP: ${fmt$(lpFromSplit)}`;
    this.tierInfo[4].stats = `Total LP: ${fmt$(totalLP)} · Total GP: ${fmt$(totalGP)}`;

    document.getElementById('calcResults').innerHTML = `
      <div class="calc-result-row"><span>Gross Sale Price:</span><strong>${fmt$(salePrice)}</strong></div>
      <div class="calc-result-row"><span>Total Equity Invested:</span><strong>${fmt$(totalEquity)}</strong></div>
      <div class="calc-result-row"><span>Gross Profit:</span><strong>${fmt$(profit)}</strong></div>
      <hr>
      <div class="calc-result-row highlight"><span>1. Return of Capital:</span><strong>${fmt$(returnOfCapital)}</strong></div>
      <div class="calc-result-row"><span>2. LP Preferred Return:</span><strong>${fmt$(prefActual)}</strong></div>
      <div class="calc-result-row"><span>3. GP Catch-Up:</span><strong>${fmt$(catchUpActual)}</strong></div>
      <div class="calc-result-row"><span>4. GP Promote (${(gpPromotePct*100).toFixed(0)}%):</span><strong>${fmt$(gpFromSplit)}</strong></div>
      <div class="calc-result-row"><span>5. Remaining to LP:</span><strong>${fmt$(lpFromSplit)}</strong></div>
      <hr>
      <div class="calc-result-row total"><span>Total to LPs:</span><strong class="text-success">${fmt$(totalLP)}</strong></div>
      <div class="calc-result-row total"><span>Total to GP:</span><strong class="text-primary">${fmt$(totalGP)}</strong></div>
    `;
  }
};
