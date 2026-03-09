/**
 * SP Referrals - Investor Referral Program
 */
window.Referrals = {
  refs: [],
  init: function() {
    const s = JSON.stringify(SP.load('referrals', null));
    if (s) this.refs = JSON.parse(s);
    else this.refs = this.generateDemo();
    this.render();
  },
  generateDemo: function() {
    const y = new Date().getFullYear();
    return [
      { id: '1', referrer: 'John Smith', referred: 'Michael Chen', email: 'mchen@email.com', deal: 'Sunset Apartments', investment: 500000, fee: 5000, status: 'converted', date: `${y}-02-15` },
      { id: '2', referrer: 'Sarah Williams', referred: 'David Rodriguez', email: 'drodriguez@email.com', deal: 'Downtown Office', investment: 250000, fee: 2500, status: 'converted', date: `${y}-01-20` },
      { id: '3', referrer: 'Mike Johnson', referred: 'Jennifer Park', email: 'jpark@email.com', deal: '', investment: 0, fee: 2500, status: 'pending', date: `${y}-03-01` },
      { id: '4', referrer: 'Lisa Brown', referred: 'Robert Martinez', email: 'rmartinez@email.com', deal: 'Industrial Portfolio', investment: 350000, fee: 3500, status: 'converted', date: `${y}-02-28` },
      { id: '5', referrer: 'David Jones', referred: 'Amanda Thompson', email: 'athompson@email.com', deal: '', investment: 0, fee: 2000, status: 'pending', date: `${y}-03-05` }
    ];
  },
  save: function() { SP.save('referrals', this.refs); },
  render: function() {
    const converted = this.refs.filter(r => r.status === 'converted').length;
    const feesPaid = this.refs.filter(r => r.status === 'converted').reduce((s,r) => s + r.fee, 0);
    const feesPending = this.refs.filter(r => r.status === 'pending').reduce((s,r) => s + r.fee, 0);
    
    document.getElementById('statTotal').textContent = this.refs.length;
    document.getElementById('statConverted').textContent = converted;
    document.getElementById('statFees').textContent = this.f(feesPaid);
    document.getElementById('statPending').textContent = this.f(feesPending);
    
    document.getElementById('referralTableBody').innerHTML = this.refs.map(r => `
      <tr>
        <td><strong>${r.referrer}</strong></td>
        <td>${r.referred}<br><small class="text-muted">${r.email}</small></td>
        <td>${r.deal || '—'}</td>
        <td>${r.investment ? this.f(r.investment) : '—'}</td>
        <td>${this.f(r.fee)}</td>
        <td><span class="badge badge-${r.status==='converted'?'success':'warning'}">${r.status}</span></td>
        <td>${new Date(r.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</td>
      </tr>
    `).join('');
  },
  f: function(a) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(a); },
  showModal: function() { document.getElementById('refModal').style.display = 'flex'; },
  closeModal: function() { document.getElementById('refModal').style.display = 'none'; },
  save: function() {
    const referrer = document.getElementById('rReferrer').value;
    if (!referrer) { alert('Referrer required'); return; }
    this.refs.unshift({ id: Date.now().toString(), referrer, referred: document.getElementById('rReferred').value, email: document.getElementById('rEmail').value, deal: '', investment: 0, fee: parseInt(document.getElementById('rFee').value)||0, status: 'pending', date: new Date().toISOString().split('T')[0] });
    this.save(); this.render(); this.closeModal();
  }
};
