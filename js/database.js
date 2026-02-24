/**
 * SyndicatePro - Data Layer
 * Handles persistence, deals, documents, and investors
 */

const DB_NAME = 'SyndicateProDB';
const DB_VERSION = 1;

class SyndicateDB {
  constructor() {
    this.db = null;
    this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Deals store
        if (!db.objectStoreNames.contains('deals')) {
          const dealStore = db.createObjectStore('deals', { keyPath: 'id', autoIncrement: true });
          dealStore.createIndex('name', 'name', { unique: false });
          dealStore.createIndex('createdAt', 'createdAt', { unique: false });
          dealStore.createIndex('status', 'status', { unique: false });
        }
        
        // Investors store
        if (!db.objectStoreNames.contains('investors')) {
          const investorStore = db.createObjectStore('investors', { keyPath: 'id', autoIncrement: true });
          investorStore.createIndex('email', 'email', { unique: true });
          investorStore.createIndex('accredited', 'accredited', { unique: false });
        }
        
        // Documents store
        if (!db.objectStoreNames.contains('documents')) {
          const docStore = db.createObjectStore('documents', { keyPath: 'id', autoIncrement: true });
          docStore.createIndex('dealId', 'dealId', { unique: false });
          docStore.createIndex('type', 'type', { unique: false });
          docStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        
        // Distributions store
        if (!db.objectStoreNames.contains('distributions')) {
          const distStore = db.createObjectStore('distributions', { keyPath: 'id', autoIncrement: true });
          distStore.createIndex('dealId', 'dealId', { unique: false });
          distStore.createIndex('date', 'date', { unique: false });
        }
      };
    });
  }

  // Deals CRUD
  async saveDeal(deal) {
    await this.ensureInit();
    const tx = this.db.transaction(['deals'], 'readwrite');
    const store = tx.objectStore('deals');
    
    const dealData = {
      ...deal,
      updatedAt: new Date().toISOString(),
      createdAt: deal.createdAt || new Date().toISOString()
    };
    
    return new Promise((resolve, reject) => {
      const request = deal.id ? store.put(dealData) : store.add(dealData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getDeal(id) {
    await this.ensureInit();
    const tx = this.db.transaction(['deals'], 'readonly');
    const store = tx.objectStore('deals');
    
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllDeals() {
    await this.ensureInit();
    const tx = this.db.transaction(['deals'], 'readonly');
    const store = tx.objectStore('deals');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteDeal(id) {
    await this.ensureInit();
    const tx = this.db.transaction(['deals'], 'readwrite');
    const store = tx.objectStore('deals');
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Investors CRUD
  async saveInvestor(investor) {
    await this.ensureInit();
    const tx = this.db.transaction(['investors'], 'readwrite');
    const store = tx.objectStore('investors');
    
    const investorData = {
      ...investor,
      updatedAt: new Date().toISOString(),
      createdAt: investor.createdAt || new Date().toISOString()
    };
    
    return new Promise((resolve, reject) => {
      const request = investor.id ? store.put(investorData) : store.add(investorData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllInvestors() {
    await this.ensureInit();
    const tx = this.db.transaction(['investors'], 'readonly');
    const store = tx.objectStore('investors');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getInvestorsByDeal(dealId) {
    const investors = await this.getAllInvestors();
    return investors.filter(inv => inv.dealIds && inv.dealIds.includes(dealId));
  }

  // Documents CRUD
  async saveDocument(doc) {
    await this.ensureInit();
    const tx = this.db.transaction(['documents'], 'readwrite');
    const store = tx.objectStore('documents');
    
    const docData = {
      ...doc,
      updatedAt: new Date().toISOString(),
      createdAt: doc.createdAt || new Date().toISOString()
    };
    
    return new Promise((resolve, reject) => {
      const request = doc.id ? store.put(docData) : store.add(docData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getDocumentsByDeal(dealId) {
    await this.ensureInit();
    const tx = this.db.transaction(['documents'], 'readonly');
    const store = tx.objectStore('documents');
    const index = store.index('dealId');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(dealId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Distributions
  async recordDistribution(distribution) {
    await this.ensureInit();
    const tx = this.db.transaction(['distributions'], 'readwrite');
    const store = tx.objectStore('distributions');
    
    const distData = {
      ...distribution,
      createdAt: new Date().toISOString()
    };
    
    return new Promise((resolve, reject) => {
      const request = store.add(distData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getDistributionsByDeal(dealId) {
    await this.ensureInit();
    const tx = this.db.transaction(['distributions'], 'readonly');
    const store = tx.objectStore('distributions');
    const index = store.index('dealId');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(dealId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Export/Import
  async exportAllData() {
    const [deals, investors, documents, distributions] = await Promise.all([
      this.getAllDeals(),
      this.getAllInvestors(),
      this.getAllDocuments(),
      this.getAllDistributions()
    ]);
    
    return {
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      deals,
      investors,
      documents,
      distributions
    };
  }

  async getAllDocuments() {
    await this.ensureInit();
    const tx = this.db.transaction(['documents'], 'readonly');
    const store = tx.objectStore('documents');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllDistributions() {
    await this.ensureInit();
    const tx = this.db.transaction(['distributions'], 'readonly');
    const store = tx.objectStore('distributions');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async importData(data) {
    await this.ensureInit();
    
    if (data.deals) {
      for (const deal of data.deals) {
        await this.saveDeal(deal);
      }
    }
    
    if (data.investors) {
      for (const investor of data.investors) {
        await this.saveInvestor(investor);
      }
    }
    
    if (data.documents) {
      for (const doc of data.documents) {
        await this.saveDocument(doc);
      }
    }
    
    if (data.distributions) {
      for (const dist of data.distributions) {
        await this.recordDistribution(dist);
      }
    }
  }

  async ensureInit() {
    if (!this.db) {
      await this.init();
    }
  }
}

// Waterfall Calculator Class
class WaterfallCalculator {
  static calculate(deal) {
    const {
      totalEquity,
      gpEquityPct,
      lpEquityPct,
      prefReturn,
      gpPromotePct,
      catchupRate,
      exitMultiple,
      holdPeriod
    } = deal;

    const totalProceeds = totalEquity * (exitMultiple || 1.8);
    const profit = totalProceeds - totalEquity;
    
    let remainingCash = totalProceeds;
    const waterfall = [];
    
    // Tier 1: Return of Capital
    const rocAmount = Math.min(remainingCash, totalEquity);
    remainingCash -= rocAmount;
    
    const rocToGP = rocAmount * (gpEquityPct / 100);
    const rocToLP = rocAmount - rocToGP;
    
    waterfall.push({
      tier: 1,
      name: 'Return of Capital',
      total: rocAmount,
      gp: rocToGP,
      lp: rocToLP,
      description: 'Initial investment returned pro-rata'
    });
    
    // Tier 2: Preferred Return (if applicable)
    let prefAmount = 0;
    let prefToLP = 0;
    
    if (deal.waterfallType !== 'simple' && prefReturn > 0) {
      const lpEquity = totalEquity * (lpEquityPct / 100);
      const prefPool = lpEquity * (Math.pow(1 + prefReturn/100, holdPeriod || 5) - 1);
      prefAmount = Math.min(remainingCash, prefPool);
      prefToLP = prefAmount;
      remainingCash -= prefAmount;
      
      waterfall.push({
        tier: 2,
        name: 'Preferred Return',
        total: prefAmount,
        gp: 0,
        lp: prefToLP,
        description: `${prefReturn}% hurdle to LPs`
      });
    }
    
    // Tier 3: GP Catch-Up (if applicable)
    let catchupAmount = 0;
    let catchupToGP = 0;
    
    if (deal.waterfallType === 'catchup' && remainingCash > 0) {
      const targetGPProfit = profit * (gpPromotePct / 100);
      const currentGPProfit = rocToGP;
      const gpShortfall = Math.max(0, targetGPProfit - currentGPProfit);
      
      if (gpShortfall > 0 && catchupRate > 0) {
        const catchupPool = gpShortfall / (catchupRate / 100);
        catchupAmount = Math.min(remainingCash, catchupPool);
        catchupToGP = catchupAmount * (catchupRate / 100);
        remainingCash -= catchupAmount;
        
        waterfall.push({
          tier: 3,
          name: 'GP Catch-Up',
          total: catchupAmount,
          gp: catchupToGP,
          lp: catchupAmount - catchupToGP,
          description: `${catchupRate}% to GP`
        });
      }
    }
    
    // Tier 4: Residual Split
    let residualToGP = 0;
    let residualToLP = 0;
    
    if (remainingCash > 0) {
      residualToGP = remainingCash * (gpPromotePct / 100);
      residualToLP = remainingCash - residualToGP;
      
      waterfall.push({
        tier: 4,
        name: 'Residual Split',
        total: remainingCash,
        gp: residualToGP,
        lp: residualToLP,
        description: `${gpPromotePct}/${100-gpPromotePct} GP/LP split`
      });
      
      remainingCash = 0;
    }
    
    // Calculate totals
    const gpTotal = rocToGP + catchupToGP + residualToGP;
    const lpTotal = totalProceeds - gpTotal;
    
    const gpInvestment = totalEquity * (gpEquityPct / 100);
    const lpInvestment = totalEquity - gpInvestment;
    
    const gpMultiple = gpInvestment > 0 ? gpTotal / gpInvestment : 0;
    const lpMultiple = lpInvestment > 0 ? lpTotal / lpInvestment : 0;
    
    const gpIRR = gpInvestment > 0 
      ? (Math.pow(gpMultiple, 1/(holdPeriod || 5)) - 1) * 100 
      : 0;
    const lpIRR = lpInvestment > 0 
      ? (Math.pow(lpMultiple, 1/(holdPeriod || 5)) - 1) * 100 
      : 0;
    
    return {
      waterfall,
      summary: {
        totalProceeds,
        totalEquity,
        profit,
        gpTotal,
        lpTotal,
        gpInvestment,
        lpInvestment,
        gpMultiple,
        lpMultiple,
        gpIRR,
        lpIRR
      }
    };
  }
}

// Initialize global instance
const db = new SyndicateDB();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SyndicateDB, WaterfallCalculator };
}