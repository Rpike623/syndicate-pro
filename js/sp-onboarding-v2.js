/**
 * SP Onboarding V2 - Firestore-backed investor onboarding
 *
 * Replaces demo/localStorage behavior with real org-scoped onboarding records,
 * deal invite links, and optional welcome emails.
 */
window.Onboarding = {
  onboardings: [],
  deals: [],
  currentStep: 1,
  orgId: null,
  db: null,

  init: async function() {
    this.db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
    this.orgId = (SP.getSession && SP.getSession()?.orgId) || null;
    await this.loadDeals();
    await this.loadData();
    this.populateDeals();
    this.render();
  },

  loadDeals: async function() {
    this.deals = SP.getDeals ? SP.getDeals() : [];
    this.deals = this.deals.filter(d => d && d.id && d.name);
  },

  loadData: async function() {
    if (!this.db || !this.orgId) {
      this.onboardings = [];
      return;
    }

    try {
      const doc = await this.db.collection('orgs').doc(this.orgId).collection('custom_data').doc('onboarding_v2').get();
      const raw = doc.exists ? doc.data()?.value : [];
      this.onboardings = Array.isArray(raw) ? raw : [];
    } catch (e) {
      console.warn('[Onboarding] Failed to load onboarding records:', e);
      this.onboardings = [];
    }
  },

  save: async function() {
    if (!this.db || !this.orgId) return;
    try {
      await this.db.collection('orgs').doc(this.orgId).collection('custom_data').doc('onboarding_v2').set({
        value: this.onboardings,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        accessLevel: 'gp_only'
      }, { merge: true });
    } catch (e) {
      console.error('[Onboarding] Save failed:', e);
      throw e;
    }
  },

  populateDeals: function() {
    const el = document.getElementById('invDeal');
    if (!el) return;
    if (!this.deals.length) {
      el.innerHTML = '<option value="">No deals available</option>';
      return;
    }
    const opts = ['<option value="">Select a deal</option>'].concat(
      this.deals.map(d => {
        const min = d.minInvest || d.min || 25000;
        return `<option value="${d.id}">${d.name} (Min: ${this.f(min)})</option>`;
      })
    ).join('');
    el.innerHTML = opts;
  },

  render: function() {
    const active = this.onboardings.filter(o => o.stage !== 'complete').length;
    const awaitingDocs = this.onboardings.filter(o => o.stage === 'docs').length;
    const verifying = this.onboardings.filter(o => o.stage === 'verify').length;
    const completed = this.onboardings.filter(o => o.stage === 'complete').length;

    const completedOnboardings = this.onboardings.filter(o => o.stage === 'complete');
    let avgDays = 0;
    if (completedOnboardings.length) {
      avgDays = Math.round(completedOnboardings.reduce((sum, o) => sum + this.daysOpen(o), 0) / completedOnboardings.length);
    }

    this.setText('statActive', active);
    this.setText('statDocs', awaitingDocs);
    this.setText('statVerify', verifying);
    this.setText('statCompleted', completed);
    this.setText('statDays', avgDays);

    ['invite','docs','verify','complete'].forEach(stage => {
      const items = this.onboardings.filter(o => o.stage === stage);
      this.setText(`count-${stage}`, items.length);
      const cards = document.getElementById(`cards-${stage}`);
      if (cards) {
        cards.innerHTML = items.slice(0,3).map(o => this.pipelineCard(o)).join('') + (items.length > 3 ? `<div class="more">+${items.length - 3} more</div>` : '');
      }
    });

    this.renderList();
  },

  setText: function(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  },

  daysOpen: function(o) {
    const start = new Date(o.startDate || o.createdAt || Date.now());
    const end = o.stage === 'complete' ? new Date(o.lastUpdate || Date.now()) : new Date();
    return Math.max(1, Math.ceil((end - start) / 86400000));
  },

  pipelineCard: function(o) {
    return `<div class="onboard-card" onclick="Onboarding.view('${o.id}')">
      <div class="onboard-name">${o.firstName} ${o.lastName}</div>
      <div class="onboard-deal">${o.dealName}</div>
      <div class="onboard-amount">${this.f(o.investment)}</div>
      <div class="onboard-progress"><div class="progress-bar-mini"><div class="fill" style="width:${o.progress || 0}%"></div></div></div>
    </div>`;
  },

  renderList: function() {
    const filter = document.getElementById('statusFilter')?.value || '';
    let list = this.onboardings.slice();
    if (filter) list = list.filter(o => o.stage === filter);

    const body = document.getElementById('onboardingTableBody');
    if (!body) return;
    body.innerHTML = list.map(o => {
      const stageLabels = { invite: 'Invited', docs: 'Awaiting Docs', verify: 'Verification', complete: 'Ready' };
      const inviteLink = o.inviteToken ? `invest.html?t=${o.inviteToken}` : '';
      return `<tr>
        <td><strong>${o.firstName} ${o.lastName}</strong><br><small class="text-muted">${o.email}</small></td>
        <td>${o.dealName || '—'}</td>
        <td>${this.f(o.investment || 0)}</td>
        <td><div class="progress-bar-mini"><div class="fill" style="width:${o.progress || 0}%"></div></div> ${o.progress || 0}%</td>
        <td><span class="badge badge-${this.stageColor(o.stage)}">${stageLabels[o.stage] || o.stage}</span></td>
        <td>${this.daysOpen(o)} days</td>
        <td class="text-center">
          <button class="btn-icon" onclick="Onboarding.view('${o.id}')" title="View"><i class="fas fa-eye"></i></button>
          <button class="btn-icon" onclick="Onboarding.sendReminder('${o.id}')" title="Resend"><i class="fas fa-paper-plane"></i></button>
          ${inviteLink ? `<button class="btn-icon" onclick="Onboarding.copyInvite('${o.id}')" title="Copy invite link"><i class="fas fa-link"></i></button>` : ''}
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="7" class="text-center text-muted" style="padding:24px;">No onboarding records yet.</td></tr>';
  },

  stageColor: function(s) { return { invite: 'info', docs: 'warning', verify: 'primary', complete: 'success' }[s] || 'secondary'; },

  startNew: function() {
    this.currentStep = 1;
    this.resetForm();
    this.showStep(1);
    document.getElementById('newModal').style.display = 'flex';
  },

  resetForm: function() {
    ['invFirstName','invLastName','invEmail','invPhone','invEntity','invEin','invAddress','invAmount','invMessage'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const dealEl = document.getElementById('invDeal');
    if (dealEl) dealEl.value = '';
    const entityType = document.getElementById('invEntityType');
    if (entityType) entityType.value = 'individual';
    const source = document.getElementById('invSource');
    if (source) source.value = 'savings';
    ['docSub','docAccred','docW9'].forEach(id => { const el = document.getElementById(id); if (el) el.checked = true; });
    ['docPpm','docBank','docCorp','sendReminder'].forEach(id => { const el = document.getElementById(id); if (el) el.checked = false; });
    const sendWelcome = document.getElementById('sendWelcome');
    if (sendWelcome) sendWelcome.checked = true;
  },

  closeModal: function() { document.getElementById('newModal').style.display = 'none'; },

  showStep: function(step) {
    this.currentStep = step;
    document.querySelectorAll('.onboarding-stepper .step').forEach((el, i) => el.classList.toggle('active', i + 1 === step));
    for (let i = 1; i <= 4; i++) {
      const panel = document.getElementById(`step${i}`);
      if (panel) panel.style.display = i === step ? 'block' : 'none';
    }
    const prev = document.getElementById('prevBtn');
    const next = document.getElementById('nextBtn');
    if (prev) prev.style.display = step > 1 ? 'inline-block' : 'none';
    if (next) next.textContent = step === 4 ? 'Create Onboarding' : 'Continue';
    if (step === 4) this.updateReview();
  },

  nextStep: function() {
    if (this.currentStep === 1 && !this.validateStep1()) return;
    if (this.currentStep === 2 && !this.validateStep2()) return;
    if (this.currentStep === 4) { this.submit(); return; }
    this.showStep(this.currentStep + 1);
  },

  prevStep: function() {
    if (this.currentStep > 1) this.showStep(this.currentStep - 1);
  },

  validateStep1: function() {
    const required = [
      ['invFirstName', 'First name is required'],
      ['invLastName', 'Last name is required'],
      ['invEmail', 'Email is required']
    ];
    for (const [id, msg] of required) {
      const el = document.getElementById(id);
      if (!el || !el.value.trim()) { alert(msg); el?.focus(); return false; }
    }
    return true;
  },

  validateStep2: function() {
    const dealId = document.getElementById('invDeal')?.value;
    const amount = parseFloat(document.getElementById('invAmount')?.value || 0);
    if (!dealId) { alert('Select a deal'); return false; }
    if (!amount || amount <= 0) { alert('Enter an investment amount'); return false; }
    const deal = this.deals.find(d => d.id === dealId);
    const min = deal?.minInvest || deal?.min || 0;
    if (min && amount < min) { alert(`Minimum investment for this deal is ${this.f(min)}`); return false; }
    return true;
  },

  updateReview: function() {
    const deal = this.deals.find(d => d.id === document.getElementById('invDeal').value);
    this.setText('revName', `${document.getElementById('invFirstName').value} ${document.getElementById('invLastName').value}`.trim());
    this.setText('revEmail', document.getElementById('invEmail').value);
    this.setText('revDeal', deal?.name || '—');
    this.setText('revAmount', this.f(parseFloat(document.getElementById('invAmount').value) || 0));

    const docs = this.selectedDocs();
    this.setText('revDocs', docs.length ? docs.map(d => d.label).join(', ') : 'No documents selected');
  },

  selectedDocs: function() {
    const defs = [
      ['docSub', 'subscription_agreement', 'Subscription Agreement'],
      ['docAccred', 'accreditation', 'Accreditation Certificate'],
      ['docW9', 'w9', 'W-9 Form'],
      ['docPpm', 'ppm_ack', 'PPM Acknowledgment'],
      ['docBank', 'bank_info', 'Bank Information'],
      ['docCorp', 'corporate_resolution', 'Corporate Resolution']
    ];
    return defs.filter(([id]) => document.getElementById(id)?.checked).map(([_, key, label]) => ({ key, label }));
  },

  makeToken: function() {
    return 'inv_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  },

  buildInviteUrl: function(token) {
    return `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}invest.html?t=${encodeURIComponent(token)}`;
  },

  upsertInvestorRecord: async function(payload) {
    const investors = SP.getInvestors ? SP.getInvestors() : [];
    const existingIdx = investors.findIndex(i => (i.email || '').toLowerCase() === payload.email.toLowerCase());
    const base = existingIdx >= 0 ? investors[existingIdx] : { id: 'inv_' + Date.now().toString(36) };

    const next = {
      ...base,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone || base.phone || '',
      address: payload.address || base.address || '',
      entityName: payload.entity || base.entityName || '',
      entityType: payload.entityType || base.entityType || 'individual',
      tin: payload.ein || base.tin || '',
      investmentSource: payload.investmentSource || base.investmentSource || '',
      updatedAt: new Date().toISOString()
    };

    if (existingIdx >= 0) investors[existingIdx] = next;
    else investors.unshift(next);

    if (SP.saveInvestors) await SP.saveInvestors(investors);
    return next;
  },

  createInviteDocs: async function(token, onboarding, docs) {
    const invite = {
      token,
      dealId: onboarding.dealId,
      investorEmail: onboarding.email,
      investorName: `${onboarding.firstName} ${onboarding.lastName}`.trim(),
      minInvest: onboarding.investment,
      maxInvest: onboarding.investment,
      onboardingId: onboarding.id,
      requiredDocs: docs.map(d => d.key),
      status: 'active',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: SP.getSession?.().uid || ''
    };

    await this.db.collection('orgs').doc(this.orgId).collection('deal_invites').doc(token).set(invite);
    await this.db.collection('_invites').doc(token).set({
      orgId: this.orgId,
      dealId: onboarding.dealId,
      investorEmail: onboarding.email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  },

  sendWelcomeEmail: async function(onboarding, inviteUrl, docs) {
    if (!(typeof firebase !== 'undefined' && firebase.functions)) return false;
    try {
      const sendEmail = firebase.functions().httpsCallable('sendEmail');
      const deal = this.deals.find(d => d.id === onboarding.dealId);
      await sendEmail({
        to: onboarding.email,
        subject: `You're invited to review ${deal?.name || 'your investment'} on deeltrack`,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;color:#1B1A19;">
            <div style="padding:28px 0 18px;border-bottom:1px solid #E2DDD8;">
              <img src="https://deeltrack.web.app/assets/logo-full-light.svg" alt="deeltrack" style="height:36px;display:block;">
            </div>
            <h2 style="margin:28px 0 12px;">Your subscription package is ready</h2>
            <p>Hi ${onboarding.firstName},</p>
            <p>You've been invited to review <strong>${deal?.name || 'an investment opportunity'}</strong> and complete your onboarding.</p>
            <table style="width:100%;border-collapse:collapse;margin:18px 0;background:#F8F7F5;border-radius:12px;overflow:hidden;">
              <tr><td style="padding:12px 14px;color:#6B6560;">Deal</td><td style="padding:12px 14px;font-weight:600;">${deal?.name || '—'}</td></tr>
              <tr><td style="padding:12px 14px;color:#6B6560;border-top:1px solid #E2DDD8;">Commitment</td><td style="padding:12px 14px;font-weight:600;border-top:1px solid #E2DDD8;">${this.f(onboarding.investment)}</td></tr>
              <tr><td style="padding:12px 14px;color:#6B6560;border-top:1px solid #E2DDD8;">Items requested</td><td style="padding:12px 14px;font-weight:600;border-top:1px solid #E2DDD8;">${docs.map(d => d.label).join(', ')}</td></tr>
            </table>
            ${onboarding.message ? `<div style="padding:14px 16px;background:#FFF5EE;border-left:4px solid #F37925;border-radius:8px;margin:18px 0;"><strong>Message from your sponsor:</strong><div style="margin-top:6px;white-space:pre-wrap;">${onboarding.message}</div></div>` : ''}
            <div style="text-align:center;margin:28px 0;">
              <a href="${inviteUrl}" style="display:inline-block;background:#F37925;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;">Review & complete onboarding</a>
            </div>
            <p style="color:#6B6560;font-size:13px;">This secure link lets you review the deal, confirm your commitment, and complete your subscription information.</p>
          </div>`
      });
      return true;
    } catch (e) {
      console.warn('[Onboarding] Welcome email failed:', e);
      return false;
    }
  },

  submit: async function() {
    const nextBtn = document.getElementById('nextBtn');
    const origText = nextBtn?.textContent || 'Create Onboarding';
    if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Creating...'; }

    try {
      const deal = this.deals.find(d => d.id === document.getElementById('invDeal').value);
      if (!deal) throw new Error('Deal not found');

      const docs = this.selectedDocs();
      const token = this.makeToken();
      const onboarding = {
        id: 'onb_' + Date.now().toString(36),
        firstName: document.getElementById('invFirstName').value.trim(),
        lastName: document.getElementById('invLastName').value.trim(),
        email: document.getElementById('invEmail').value.trim(),
        phone: document.getElementById('invPhone').value.trim(),
        entity: document.getElementById('invEntity').value.trim(),
        ein: document.getElementById('invEin').value.trim(),
        address: document.getElementById('invAddress').value.trim(),
        dealId: deal.id,
        dealName: deal.name,
        investment: parseFloat(document.getElementById('invAmount').value),
        entityType: document.getElementById('invEntityType').value,
        investmentSource: document.getElementById('invSource').value,
        stage: 'invite',
        progress: 25,
        docsSent: docs.map(d => d.key),
        docsReceived: [],
        accreditation: { status: 'pending', method: '' },
        message: document.getElementById('invMessage').value.trim(),
        inviteToken: token,
        inviteUrl: this.buildInviteUrl(token),
        createdAt: new Date().toISOString(),
        startDate: new Date().toISOString().split('T')[0],
        lastUpdate: new Date().toISOString().split('T')[0]
      };

      const investor = await this.upsertInvestorRecord(onboarding);
      onboarding.investorId = investor.id;

      await this.createInviteDocs(token, onboarding, docs);

      this.onboardings.unshift(onboarding);
      await this.save();
      this.render();
      this.closeModal();

      let message = `Onboarding created for ${onboarding.email}. Invite link copied.`;
      if (document.getElementById('sendWelcome')?.checked) {
        const sent = await this.sendWelcomeEmail(onboarding, onboarding.inviteUrl, docs);
        if (sent) message = `Onboarding created and welcome email sent to ${onboarding.email}.`;
      }

      try {
        await navigator.clipboard.writeText(onboarding.inviteUrl);
      } catch (_) {}

      if (document.getElementById('sendReminder')?.checked) {
        message += ' Reminder requested (manual cron still needed).';
      }

      alert(message);
    } catch (e) {
      console.error('[Onboarding] Submit failed:', e);
      alert('Failed to create onboarding: ' + (e.message || e));
    } finally {
      if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = origText; }
    }
  },

  copyInvite: async function(id) {
    const o = this.onboardings.find(x => x.id === id);
    if (!o?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(o.inviteUrl);
      alert('Invite link copied to clipboard');
    } catch (_) {
      prompt('Copy invite link:', o.inviteUrl);
    }
  },

  view: function(id) {
    const o = this.onboardings.find(x => x.id === id);
    if (!o) return;
    const docs = (o.docsSent || []).join(', ') || 'none';
    alert(`${o.firstName} ${o.lastName}\n${o.email}\n\nDeal: ${o.dealName}\nCommitment: ${this.f(o.investment)}\nStage: ${o.stage}\nDocs requested: ${docs}${o.inviteUrl ? `\n\nInvite: ${o.inviteUrl}` : ''}`);
  },

  sendReminder: async function(id) {
    const o = this.onboardings.find(x => x.id === id);
    if (!o?.inviteUrl) return;
    const docs = (o.docsSent || []).map(k => ({ key: k, label: k.replace(/_/g, ' ') }));
    const sent = await this.sendWelcomeEmail(o, o.inviteUrl, docs);
    alert(sent ? `Reminder sent to ${o.email}` : `Couldn't send reminder automatically. Invite: ${o.inviteUrl}`);
  },

  exportAll: function() {
    const blob = new Blob([JSON.stringify(this.onboardings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deeltrack-onboarding-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  f: function(a) {
    return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(Number(a || 0));
  }
};

window.addEventListener('click', function(e) {
  const modal = document.getElementById('newModal');
  if (modal && e.target === modal) Onboarding.closeModal();
});

window.addEventListener('spdata-ready', function() {
  if (window.Onboarding && document.getElementById('invDeal')) {
    Onboarding.loadDeals().then(() => {
      Onboarding.populateDeals();
      Onboarding.render();
    });
  }
});

window.Onboarding = window.Onboarding;