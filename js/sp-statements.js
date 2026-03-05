/**
 * sp-statements.js - Capital Account Statement Engine
 * Aggregates deal data from Firestore for individualized LP statements.
 */

const SP_Statements = {
    async generate(investorId, dealId) {
        console.log(`Generating statement for Investor: ${investorId}, Deal: ${dealId}`);
        
        // 1. Pull data from Firestore
        const investment = await this.getInvestment(investorId, dealId);
        const distributions = await this.getDistributions(investorId, dealId);
        
        if (!investment) return null;

        // 2. Run Calculations
        const totalContributed = investment.amount || 0;
        const totalDistributed = distributions.reduce((sum, d) => sum + d.amount, 0);
        const currentBalance = investment.currentValue || totalContributed;
        
        // Yield-to-Date (YTD) - Simple Annualized
        const startDate = new Date(investment.date);
        const today = new Date();
        const daysInDeal = Math.max(1, (today - startDate) / (1000 * 60 * 60 * 24));
        const annualizedYield = (totalDistributed / totalContributed) / (daysInDeal / 365) * 100;

        // TVPI (Total Value to Paid-In)
        const tvpi = (currentBalance + totalDistributed) / totalContributed;

        return {
            investorName: investment.investorName,
            dealName: investment.dealName,
            periodStart: investment.date,
            periodEnd: today.toISOString().split('T')[0],
            contributions: totalContributed,
            distributions: totalDistributed,
            endingBalance: currentBalance,
            metrics: {
                yieldYTD: annualizedYield.toFixed(2) + '%',
                tvpi: tvpi.toFixed(2) + 'x',
                irr: 'TBD' // Advanced math for later
            },
            history: distributions.map(d => ({
                date: d.date,
                type: 'Distribution',
                amount: d.amount
            }))
        };
    },

    async getInvestment(investorId, dealId) {
        // Placeholder for real Firestore call (using sp-firebase.js)
        return {
            investorName: "Demo Investor",
            dealName: "Summit Ridge Apartments",
            amount: 100000,
            currentValue: 105000,
            date: "2025-01-01"
        };
    },

    async getDistributions(investorId, dealId) {
        // Placeholder for real Firestore call
        return [
            { date: "2025-04-01", amount: 2000 },
            { date: "2025-07-01", amount: 2200 },
            { date: "2025-10-01", amount: 2100 },
            { date: "2026-01-01", amount: 2300 }
        ];
    },

    renderUI(data) {
        if (!data) return;
        
        const container = document.getElementById('statement-content');
        if (!container) return;

        container.innerHTML = `
            <div class="statement-header">
                <h2>INVESTOR CAPITAL ACCOUNT</h2>
                <p>Period: ${data.periodStart} to ${data.periodEnd}</p>
            </div>
            
            <div class="statement-summary-grid">
                <div class="stat-box">
                    <label>Total Contributed</label>
                    <div class="value">$${data.contributions.toLocaleString()}</div>
                </div>
                <div class="stat-box">
                    <label>Total Distributed</label>
                    <div class="value">$${data.distributions.toLocaleString()}</div>
                </div>
                <div class="stat-box">
                    <label>Ending Balance</label>
                    <div class="value">$${data.endingBalance.toLocaleString()}</div>
                </div>
            </div>

            <div class="statement-metrics-row">
                <div class="metric">Yield (YTD): <strong>${data.metrics.yieldYTD}</strong></div>
                <div class="metric">TVPI: <strong>${data.metrics.tvpi}</strong></div>
            </div>

            <table class="statement-history">
                <thead>
                    <tr><th>Date</th><th>Description</th><th class="text-right">Amount</th></tr>
                </thead>
                <tbody>
                    <tr><td>${data.periodStart}</td><td>Initial Investment</td><td class="text-right">$${data.contributions.toLocaleString()}</td></tr>
                    ${data.history.map(h => `
                        <tr><td>${h.date}</td><td>${h.type}</td><td class="text-right">$${h.amount.toLocaleString()}</td></tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
};

window.SP_Statements = SP_Statements;
