/**
 * js/sp-math.js — deeltrack Financial Precision Library
 * Handles compounding interest, XIRR calculations, and floating point safety.
 */

const SPMath = (() => {
  
  // 1. Floating Point Safety (Cents-based math)
  function toCents(dollars) { return Math.round(dollars * 100); }
  function fromCents(cents) { return cents / 100; }

  // 2. Compounding Preferred Return
  // Formula: P = C * (1 + r/n)^(nt)
  function calculatePref(capital, rate, years, compoundingPerYear = 1) {
    const r = rate / 100;
    const n = compoundingPerYear;
    return capital * Math.pow((1 + r/n), (n * years)) - capital;
  }

  // 3. XIRR Approximation (Newton-Raphson method)
  function xirr(cashflows, dates, estimate = 0.1) {
    let result = estimate;
    for (let i = 0; i < 20; i++) {
        let f = 0;
        let df = 0;
        for (let j = 0; j < cashflows.length; j++) {
            const days = (dates[j] - dates[0]) / (365 * 24 * 60 * 60 * 1000);
            f += cashflows[j] / Math.pow(1 + result, days);
            df -= days * cashflows[j] / Math.pow(1 + result, days + 1);
        }
        result -= f / df;
    }
    return result;
  }

  // 4. Per-Distribution Pref Tracker
  // Given a deal and a list of prior distributions, compute each investor's
  // accrued preferred return and how much remains unpaid.
  //
  // deal: { prefReturn (%), investors: [{investorId, amount, ownership}] }
  // priorDists: array of distributions for this deal (each with .recipients[])
  // newAmount: total new distribution amount
  // periodYears: fraction of year this distribution covers (default: 0.25 = quarterly)
  //
  // Returns array of per-investor pref objects:
  // { investorId, invested, annualPref, periodPrefAccrued, prefPaidToDate, prefRemainingBeforeDist,
  //   prefPaidThisDist, excessThisDist, totalThisDist }
  function computePrefSplits(deal, priorDists, newAmount, periodYears = 0.25) {
    const prefRate = parseFloat(deal.prefReturn || deal.wizardData?.prefReturn || 0);
    const investors = deal.investors || [];
    if (!investors.length) return [];

    // Sum prior pref payments per investor
    const priorPrefById = {};
    (priorDists || []).forEach(dist => {
      (dist.recipients || []).forEach(r => {
        if (r.prefPaidThisDist) {
          priorPrefById[r.investorId] = (priorPrefById[r.investorId] || 0) + r.prefPaidThisDist;
        }
      });
    });

    // Compute total LP equity (for pro-rata excess split)
    const totalLPEquity = investors.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
    let remaining = newAmount;

    // Pass 1: satisfy pref for each investor
    const results = investors.map(inv => {
      const invested = parseFloat(inv.amount) || 0;
      const annualPref = prefRate > 0 ? invested * (prefRate / 100) : 0;
      const periodPrefAccrued = annualPref * periodYears;
      const prefPaidToDate = priorPrefById[inv.investorId] || 0;
      // Total accrued pref up through end of this period (simple, non-compounding)
      // For ongoing tracking we just look at this period's accrual
      const prefRemainingBeforeDist = Math.max(0, periodPrefAccrued - prefPaidToDate);

      return {
        investorId: inv.investorId,
        invested,
        annualPref,
        periodPrefAccrued,
        prefPaidToDate,
        prefRemainingBeforeDist,
        ownership: inv.ownership || (totalLPEquity > 0 ? (invested / totalLPEquity * 100) : 0),
        prefPaidThisDist: 0,
        excessThisDist: 0,
        totalThisDist: 0,
      };
    });

    // Pass 2: fill pref buckets first
    const totalPrefNeeded = results.reduce((s, r) => s + r.prefRemainingBeforeDist, 0);
    const prefPool = Math.min(remaining, totalPrefNeeded);
    remaining -= prefPool;

    results.forEach(r => {
      if (totalPrefNeeded > 0) {
        r.prefPaidThisDist = parseFloat(((prefPool * r.prefRemainingBeforeDist / totalPrefNeeded) || 0).toFixed(2));
      }
    });

    // Pass 3: distribute excess pro-rata by ownership
    const totalOwnership = results.reduce((s, r) => s + r.ownership, 0);
    results.forEach(r => {
      const ownershipFraction = totalOwnership > 0 ? r.ownership / totalOwnership : 0;
      r.excessThisDist = parseFloat((remaining * ownershipFraction).toFixed(2));
      r.totalThisDist = parseFloat((r.prefPaidThisDist + r.excessThisDist).toFixed(2));
      r.prefRemaining = parseFloat(Math.max(0, r.prefRemainingBeforeDist - r.prefPaidThisDist).toFixed(2));
    });

    return results;
  }

  return { toCents, fromCents, calculatePref, xirr, computePrefSplits };
})();
