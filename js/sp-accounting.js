/**
 * SPAccounting - Fund Accounting Module
 * Income/Expense tracking, P&L, Cash Flow per deal
 */

const INCOME_CATEGORIES = [
  'Rental Income',
  'Sale Proceeds',
  'Distribution Received',
  'Other Income'
];

const EXPENSE_CATEGORIES = [
  'Operating Expenses',
  'Capital Improvements',
  'Management Fees',
  'Interest Expense',
  'Property Taxes',
  'Insurance',
  'Other Expenses'
];

window.SPAccounting = {
  deals: [],
  currentDeal: null,
  transactions: [],
  categories: {
    income: INCOME_CATEGORIES,
    expense: EXPENSE_CATEGORIES
  },

  init: async function() {
    await this.loadDeals();
    this.toggleCategories();
    
    // Set default date to today
    document.getElementById('txDate').value = new Date().toISOString().split('T')[0];
  },

  loadDeals: async function() {
    const select = document.getElementById('dealSelect');
    
    // Load from SP deals
    const deals = SP.getDeals ? SP.getDeals() : [];
    
    // Add manual entries if any
    const manualDeals = [
      { id: 'manual_1', name: 'Downtown Office Complex', address: '123 Main St' },
      { id: 'manual_2', name: 'Sunset Apartments', address: '456 Oak Ave' },
      { id: 'manual_3', name: 'Industrial Warehouse', address: '789 Industrial Blvd' }
    ];
    
    this.deals = [...deals, ...manualDeals];
    
    // Populate select
    select.innerHTML = '<option value="">-- Select a Deal --</option>';
    this.deals.forEach(deal => {
      const opt = document.createElement('option');
      opt.value = deal.id;
      opt.textContent = deal.name || deal.propertyName || deal.id;
      select.appendChild(opt);
    });
  },

  loadDeal: async function() {
    const dealId = document.getElementById('dealSelect').value;
    if (!dealId) {
      document.getElementById('pnlCard').style.display = 'none';
      document.getElementById('cfCard').style.display = 'none';
      document.getElementById('txCard').style.display = 'none';
      return;
    }

    this.currentDeal = this.deals.find(d => d.id === dealId);
    await this.loadTransactions(dealId);
    this.calculatePNL();
    this.calculateCashFlow();
    this.renderTransactions();
    
    document.getElementById('pnlCard').style.display = 'block';
    document.getElementById('cfCard').style.display = 'block';
    document.getElementById('txCard').style.display = 'block';
  },

  loadTransactions: async function(dealId) {
    // Try Firestore first
    if (window.SPFB && SPFB.db) {
      try {
        const orgId = SP.getOrgId();
        const snapshot = await SPFB.db.collection('orgs').doc(orgId)
          .collection('accounting').doc(dealId).collection('transactions')
          .orderBy('date', 'desc').get();
        
        if (!snapshot.empty) {
          this.transactions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          return;
        }
      } catch(e) {
        console.log('Firestore lookup failed, trying localStorage:', e);
      }
    }
    
    // Fallback to localStorage with demo data
    const key = `sp_accounting_${dealId}`;
    const stored = localStorage.getItem(key);
    
    if (stored) {
      this.transactions = JSON.parse(stored);
    } else {
      // Seed demo data
      this.transactions = this.generateDemoData(dealId);
      this.saveToStorage(dealId);
    }
  },

  generateDemoData: function(dealId) {
    const now = new Date();
    const year = now.getFullYear();
    
    return [
      { id: '1', type: 'income', category: 'Rental Income', description: 'January Rent Collection', amount: 45000, date: `${year}-01-01`, notes: 'Occupancy: 95%' },
      { id: '2', type: 'income', category: 'Rental Income', description: 'February Rent Collection', amount: 45200, date: `${year}-02-01`, notes: '' },
      { id: '3', type: 'income', category: 'Rental Income', description: 'March Rent Collection', amount: 45200, date: `${year}-03-01`, notes: '' },
      { id: '4', type: 'expense', category: 'Operating Expenses', description: 'Property Management Fee', amount: 4500, date: `${year}-01-15`, notes: '3% of gross' },
      { id: '5', type: 'expense', category: 'Operating Expenses', description: 'Utilities - Common Areas', amount: 2100, date: `${year}-01-20`, notes: '' },
      { id: '6', type: 'expense', category: 'Property Taxes', description: 'Q1 Property Tax Installment', amount: 12500, date: `${year}-01-31`, notes: '' },
      { id: '7', type: 'expense', category: 'Insurance', description: 'Commercial Property Insurance', amount: 8500, date: `${year}-02-01`, notes: 'Annual premium' },
      { id: '8', type: 'expense', category: 'Capital Improvements', description: 'HVAC Unit Replacement', amount: 18000, date: `${year}-02-15`, notes: 'Unit #3' },
      { id: '9', type: 'expense', category: 'Interest Expense', description: 'Mortgage Payment - Interest', amount: 22000, date: `${year}-02-28`, notes: 'Prime + 2%' },
      { id: '10', type: 'income', category: 'Other Income', description: 'Parking Income', amount: 3200, date: `${year}-02-28`, notes: '' },
      { id: '11', type: 'expense', category: 'Operating Expenses', description: 'Repairs & Maintenance', amount: 3800, date: `${year}-03-05`, notes: 'Unit turnovers' },
      { id: '12', type: 'expense', category: 'Management Fees', description: 'Asset Management Fee', amount: 2250, date: `${year}-03-15`, notes: '1% of AUM quarterly' }
    ];
  },

  saveToStorage: function(dealId) {
    const key = `sp_accounting_${dealId}`;
    localStorage.setItem(key, JSON.stringify(this.transactions));
    
    // Also sync to Firestore if available
    if (window.SPFB && SPFB.db) {
      this.syncToFirestore(dealId);
    }
  },

  syncToFirestore: async function(dealId) {
    try {
      const orgId = SP.getOrgId();
      const batch = SPFB.db.batch();
      const ref = SPFB.db.collection('orgs').doc(orgId)
        .collection('accounting').doc(dealId).collection('transactions');
      
      this.transactions.forEach(tx => {
        if (tx.id) {
          batch.set(ref.doc(tx.id), tx);
        }
      });
      
      await batch.commit();
    } catch(e) {
      console.log('Firestore sync failed:', e);
    }
  },

  calculatePNL: function() {
    const income = { rental: 0, sale: 0, distribution: 0, other: 0 };
    const expenses = { operating: 0, capex: 0, management: 0, interest: 0, taxes: 0, insurance: 0, other: 0 };
    
    this.transactions.forEach(tx => {
      const amt = parseFloat(tx.amount) || 0;
      if (tx.type === 'income') {
        switch(tx.category) {
          case 'Rental Income': income.rental += amt; break;
          case 'Sale Proceeds': income.sale += amt; break;
          case 'Distribution Received': income.distribution += amt; break;
          case 'Other Income': income.other += amt; break;
        }
      } else {
        switch(tx.category) {
          case 'Operating Expenses': expenses.operating += amt; break;
          case 'Capital Improvements': expenses.capex += amt; break;
          case 'Management Fees': expenses.management += amt; break;
          case 'Interest Expense': expenses.interest += amt; break;
          case 'Property Taxes': expenses.taxes += amt; break;
          case 'Insurance': expenses.insurance += amt; break;
          case 'Other Expenses': expenses.other += amt; break;
        }
      }
    });

    const totalIncome = income.rental + income.sale + income.distribution + income.other;
    const totalExpenses = expenses.operating + expenses.capex + expenses.management + 
                          expenses.interest + expenses.taxes + expenses.insurance + expenses.other;
    const netIncome = totalIncome - totalExpenses;

    // Update UI
    document.getElementById('rentalIncome').textContent = this.formatCurrency(income.rental);
    document.getElementById('saleProceeds').textContent = this.formatCurrency(income.sale);
    document.getElementById('distributionIncome').textContent = this.formatCurrency(income.distribution);
    document.getElementById('otherIncome').textContent = this.formatCurrency(income.other);
    document.getElementById('totalIncome').textContent = this.formatCurrency(totalIncome);
    document.getElementById('totalIncome').className = 'amount positive';

    document.getElementById('operatingExpenses').textContent = this.formatCurrency(expenses.operating);
    document.getElementById('capex').textContent = this.formatCurrency(expenses.capex);
    document.getElementById('managementFees').textContent = this.formatCurrency(expenses.management);
    document.getElementById('interestExpense').textContent = this.formatCurrency(expenses.interest);
    document.getElementById('propertyTaxes').textContent = this.formatCurrency(expenses.taxes);
    document.getElementById('insurance').textContent = this.formatCurrency(expenses.insurance);
    document.getElementById('otherExpenses').textContent = this.formatCurrency(expenses.other);
    document.getElementById('totalExpenses').textContent = this.formatCurrency(totalExpenses);
    document.getElementById('totalExpenses').className = 'amount negative';

    const noiEl = document.getElementById('netIncome');
    noiEl.textContent = this.formatCurrency(netIncome);
    noiEl.className = 'amount ' + (netIncome >= 0 ? 'positive' : 'negative');

    // Update period
    document.getElementById('pnlPeriod').textContent = `YTD ${new Date().getFullYear()}`;
  },

  calculateCashFlow: function() {
    // Simplified cash flow
    const cashIn = this.transactions
      .filter(tx => tx.type === 'income')
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    
    const cashOut = this.transactions
      .filter(tx => tx.type === 'expense')
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    
    // Assume starting cash of $50k for demo
    const beginningCash = 50000;
    const endingCash = beginningCash + cashIn - cashOut;

    document.getElementById('beginningCash').textContent = this.formatCurrency(beginningCash);
    document.getElementById('cashIn').textContent = this.formatCurrency(cashIn);
    document.getElementById('cashOut').textContent = this.formatCurrency(cashOut);
    document.getElementById('endingCash').textContent = this.formatCurrency(endingCash);
  },

  renderTransactions: function() {
    const tbody = document.getElementById('txTableBody');
    const typeFilter = document.getElementById('typeFilter').value;
    
    let filtered = this.transactions;
    if (typeFilter) {
      filtered = filtered.filter(tx => tx.type === typeFilter);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No transactions found</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(tx => `
      <tr>
        <td>${this.formatDate(tx.date)}</td>
        <td>${this.escapeHtml(tx.description)}</td>
        <td><span class="badge ${tx.type === 'income' ? 'badge-success' : 'badge-danger'}">${tx.category}</span></td>
        <td>${tx.type === 'income' ? '<i class="fas fa-arrow-up text-success"></i> Income' : '<i class="fas fa-arrow-down text-danger"></i> Expense'}</td>
        <td class="text-right ${tx.type === 'income' ? 'text-success' : 'text-danger'}">${this.formatCurrency(tx.amount)}</td>
        <td class="text-center">
          <button class="btn-icon" onclick="SPAccounting.editTransaction('${tx.id}')" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="btn-icon text-danger" onclick="SPAccounting.deleteTransaction('${tx.id}')" title="Delete"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  },

  showAddModal: function() {
    if (!this.currentDeal) {
      alert('Please select a deal first');
      return;
    }
    
    document.getElementById('txId').value = '';
    document.getElementById('txType').value = 'income';
    document.getElementById('txCategory').value = '';
    document.getElementById('txDescription').value = '';
    document.getElementById('txAmount').value = '';
    document.getElementById('txDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('txNotes').value = '';
    
    this.toggleCategories();
    document.getElementById('txModal').style.display = 'flex';
  },

  closeModal: function() {
    document.getElementById('txModal').style.display = 'none';
  },

  toggleCategories: function() {
    const type = document.getElementById('txType').value;
    const catSelect = document.getElementById('txCategory');
    const cats = this.categories[type];
    
    catSelect.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  },

  saveTransaction: function() {
    const id = document.getElementById('txId').value;
    const type = document.getElementById('txType').value;
    const category = document.getElementById('txCategory').value;
    const description = document.getElementById('txDescription').value;
    const amount = parseFloat(document.getElementById('txAmount').value);
    const date = document.getElementById('txDate').value;
    const notes = document.getElementById('txNotes').value;

    if (!description || !amount || !date || !category) {
      alert('Please fill in all required fields');
      return;
    }

    const dealId = document.getElementById('dealSelect').value;

    if (id) {
      // Update existing
      const idx = this.transactions.findIndex(tx => tx.id === id);
      if (idx >= 0) {
        this.transactions[idx] = { ...this.transactions[idx], type, category, description, amount, date, notes };
      }
    } else {
      // Add new
      const newId = Date.now().toString();
      this.transactions.unshift({ id: newId, type, category, description, amount, date, notes });
    }

    this.saveToStorage(dealId);
    this.calculatePNL();
    this.calculateCashFlow();
    this.renderTransactions();
    this.closeModal();
  },

  editTransaction: function(id) {
    const tx = this.transactions.find(t => t.id === id);
    if (!tx) return;

    document.getElementById('txId').value = tx.id;
    document.getElementById('txType').value = tx.type;
    this.toggleCategories();
    document.getElementById('txCategory').value = tx.category;
    document.getElementById('txDescription').value = tx.description;
    document.getElementById('txAmount').value = tx.amount;
    document.getElementById('txDate').value = tx.date;
    document.getElementById('txNotes').value = tx.notes || '';

    document.getElementById('txModal').style.display = 'flex';
  },

  deleteTransaction: function(id) {
    if (!confirm('Delete this transaction?')) return;
    
    this.transactions = this.transactions.filter(tx => tx.id !== id);
    
    const dealId = document.getElementById('dealSelect').value;
    this.saveToStorage(dealId);
    this.calculatePNL();
    this.calculateCashFlow();
    this.renderTransactions();
  },

  exportCSV: function() {
    if (this.transactions.length === 0) {
      alert('No transactions to export');
      return;
    }

    const headers = ['Date', 'Description', 'Category', 'Type', 'Amount', 'Notes'];
    const rows = this.transactions.map(tx => [
      tx.date,
      `"${tx.description}"`,
      tx.category,
      tx.type,
      tx.amount,
      `"${tx.notes || ''}"`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accounting_${this.currentDeal?.name || 'export'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  formatCurrency: function(amt) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amt);
  },

  formatDate: function(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  escapeHtml: function(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
