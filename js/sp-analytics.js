/**
 * sp-analytics.js - Engagement Tracking Engine
 * Instruments the Offering Memorandum (OM) to track investor activity.
 */

const SP_Analytics = {
    _startTime: null,
    _investorId: null,
    _dealId: null,

    init(investorId, dealId) {
        this._investorId = investorId;
        this._dealId = dealId;
        this._startTime = Date.now();
        console.log(`Engagement tracking started for Investor: ${investorId}, Deal: ${dealId}`);
        
        // Track initial view
        this.logEvent('view_om');

        // Track "dwell time" every 30 seconds
        setInterval(() => this.logPulse(), 30000);
        
        // Track section scrolls
        this.trackScroll();
    },

    async logPulse() {
        const dwell = Math.round((Date.now() - this._startTime) / 1000);
        await this.logEvent('pulse_om', { seconds_since_start: dwell });
    },

    async logEvent(eventType, metadata = {}) {
        if (!this._investorId || !this._dealId) return;

        if (typeof SPFB !== 'undefined' && SPFB.isReady()) {
            try {
                await firebase.firestore().collection('orgs')
                    .doc(SPFB.getOrgId())
                    .collection('deals')
                    .doc(this._dealId)
                    .collection('engagement')
                    .add({
                        investorId: this._investorId,
                        eventType: eventType,
                        timestamp: new Date(),
                        metadata: metadata,
                        userAgent: navigator.userAgent
                    });
            } catch (e) { console.warn('Analytics log failed:', e); }
        }
    },

    trackScroll() {
        let lastSection = '';
        window.addEventListener('scroll', () => {
            const sections = document.querySelectorAll('section[id]');
            sections.forEach(sec => {
                const rect = sec.getBoundingClientRect();
                if (rect.top >= 0 && rect.top <= 200) {
                    if (sec.id !== lastSection) {
                        lastSection = sec.id;
                        this.logEvent('scroll_section', { section: sec.id });
                    }
                }
            });
        }, { passive: true });
    },

    async getHeatmapData(dealId) {
        if (typeof SPFB === 'undefined' || !SPFB.isReady()) return [];
        
        const snap = await firebase.firestore().collection('orgs')
            .doc(SPFB.getOrgId())
            .collection('deals')
            .doc(dealId)
            .collection('engagement')
            .orderBy('timestamp', 'desc')
            .limit(1000)
            .get();
            
        return snap.docs.map(doc => doc.data());
    }
};

window.SP_Analytics = SP_Analytics;
