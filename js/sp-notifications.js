/**
 * SyndicatePro Notifications Panel
 * Include on any GP page: <script src="js/sp-notifications.js"></script>
 * Requires sp-core.js loaded first.
 */
(function() {
  if (typeof SP === 'undefined') return;

  // ── Notification data ────────────────────────────────────────────────────────
  function getNotifications() {
    return SP.load('notifications', []);
  }
  function saveNotifications(notifs) {
    SP.save('notifications', notifs);
  }
  function addNotification(type, icon, color, title, body, link) {
    const notifs = getNotifications();
    notifs.unshift({ id: 'n' + Date.now(), type, icon, color, title, body, link, read: false, ts: Date.now() });
    saveNotifications(notifs.slice(0, 50));
    updateBadge();
  }
  function markAllRead() {
    const notifs = getNotifications().map(n => ({ ...n, read: true }));
    saveNotifications(notifs);
    updateBadge();
    renderPanel();
  }
  function markRead(id) {
    const notifs = getNotifications().map(n => n.id === id ? { ...n, read: true } : n);
    saveNotifications(notifs);
    updateBadge();
    renderPanel();
  }
  function clearAll() {
    saveNotifications([]);
    updateBadge();
    renderPanel();
  }

  // ── Badge ────────────────────────────────────────────────────────────────────
  function updateBadge() {
    const unread = getNotifications().filter(n => !n.read).length;
    const badge = document.getElementById('sp-notif-badge');
    if (!badge) return;
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.style.display = unread ? 'flex' : 'none';
  }

  // ── Panel HTML ────────────────────────────────────────────────────────────────
  function renderPanel() {
    const panel = document.getElementById('sp-notif-panel');
    if (!panel) return;
    const notifs = getNotifications();
    const unread = notifs.filter(n => !n.read).length;
    panel.innerHTML = `
      <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-weight:700;font-size:1rem;">Notifications ${unread?`<span style="background:#ef4444;color:white;padding:2px 7px;border-radius:10px;font-size:.72rem;margin-left:4px;">${unread}</span>`:''}
        </div>
        <div style="display:flex;gap:8px;">
          ${unread?`<button onclick="window._spNotif.markAllRead()" style="font-size:.75rem;color:#3b82f6;background:none;border:none;cursor:pointer;font-family:inherit;font-weight:600;">Mark all read</button>`:''}
          <button onclick="window._spNotif.clearAll()" style="font-size:.75rem;color:#94a3b8;background:none;border:none;cursor:pointer;font-family:inherit;">Clear all</button>
        </div>
      </div>
      <div style="overflow-y:auto;max-height:calc(100vh - 160px);">
        ${!notifs.length ? `<div style="text-align:center;padding:40px;color:#94a3b8;"><i class="fas fa-bell-slash" style="font-size:2rem;opacity:.3;display:block;margin-bottom:12px;"></i><p style="font-size:.875rem;">No notifications yet</p></div>` :
          notifs.map(n => `
            <div onclick="window._spNotif.markRead('${n.id}')" style="display:flex;gap:12px;padding:14px 20px;border-bottom:1px solid #f1f5f9;cursor:pointer;background:${n.read?'white':'#f0f9ff'};transition:background .15s;">
              <div style="width:34px;height:34px;border-radius:50%;background:${n.color==='blue'?'#dbeafe':n.color==='green'?'#d1fae5':n.color==='amber'?'#fef3c7':n.color==='danger'?'#fee2e2':'#ede9fe'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:.85rem;color:${n.color==='blue'?'#3b82f6':n.color==='green'?'#10b981':n.color==='amber'?'#f59e0b':n.color==='danger'?'#ef4444':'#8b5cf6'};">
                <i class="fas ${n.icon}"></i>
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:${n.read?'500':'700'};font-size:.875rem;margin-bottom:2px;">${n.title}</div>
                <div style="font-size:.78rem;color:#64748b;">${n.body}</div>
                <div style="font-size:.72rem;color:#94a3b8;margin-top:3px;">${timeAgo(n.ts)}</div>
              </div>
              ${!n.read?'<div style="width:8px;height:8px;border-radius:50%;background:#3b82f6;flex-shrink:0;margin-top:6px;"></div>':''}
            </div>`).join('')}
      </div>`;
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
    return Math.floor(diff/86400000) + 'd ago';
  }

  // ── Panel toggle ─────────────────────────────────────────────────────────────
  function togglePanel() {
    const panel = document.getElementById('sp-notif-panel');
    const overlay = document.getElementById('sp-notif-overlay');
    if (!panel) return;
    const open = panel.style.transform === 'translateX(0px)';
    panel.style.transform = open ? 'translateX(100%)' : 'translateX(0px)';
    overlay.style.display = open ? 'none' : 'block';
    if (!open) renderPanel();
  }

  // ── Auto-generate notifications from app state ───────────────────────────────
  function checkForAlerts() {
    const investors = SP.getInvestors();
    const today = new Date();
    const existing = getNotifications();

    investors.forEach(inv => {
      if (!inv.accredExpiry || inv.accredStatus !== 'verified') return;
      const days = Math.ceil((new Date(inv.accredExpiry) - today) / 86400000);
      const key = `accred-expiry-${inv.id}`;
      if (days >= 0 && days <= 30 && !existing.find(n => n.id === key)) {
        const n = { id: key, type:'accred', icon:'fa-shield-alt', color:'amber',
          title: `Accreditation expiring soon`,
          body: `${inv.firstName} ${inv.lastName}'s accreditation expires in ${days} day${days!==1?'s':''}.`,
          link: 'investors.html', read: false, ts: Date.now() };
        const notifs = getNotifications();
        if (!notifs.find(x=>x.id===key)) { notifs.unshift(n); saveNotifications(notifs.slice(0,50)); }
      }
    });

    // Capital call overdue checks
    const calls = SP.load('capitalCalls', []);
    calls.forEach(c => {
      if (c.status === 'received' || !c.dueDate) return;
      const days = Math.ceil((new Date(c.dueDate) - today) / 86400000);
      if (days < 0) {
        const key = `cc-overdue-${c.id}`;
        const notifs = getNotifications();
        if (!notifs.find(x=>x.id===key)) {
          notifs.unshift({ id:key, type:'cc', icon:'fa-hand-holding-usd', color:'danger',
            title: 'Capital call overdue',
            body: `${c.dealName} ${c.callNumber} call — ${Math.abs(days)} days overdue`,
            link: 'capital-calls.html', read: false, ts: Date.now() });
          saveNotifications(notifs.slice(0,50));
        }
      }
    });

    updateBadge();
  }

  // ── Inject UI ─────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function() {
    if (!SP.isGP()) return;

    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'sp-notif-overlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:298;';
    overlay.onclick = togglePanel;
    document.body.appendChild(overlay);

    // Slide-in panel
    const panel = document.createElement('div');
    panel.id = 'sp-notif-panel';
    panel.style.cssText = 'position:fixed;top:0;right:0;width:360px;height:100vh;background:white;box-shadow:-4px 0 24px rgba(0,0,0,.12);z-index:299;transform:translateX(100%);transition:transform .3s;font-family:Inter,sans-serif;';
    document.body.appendChild(panel);

    // Wire bell buttons
    document.querySelectorAll('.btn-icon[title="Notifications"], .notification-dot').forEach(btn => {
      // Replace with wrapper that includes badge
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:relative;display:inline-flex;';
      btn.parentNode.insertBefore(wrap, btn);
      wrap.appendChild(btn);
      const badge = document.createElement('div');
      badge.id = 'sp-notif-badge';
      badge.style.cssText = 'position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;background:#ef4444;color:white;border-radius:9px;font-size:.65rem;font-weight:700;display:none;align-items:center;justify-content:center;padding:0 4px;border:2px solid white;font-family:inherit;';
      wrap.appendChild(badge);
      btn.onclick = togglePanel;
      btn.style.cursor = 'pointer';
    });

    checkForAlerts();
  });

  // Expose API
  window._spNotif = { addNotification, markAllRead, markRead, clearAll, togglePanel };

  // Hook into SP.logActivity to generate notifications for important events
  const origLog = SP.logActivity;
  SP.logActivity = function(icon, color, text) {
    origLog.call(SP, icon, color, text);
    // Strip HTML for notification title
    const clean = text.replace(/<[^>]+>/g, '');
    if (['fa-user-plus','fa-link','fa-paper-plane','fa-wallet','fa-hand-holding-usd'].some(ic => icon.includes(ic.replace('fa-','')))) {
      const notifs = getNotifications();
      notifs.unshift({ id:'act'+Date.now(), type:'activity', icon: icon.includes('fa-') ? icon : 'fa-'+icon, color, title: clean.slice(0,60), body: '', link:'dashboard.html', read:false, ts:Date.now() });
      saveNotifications(notifs.slice(0,50));
      updateBadge();
    }
  };
})();
