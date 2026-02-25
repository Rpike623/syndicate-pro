/**
 * sp-email.js — deeltrack Email System
 *
 * Sends transactional emails via EmailJS (client-side, no backend).
 * Falls back to mailto: if EmailJS not configured.
 *
 * EmailJS setup (free, 200 emails/month):
 *   1. Sign up at emailjs.com
 *   2. Add an email service (Gmail, Outlook, etc.)
 *   3. Create templates for each email type
 *   4. Set SERVICE_ID, PUBLIC_KEY in settings
 *
 * All sent emails are logged to Firebase (orgs/{orgId}/emails/{id})
 * and localStorage as backup.
 */

const SPEmail = (function () {
  'use strict';

  // ── Config (loaded from SP settings) ────────────────────────────────────────
  let _config = {
    serviceId:  null,
    publicKey:  null,
    fromName:   'deeltrack',
    fromEmail:  '',
    configured: false,
  };

  // ── Email templates ──────────────────────────────────────────────────────────
  const TEMPLATES = {

    welcome: {
      subject: 'Welcome to {{dealName}} — Your Investment Portal',
      html: (vars) => `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#0ea5e9;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
            <h1 style="color:white;margin:0;font-size:1.5rem;">Welcome, {{investorName}}!</h1>
          </div>
          <div style="background:#f8fafc;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;">
            <p style="font-size:1rem;color:#1e293b;">You've been added as an investor in <strong>{{dealName}}</strong>.</p>
            <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
              <p style="margin:0 0 8px;color:#64748b;font-size:.875rem;">YOUR INVESTMENT</p>
              <p style="margin:0;font-size:1.5rem;font-weight:700;color:#0ea5e9;">$\{{commitmentFormatted}}</p>
              <p style="margin:4px 0 0;color:#64748b;font-size:.875rem;">{{ownershipPct}}% ownership</p>
            </div>
            <p style="color:#475569;">Your GP will share deal documents, updates, and distribution notices through this portal. You can view your investment details and documents at any time.</p>
            <div style="text-align:center;margin:24px 0;">
              <a href="{{portalUrl}}" style="background:#0ea5e9;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:.95rem;">View My Investment Portal →</a>
            </div>
            <p style="color:#94a3b8;font-size:.8rem;text-align:center;margin-top:24px;">Questions? Reply to this email or contact your GP directly.</p>
          </div>
        </div>`,
    },

    capitalCall: {
      subject: 'Capital Call — {{dealName}} | Due {{dueDate}}',
      html: (vars) => `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#f59e0b;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
            <h1 style="color:white;margin:0;font-size:1.4rem;">⚡ Capital Call Notice</h1>
            <p style="color:rgba(255,255,255,.9);margin:8px 0 0;">{{dealName}}</p>
          </div>
          <div style="background:#f8fafc;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;">
            <p style="font-size:1rem;color:#1e293b;">Dear {{investorName}},</p>
            <p style="color:#475569;">A capital call has been issued for your investment in <strong>{{dealName}}</strong>. Please wire your contribution by the due date.</p>
            <div style="background:white;border:2px solid #f59e0b;border-radius:8px;padding:20px;margin:20px 0;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:8px 0;color:#64748b;font-size:.875rem;">Amount Due</td><td style="text-align:right;font-weight:700;font-size:1.25rem;color:#f59e0b;">$\{{amountDue}}</td></tr>
                <tr><td style="padding:8px 0;color:#64748b;font-size:.875rem;border-top:1px solid #f1f5f9;">Due Date</td><td style="text-align:right;font-weight:600;border-top:1px solid #f1f5f9;">{{dueDate}}</td></tr>
                <tr><td style="padding:8px 0;color:#64748b;font-size:.875rem;border-top:1px solid #f1f5f9;">Purpose</td><td style="text-align:right;border-top:1px solid #f1f5f9;">{{purpose}}</td></tr>
              </table>
            </div>
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:20px 0;">
              <p style="margin:0 0 8px;font-weight:600;color:#92400e;">Wire Instructions</p>
              <p style="margin:0;font-size:.875rem;color:#78350f;white-space:pre-line;">{{wireInstructions}}</p>
            </div>
            <p style="color:#94a3b8;font-size:.8rem;text-align:center;margin-top:24px;">Questions? Contact your GP immediately. Late contributions may affect your ownership percentage.</p>
          </div>
        </div>`,
    },

    distribution: {
      subject: '💰 Distribution Notice — {{dealName}} | {{period}}',
      html: (vars) => `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#10b981;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
            <h1 style="color:white;margin:0;font-size:1.4rem;">💰 Distribution Notice</h1>
            <p style="color:rgba(255,255,255,.9);margin:8px 0 0;">{{dealName}} · {{period}}</p>
          </div>
          <div style="background:#f8fafc;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;">
            <p style="font-size:1rem;color:#1e293b;">Dear {{investorName}},</p>
            <p style="color:#475569;">Great news — a distribution has been issued for your investment in <strong>{{dealName}}</strong>.</p>
            <div style="background:white;border:2px solid #10b981;border-radius:8px;padding:24px;margin:20px 0;text-align:center;">
              <p style="margin:0 0 4px;color:#64748b;font-size:.875rem;text-transform:uppercase;letter-spacing:.05em;">Your Distribution</p>
              <p style="margin:0;font-size:2.5rem;font-weight:700;color:#10b981;">$\{{amount}}</p>
              <p style="margin:4px 0 0;color:#64748b;font-size:.875rem;">{{ownershipPct}}% of $\{{totalDistribution}} total</p>
            </div>
            <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:20px 0;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#64748b;font-size:.875rem;">Distribution Type</td><td style="text-align:right;font-weight:600;">{{distributionType}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;font-size:.875rem;border-top:1px solid #f1f5f9;">Distribution Date</td><td style="text-align:right;font-weight:600;border-top:1px solid #f1f5f9;">{{date}}</td></tr>
                <tr><td style="padding:6px 0;color:#64748b;font-size:.875rem;border-top:1px solid #f1f5f9;">Payment Method</td><td style="text-align:right;border-top:1px solid #f1f5f9;">{{paymentMethod}}</td></tr>
              </table>
            </div>
            <p style="color:#94a3b8;font-size:.8rem;text-align:center;margin-top:24px;">Funds are processed within 3–5 business days. Questions? Contact your GP.</p>
          </div>
        </div>`,
    },

    dealUpdate: {
      subject: '📊 Deal Update — {{dealName}}',
      html: (vars) => `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#6366f1;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
            <h1 style="color:white;margin:0;font-size:1.4rem;">📊 Investor Update</h1>
            <p style="color:rgba(255,255,255,.9);margin:8px 0 0;">{{dealName}} · {{updateDate}}</p>
          </div>
          <div style="background:#f8fafc;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;">
            <p style="font-size:1rem;color:#1e293b;">Dear {{investorName}},</p>
            <div style="color:#475569;line-height:1.7;">{{messageBody}}</div>
            <div style="margin:24px 0;padding:16px;background:white;border-left:4px solid #6366f1;border-radius:0 8px 8px 0;">
              <p style="margin:0 0 8px;font-weight:600;color:#1e293b;">Key Metrics</p>
              <p style="margin:0;font-size:.875rem;color:#64748b;white-space:pre-line;">{{keyMetrics}}</p>
            </div>
            <p style="color:#94a3b8;font-size:.8rem;text-align:center;margin-top:24px;">View full details in your investor portal.</p>
          </div>
        </div>`,
    },

    docShared: {
      subject: '📄 New Document Available — {{docName}}',
      html: (vars) => `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#1e293b;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
            <h1 style="color:white;margin:0;font-size:1.4rem;">📄 Document Available</h1>
            <p style="color:rgba(255,255,255,.7);margin:8px 0 0;">{{dealName}}</p>
          </div>
          <div style="background:#f8fafc;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;">
            <p style="font-size:1rem;color:#1e293b;">Dear {{investorName}},</p>
            <p style="color:#475569;">A new document has been shared with you for <strong>{{dealName}}</strong>:</p>
            <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;display:flex;align-items:center;gap:16px;">
              <span style="font-size:2rem;">📄</span>
              <div>
                <p style="margin:0;font-weight:600;color:#1e293b;">{{docName}}</p>
                <p style="margin:4px 0 0;color:#64748b;font-size:.875rem;">{{docType}} · Shared {{sharedDate}}</p>
              </div>
            </div>
            <div style="text-align:center;margin:24px 0;">
              <a href="{{portalUrl}}" style="background:#1e293b;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:.95rem;">View Document →</a>
            </div>
          </div>
        </div>`,
    },
  };

  // ── Init ────────────────────────────────────────────────────────────────────
  function init() {
    const settings = (typeof SP !== 'undefined') ? SP.load('settings', {}) : {};
    _config.serviceId  = settings.emailjsServiceId  || null;
    _config.publicKey  = settings.emailjsPublicKey  || null;
    _config.fromName   = settings.firmName          || 'deeltrack';
    _config.fromEmail  = settings.firmEmail         || '';
    _config.configured = !!(settings.emailjsServiceId && settings.emailjsPublicKey);

    // Load EmailJS SDK if configured
    if (_config.configured && typeof emailjs === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
      script.onload = () => {
        emailjs.init({ publicKey: _config.publicKey });
        console.log('SPEmail: EmailJS initialized');
      };
      document.head.appendChild(script);
    }
  }

  // ── Template interpolation ───────────────────────────────────────────────────
  function _interpolate(template, vars) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] || match);
  }

  function buildEmail(type, vars) {
    const tpl = TEMPLATES[type];
    if (!tpl) throw new Error(`Unknown email template: ${type}`);
    return {
      subject: _interpolate(tpl.subject, vars),
      html:    _interpolate(tpl.html(vars), vars),
      text:    vars.messageBody || `${vars.subject || ''}\n\nPlease view this email in an HTML-capable email client.`,
    };
  }

  // ── Send ─────────────────────────────────────────────────────────────────────

  /**
   * Send an email to one or more recipients.
   * @param {string} type - template name
   * @param {string|string[]} to - email address(es)
   * @param {object} vars - template variables
   * @param {string} templateId - EmailJS template ID (optional, uses 'default' if not set)
   */
  async function send(type, to, vars, templateId = 'template_deeltrack') {
    const recipients = Array.isArray(to) ? to : [to];
    const { subject, html, text } = buildEmail(type, vars);
    const results = [];

    for (const email of recipients) {
      const result = await _sendOne(email, subject, html, text, templateId, vars);
      results.push(result);
      // Log to Firebase + localStorage
      await _logEmail({ type, to: email, subject, vars, status: result.status, sentAt: new Date().toISOString() });
    }

    return results;
  }

  async function _sendOne(to, subject, html, text, templateId, vars) {
    // Method 1: Firebase Cloud Function (preferred — uses GoDaddy SMTP)
    if (typeof firebase !== 'undefined' && typeof SPFB !== 'undefined' && SPFB.isReady()) {
      try {
        const fn = firebase.functions().httpsCallable('sendEmail');
        const result = await fn({ to, subject, html, text, type: vars._type || 'custom' });
        if (result.data.success) {
          return { status: 'sent', to, method: 'cloud-function' };
        }
      } catch (e) {
        console.warn('SPEmail Cloud Function failed, trying EmailJS:', e.message);
      }
    }

    // Method 2: EmailJS fallback
    if (_config.configured && typeof emailjs !== 'undefined') {
      try {
        await emailjs.send(_config.serviceId, templateId, {
          to_email:   to,
          to_name:    vars.investorName || to,
          from_name:  _config.fromName,
          from_email: _config.fromEmail,
          subject,
          html_body:  html,
          text_body:  text,
          reply_to:   _config.fromEmail,
        });
        return { status: 'sent', to, method: 'emailjs' };
      } catch (e) {
        console.error('SPEmail EmailJS error:', e);
        return { status: 'error', to, error: e.message, method: 'emailjs' };
      }
    }

    // Method 3: mailto fallback (dev/offline mode)
    _openMailto(to, subject, text);
    return { status: 'mailto', to, method: 'mailto' };
  }

  function _openMailto(to, subject, body) {
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  }

  // ── Convenience senders ──────────────────────────────────────────────────────

  async function sendWelcome(investor, deal) {
    const vars = {
      investorName:        `${investor.firstName} ${investor.lastName}`,
      dealName:            deal.name,
      commitmentFormatted: '$' + Number(investor.commitmentAmount || 0).toLocaleString(),
      ownershipPct:        investor.ownershipPct || '—',
      portalUrl:           window.location.origin + '/syndicate-pro/investor-portal.html',
    };
    return send('welcome', investor.email, vars);
  }

  async function sendCapitalCall(call, investors) {
    const results = [];
    for (const inv of investors) {
      const recipient = call.recipients?.find(r => r.investorId === inv.id);
      if (!recipient) continue;
      const vars = {
        investorName:     `${inv.firstName} ${inv.lastName}`,
        dealName:         call.dealName,
        amountDue:        '$' + Number(recipient.amount || 0).toLocaleString(),
        dueDate:          call.dueDate || '—',
        purpose:          call.purpose || 'Acquisition / operations',
        wireInstructions: call.wireInstructions || 'Wire instructions will be provided separately.',
      };
      results.push(await send('capitalCall', inv.email, vars));
    }
    return results;
  }

  async function sendDistribution(dist, investors) {
    const results = [];
    for (const inv of investors) {
      const recipient = dist.recipients?.find(r => r.investorId === inv.id);
      if (!recipient) continue;
      const vars = {
        investorName:       `${inv.firstName} ${inv.lastName}`,
        dealName:           dist.dealName,
        amount:             '$' + Number(recipient.amount || 0).toLocaleString(),
        ownershipPct:       recipient.ownership || '—',
        totalDistribution:  '$' + Number(dist.totalAmount || 0).toLocaleString(),
        period:             dist.period || '—',
        date:               dist.date || new Date().toLocaleDateString(),
        distributionType:   dist.type || 'Cash Distribution',
        paymentMethod:      dist.paymentMethod || 'Wire Transfer',
      };
      results.push(await send('distribution', inv.email, vars));
    }
    return results;
  }

  async function sendDocumentNotification(doc, investors) {
    const results = [];
    const typeLabels = { oa: 'Operating Agreement', ppm: 'PPM', k1: 'K-1 Tax Document', subscription: 'Subscription Agreement' };
    for (const inv of investors) {
      const vars = {
        investorName: `${inv.firstName} ${inv.lastName}`,
        dealName:     doc.dealName || '—',
        docName:      doc.name,
        docType:      typeLabels[doc.type] || doc.type,
        sharedDate:   new Date().toLocaleDateString(),
        portalUrl:    window.location.origin + '/syndicate-pro/investor-portal.html',
      };
      results.push(await send('docShared', inv.email, vars));
    }
    return results;
  }

  async function sendDealUpdate(dealName, messageBody, keyMetrics, investors) {
    const results = [];
    for (const inv of investors) {
      const vars = {
        investorName: `${inv.firstName} ${inv.lastName}`,
        dealName,
        messageBody,
        keyMetrics:   keyMetrics || '',
        updateDate:   new Date().toLocaleDateString(),
      };
      results.push(await send('dealUpdate', inv.email, vars));
    }
    return results;
  }

  // ── Logging ──────────────────────────────────────────────────────────────────

  async function _logEmail(entry) {
    // Always log to localStorage
    const log = (typeof SP !== 'undefined') ? SP.load('emailLog', []) : [];
    log.unshift({ ...entry, id: 'em' + Date.now() });
    if (log.length > 500) log.splice(500); // cap at 500
    if (typeof SP !== 'undefined') SP.save('emailLog', log);

    // Also log to Firebase if ready
    if (typeof SPFB !== 'undefined' && SPFB.isReady() && !SPFB.isOffline()) {
      try {
        const orgId = SPFB.getOrgId();
        if (orgId) {
          await firebase.firestore().collection('orgs').doc(orgId).collection('emails').add({
            ...entry,
            orgId,
            loggedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (e) { /* silently fail — local log is fine */ }
    }
  }

  function getEmailLog(limit = 50) {
    return (typeof SP !== 'undefined') ? SP.load('emailLog', []).slice(0, limit) : [];
  }

  // ── Configuration check ──────────────────────────────────────────────────────

  function isConfigured() { return _config.configured; }

  function getSetupInstructions() {
    return {
      steps: [
        'Sign up free at https://emailjs.com',
        'Add an Email Service (Gmail, Outlook, SMTP)',
        'Create a template named "template_deeltrack" with variables: to_email, to_name, subject, html_body',
        'Copy your Service ID and Public Key',
        'Go to deeltrack Settings → Notifications and enter those values',
      ],
      note: 'Free plan: 200 emails/month. Paid plans start at $15/month for 1,000 emails.',
    };
  }

  // ── Public API ───────────────────────────────────────────────────────────────
  return {
    init,
    buildEmail,
    send,
    sendWelcome,
    sendCapitalCall,
    sendDistribution,
    sendDocumentNotification,
    sendDealUpdate,
    getEmailLog,
    isConfigured,
    getSetupInstructions,
    TEMPLATES,
  };
})();

// Auto-init when DOM is ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => SPEmail.init());
}
