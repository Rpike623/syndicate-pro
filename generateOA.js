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
2.3 Capital Accounts.
   (a) Maintenance. A Capital Account shall be established and maintained for each Member in accordance with Treasury Regulation §1.704-1(b)(2)(iv). Each Member's Capital Account shall be:
       (i) increased by the amount of cash and the fair market value of property contributed by such Member, and by allocations to such Member of Net Income and items of Company income and gain (including income and gain exempt from tax);
       (ii) decreased by the amount of cash and the fair market value of property distributed to such Member, and by allocations to such Member of Net Loss and items of Company loss and deduction (including expenditures described in Section 705(a)(2)(B) of the Code).
   (b) Transfers. Upon the transfer of a Membership Interest, the Capital Account of the transferor shall carry over to the transferee to the extent of the interest transferred.
   (c) Revaluation. The Managing Member may revalue Capital Accounts to reflect the fair market value of Company assets upon: (i) the contribution of more than a de minimis amount of money or property by a new or existing Member; (ii) the distribution of more than a de minimis amount of money or property to a Member; (iii) the liquidation of the Company within the meaning of Treasury Regulation §1.704-1(b)(2)(ii)(g); or (iv) such other events as permitted under Treasury Regulation §1.704-1(b)(2)(iv)(f).
   (d) Compliance. The provisions of this Section 2.3 and the other provisions of this Agreement relating to the maintenance of Capital Accounts are intended to comply with Treasury Regulation §1.704-1(b) and shall be interpreted and applied in a manner consistent with such regulations.

2.4 Additional Capital Calls. Managing Member may call additional capital pro rata upon thirty (30) days' written notice. Failure to contribute within ten (10) business days of the due date shall constitute an Event of Default.
2.5 Default. Defaulting Member: (a) loses voting rights during the default period, (b) interest diluted pursuant to an anti-dilution formula, (c) subject to forced sale at 75% of fair market value.
2.6 No Interest. No interest shall be paid on Capital Contributions.

ARTICLE III - ALLOCATIONS AND DISTRIBUTIONS

PART A - TAX ALLOCATIONS

3.1 General Allocations. After giving effect to the special allocations in Sections 3.2 through 3.6, Net Income and Net Loss for each Fiscal Year (or portion thereof) shall be allocated among the Members in a manner such that, as of the end of such Fiscal Year, the Capital Account balance of each Member equals (as nearly as possible) the amount that would be distributed to such Member if the Company were dissolved, its affairs wound up, and its assets sold for their book values on the last day of such Fiscal Year, after satisfaction of all Company liabilities.

3.2 Minimum Gain Chargeback. Notwithstanding any other provision of this Article III, if there is a net decrease in Company Minimum Gain during any Fiscal Year, each Member shall be allocated items of Company income and gain for such year (and, if necessary, subsequent years) in an amount equal to such Member's share of the net decrease in Company Minimum Gain, determined in accordance with Treasury Regulation §1.704-2(g). This Section 3.2 is intended to comply with the minimum gain chargeback requirement in Treasury Regulation §1.704-2(f) and shall be interpreted consistently therewith.

3.3 Member Nonrecourse Debt Minimum Gain Chargeback. Notwithstanding any other provision of this Article III (except Section 3.2), if there is a net decrease in Member Nonrecourse Debt Minimum Gain attributable to a Member Nonrecourse Debt during any Fiscal Year, each Member who has a share of the Member Nonrecourse Debt Minimum Gain attributable to such debt shall be allocated items of Company income and gain for such year in an amount equal to such Member's share of the net decrease, determined in accordance with Treasury Regulation §1.704-2(i)(4). This Section 3.3 is intended to comply with the partner nonrecourse debt minimum gain chargeback requirement in Treasury Regulation §1.704-2(i)(4) and shall be interpreted consistently therewith.

3.4 Qualified Income Offset. If any Member unexpectedly receives an adjustment, allocation, or distribution described in Treasury Regulation §1.704-1(b)(2)(ii)(d)(4), (5), or (6) that causes or increases a deficit balance in such Member's Capital Account (in excess of any amount such Member is obligated to restore), items of Company income and gain shall be specially allocated to such Member in an amount and manner sufficient to eliminate such deficit balance as quickly as possible. This Section 3.4 is intended to constitute a "qualified income offset" within the meaning of Treasury Regulation §1.704-1(b)(2)(ii)(d) and shall be interpreted consistently therewith.

3.5 Nonrecourse Deductions. Nonrecourse Deductions for any Fiscal Year shall be allocated to the Members in proportion to their respective Percentage Interests.

3.6 Member Nonrecourse Deductions. Any Member Nonrecourse Deductions for any Fiscal Year shall be allocated to the Member who bears the economic risk of loss with respect to the Member Nonrecourse Debt to which such deductions are attributable, in accordance with Treasury Regulation §1.704-2(i)(1).

3.7 Section 704(c) Allocations. In accordance with Section 704(c) of the Code and Treasury Regulation §1.704-1(b)(4)(i), income, gain, loss, and deduction with respect to any property contributed to the capital of the Company shall, solely for tax purposes, be allocated among the Members so as to take account of any variation between the adjusted basis of such property to the Company for federal income tax purposes and its initial book value. If the book value of any Company asset is adjusted pursuant to Section 2.3(c), subsequent allocations of income, gain, loss, and deduction with respect to such asset shall take account of the variation between the adjusted basis and book value in the same manner as under Section 704(c) of the Code. The Managing Member shall select the method of allocation (traditional method, traditional method with curative allocations, or remedial allocation method) under Treasury Regulation §1.704-3 with respect to each item of contributed or revalued property.

3.8 Deficit Capital Accounts. No Member shall be obligated to restore a deficit balance in such Member's Capital Account. In the event any Member has a deficit balance in such Member's Capital Account at the end of any Fiscal Year, such Member shall not be required to make any contribution to the Company with respect to such deficit, and such deficit shall not be considered a debt owed by such Member to the Company or to any other Member.

PART B - DISTRIBUTIONS

3.9 Waterfall. Distributable Cash shall be distributed as follows:
   ${waterfallSection}

3.10 Tax Distributions. Prior to any other distributions under Section 3.9, the Company shall distribute to each Member an amount equal to such Member's estimated tax liability arising from allocations of Company income, calculated at the highest combined federal and state marginal tax rate applicable to individuals. Such distributions shall be made quarterly on an estimated basis and trued up annually.

3.11 Withholding. The Company is authorized to withhold from distributions, and to pay over to any federal, state, or local government, any amounts required to be withheld pursuant to applicable law. Any amounts so withheld shall be treated as distributions to the applicable Member.

3.12 Distributions In-Kind. The Managing Member may distribute property in-kind. Such distributions shall be made at fair market value as determined in good faith by the Managing Member.

3.13 Liquidating Distributions. Upon dissolution and winding up of the Company, after payment of all debts and establishment of reasonable reserves, remaining assets shall be distributed to Members in accordance with their positive Capital Account balances, as adjusted for all allocations for the Fiscal Year in which liquidation occurs. This Section 3.13 is intended to comply with Treasury Regulation §1.704-1(b)(2)(ii)(b)(2).

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
9.1 Events. (a) Written consent of Members holding 75% of Percentage Interests; (b) sale of all or substantially all Company assets; (c) judicial dissolution; (d) bankruptcy or insolvency of the Company.
9.2 Winding Up. Upon dissolution, the Managing Member (or a liquidating trustee appointed by Members holding a majority of Percentage Interests) shall wind up the Company's affairs and distribute assets in the following order: (a) payment of debts and liabilities to creditors, including Members who are creditors, in the order of priority as provided by law; (b) establishment of reserves reasonably necessary for contingent or unforeseen liabilities; (c) distribution to Members in accordance with their positive Capital Account balances after giving effect to all Capital Account adjustments for the Fiscal Year in which liquidation occurs. If any Member has a deficit Capital Account balance after all adjustments, such Member shall have no obligation to restore such deficit. Any property distributed in kind shall be valued at fair market value on the date of distribution, and the Capital Accounts of the Members shall be adjusted to reflect any unrealized gain or loss inherent in such property (as if such property were sold for its fair market value). This Section 9.2 is intended to comply with Treasury Regulation §1.704-1(b)(2)(ii)(b)(2).

ARTICLE X - STATE PROVISIONS
${stateClause}

ARTICLE XI - GENERAL
11.1 Governing Law. ${data.state || '[STATE]'}
11.2 Dispute Resolution. Mediation then binding arbitration (AAA rules).
11.3 Amendments. Requires Managing Member + 75% approval.
11.4 Severability. Invalid provisions severed; remainder effective.
11.5 Entire Agreement. Supersedes all prior agreements.

ARTICLE XII - DEFINITIONS
12.1 "Capital Account" means the account maintained for each Member pursuant to Section 2.3.
12.2 "Capital Contribution" means the total amount of cash and fair market value of property contributed to the Company by a Member.
12.3 "Code" means the Internal Revenue Code of 1986, as amended.
12.4 "Company Minimum Gain" has the meaning set forth in Treasury Regulation §1.704-2(b)(2) and §1.704-2(d).
12.5 "Distributable Cash" means all cash received by the Company from operations and capital events, less operating expenses, debt service, and reasonable reserves.
12.6 "Fiscal Year" means the calendar year or such other fiscal year as determined by the Managing Member.
12.7 "Member Nonrecourse Debt" has the meaning set forth in Treasury Regulation §1.704-2(b)(4).
12.8 "Member Nonrecourse Debt Minimum Gain" has the meaning set forth in Treasury Regulation §1.704-2(i)(2).
12.9 "Member Nonrecourse Deductions" has the meaning set forth in Treasury Regulation §1.704-2(i)(1).
12.10 "Net Income" and "Net Loss" mean the Company's taxable income or loss for a Fiscal Year, determined in accordance with Section 703(a) of the Code, with adjustments as required by Treasury Regulation §1.704-1(b)(2)(iv).
12.11 "Nonrecourse Deductions" has the meaning set forth in Treasury Regulation §1.704-2(b)(1).
12.12 "Percentage Interest" means, for each Member, the percentage set forth opposite such Member's name on Schedule A, as adjusted from time to time.
12.13 "Treasury Regulations" means the income tax regulations promulgated under the Code, as amended.

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
