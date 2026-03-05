/**
 * sp-pipeline.js - Deal Sourcing & Underwriting Engine
 * Manages the "Top of Funnel" pipeline from sourcing to closing.
 */

const SP_Pipeline = {
    STAGES: ['Sourcing', 'Underwriting', 'LOI', 'Due Diligence', 'Closing', 'Operating'],

    async getPipeline() {
        if (!SPFB.isReady()) return [];
        const snap = await firebase.firestore().collection('orgs').doc(SPFB.getOrgId())
            .collection('pipeline').orderBy('updatedAt', 'desc').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async updateStage(dealId, newStage) {
        if (!SPFB.isReady()) return;
        await firebase.firestore().collection('orgs').doc(SPFB.getOrgId())
            .collection('pipeline').doc(dealId).update({
                stage: newStage,
                updatedAt: new Date()
            });
    },

    async recordUnderwriting(dealId, metrics) {
        // metrics: { capRate, grp, noi, dsr }
        await firebase.firestore().collection('orgs').doc(SPFB.getOrgId())
            .collection('pipeline').doc(dealId).update({
                underwriting: metrics,
                score: this.calculateScore(metrics),
                updatedAt: new Date()
            });
    },

    calculateScore(m) {
        // Institutional scoring logic (simplified for demo)
        let score = 0;
        if (m.capRate > 0.06) score += 30;
        if (m.dsr > 1.25) score += 40;
        if (m.irr > 15) score += 30;
        return score;
    }
};

window.SP_Pipeline = SP_Pipeline;
