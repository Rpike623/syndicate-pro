/**
 * storage.js — Legacy compatibility shim
 * Proxies old Storage.* and db.* calls to sp-core.js SP.*
 * Loaded by pages that haven't been fully migrated yet.
 */
const Storage = {
  getDeals: () => (typeof SP !== 'undefined') ? SP.getDeals() : [],
  saveDeals: (d) => (typeof SP !== 'undefined') && SP.saveDeals(d),
  getInvestors: () => (typeof SP !== 'undefined') ? SP.getInvestors() : [],
  saveInvestors: (i) => (typeof SP !== 'undefined') && SP.saveInvestors(i),
};
// Legacy async db shim
const db = {
  getAllDeals: async () => Storage.getDeals(),
  getDeal: async (id) => (typeof SP !== 'undefined') ? SP.getDealById(String(id)) : null,
  getAllInvestors: async () => Storage.getInvestors(),
  getInvestorsByDeal: async (dealId) => {
    const deal = (typeof SP !== 'undefined') ? SP.getDealById(String(dealId)) : null;
    if (!deal) return [];
    return (deal.investors || []).map(e => {
      const inv = SP.getInvestorById(e.investorId) || {};
      return { ...inv, ...e, name: `${inv.firstName||''} ${inv.lastName||''}`.trim() || inv.email || 'Unknown' };
    });
  },
};
