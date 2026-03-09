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
    return capital * Math.pow((1 + r / n), (n * years)) - capital;
  }

  // 3. XIRR Approximation (Newton-Raphson method)
  function xirr(cashflows, dates, estimate = 0.1) {
    if (!cashflows || !dates || cashflows.length < 2 || cashflows.length !== dates.length) return 0;
    // Guard: if all cashflows are zero or no positive cashflows, return 0 or -1
    if (cashflows.every(c => c === 0)) return 0;
    const hasPositive = cashflows.some(c => c > 0);
    const hasNegative = cashflows.some(c => c < 0);
    if (!hasPositive && hasNegative) return -1; // total loss
    if (hasPositive && !hasNegative) return Infinity; // free money (shouldn't happen)
    let result = estimate;
    for (let i = 0; i < 100; i++) {
      let f = 0, df = 0;
      for (let j = 0; j < cashflows.length; j++) {
        const days = (dates[j] - dates[0]) / (365 * 24 * 60 * 60 * 1000);
        const denom = Math.pow(1 + result, days);
        if (!isFinite(denom) || denom === 0) { result = estimate * 0.5; break; }
        f  += cashflows[j] / denom;
        df -= days * cashflows[j] / Math.pow(1 + result, days + 1);
      }
      if (df === 0 || !isFinite(df)) break; // avoid division by zero
      const delta = f / df;
      result -= delta;
      if (!isFinite(result)) return 0; // diverged
      if (Math.abs(delta) < 1e-8) break; // converged
    }
    return isFinite(result) ? result : 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Core Pref Engine — computePrefSplits()
  //
  // This is the single source of truth for how a distribution is split among
  // investors given a deal's terms and the full history of prior posted
  // distributions.
  //
  // Rules:
  //   - Only POSTED distributions count as prior history (status === 'posted').
  //   - Pref accrues from each investor's linkedAt date (or deal.closeDate) to
  //     the distribution date, non-compounding, simple interest.
  //   - Distribution amount first satisfies all outstanding accrued-but-unpaid
  //     preferred return across all investors (pro-rata among those with pref
  //     outstanding if the pool is insufficient).
  //   - Any amount beyond pref (excess) is split pro-rata by LP ownership %.
  //   - GP promote applies only to exit waterfalls (handled by WaterfallCalculator),
  //     not to periodic distributions (which just address pref + pro-rata excess).
  //
  // Inputs:
  //   deal        — full deal object from SPData/SP
  //                 Required fields: prefReturn, investors[], closeDate (or fallback)
  //   postedDists — array of ALL prior distributions for this deal where status === 'posted'
  //   newAmount   — total dollar amount of the new distribution
  //   distDate    — JS Date (or ISO string) of this distribution; defaults to today
  //
  // Returns array of per-investor pref objects:
  //   { investorId, name, invested, ownership,
  //     daysHeld, yearsHeld,
  //     totalPrefAccrued,     // total pref accrued since linkedAt → distDate
  //     prefPaidToDate,       // sum of prefPaidThisDist across all prior posted dists
  //     prefRemainingBeforeDist,
  //     prefPaidThisDist,     // how much of THIS dist goes toward pref
  //     excessThisDist,       // how much of THIS dist is above-pref split
  //     prefPaidAfterDist,    // prefPaidToDate + prefPaidThisDist
  //     prefRemainingAfterDist,
  //     totalThisDist }
  // ─────────────────────────────────────────────────────────────────────────
  function computePrefSplits(deal, postedDists, newAmount, distDate) {
    const prefRate    = parseFloat(deal.prefReturn || deal.wizardData?.prefReturn || 0);
    const investors   = deal.investors || [];
    if (!investors.length) return [];

    const distMs = distDate
      ? new Date(distDate).getTime()
      : Date.now();

    // Fallback deal start: closeDate > acquisitionDate > added > 2 years ago
    const dealStartIso = deal.closeDate || deal.acquisitionDate || deal.added || null;
    const dealStartMs  = dealStartIso
      ? new Date(dealStartIso).getTime()
      : distMs - (2 * 365.25 * 24 * 3600 * 1000);

    // Sum prior POSTED pref payments per investor
    const priorPrefById = {};
    (postedDists || []).forEach(dist => {
      if (dist.status !== 'posted') return;
      (dist.recipients || []).forEach(r => {
        priorPrefById[r.investorId] = (priorPrefById[r.investorId] || 0)
          + (r.prefPaidThisDist || 0);
      });
    });

    // Compute total LP equity for pro-rata fallback
    const totalLPCommitted = investors.reduce((sum, inv) => {
      return sum + (parseFloat(inv.committed || inv.amount || 0));
    }, 0);

    let remaining = newAmount;

    // Pass 1 — compute each investor's pref accrual
    const results = investors.map(inv => {
      // Guard: strip commas from committed amounts, handle missing values
      const rawCommitted = String(inv.committed || inv.amount || 0).replace(/,/g, '');
      const invested = parseFloat(rawCommitted) || 0;
      // Pref clock starts when investor funded, or deal close
      let invStartMs = dealStartMs;
      if (inv.linkedAt) {
        const parsed = new Date(inv.linkedAt).getTime();
        if (isFinite(parsed)) invStartMs = parsed; // only use if valid date
      }
      const holdMs    = Math.max(0, distMs - invStartMs);
      const daysHeld  = holdMs / (24 * 3600 * 1000);
      const yearsHeld = daysHeld / 365.25;

      // Simple (non-compounding) annual pref
      const totalPrefAccrued = prefRate > 0
        ? parseFloat((invested * (prefRate / 100) * yearsHeld).toFixed(2))
        : 0;

      const prefPaidToDate = parseFloat((priorPrefById[inv.investorId] || 0).toFixed(2));
      const prefRemainingBeforeDist = parseFloat(Math.max(0, totalPrefAccrued - prefPaidToDate).toFixed(2));

      // Ownership: use stored %, else compute from committed amounts
      const ownership = parseFloat(inv.ownership)
        || (totalLPCommitted > 0 ? parseFloat((invested / totalLPCommitted * 100).toFixed(4)) : 0);

      return {
        investorId: inv.investorId,
        invested,
        ownership,
        daysHeld: Math.round(daysHeld),
        yearsHeld: parseFloat(yearsHeld.toFixed(4)),
        totalPrefAccrued,
        prefPaidToDate,
        prefRemainingBeforeDist,
        prefPaidThisDist: 0,
        excessThisDist: 0,
        prefPaidAfterDist: 0,
        prefRemainingAfterDist: 0,
        totalThisDist: 0,
      };
    });

    // Pass 2 — fill pref buckets (pro-rata among those with outstanding pref)
    const totalPrefNeeded = results.reduce((s, r) => s + r.prefRemainingBeforeDist, 0);
    const prefPool = Math.min(remaining, totalPrefNeeded);
    remaining = parseFloat((remaining - prefPool).toFixed(2));

    results.forEach(r => {
      if (totalPrefNeeded > 0 && r.prefRemainingBeforeDist > 0) {
        r.prefPaidThisDist = parseFloat(
          (prefPool * (r.prefRemainingBeforeDist / totalPrefNeeded)).toFixed(2)
        );
      }
    });

    // Pass 3 — distribute excess pro-rata by LP ownership %
    const totalOwnership = results.reduce((s, r) => s + r.ownership, 0);
    results.forEach(r => {
      const ownershipFrac = totalOwnership > 0 ? r.ownership / totalOwnership : 0;
      r.excessThisDist           = parseFloat((remaining * ownershipFrac).toFixed(2));
      r.totalThisDist            = parseFloat((r.prefPaidThisDist + r.excessThisDist).toFixed(2));
      r.prefPaidAfterDist        = parseFloat((r.prefPaidToDate + r.prefPaidThisDist).toFixed(2));
      r.prefRemainingAfterDist   = parseFloat(Math.max(0, r.prefRemainingBeforeDist - r.prefPaidThisDist).toFixed(2));
    });

    // Pass 4 — penny reconciliation: ensure sum of totalThisDist === newAmount exactly
    const distSum = results.reduce((s, r) => s + r.totalThisDist, 0);
    const diff = parseFloat((newAmount - distSum).toFixed(2));
    if (diff !== 0 && results.length > 0) {
      // Apply rounding diff to the largest investor (least % impact)
      const largest = results.reduce((a, b) => b.totalThisDist > a.totalThisDist ? b : a);
      largest.excessThisDist = parseFloat((largest.excessThisDist + diff).toFixed(2));
      largest.totalThisDist  = parseFloat((largest.prefPaidThisDist + largest.excessThisDist).toFixed(2));
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Capital Account summary for one investor in one deal
  //
  // Returns:
  //   { invested, prefRate, totalPrefAccrued, prefPaidToDate,
  //     prefRemainingToDate, totalDistributed, excessReceived,
  //     netROC (total distributions as % of invested) }
  // ─────────────────────────────────────────────────────────────────────────
  function capitalAccount(deal, investor, postedDists, asOfDate) {
    const asOfMs = asOfDate ? new Date(asOfDate).getTime() : Date.now();

    // Run computePrefSplits with $0 new amount just to get accrual state
    const snap = computePrefSplits(deal, postedDists, 0, new Date(asOfMs));
    const inv  = snap.find(s => s.investorId === investor.id || s.investorId === investor.investorId);
    if (!inv) return null;

    const totalDistributed = postedDists.reduce((s, d) => {
      const rec = (d.recipients || []).find(r => r.investorId === (investor.id || investor.investorId));
      return s + (rec ? (rec.totalThisDist || rec.amount || 0) : 0);
    }, 0);

    const excessReceived = postedDists.reduce((s, d) => {
      const rec = (d.recipients || []).find(r => r.investorId === (investor.id || investor.investorId));
      return s + (rec ? (rec.excessThisDist || 0) : 0);
    }, 0);

    return {
      invested:            inv.invested,
      prefRate:            parseFloat(deal.prefReturn || 0),
      totalPrefAccrued:    inv.totalPrefAccrued,
      prefPaidToDate:      inv.prefPaidToDate,
      prefRemainingToDate: inv.prefRemainingBeforeDist,
      totalDistributed:    parseFloat(totalDistributed.toFixed(2)),
      excessReceived:      parseFloat(excessReceived.toFixed(2)),
      netROC:              inv.invested > 0
        ? parseFloat(((totalDistributed / inv.invested) * 100).toFixed(2))
        : 0,
    };
  }

  return { toCents, fromCents, calculatePref, xirr, computePrefSplits, capitalAccount };
})();
