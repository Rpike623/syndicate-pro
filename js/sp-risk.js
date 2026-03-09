/**
 * SP Risk Register
 */
window.Risk = {
  risks: [],
  init: function() {
    const s = JSON.stringify(SP.load('risks', null));
    if (s) this.risks = JSON.parse(s);
    else this.risks = this.sample();
    this.render();
  },
  sample: function() {
    return [
      { desc:'Interest rate increase', category:'financial', impact:5, likelihood:4, status:'mitigating', mitigation:'Fixed rate loan locked' },
      { desc:'Tenant vacancy increase', category:'operational', impact:4, likelihood:3, status:'identified', mitigation:'' },
      { desc:'Market downturn', category:'market', impact:5, likelihood:2, status:'identified', mitigation:'' },
      { desc:'Regulatory change', category:'regulatory', impact:3, likelihood:2, status:'mitigated', mitigation:'Legal counsel engaged' },
      { desc:'Property damage', category:'operational', impact:4, likelihood:2, status:'mitigating', mitigation:'Insurance in place' }
    ];
  },
  save: function() { SP.save('risks', this.risks); },
  render: function() {
    const total = this.risks.length;
    const high = this.risks.filter(r => r.impact * r.likelihood >= 15).length;
    const mitigated = this.risks.filter(r => r.status === 'mitigated').length;
    const score = Math.round(this.risks.reduce((s,r) => s + r.impact * r.likelihood, 0) / total);
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statHigh').textContent = high;
    document.getElementById('statMitigated').textContent = mitigated;
    document.getElementById('statScore').textContent = score;
    document.getElementById('riskTable').innerHTML = this.risks.map(r => {
      const s = r.impact * r.likelihood;
      return `<tr><td>${r.desc}</td><td>${r.category}</td><td>${r.impact}</td><td>${r.likelihood}</td><td><span class="badge badge-${s>=15?'danger':s>=10?'warning':'info'}">${s}</span></td><td><span class="badge badge-${r.status==='mitigated'?'success':r.status==='mitigating'?'warning':'secondary'}">${r.status}</span></td><td>${r.mitigation || '—'}</td></tr>`;
    }).join('');
  },
  showModal: function() { document.getElementById('riskModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('riskModal').style.display = 'none'; },
  save: function() {
    this.risks.push({ desc:document.getElementById('rDesc').value, category:document.getElementById('rCat').value, impact:parseInt(document.getElementById('rImpact').value), likelihood:parseInt(document.getElementById('rLike').value), status:document.getElementById('rStatus').value, mitigation:'' });
    this.save(); this.render(); this.closeModal();
  }
};
