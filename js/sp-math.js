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

  return { toCents, fromCents, calculatePref, xirr };
})();
