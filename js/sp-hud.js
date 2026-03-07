/**
 * SP HUD Closing Statement - Journal Entry Generator
 */
window.HUD = {
  inputs: [],
  init: function() {
    this.inputs = ['h101','h102','h103','h201','h202','h301','h302','h303','h304','h305','h306','h307','h308','h309','h310','h311','h312','h313','h314','h401','h402','h403','h404','h503','h504'];
    this.inputs.forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.calculate());
    });
  },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  g: function(id) { return parseFloat(document.getElementById(id).value) || 0; },
  clear: function() {
    this.inputs.forEach(id => { document.getElementById(id).value = 0; });
    this.calculate();
  },
  calculate: function() {
    // Section A totals
    const h101 = this.g('h101');
    const h102 = this.g('h102');
    const h103 = this.g('h103');
    const h120 = h101 + h102 + h103;
    document.getElementById('h120').value = h120;
    
    // Section B totals
    const settlement = ['h201','h202','h301','h302','h303','h304','h305','h306','h307','h308','h309','h310','h311','h312','h313','h314'];
    let h1400 = 0;
    settlement.forEach(id => { h1400 += this.g(id); });
    document.getElementById('h1400').value = h1400;
    
    // Section C
    const h401 = this.g('h401');
    const h402 = this.g('h402');
    const h403 = this.g('h403');
    const h404 = this.g('h404');
    document.getElementById('h120b').value = h120 + h1400;
    document.getElementById('h501').value = h101;
    document.getElementById('h502').value = h403;
    
    // Summary
    const totalPurchase = h101;
    const totalCosts = h1400;
    const cashToBuyer = h401 + h402 - h1400;
    const payoff1 = this.g('h503');
    const payoff2 = this.g('h504');
    const netToSeller = h101 - payoff1 - payoff2 - h1400;
    
    document.getElementById('sumPurchase').textContent = this.f(totalPurchase);
    document.getElementById('sumCosts').textContent = this.f(totalCosts);
    document.getElementById('sumBuyer').textContent = this.f(cashToBuyer);
    document.getElementById('sumSeller').textContent = this.f(netToSeller);
    
    // Generate Journal Entries
    this.generateJE(h101, h102, h103, h1400, h402, h403, payoff1, payoff2, cashToBuyer);
  },
  generateJE: function(land, building, personal, costs, loanAmt, existingLoan, payoff1, payoff2, cash) {
    // Asset Acquisition Entry
    const assetJE = `Date: ${new Date().toLocaleDateString()}
Property: [Property Name]

DEBIT                           CREDIT
-----------                     --------
Land.................... ${this.f(land).padStart(12)}
Building................ ${this.f(building).padStart(12)}
Personal Property........ ${this.f(personal).padStart(12)}
Closing Costs........... ${this.f(costs).padStart(12)}

                 Mortgage Payable........ ${this.f(loanAmt + existingLoan).padStart(12)}
                 Cash.................... ${this.f(land + building + personal + costs - loanAmt - existingLoan).padStart(12)}`;
    
    // Loan Proceeds Entry  
    const loanJE = `Date: ${new Date().toLocaleDateString()}

DEBIT                           CREDIT
-----------                     --------
Cash (New Loan).......... ${this.f(loanAmt).padStart(12)}
Mortgage Payable......... ${this.f(loanAmt).padStart(12)}`;
    
    // Payoff Entries
    const payoffJE = `Date: ${new Date().toLocaleDateString()}

DEBIT                           CREDIT
-----------                     --------
Mortgage Payable - 1st. ${this.f(payoff1).padStart(12)}
Mortgage Payable - 2nd. ${this.f(payoff2).padStart(12)}

                 Cash.................... ${this.f(payoff1 + payoff2).padStart(12)}`;
    
    // Cash Payment Entry
    const cashJE = `Date: ${new Date().toLocaleDateString()}

DEBIT                           CREDIT
-----------                     --------
Cash (Buyer Cash In)..... ${this.f(Math.abs(cash)).padStart(12)}

                 Cash (Disbursed)....... ${this.f(Math.abs(cash)).padStart(12)}`;
    
    document.getElementById('jeAssets').textContent = assetJE;
    document.getElementById('jeLoan').textContent = loanJE + '\n\n' + payoffJE + '\n\n' + cashJE;
    document.getElementById('jeCash').textContent = '';
  },
  copyJE: function() {
    const je = document.getElementById('jeAssets').textContent + '\n\n' + document.getElementById('jeLoan').textContent;
    navigator.clipboard.writeText(je).then(() => alert('Journal entries copied!'));
  }
};