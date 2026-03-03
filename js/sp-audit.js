/**
 * sp-audit.js — Advanced Audit Logging & Data Integrity
 * Tracks critical deal and investor actions for compliance and GP oversight.
 */

const SPAudit = (() => {
  const _id = (prefix) => prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

  async function log(action, entityType, entityId, entityName, detail) {
    if (typeof SPData === 'undefined' || !SPData.isReady()) {
      console.warn('SPAudit: Data layer not ready, skipping log.');
      return;
    }

    const session = typeof SP !== 'undefined' ? SP.getSession() : null;
    const entry = {
      id: _id('audit'),
      timestamp: Date.now(),
      userEmail: session?.email || 'system',
      userName: session?.name || 'System',
      userRole: session?.role || 'Unknown',
      action, // 'create', 'update', 'delete', 'export', 'invite'
      entityType, // 'deal', 'investor', 'distribution', 'settings'
      entityId,
      entityName,
      detail, // String or Objectified change-set
      orgId: SPData.getOrgId()
    };

    // 1. Push to Firebase via SPData pattern if available
    try {
      const db = firebase.firestore();
      const orgId = SPData.getOrgId();
      if (db && orgId) {
        await db.collection('orgs').doc(orgId).collection('audit_logs').doc(entry.id).set(entry);
      }
    } catch (e) {
      console.error('SPAudit: Firestore write failed:', e.message);
    }

    // 2. Local fallback / mirroring if necessary
    console.log(`[AUDIT] ${entry.userName} (${entry.userRole}) ${action} ${entityType}: ${entityName}`, detail);
  }

  function getActionVerb(action) {
    const verbs = { 
      'create': 'created', 'update': 'modified', 'delete': 'removed', 
      'export': 'exported', 'invite': 'invited', 'link': 'linked' 
    };
    return verbs[action] || action;
  }

  return { log, getActionVerb };
})();
