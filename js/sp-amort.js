/**
 * SP Amortization Calculator
 */
window.Amort = {
  init: function() { this.calc(); },
  calc: function() {
    const P = parseFloat(document.getElementById('amLoan').value) || 0;
    const r = (parseFloat(document.getElementById('amRate').value) || 0) / 100 / 12;
    const n = (parseFloat(document.getElementById('amTerm').value) || 30) * 12;
    const extra = parseFloat(document.getElementById('amExtra').value) || 0;
    const monthly = P * (r * Math.pow(1+r,n)) / (Math.pow(1+r,n)-1);
    const payment = monthly + extra;
    let balance = P, totalInt = 0, html = '', pmtNum = 0;
    while(balance > 0 && pmtNum < n * 2) {
      pmtNum++;
      const interest = balance * r;
      let principal = payment - interest;
      if(principal > balance) principal = balance;
      balance -= principal;
      totalInt += interest;
      if(pmtNum <= 360) html += `<tr><td>${pmtNum}</td><td>$${Math.round(principal).toLocaleString()}</td><td>$${Math.round(interest).toLocaleString()}</td><td>$${Math.round(balance).toLocaleString()}</td></tr>`;
      if(balance <= 0) break;
    }
    const years = Math.floor(pmtNum / 12);
    const months = pmtNum % 12;
    document.getElementById('amPayment').textContent = '$' + Math.round(payment).toLocaleString();
    document.getElementById('amTotalInt').textContent = '$' + Math.round(totalInt).toLocaleString();
    document.getElementById('amPayoff').textContent = years + 'y ' + months + 'm';
    document.getElementById('amTable').innerHTML = html;
  }
};