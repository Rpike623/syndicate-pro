// LocalStorage fallback for simple data persistence
// Used when IndexedDB isn't needed or for cross-page communication

const Storage = {
  // Deals
  saveDeal(deal) {
    const deals = this.getDeals();
    deal.id = deal.id || Date.now().toString();
    deal.updatedAt = new Date().toISOString();
    
    const existingIndex = deals.findIndex(d => d.id === deal.id);
    if (existingIndex >= 0) {
      deals[existingIndex] = deal;
    } else {
      deal.createdAt = deal.createdAt || deal.updatedAt;
      deals.push(deal);
    }
    
    localStorage.setItem('syndicateDeals', JSON.stringify(deals));
    return deal;
  },
  
  getDeals() {
    return JSON.parse(localStorage.getItem('syndicateDeals') || '[]');
  },
  
  getDeal(id) {
    return this.getDeals().find(d => d.id === id);
  },
  
  deleteDeal(id) {
    const deals = this.getDeals().filter(d => d.id !== id);
    localStorage.setItem('syndicateDeals', JSON.stringify(deals));
  },
  
  // Investors
  saveInvestor(investor) {
    const investors = this.getInvestors();
    investor.id = investor.id || Date.now().toString();
    investor.updatedAt = new Date().toISOString();
    
    const existingIndex = investors.findIndex(i => i.id === investor.id);
    if (existingIndex >= 0) {
      investors[existingIndex] = investor;
    } else {
      investor.createdAt = investor.createdAt || investor.updatedAt;
      investors.push(investor);
    }
    
    localStorage.setItem('syndicateInvestors', JSON.stringify(investors));
    return investor;
  },
  
  getInvestors() {
    return JSON.parse(localStorage.getItem('syndicateInvestors') || '[]');
  },
  
  getInvestor(id) {
    return this.getInvestors().find(i => i.id === id);
  },
  
  getInvestorsByDeal(dealId) {
    return this.getInvestors().filter(i => i.dealIds && i.dealIds.includes(dealId));
  },
  
  // Current session
  setCurrentDeal(deal) {
    sessionStorage.setItem('currentDeal', JSON.stringify(deal));
  },
  
  getCurrentDeal() {
    const deal = sessionStorage.getItem('currentDeal');
    return deal ? JSON.parse(deal) : null;
  },
  
  clearCurrentDeal() {
    sessionStorage.removeItem('currentDeal');
  },
  
  // Export/Import
  exportAll() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      deals: this.getDeals(),
      investors: this.getInvestors()
    };
  },
  
  importAll(data) {
    if (data.deals) {
      localStorage.setItem('syndicateDeals', JSON.stringify(data.deals));
    }
    if (data.investors) {
      localStorage.setItem('syndicateInvestors', JSON.stringify(data.investors));
    }
  },
  
  // Clear all data
  clearAll() {
    localStorage.removeItem('syndicateDeals');
    localStorage.removeItem('syndicateInvestors');
    sessionStorage.removeItem('currentDeal');
  }
};

// Currency/number formatters
const Formatters = {
  currency(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  },
  
  percent(value, decimals = 2) {
    return (value || 0).toFixed(decimals) + '%';
  },
  
  number(value) {
    return new Intl.NumberFormat('en-US').format(value || 0);
  },
  
  date(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Storage, Formatters };
}