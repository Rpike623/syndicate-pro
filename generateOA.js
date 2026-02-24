function generateOperatingAgreement(data) {
  // State-specific provisions dictionary
  const stateProvisions = {
    'DE': `Delaware-Specific Provisions: Series LLC permitted under Section 18-215. Charging order sole remedy under Section 18-703.`,
    'TX': `Texas-Specific Provisions: Partnership tax treatment under TX Tax Code §171.0002. Franchise tax obligations acknowledged.`,
    'CA': `California-Specific Provisions: Minimum $800 franchise tax under Rev & Tax Code §17941. Registered agent required per Corp Code §17701.13.`,
    'NY': `New York-Specific Provisions: Publication requirements satisfied under LLC Law §206. Member liability limited per LLC Law §609.`,
    'FL': `Florida-Specific Provisions: Registered agent maintained per §605.0113. Annual reports filed with Division of Corporations.`,
    'NV': `Nevada-Specific Provisions: Charging order exclusive remedy per NRS 86.401. Series LLC permitted under NRS 86.296.`,
    'WY': `Wyoming-Specific Provisions: Charging order protection per W.S. 17-29-503. Member information not publicly filed.`
  };

  const stateClause = stateProvisions[data.state] || stateProvisions['DE'];
  
  // Waterfall configuration
  const wfType = data.waterfallType || 'catchup';
  const prefReturn = data.prefReturn || 8;
  const gpPromote = data.gpPromote || 30;
  const lpShare = 100 - gpPromote;
  const catchupRate = data.catchupRate || 50;

  let waterfallSection = '';
  
  if (wfType === 'simple') {
    waterfallSection = `4.2 Simple Split. After return of capital, all remaining Distributable Cash shall be distributed ${gpPromote}% to the Managing Member and ${lpShare}% to Limited Partners.`;
  } else if (wfType === 'pref') {
    waterfallSection = `
      4.2 Return of Capital. First, to Members pro rata until Capital Contributions returned.
      4.3 Preferred Return. Second, ${prefReturn}% cumulative preferred return to LPs on unreturned Capital.
      4.4 Residual Split. Thereafter, ${gpPromote}% to Managing Member and ${lpShare}% to LPs.`;
  } else {
    // Catch-up (European) waterfall
    waterfallSection = `
      4.2 Return of Capital. First, 100% to Members pro rata until Capital Contributions returned.
      4.3 Preferred Return. Second, ${prefReturn}% per annum (cumulative, non-compounded) preferred return to LPs.
      4.4 GP Catch-Up. Third, to Managing Member until Managing Member has received ${gpPromote}% of all distributions under 4.3 and 4.4 (calculated as: GP share / (100% - GP share)).
      4.5 Residual Split. Thereafter, ${gpPromote}% to Managing Member and ${lpShare}% to LPs.`;
  }

  const totalEquity = parseFloat(data.totalEquity || 0).toLocaleString();
  const gpEquityPct = data.gpEquity || 10;
  const gpEquityAmount = Math.round((data.totalEquity || 0) * (gpEquityPct / 100)).toLocaleString();

  return `
OPERATING AGREEMENT OF ${data.companyName || '[COMPANY NAME]'}
A ${data.state || '[STATE]'} Limited Liability Company

DATE: ${new Date().toLocaleDateString()}

ARTICLE I - ORGANIZATION
1.1 Formation. Formed under ${data.state || '[STATE]'} LLC Act.
1.2 Name. ${data.companyName || '[COMPANY NAME]'}.
1.3 Principal Office. ${data.address || '[ADDRESS]'}
1.4 Registered Agent. As specified in Articles.
1.5 Duration. Perpetual until dissolved per Article X.
1.6 Purpose. Acquire, own, operate real property at ${data.propertyAddress || '[PROPERTY]'}. No other business without consent.

ARTICLE II - MEMBERS AND CAPITAL
2.1 Initial Capital. Total equity: $${totalEquity}.
2.2 Capital Contributions. Per Schedule A:
   - Managing Member (${gpEquityPct}%): $${gpEquityAmount}
   - Limited Partners (${100-gpEquityPct}%): $${(data.totalEquity - (data.totalEquity * gpEquityPct/100)).toLocaleString()}
2.3 Capital Accounts. Maintained per §704(b) regulations.
2.4 Additional Capital Calls. Managing Member may call additional capital pro rata. Failure to contribute within 10 business days = Event of Default.
2.5 Default. Defaulting Member: (a) loses voting rights, (b) interest diluted, (c) subject to forced sale at 75% FMV.
2.6 No Interest. No interest paid on capital contributions.

ARTICLE III - ALLOCATIONS AND DISTRIBUTIONS
3.1 Allocations. Income/loss allocated per §704(b) with qualified income offset.
3.2 Waterfall. Distributable Cash distributed:
   ${waterfallSection}
3.3 Tax Distributions. To cover tax on allocated income, estimated quarterly.
3.4 Withholding. Authorized for any governmental requirement.
3.5 Distributions In-Kind. Permitted at FMV.

ARTICLE IV - MANAGEMENT
4.1 Managing Member. ${data.gpName || '[GP ENTITY]'} designated as Managing Member with full authority.
4.2 Limited Partner Rights. No management rights. No authority to bind Company.
4.3 Major Decisions. Require 60% approval: sale of assets, refinance >$100k, bankruptcy, amendment, new members, related party transactions.
4.4 Removal. (a) For Cause: fraud, felony, material breach, misappropriation by 60%; (b) Without Cause: by 75% with 90 days notice.
4.5 Resignation. Managing Member may resign with 180 days notice.
4.6 Indemnification. Full indemnification except for fraud, gross negligence, willful misconduct.

ARTICLE V - TRANSFERS
5.1 Transfer Restrictions. No Transfer without Managing Member consent and ROFR.
5.2 Right of First Refusal. Company first, then other Members, then permitted assignees.
5.3 Permitted Transferees. Family members, trust beneficiaries, Affiliates (no increase in member count).
5.4 Drag-Along. 75% approval can force sale of all interests.
5.5 Tag-Along. If Member sells >10%, others can participate pro rata.

ARTICLE VI - FEES
6.1 Acquisition Fee. ${data.acqFee || 3}% of purchase price at closing.
6.2 Asset Management. ${data.assetMgmtFee || 2}% of gross revenue monthly.
6.3 Disposition. ${data.dispFee || 2}% of gross sale price.
6.4 Construction. 5% of hard costs if renovation performed.
6.5 Reimbursement. All reasonable out-of-pocket expenses reimbursed.

ARTICLE VII - REPORTS
7.1 Financial Statements. Quarterly within 45 days; annual audited within 90 days.
7.2 Tax Returns. K-1s delivered by March 15.
7.3 Inspection Rights. Members may inspect books upon reasonable notice.

ARTICLE VIII - CONFIDENTIALITY
8.1 Confidential Information. Proprietary information protected. No disclosure without consent.
8.2 Securities Laws. Interests not registered. Investment intent required.

ARTICLE IX - DISSOLUTION
9.1 Events. (a) 75% consent; (b) sale of all assets; (c) judicial; (d) insolvency.
9.2 Winding Up. Creditors first, then reserves, then Capital Account balances.

ARTICLE X - STATE PROVISIONS
${stateClause}

ARTICLE XI - GENERAL
11.1 Governing Law. ${data.state || '[STATE]'}
11.2 Dispute Resolution. Mediation then binding arbitration (AAA rules).
11.3 Amendments. Requires Managing Member + 75% approval.
11.4 Severability. Invalid provisions severed; remainder effective.
11.5 Entire Agreement. Supersedes all prior agreements.

SCHEDULE A - MEMBERS
[To be completed with investor details]

SIGNATURE PAGE
MANAGING MEMBER:
${data.gpName || '[GP ENTITY]'}
By: ${data.gpRep || '[NAME]'}
Title: Managing Member
Date: _______________
`;
}

module.exports = { generateOperatingAgreement };
