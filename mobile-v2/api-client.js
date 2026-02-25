// SyndicatePro API Client
const API_BASE_URL = 'https://api.syndicatepro.com';
// const API_BASE_URL = 'http://localhost:3000'; // For local dev

class SyndicateProAPI {
  constructor() {
    this.token = localStorage.getItem('authToken');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
      }

      return await response.json();
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  }

  // Auth
  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setToken(data.token);
    return data;
  }

  async register(email, password, companyName) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, companyName })
    });
    this.setToken(data.token);
    return data;
  }

  // Deals
  async getDeals() {
    return this.request('/api/deals');
  }

  async getDeal(id) {
    return this.request(`/api/deals/${id}`);
  }

  async createDeal(dealData) {
    return this.request('/api/deals', {
      method: 'POST',
      body: JSON.stringify(dealData)
    });
  }

  // Investors
  async getInvestors() {
    return this.request('/api/investors');
  }

  async createInvestor(investorData) {
    return this.request('/api/investors', {
      method: 'POST',
      body: JSON.stringify(investorData)
    });
  }

  // Distributions
  async createDistribution(dealId, totalAmount, distributionType, quarter, year) {
    return this.request('/api/distributions', {
      method: 'POST',
      body: JSON.stringify({ dealId, totalAmount, distributionType, quarter, year })
    });
  }
}

// Initialize API client
const api = new SyndicateProAPI();

// Export for use in other scripts
window.SyndicateProAPI = SyndicateProAPI;
window.api = api;