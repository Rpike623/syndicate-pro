/**
 * SP Capital Call Calculator
 */
window.CapitalCall = {
  init: function() {
    document.getElementById('ccDue').value = new Date(Date.now() + 14*24*60*60*1000).toISOString().split('T')[0];
    document.querySelectorAll('.inv-commit').forEach(i => i.addEventListener('input', () => this.updatePcts()));
    this.updatePcts();
  },
  addInvestor: function() {
    const div = document.createElement('div');
    div.className = 'investor-row';
    div.innerHTML = '<input type="text" placeholder="Investor Name" class="inv-name"><input type="number" placeholder="Commitment $" class="inv-commit"><span class="inv-pct">0%</span><button class="btn-icon text-danger" onclick="this.parentElement.remove()">×</button>';
    document.getElementById('investorList').appendChild(div);
    div.querySelector('.inv-commit').addEventListener('input', () => this.updatePcts());
  },
  updatePcts: function() {
    const commits = Array.from(document.querySelectorAll('.inv-commit')).map(i => parseInt(i.value)||0);
    const total = commits.reduce((s,x) => s+x, 0);
    const rows = document.querySelectorAll('.investor-row');
    rows.forEach((r, i) => {
      const pct = total ? ((commits[i]/total)*100).toFixed(1) : 0;
      r.querySelector('.inv-pct').textContent = pct + '%';
    });
  },
  calculate: function() {
    const deal = document.getElementById('ccDeal').value;
    const total = parseInt(document.getElementById('ccTotal').value) || 0;
    const callAmount = parseInt(document.getElementById('ccAmount').value) || 0;
    const callPct = parseFloat(document.getElementById('ccPct').value) / 100;
    const due = document.getElementById('ccDue').value;
    
    const investors = [];
    document.querySelectorAll('.investor-row').forEach(r => {
      const name = r.querySelector('.inv-name').value;
      const commit = parseInt(r.querySelector('.inv-commit').value) || 0;
      if (name && commit) investors.push({ name, commit });
    });
    
    const totalCommit = investors.reduce((s,i) => s + i.commit, 0);
    
    document.getElementById('calcResults').style.display = 'block';
    document.getElementById('resDeal').textContent = deal;
    document.getElementById('resTotal').textContent = this.f(totalCommit);
    document.getElementById('resCall').textContent = this.f(callAmount);
    document.getElementById('resDue').textContent = new Date(due).toLocaleDateString();
    
    document.getElementById('callTable').innerHTML = investors.map(inv => {
      const invCall = Math.round(inv.commit * callPct);
      return `<tr><td><strong>${inv.name}</strong></td><td>${this.f(inv.commit)}</td><td class="text-primary"><strong>${this.f(invCall)}</strong></td><td><small>Wire details on file</small></td><td>${new Date(due).toLocaleDateString()}</td></tr>`;
    }).join('');
    
    document.getElementById('emailTemplate').innerHTML = `<pre>Subject: Capital Call Notice - ${deal}

Dear Investor,

This is a capital call notice for ${deal}.

Call Amount: ${this.f(callAmount)}
Due Date: ${new Date(due).toLocaleDateString()}

Your allocation: ${callPct*100}% of your commitment (${this.f(investors[0]?.commit||0)})

Please wire funds to:
Bank: First Horizon Bank
Account: [Account Number]
Routing: [Routing Number]
Reference: ${deal.replace(/\s/g,'')}-CC

Questions? Contact us at admin@deeltrack.com.

Best regards,
The Sponsor Team</pre>`;
  },
  exportCSV: function() {
    const rows = [['Investor','Commitment','Call Amount','Due Date']];
    document.querySelectorAll('#callTable tr').forEach(tr => {
      const cells = Array.from(tr.querySelectorAll('td')).slice(0,3);
      if (cells.length) rows.push(cells.map(c => c.textContent));
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'capital_call.csv'; a.click();
  },
  f: function(a) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(a); }
};
