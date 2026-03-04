/**
 * sp-reit.js — Institutional REIT & Fund-Level Rollup Engine
 * Aggregates individual syndications into a master fund/REIT structure.
 */

const SPREIT = (() => {
  function calculateNAV(deals) {
    // Net Asset Value calculation logic
    const totalAUM = deals.reduce((s, d) => s + (d.valuation || d.purchasePrice || 0), 0);
    const totalDebt = deals.reduce((s, d) => s + (d.loanAmount || 0), 0);
    return totalAUM - totalDebt;
  }

  function getPerformanceMatrix(deals) {
    return deals.map(d => ({
      name: d.name,
      yield: d.currentYield || 0,
      occupancy: d.occupancy || 95,
      risk: d.riskScore || 'Low'
    }));
  }

  return { calculateNAV, getPerformanceMatrix };
})();
