/**
 * SP Amortization Calculator
 */
window.AmortizationCalc = {
  init: function() { this.calc(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  f2: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(v); },
  calc: function() {
    const loanAmount = parseFloat(document.getElementById('amLoanAmount').value) || 0;
    const annualRate = (parseFloat(document.getElementById('amRate').value) || 0) / 100;
    const termYears = parseInt(document.getElementById('amTerm').value) || 0;
    const downPayment = parseFloat(document.getElementById('amDown').value) || 0;
    
    const months = termYears * 12;
    const monthlyRate = annualRate / 12;
    
    let monthlyPayment = 0;
    if (monthlyRate > 0) {
      monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
    } else {
      monthlyPayment = loanAmount / months;
    }
    
    const totalPayments = monthlyPayment * months;
    const totalInterest = totalPayments - loanAmount;
    const totalPrice = loanAmount + downPayment;
    
    document.getElementById('amMonthly').textContent = this.f2(monthlyPayment);
    document.getElementById('amTotalInterest').textContent = this.f(totalInterest);
    document.getElementById('amTotalCost').textContent = this.f(totalPayments);
    document.getElementById('amTotalPrice').textContent = this.f(totalPrice);
    
    this.renderSchedule(loanAmount, monthlyRate, monthlyPayment, months);
  },
  renderSchedule: function(principal, monthlyRate, monthlyPayment, totalMonths) {
    const tbody = document.querySelector('#amSchedule tbody');
    tbody.innerHTML = '';
    
    let balance = principal;
    const maxRows = 360; // Limit for performance
    
    for (let i = 1; i <= totalMonths && i <= maxRows; i++) {
      const interestPayment = balance * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;
      balance = Math.max(0, balance - principalPayment);
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${i}</td>
        <td>${this.f2(monthlyPayment)}</td>
        <td>${this.f2(principalPayment)}</td>
        <td>${this.f2(interestPayment)}</td>
        <td>${this.f2(balance)}</td>
      `;
      tbody.appendChild(row);
    }
    
    if (totalMonths > maxRows) {
      const note = document.createElement('tr');
      note.innerHTML = `<td colspan="5" style="text-align:center;color:var(--text-muted);">Showing first ${maxRows} months (${maxRows/12} years). Full schedule has ${totalMonths} months.</td>`;
      tbody.appendChild(note);
    }
  }
};