function render() {
  const session = SP.getSession();
  if (!session) return;

  const firstName = session.name ? session.name.split(' ')[0] : 'Investor';
  document.getElementById('headerName').textContent = session.name || session.email;
  document.getElementById('welcomeName').textContent = firstName;
  // Avatar initials
  const avatarEl = document.getElementById('userAvatar');
  if (avatarEl) {
    const initials = session.name
      ? session.name.split(' ').map(p => p[0]).join('').slice(0,2)
      : session.email.slice(0,2).toUpperCase();
    avatarEl.textContent = initials;
  }

  // Find this investor's record
  const inv = SP.getCurrentInvestorRecord();

  // Get all deals and find ones linked to this investor
  // If multi-org data is available, merge it in
  let allDeals = SP.getDeals();
  const linkedEntries = []; // { deal, entry }

  if (_multiOrgData && _multiOrgData.deals.length) {
    // Use multi-org aggregated deals (already filtered to LP's deals)
    _multiOrgData.deals.forEach(d => {
      const invRecord = _multiOrgData.investors.find(i => i._orgId === d._orgId);
      const entry = (d.investors || []).find(i => i.investorId === invRecord?.id);
      if (entry) linkedEntries.push({ deal: d, entry, gpName: d._gpName });
    });
  } else {
    // Single-org mode
    allDeals.forEach(d => {
      if (!Array.isArray(d.investors)) return;
      const entry = d.investors.find(i =>
        i.investorId === inv?.id ||
        (inv?.email && SP.getInvestorById(i.investorId)?.email?.toLowerCase() === session.email?.toLowerCase())
      );
      if (entry) linkedEntries.push({ deal: d, entry });
    });
  }

  const totalInvested = linkedEntries.reduce((s, { entry }) => s + (entry.committed || 0), 0);

  // Distributions for this investor
  let allDists;
  if (_multiOrgData && _multiOrgData.distributions && _multiOrgData.distributions.length) {
    allDists = _multiOrgData.distributions.filter(d => d.status === 'posted');
  } else {
    allDists = SP.getDistributions().filter(d => d.status === 'posted');
  }
  const myDists = [];
  allDists.forEach(d => {
    if (!Array.isArray(d.recipients)) return;
    // For multi-org: match by org-specific investor ID
    const orgInvRec = _multiOrgData
      ? (_multiOrgData.investors || []).find(i => i._orgId === d._orgId)
      : null;
    const matchId = orgInvRec ? orgInvRec.id : inv?.id;
    const r = d.recipients.find(r =>
      r.investorId === matchId ||
      r.investorId === inv?.id ||
      (inv?.email && SP.getInvestorById(r.investorId)?.email?.toLowerCase() === session.email?.toLowerCase())
    );
    if (r) myDists.push({ dist: d, r });
  });
  const totalDist = myDists.reduce((s, { r }) => s + (r.amount || r.totalThisDist || 0), 0);

  // Average IRR
  const irrs = linkedEntries.map(({ deal }) => deal.irr).filter(Boolean);
  const avgIrr = irrs.length ? (irrs.reduce((a,b)=>a+b,0)/irrs.length).toFixed(1) + '%' : '—';

  // KPIs
  document.getElementById('kpiInvested').textContent = fmt$(totalInvested);
  document.getElementById('kpiDeals').textContent = linkedEntries.length;
  document.getElementById('kpiDist').textContent = fmt$(totalDist);
  document.getElementById('kpiIrr').textContent = avgIrr;

  // Welcome subtitle
  if (totalInvested > 0) {
    document.getElementById('welcomeSub').textContent =
      `You have ${linkedEntries.length} active investment${linkedEntries.length!==1?'s':''} totaling ${fmtFull$(totalInvested)}`;
  }

  // ── Performance chart: cumulative distributions over time ──
  _renderPerfChart(myDists, totalDist);

  // Dashboard deals
  const dashDealsEl = document.getElementById('dashDeals');
  if (linkedEntries.length) {
    dashDealsEl.innerHTML = linkedEntries.slice(0,5).map(({ deal, entry, gpName }) => {
      const STATUS_BADGE = {operating:'badge-operating',closed:'badge-closed',dd:'badge-active',loi:'badge-committed'};
      const STATUS_LABEL = {sourcing:'Sourcing',loi:'LOI',dd:'Due Diligence',operating:'Operating',closed:'Closed'};
      const gpTag = gpName ? `<span style="color:var(--accent);font-weight:600;">${gpName}</span> · ` : '';
      return `<div class="deal-item">
        <div>
          <div class="deal-name">${deal.name}</div>
          <div class="deal-meta">
            ${gpTag}${deal.location || '—'} · <span class="badge ${STATUS_BADGE[deal.status]||'badge-committed'}">${STATUS_LABEL[deal.status]||deal.status||'—'}</span>
            · ${entry.ownership ? entry.ownership.toFixed(2)+'% ownership' : '—'}
          </div>
        </div>
        <div class="deal-nums">
          <div class="invested">${fmtFull$(entry.committed||0)}</div>
          <div class="ownership">IRR: ${deal.irr ? deal.irr.toFixed(1)+'%' : '—'}</div>
        </div>
      </div>`;
    }).join('');
  } else {
    dashDealsEl.innerHTML = '<div class="empty-state"><i class="fas fa-building"></i><p>No deals linked to your account yet.<br>Contact your GP to get added to a deal.</p></div>';
  }

  // Dashboard distributions
  const dashDistsEl = document.getElementById('dashDists');
  if (myDists.length) {
    dashDistsEl.innerHTML = myDists.slice(-5).reverse().map(({ dist, r }) => {
      const amount = r.amount || r.totalThisDist || 0;
      return `<div class="dist-item">
        <div>
          <div class="dist-deal">${_resolveDealName(dist, allDeals)}</div>
          <div class="dist-period">${_distPeriod(dist)} · ${dist.method||'Wire'}</div>
        </div>
        <div class="dist-amount">${fmtFull$(amount)}</div>
      </div>`;
    }).join('');
  } else {
    dashDistsEl.innerHTML = '<div class="empty-state"><i class="fas fa-wallet"></i><p>No distributions yet.</p></div>';
  }

  // Investments page
  const invContent = document.getElementById('investmentsContent');
  if (linkedEntries.length) {
    invContent.innerHTML = linkedEntries.map(({ deal, entry, gpName }) => {
      const dealDists = myDists.filter(({ dist }) => dist.dealId === deal.id && (!deal._orgId || dist._orgId === deal._orgId));
      const dealDistTotal = dealDists.reduce((s, { r }) => s + (r.amount||r.totalThisDist||0), 0);
      const gpLine = gpName ? `<span style="color:var(--accent);font-weight:600;font-size:.72rem;">${gpName}</span> · ` : '';
      return `<div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <div>
            <div style="font-weight:700;">${deal.name}</div>
            <div style="font-size:.78rem;color:var(--text-muted);font-weight:400;margin-top:2px;">${gpLine}${deal.location||'—'} · ${deal.type||'—'}</div>
          </div>
          <span class="badge ${deal.status==='operating'?'badge-operating':deal.status==='closed'?'badge-closed':'badge-committed'}">${deal.status||'—'}</span>
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;flex-wrap:wrap;">
            <div><div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:4px;">Invested</div><div style="font-family:'JetBrains Mono',monospace;font-weight:700;font-size:1rem;">${fmtFull$(entry.committed||0)}</div></div>
            <div><div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:4px;">Ownership</div><div style="font-family:'JetBrains Mono',monospace;font-weight:700;">${entry.ownership ? entry.ownership.toFixed(2)+'%' : '—'}</div></div>
            <div><div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:4px;">Target IRR</div><div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--success);">${deal.irr ? deal.irr.toFixed(1)+'%' : '—'}</div></div>
            <div><div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:4px;">Distributions</div><div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--success);">${fmtFull$(dealDistTotal)}</div></div>
          </div>
          ${deal.prefReturn ? `<div style="margin-top:14px;padding:10px 14px;background:var(--border-light);border-radius:var(--radius);font-size:.82rem;color:var(--text-secondary);"><i class="fas fa-star" style="color:#f59e0b;margin-right:6px;"></i>Preferred return: <strong style="color:#1B1A19;">${deal.prefReturn}% per annum</strong> · GP promote: ${deal.gpPromote||'—'}%</div>` : ''}
        </div>
      </div>`;
    }).join('');
  } else {
    invContent.innerHTML = '<div class="empty-state"><i class="fas fa-building"></i><p>No investments yet.</p></div>';
  }

  // Distributions page
  const distContent = document.getElementById('distContent');
  // Store for CSV export
  window._portalDists = myDists;
  if (myDists.length) {
    // YTD summary
    const ytdBar = document.getElementById('distYtdBar');
    const currentYear = new Date().getFullYear();
    const ytdTotal = myDists.reduce((s, { dist, r }) => {
      const dYear = dist.year || (dist.date ? new Date(dist.date + 'T00:00:00').getFullYear() : 0);
      return s + (dYear === currentYear ? (r.amount || r.totalThisDist || 0) : 0);
    }, 0);
    if (ytdBar) {
      ytdBar.style.display = '';
      document.getElementById('distYtd').textContent = fmtFull$(ytdTotal);
      document.getElementById('distLifetime').textContent = fmtFull$(totalDist);
      const avgPerQtr = myDists.length > 0 ? totalDist / myDists.length : 0;
      document.getElementById('distAvgQtr').textContent = fmtFull$(Math.round(avgPerQtr));
    }
    const exportBtn = document.getElementById('distExportBtn');
    if (exportBtn) exportBtn.style.display = '';

    distContent.innerHTML = myDists.slice().reverse().map(({ dist, r }) => {
      const amount = r.amount || r.totalThisDist || 0;
      return `<div class="dist-item">
        <div>
          <div class="dist-deal">${_resolveDealName(dist, allDeals)}</div>
          <div class="dist-period">
            ${_distPeriod(dist)} ·
            ${dist.method||'Wire'}
          </div>
          ${r.prefPaidThisDist > 0 ? `<div style="font-size:.72rem;color:var(--warning);margin-top:3px;"><i class="fas fa-star"></i> Pref: ${fmtFull$(r.prefPaidThisDist)} + Excess: ${fmtFull$(r.excessThisDist||0)}</div>` : ''}
        </div>
        <div class="dist-amount">${fmtFull$(amount)}</div>
      </div>`;
    }).join('') + `<div style="padding:14px 0;border-top:2px solid #E2DDD8;margin-top:8px;display:flex;justify-content:space-between;font-weight:700;">
      <span>Total Received</span>
      <span style="font-family:'JetBrains Mono',monospace;color:var(--success);">${fmtFull$(totalDist)}</span>
    </div>`;
  } else {
    distContent.innerHTML = '<div class="empty-state"><i class="fas fa-wallet"></i><p>No distributions recorded yet.</p></div>';
  }

  // Documents page — categorized
  const docsContent = document.getElementById('docsContent');
  const allPortalDocs = [];
  const DOC_ICONS = { legal: 'fa-file-contract', tax: 'fa-file-invoice-dollar', reports: 'fa-chart-bar' };
  const DOC_COLORS = { legal: 'var(--accent)', tax: 'var(--purple)', reports: 'var(--success)' };

  linkedEntries.forEach(({ deal }) => {
    // Operating Agreements → Legal
    if (deal.generatedOA) allPortalDocs.push({ name: `${deal.name} — Operating Agreement`, cat: 'legal', type: 'OA', date: deal.oaGeneratedAt, dealId: deal.id });
    // Subscription Agreements → Legal
    if (deal.subAgreement) allPortalDocs.push({ name: `${deal.name} — Subscription Agreement`, cat: 'legal', type: 'Sub', date: deal.subAgreementAt, dealId: deal.id });
    // K-1s → Tax
    if (deal.k1Generated) allPortalDocs.push({ name: `${deal.name} — K-1 Statement`, cat: 'tax', type: 'K-1', date: deal.k1GeneratedAt, dealId: deal.id });
  });
  // Distribution statements → Reports (synthesize from dist history)
  myDists.forEach(({ dist, r }) => {
    const amount = r.amount || r.totalThisDist || 0;
    if (amount > 0) allPortalDocs.push({ name: `${_resolveDealName(dist, allDeals)} — Distribution Statement`, cat: 'reports', type: 'Dist', date: dist.date || dist.createdAt, dealId: dist.dealId, synthetic: true });
  });

  window._portalAllDocs = allPortalDocs; // for filtering

  _renderDocsList(allPortalDocs, docsContent, DOC_ICONS, DOC_COLORS);

  // Accreditation status
  const accredEl = document.getElementById('accredStatus');
  if (inv) {
    const today = new Date();
    let expiry = null;
    if (inv.accredExpiry) {
      // Handle Firestore Timestamp objects, ISO strings, or date strings
      if (inv.accredExpiry.toDate) expiry = inv.accredExpiry.toDate();
      else if (inv.accredExpiry.seconds) expiry = new Date(inv.accredExpiry.seconds * 1000);
      else expiry = new Date(inv.accredExpiry);
      // Validate the date is real
      if (isNaN(expiry.getTime())) expiry = null;
    }
    const daysLeft = expiry ? Math.ceil((expiry - today) / 86400000) : null;

    const certForm = document.getElementById('accredCertifyForm');
    const isVerified = inv.accredStatus === 'verified';
    const isExpiring = isVerified && daysLeft !== null && daysLeft <= 30 && daysLeft > 0;
    const isExpired = inv.accredStatus === 'expired' || (daysLeft !== null && daysLeft <= 0);

    if (isVerified && !isExpiring) {
      const methodLabels = { income:'Income', net_worth:'Net Worth', professional:'Professional Certification', entity:'Qualified Entity', knowledgeable:'Knowledgeable Employee', cpa:'CPA Verification', self_certified:'Self-Certified' };
      const methods = (inv.accredMethod || '').split(',').map(m => methodLabels[m.trim()] || m.trim()).filter(Boolean).join(', ');
      accredEl.innerHTML = `<div class="accred-card accred-ok">
        <i class="fas fa-check-circle" style="color:var(--success);font-size:1.2rem;"></i>
        <div>
          <div style="font-weight:600;color:var(--success);">Accredited Investor — Verified</div>
          <div style="font-size:.82rem;color:var(--text-secondary);margin-top:2px;">Method: ${methods||'On file'}${expiry ? ' · Expires: '+expiry.toLocaleDateString() : ''}${inv.accredCertifiedAt ? ' · Certified: '+new Date(inv.accredCertifiedAt).toLocaleDateString() : ''}</div>
        </div>
      </div>`;
      if (certForm) certForm.style.display = 'none';
    } else if (isExpiring) {
      accredEl.innerHTML = `<div class="accred-card accred-warn">
        <i class="fas fa-exclamation-triangle" style="color:var(--warning);font-size:1.2rem;"></i>
        <div>
          <div style="font-weight:600;color:var(--warning);">Accreditation Expiring in ${daysLeft} day${daysLeft!==1?'s':''}</div>
          <div style="font-size:.82rem;color:var(--text-secondary);margin-top:2px;">Please re-certify below before ${expiry ? expiry.toLocaleDateString() : 'expiration'}.</div>
        </div>
      </div>`;
      if (certForm) certForm.style.display = '';
    } else if (isExpired) {
      accredEl.innerHTML = `<div class="accred-card accred-exp">
        <i class="fas fa-times-circle" style="color:var(--danger);font-size:1.2rem;"></i>
        <div>
          <div style="font-weight:600;color:var(--danger);">Accreditation Expired</div>
          <div style="font-size:.82rem;color:var(--text-secondary);margin-top:2px;">Please re-certify below to continue investing.</div>
        </div>
      </div>`;
      if (certForm) certForm.style.display = '';
    } else {
      // Pending or no status — show certify form
      accredEl.innerHTML = `<div class="accred-card accred-warn">
        <i class="fas fa-shield-alt" style="color:var(--warning);font-size:1.2rem;"></i>
        <div>
          <div style="font-weight:600;color:var(--warning);">Accreditation Required</div>
          <div style="font-size:.82rem;color:var(--text-secondary);margin-top:2px;">Please self-certify below to confirm your accredited investor status.</div>
        </div>
      </div>`;
      if (certForm) certForm.style.display = '';
    }
  }

  // Profile
  if (inv) {
    const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    v('profFirst', inv.firstName);
    v('profLast', inv.lastName);
    v('profEmail', session.email);
    v('profPhone', inv.phone);
    v('profAddress', inv.address);
    // Tax / Entity
    v('profEntityType', inv.entityType);
    v('profTin', inv.tin);
    v('profEntityName', inv.entityName);
    v('profTaxAddress', inv.taxAddress);
    // Banking
    v('profBankName', inv.bankName);
    v('profBankHolder', inv.bankHolder);
    v('profRouting', inv.routing);
    v('profAcctNum', inv.acctNum);
    v('profAcctType', inv.acctType);
    v('profDistMethod', inv.distMethod || 'wire');
    // Show/hide entity name field based on entity type
    _toggleEntityName();
  } else {
    // Investor record not found — show email only
    const el = document.getElementById('profEmail');
    if (el) el.value = session.email || '';
  }
}
