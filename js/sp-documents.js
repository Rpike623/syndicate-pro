// sp-documents.js
// Thorough legal document generation for SyndicatePro

var SPDocs = (function() {

  function safe(val, def = '[____]') {
    return val !== undefined && val !== null && val !== '' ? val : def;
  }

  function fmtMoney(num) {
    if (!num) return '$0';
    return '$' + Number(num).toLocaleString();
  }

  // ─── WATERFALL LANGUAGE BUILDER ────────────────────────────────────────────
  // Generates Article IV distribution priority language based on waterfall type

  function buildWaterfallOASection(wfType, pref, promote, lpResidual, catchupRate, tier2Hurdle, tier2GPSplit, tier3GPSplit, tier2Catchup) {
    // Simple Split: no pref, no catch-up — straight split from dollar one
    if (wfType === 'simple') {
      return `
<ol type="a">
  <li style="margin-bottom: 8px;"><strong>First (Return of Capital):</strong> 100% to all Members in proportion to their unreturned Capital Contributions, until each Member has received a full return of their invested capital;</li>
  <li style="margin-bottom: 8px;"><strong>Second (Profit Split):</strong> Thereafter, the balance shall be distributed <strong>${promote}% to the Managing Member</strong> and <strong>${lpResidual}% to the Limited Members</strong>, pro-rata based on each Limited Member's percentage interest.</li>
</ol>
<p style="margin-top: 8px;"><em>This structure provides no preferred return or catch-up. All profits above return of capital are split according to the fixed ratio set forth above.</em></p>`;
    }

    // Preferred Return only: pref to LPs, then straight split — no catch-up
    if (wfType === 'pref') {
      return `
<ol type="a">
  <li style="margin-bottom: 8px;"><strong>First (Return of Capital):</strong> 100% to all Members in proportion to their unreturned Capital Contributions, until each Member has received a full return of their invested capital;</li>
  <li style="margin-bottom: 8px;"><strong>Second (Preferred Return):</strong> 100% to the Limited Members, in proportion to their accrued but unpaid Preferred Return, until each Limited Member has received a cumulative, non-compounding return of <strong>${pref}% per annum</strong> on their unreturned capital;</li>
  <li style="margin-bottom: 8px;"><strong>Third (Profit Split):</strong> Thereafter, the balance shall be distributed <strong>${promote}% to the Managing Member</strong> and <strong>${lpResidual}% to the Limited Members</strong>, pro-rata based on each Limited Member's percentage interest.</li>
</ol>
<p style="margin-top: 8px;"><em>Note: This structure does not include a GP catch-up provision. The Managing Member participates only in distributions above the Preferred Return threshold at the ${promote}/${lpResidual} split ratio.</em></p>`;
    }

    // Preferred Return + GP Catch-Up (the standard syndication waterfall)
    if (wfType === 'catchup') {
      return `
<ol type="a">
  <li style="margin-bottom: 8px;"><strong>First (Return of Capital):</strong> 100% to all Members in proportion to their unreturned Capital Contributions, until each Member has received a full return of their invested capital;</li>
  <li style="margin-bottom: 8px;"><strong>Second (Preferred Return):</strong> 100% to the Limited Members, in proportion to their accrued but unpaid Preferred Return, until each Limited Member has received a cumulative, non-compounding return of <strong>${pref}% per annum</strong> on their unreturned capital;</li>
  <li style="margin-bottom: 8px;"><strong>Third (GP Catch-Up):</strong> <strong>${catchupRate}%</strong> to the Managing Member and <strong>${100 - catchupRate}%</strong> to the Limited Members until the Managing Member has received <strong>${promote}%</strong> of all cumulative distributions made under subsections (b) and (c) combined;</li>
  <li style="margin-bottom: 8px;"><strong>Fourth (Residual Split):</strong> Thereafter, the balance shall be distributed <strong>${promote}% to the Managing Member</strong> and <strong>${lpResidual}% to the Limited Members</strong>, pro-rata based on each Limited Member's percentage interest.</li>
</ol>`;
    }

    // Multi-Tier Promote: pref, optional catch-up, then escalating GP splits at IRR hurdles
    if (wfType === 'tiered') {
      const tier2LP = 100 - tier2GPSplit;
      const tier3LP = 100 - tier3GPSplit;
      const catchupClause = tier2Catchup === 'yes'
        ? `<li style="margin-bottom: 8px;"><strong>Third (GP Catch-Up):</strong> <strong>${catchupRate || 100}%</strong> to the Managing Member${(catchupRate && catchupRate < 100) ? ` and <strong>${100 - catchupRate}%</strong> to the Limited Members` : ''} until the Managing Member has received <strong>${tier2GPSplit}%</strong> of all cumulative distributions made under subsections (b) and (c) combined;</li>`
        : '';
      const tierLetterAfterCatchup = tier2Catchup === 'yes' ? 'd' : 'c';
      const nextLetter = tier2Catchup === 'yes' ? 'e' : 'd';

      return `
<ol type="a">
  <li style="margin-bottom: 8px;"><strong>First (Return of Capital):</strong> 100% to all Members in proportion to their unreturned Capital Contributions, until each Member has received a full return of their invested capital;</li>
  <li style="margin-bottom: 8px;"><strong>Second (Preferred Return):</strong> 100% to the Limited Members, in proportion to their accrued but unpaid Preferred Return, until each Limited Member has received a cumulative, non-compounding return of <strong>${pref}% per annum</strong> on their unreturned capital;</li>
  ${catchupClause}
  <li style="margin-bottom: 8px;"><strong>Tier 2 — Below ${tier2Hurdle}% IRR (subsection ${tierLetterAfterCatchup}):</strong> <strong>${tier2GPSplit}% to the Managing Member</strong> and <strong>${tier2LP}% to the Limited Members</strong>, until the Limited Members have achieved an internal rate of return equal to <strong>${tier2Hurdle}%</strong> on their invested capital;</li>
  <li style="margin-bottom: 8px;"><strong>Tier 3 — Above ${tier2Hurdle}% IRR (subsection ${nextLetter}):</strong> Thereafter, the balance shall be distributed <strong>${tier3GPSplit}% to the Managing Member</strong> and <strong>${tier3LP}% to the Limited Members</strong>, pro-rata based on each Limited Member's percentage interest.</li>
</ol>
<p style="margin-top: 8px;"><em>For purposes of this Section, "internal rate of return" or "IRR" means the discount rate at which the net present value of all distributions to a Limited Member, measured from the date of such Member's capital contribution, equals zero.</em></p>`;
    }

    // Fallback: same as catchup
    return `
<ol type="a">
  <li style="margin-bottom: 8px;"><strong>First (Return of Capital):</strong> 100% to all Members in proportion to their unreturned Capital Contributions, until each Member has received a full return of their invested capital;</li>
  <li style="margin-bottom: 8px;"><strong>Second (Preferred Return):</strong> 100% to the Limited Members, in proportion to their accrued but unpaid Preferred Return, until each Limited Member has received a cumulative, non-compounding return of <strong>${pref}% per annum</strong> on their unreturned capital;</li>
  <li style="margin-bottom: 8px;"><strong>Third (GP Catch-Up):</strong> 100% to the Managing Member until the Managing Member has received <strong>${promote}%</strong> of all cumulative distributions made under subsections (b) and (c) combined;</li>
  <li style="margin-bottom: 8px;"><strong>Fourth (Residual Split):</strong> Thereafter, the balance shall be distributed <strong>${promote}% to the Managing Member</strong> and <strong>${lpResidual}% to the Limited Members</strong>.</li>
</ol>`;
  }

  // ─── OPERATING AGREEMENT ───────────────────────────────────────────────────

  function generateOA(deal, gpName, gpRep, firmAddress, state, minInvest, linkedInvestors) {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const equity = deal.raise || deal.totalEquity || 0;
    const gpPct = deal.gpEquity || 10;
    const lpPct = deal.lpEquity || 90;
    const pref = deal.prefReturn || 8;
    const promote = deal.gpPromote || 20;
    const lpResidual = 100 - promote;
    const acqFee = deal.acqFee || 3;
    const mgmtFee = deal.assetMgmtFee || 2;
    const loc = safe(deal.location, '[PROPERTY LOCATION]');
    const dealName = safe(deal.name, '[DEAL NAME]');
    const companyName = safe(deal.companyName || gpName, '[COMPANY NAME]');
    const wfType = deal.waterfallType || 'pref';
    const catchupRate = deal.catchupRate || 50;
    const wizData = deal.wizardData || deal;
    const tier2Hurdle = wizData.tier2Hurdle || 12;
    const tier2GPSplit = wizData.tier2GPSplit || 30;
    const tier3GPSplit = wizData.tier3GPSplit || 40;
    const tier2Catchup = wizData.tier2Catchup || 'yes';
    const dispositionFee = deal.dispositionFee || 1;
    const constructionFee = deal.constructionFee || 5;
    const refinancingFee = deal.refinancingFee || 0.5;
    const gpRemovalPct = deal.gpRemovalThreshold || 66.67;
    const defaultInterest = deal.defaultInterestRate || 15;
    const buyoutDiscount = deal.defaultBuyoutDiscount || 25;

    const stateRules = {
      'TX': `<p><strong>Tax Treatment.</strong> The Company intends to be treated as a partnership for federal income tax purposes and under Texas Tax Code § 171.0002. The Managing Member shall make such elections.</p><p><strong>Franchise Tax.</strong> The Company acknowledges its obligations under Texas Tax Code Chapter 171 regarding franchise tax and shall file all necessary reports.</p><p><strong>Community Property.</strong> Each Married Member agrees that their spouse's interest, if any, is subject to the provisions of this Agreement, and each such spouse consents hereto pursuant to Texas Family Code § 3.104.</p>`,
      'DE': `<p><strong>Series LLC Authority.</strong> In accordance with Section 18-215 of the Delaware Limited Liability Company Act (the "Act"), the Managing Member may establish separate protected series. The debts, liabilities, and obligations incurred, contracted for, or otherwise existing with respect to a particular series shall be enforceable against the assets of such series only.</p><p><strong>Charging Order.</strong> A judgment creditor's exclusive remedy with respect to a Member's interest shall be a charging order pursuant to Section 18-703 of the Act.</p>`,
      'FL': `<p><strong>Registered Agent.</strong> The Company shall continuously maintain a registered agent within the State of Florida as required by § 605.0113, Florida Statutes.</p><p><strong>Annual Reports.</strong> The Managing Member shall file an annual report with the Florida Department of State, Division of Corporations, between January 1 and May 1 of each calendar year.</p>`,
      'CA': `<p><strong>Franchise Tax.</strong> The Company is subject to the annual minimum franchise tax of $800 pursuant to California Revenue and Taxation Code § 17941, which shall be an operating expense of the Company.</p><p><strong>Exemption.</strong> The Interests are offered and sold in reliance upon the exemption from qualification under Section 25102(f) of the California Corporations Code.</p>`,
      'NV': `<p><strong>Charging Order Exclusive Remedy.</strong> On application to a court of competent jurisdiction by any judgment creditor of a Member, the court may charge the Member's interest with payment of the unsatisfied amount of the judgment with interest. This charging order is the exclusive remedy by which a judgment creditor may satisfy a judgment out of the judgment debtor's interest in the Company, pursuant to NRS 86.401.</p>`,
      'WY': `<p><strong>Asset Protection.</strong> Wyoming law provides charging order protection as the sole and exclusive remedy for a judgment creditor of a Member pursuant to W.S. 17-29-503. No creditor shall have the right to obtain possession of, or otherwise exercise legal or equitable remedies with respect to, the property of the Company.</p>`,
      'NY': `<p><strong>Publication Requirement.</strong> The Managing Member shall cause a notice of formation to be published once a week for six successive weeks in two newspapers of the county in which the office of the Company is located, and file a certificate of publication, pursuant to NY LLC Law § 206.</p><p><strong>Member Liability.</strong> Neither the Members nor the Managing Member shall be liable for the debts, obligations, or liabilities of the Company pursuant to NY LLC Law § 609.</p>`
    };
    const stateSection = stateRules[state] || stateRules['DE'];

    const hdr = `font-size: 12pt; text-align: center; margin: 36px 0 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;`;
    const sub = `margin-bottom: 10px; text-align: justify; text-indent: 0;`;

    return `
<div style="font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.6; color: #000; background: #fff; padding: 72px 72px 60px; max-width: 8.5in; margin: 0 auto; text-align: justify;">

<div style="text-align: center; margin-bottom: 48px;">
  <p style="font-size: 14pt; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 24px;">LIMITED LIABILITY COMPANY OPERATING AGREEMENT</p>
  <p style="font-size: 11pt; margin-bottom: 4px;">OF</p>
  <p style="font-size: 14pt; font-weight: bold; margin-bottom: 16px;">${companyName}</p>
  <p style="font-size: 11pt;">A ${state} Limited Liability Company</p>
  <p style="font-size: 11pt; margin-top: 16px;">Dated as of ${today}</p>
</div>

${deal._cleanExport ? '' : '<div style="border: 1px solid #999; padding: 12px 16px; margin-bottom: 32px; font-size: 9pt; text-align: center;"><strong>DRAFT — FOR DISCUSSION PURPOSES ONLY.</strong> This document was generated by software from user-supplied inputs and does not constitute legal advice. It must be reviewed, revised, and approved by qualified securities counsel before execution or distribution.</div>'}

<p style="text-align: center; font-weight: bold; text-transform: uppercase; margin-bottom: 20px; font-size: 12pt;">TABLE OF CONTENTS</p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 36px; font-size: 11pt;">
${[
  ['Article I', 'Definitions'],
  ['Article II', 'Formation and Overview'],
  ['Article III', 'Capital Contributions'],
  ['Article IV', 'Distributions and Waterfall'],
  ['Article V', 'Allocations of Profits and Losses'],
  ['Article VI', 'Management and Fees'],
  ['Article VII', 'Exculpation and Indemnification'],
  ['Article VIII', 'Transfers of Interests'],
  ['Article IX', 'Accounting, Records, and Tax Matters'],
  ['Article X', 'Additional Capital and Default'],
  ['Article XI', 'Dissolution and Winding Up'],
  ['Article XII', 'State-Specific Provisions'],
  ['Article XIII', 'General Provisions'],
  ['Schedule A', 'Members and Capital Contributions'],
  ['Exhibit A', 'Form of Spousal Consent'],
].map(([a, t]) => '<tr><td style="padding: 4px 0;">' + a + '</td><td style="padding: 4px 0; border-bottom: 1px dotted #999;">' + t + '</td></tr>').join('')}
</table>

<p style="text-align: justify;">This LIMITED LIABILITY COMPANY OPERATING AGREEMENT (this "<strong>Agreement</strong>") is made and entered into as of ${today} (the "<strong>Effective Date</strong>"), by and among <strong>${gpName}</strong>, as the managing member (the "<strong>Managing Member</strong>" or "<strong>GP</strong>"), and the persons and entities listed on <strong>Schedule A</strong> attached hereto, as limited members (collectively, the "<strong>Limited Members</strong>" or "<strong>LPs</strong>"; the Managing Member and the Limited Members are hereinafter collectively referred to as the "<strong>Members</strong>").</p>

<p style="text-align: center; font-weight: bold; text-transform: uppercase; margin: 24px 0 12px;">RECITALS</p>
<p style="text-align: justify;"><strong>WHEREAS,</strong> the Members desire to form a limited liability company under the laws of the State of ${state} for the purpose of acquiring, owning, operating, and disposing of certain real property; and</p>
<p style="text-align: justify;"><strong>WHEREAS,</strong> the Members desire to set forth their respective rights, duties, and obligations with respect to the Company;</p>
<p style="text-align: justify;"><strong>NOW, THEREFORE,</strong> in consideration of the mutual covenants and agreements herein contained and other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the parties agree as follows:</p>

<p style="${hdr}">ARTICLE I<br>DEFINITIONS</p>
<p>As used in this Agreement, the following capitalized terms shall have the meanings set forth below:</p>
<p><strong>"Act"</strong> means the ${state} Limited Liability Company Act, as amended from time to time.</p>
<p><strong>"Adjusted Capital Account Deficit"</strong> means, with respect to any Member, the deficit balance, if any, in such Member's Capital Account as of the end of the relevant fiscal year, after giving effect to the following adjustments: (i) credit to such Capital Account any amounts that such Member is obligated to restore or is deemed obligated to restore pursuant to Treasury Regulation Sections 1.704-2(g)(1) and 1.704-2(i)(5); and (ii) debit to such Capital Account the items described in Treasury Regulation Sections 1.704-1(b)(2)(ii)(d)(4), (5), and (6).</p>
<p><strong>"Agreement"</strong> means this Limited Liability Company Operating Agreement, as amended, restated, or supplemented from time to time.</p>
<p><strong>"Capital Account"</strong> means the individual capital account maintained for each Member in accordance with Treasury Regulation Section 1.704-1(b)(2)(iv).</p>
<p><strong>"Capital Contribution"</strong> means the total amount of cash and the fair market value of any property contributed to the Company by a Member.</p>
<p><strong>"Code"</strong> means the Internal Revenue Code of 1986, as amended.</p>
<p><strong>"Company"</strong> means ${companyName}, a ${state} limited liability company.</p>
<p><strong>"Covered Person"</strong> has the meaning set forth in Section 7.1 of Article VII.</p>
<p><strong>"Distributable Cash"</strong> means all cash funds of the Company on hand at the end of any fiscal period from operations or capital events, less amounts required or reserved for: (a) debt service; (b) operating expenses; (c) capital expenditures and reserves; and (d) any other amounts the Managing Member reasonably determines are necessary for the prudent operation of the Company's business.</p>
<p><strong>"GP"</strong> or <strong>"Managing Member"</strong> means ${gpName}, or any successor managing member appointed in accordance with this Agreement.</p>
<p><strong>"Gross Asset Value"</strong> means, with respect to any Company asset, the asset's adjusted basis for federal income tax purposes, except as adjusted pursuant to Treasury Regulation Section 1.704-1(b)(2)(iv)(f) and (g).</p>
<p><strong>"Interest"</strong> means a Member's entire ownership interest in the Company, including such Member's right to share in Distributable Cash, allocations of profits and losses, and voting or consent rights as set forth herein.</p>
<p><strong>"Limited Members"</strong> or <strong>"LPs"</strong> means the persons and entities listed on Schedule A (other than the Managing Member) and any persons subsequently admitted as limited members.</p>
<p><strong>"Majority-in-Interest"</strong> means Limited Members holding more than fifty percent (50%) of the aggregate Percentage Interests held by all Limited Members.</p>
<p><strong>"Major Decisions"</strong> has the meaning set forth in Section 6.3 of Article VI.</p>
<p><strong>"Member"</strong> means any person or entity that is a member of the Company, including the Managing Member and each Limited Member.</p>
<p><strong>"Member Nonrecourse Debt"</strong> has the meaning set forth in Treasury Regulation Section 1.704-2(b)(4).</p>
<p><strong>"Member Nonrecourse Debt Minimum Gain"</strong> has the meaning set forth in Treasury Regulation Section 1.704-2(i)(2).</p>
<p><strong>"Minimum Gain"</strong> has the meaning set forth in Treasury Regulation Sections 1.704-2(b)(2) and 1.704-2(d).</p>
<p><strong>"Net Profits"</strong> and <strong>"Net Losses"</strong> mean, for each fiscal year (or portion thereof), the taxable income or loss of the Company as determined for federal income tax purposes, with the adjustments required by Treasury Regulation Section 1.704-1(b)(2)(iv).</p>
<p><strong>"Nonrecourse Deductions"</strong> has the meaning set forth in Treasury Regulation Section 1.704-2(b)(1).</p>
<p><strong>"Percentage Interest"</strong> means, with respect to any Member, the percentage set forth opposite such Member's name on Schedule A, as adjusted from time to time to reflect additional contributions, transfers, and dilution events.</p>
<p><strong>"Preferred Return"</strong> means a cumulative, non-compounding return of ${pref}% per annum on each Limited Member's unreturned Capital Contribution, calculated from the date of such contribution.</p>
<p><strong>"Property"</strong> means the real property commonly known as ${dealName}, located at ${loc}, together with all improvements thereon and all personal property used in connection therewith.</p>
<p><strong>"Schedule A"</strong> means the schedule attached hereto listing the Members, their Capital Contributions, and their Percentage Interests, as amended from time to time.</p>
<p><strong>"Transfer"</strong> means any sale, assignment, pledge, hypothecation, encumbrance, or other disposition of all or any portion of a Member's Interest, whether voluntary or involuntary, by operation of law or otherwise.</p>
<p><strong>"Treasury Regulations"</strong> means the Income Tax Regulations promulgated under the Code, as amended from time to time.</p>

<p style="${hdr}">ARTICLE II<br>FORMATION AND OVERVIEW</p>
<p><strong>2.1 Formation.</strong> The Company was formed as a limited liability company under the laws of the State of ${state} by the filing of its formation documents with the appropriate state authority.</p>
<p><strong>2.2 Name.</strong> The name of the Company is ${companyName}. The business of the Company may be conducted under any other name designated by the Managing Member.</p>
<p><strong>2.3 Principal Office.</strong> The principal office of the Company shall be located at ${safe(firmAddress, '[FIRM ADDRESS]')}, or such other place as the Managing Member may determine.</p>
<p><strong>2.4 Purpose.</strong> The purpose of the Company is to acquire, own, operate, manage, finance, refinance, lease, and eventually sell or dispose of that certain real property commonly known as <strong>${dealName}</strong>, located at ${loc} (the "<strong>Property</strong>"), and to engage in any and all other activities necessary or incidental to the foregoing.</p>

<p style="${hdr}">ARTICLE III<br>CAPITAL CONTRIBUTIONS</p>
<p><strong>3.1 Total Capitalization.</strong> The projected total equity capitalization of the Company is <strong>${fmtMoney(equity)}</strong>.</p>
<p><strong>3.2 Managing Member Contribution.</strong> The Managing Member (and/or its affiliates) agrees to contribute cash or sweat equity such that its Capital Account initially equals <strong>${gpPct}%</strong> of the total equity capitalization.</p>
<p><strong>3.3 Limited Member Contributions.</strong> The Limited Members shall contribute cash in the amounts set forth opposite their respective names on Schedule A, collectively representing <strong>${lpPct}%</strong> of the initial equity capitalization. The minimum investment for any Limited Member is ${fmtMoney(minInvest)}, unless waived by the Managing Member.</p>
<p><strong>3.4 Capital Accounts.</strong> A separate Capital Account shall be maintained for each Member in accordance with the rules of Treasury Regulation Section 1.704-1(b)(2)(iv).</p>

<p style="${hdr}">ARTICLE IV<br>DISTRIBUTIONS AND WATERFALL</p>
<p><strong>4.1 Distributable Cash.</strong> "Distributable Cash" means all cash funds of the Company on hand from operations or capital events, less amounts required for debt service, operating expenses, and reasonable reserves as determined by the Managing Member.</p>
<p><strong>4.2 Distribution Priority (The Waterfall).</strong> Except as otherwise provided upon liquidation, Distributable Cash shall be distributed to the Members in the following order of priority:</p>
${buildWaterfallOASection(wfType, pref, promote, lpResidual, catchupRate, tier2Hurdle, tier2GPSplit, tier3GPSplit, tier2Catchup)}
<p><strong>4.3 Tax Distributions.</strong> To the extent legally and financially permissible, the Managing Member shall use commercially reasonable efforts to make distributions to the Members sufficient to cover federal and state income tax liabilities reasonably expected to result from the allocation of Company taxable income.</p>

<p style="${hdr}">ARTICLE V<br>ALLOCATIONS OF PROFITS AND LOSSES</p>
<p><strong>5.1 Net Profits and Net Losses.</strong> Except as otherwise provided in this Article V, Net Profits and Net Losses of the Company for each fiscal year (or portion thereof) shall be allocated among the Members in a manner consistent with and proportionate to the distributions described in Article IV, so that to the maximum extent possible, each Member's Capital Account balance at the end of each fiscal year, after giving effect to allocations and distributions, reflects the amount such Member would receive if the Company were to liquidate and distribute its assets in accordance with the waterfall set forth in Section 4.2.</p>
<p><strong>5.2 Regulatory Allocations.</strong> Notwithstanding Section 5.1, the following special allocations shall be made in the following order of priority:</p>
<ol type="a" style="margin-left: 20px;">
  <li style="margin-bottom: 6px;"><strong>Minimum Gain Chargeback.</strong> If there is a net decrease in Company Minimum Gain during any fiscal year, each Member shall be specially allocated items of Company income and gain for such year (and, if necessary, subsequent years) in an amount equal to such Member's share of the net decrease in Company Minimum Gain, determined in accordance with Treasury Regulation Section 1.704-2(g). This Section 5.2(a) is intended to comply with the minimum gain chargeback requirement of Treasury Regulation Section 1.704-2(f) and shall be interpreted accordingly.</li>
  <li style="margin-bottom: 6px;"><strong>Member Nonrecourse Debt Minimum Gain Chargeback.</strong> If there is a net decrease in Member Nonrecourse Debt Minimum Gain attributable to a Member Nonrecourse Debt during any fiscal year, each Member who has a share of the Member Nonrecourse Debt Minimum Gain attributable to such debt shall be specially allocated items of Company income and gain for such year in an amount equal to such Member's share of the net decrease, as determined under Treasury Regulation Section 1.704-2(i)(4). This allocation is intended to comply with Treasury Regulation Section 1.704-2(i)(4).</li>
  <li style="margin-bottom: 6px;"><strong>Qualified Income Offset.</strong> If a Member unexpectedly receives any adjustment, allocation, or distribution described in Treasury Regulation Section 1.704-1(b)(2)(ii)(d)(4), (5), or (6), items of Company income and gain shall be specially allocated to such Member in an amount and manner sufficient to eliminate, to the extent required by Treasury Regulation Section 1.704-1(b)(2)(ii)(d), the Adjusted Capital Account Deficit of such Member as quickly as possible.</li>
  <li style="margin-bottom: 6px;"><strong>Nonrecourse Deductions.</strong> Nonrecourse Deductions for any fiscal year shall be allocated to the Members in proportion to their respective Percentage Interests.</li>
  <li style="margin-bottom: 6px;"><strong>Member Nonrecourse Deductions.</strong> Any Member Nonrecourse Deductions for any fiscal year shall be specially allocated to the Member who bears the economic risk of loss with respect to the Member Nonrecourse Debt to which such deductions are attributable.</li>
</ol>
<p><strong>5.3 Section 704(c) Allocations.</strong> In accordance with Section 704(c) of the Code and the Treasury Regulations thereunder, income, gain, loss, and deduction with respect to any property contributed to the capital of the Company shall, solely for tax purposes, be allocated among the Members so as to take account of any variation between the adjusted basis of such property to the Company for federal income tax purposes and its initial Gross Asset Value. The Managing Member shall select the method of allocation under Section 704(c) in its reasonable discretion.</p>
<p><strong>5.4 Depreciation Recapture.</strong> To the extent gain recognized upon the sale or disposition of Company property is treated as ordinary income attributable to the recapture of depreciation, such ordinary income shall be allocated among the Members in proportion to the depreciation deductions previously allocated to them.</p>

<p style="${hdr}">ARTICLE VI<br>MANAGEMENT AND FEES</p>
<p><strong>6.1 Authority of Managing Member.</strong> The business and affairs of the Company shall be managed exclusively by the Managing Member, acting through its authorized representative, <strong>${gpRep}</strong>. The Managing Member shall have full and complete authority, power, and discretion to manage and control the business, including but not limited to: acquiring, financing, refinancing, improving, operating, leasing, and disposing of the Property; hiring and terminating employees, contractors, and property managers; opening and maintaining bank accounts; and executing all documents and instruments on behalf of the Company.</p>
<p><strong>6.2 Compensation and Fees.</strong> For services rendered to the Company, the Managing Member (or an affiliate) shall receive:</p>
<ul>
  <li><strong>Acquisition Fee:</strong> A one-time fee equal to <strong>${acqFee}%</strong> of the gross purchase price of the Property, payable at closing from offering proceeds.</li>
  <li><strong>Asset Management Fee:</strong> An ongoing fee equal to <strong>${mgmtFee}%</strong> of the gross monthly revenues collected by the Property, payable monthly in arrears.</li>
  <li><strong>Disposition Fee:</strong> A one-time fee equal to <strong>${dispositionFee}%</strong> of the gross sale price of the Property, payable from sale proceeds at closing, subordinated to the return of Limited Member capital contributions and accrued Preferred Returns.</li>
  <li><strong>Construction/Renovation Management:</strong> If the Managing Member directly oversees material capital improvements, a construction management fee of up to <strong>${constructionFee}%</strong> of the hard construction costs may be charged, disclosed to the Limited Members in advance.</li>
  <li><strong>Refinancing Fee:</strong> A fee of up to <strong>${refinancingFee}%</strong> of the new loan amount upon any refinancing event, payable at closing of the refinancing.</li>
</ul>
<p><strong>6.3 Limitation on Authority (Major Decisions).</strong> Notwithstanding the foregoing, the Managing Member shall not take any of the following "Major Decisions" without the prior affirmative vote or written consent of a Majority-in-Interest (over 50%) of the Limited Members:</p>
<ol type="i" style="margin-left: 20px;">
  <li>Sale or other disposition of the Property or substantially all Company assets;</li>
  <li>Refinancing of existing debt, or incurrence of new indebtedness in excess of 80% loan-to-value;</li>
  <li>Filing a voluntary petition for bankruptcy, insolvency, or receivership;</li>
  <li>Any merger, consolidation, or conversion of the Company;</li>
  <li>Admission of a new Managing Member;</li>
  <li>Material modification of the business plan or investment thesis;</li>
  <li>Dissolution or winding up of the Company (except as provided in Article XI);</li>
  <li>Any transaction between the Company and the Managing Member or its affiliates not otherwise disclosed in this Agreement or the Private Placement Memorandum;</li>
  <li>Performing any act in contravention of this Agreement.</li>
</ol>
<p><strong>6.4 No Participation by Limited Members.</strong> The Limited Members shall not participate in the management or control of the Company. No Limited Member shall have any authority to bind the Company or transact any business on its behalf.</p>
<p><strong>6.5 GP Removal for Cause.</strong> The Managing Member may be removed for "Cause" by the affirmative vote of Limited Members holding at least <strong>${gpRemovalPct >= 66.6 && gpRemovalPct <= 66.7 ? 'sixty-six and two-thirds percent (66⅔%)' : gpRemovalPct + '%'}</strong> in interest. "Cause" means: (a) fraud, gross negligence, or willful misconduct in the management of the Company; (b) a material breach of this Agreement that remains uncured for thirty (30) days following written notice; (c) conviction of a felony; or (d) bankruptcy or insolvency of the Managing Member. Upon removal, the Limited Members by majority vote shall appoint a successor Managing Member or vote to dissolve the Company.</p>
<p><strong>6.6 Insurance.</strong> The Managing Member shall procure and maintain, at the Company's expense, comprehensive general liability insurance, property insurance, and such other insurance as is customary for properties of the type and in the location of the Property, in amounts deemed adequate by the Managing Member. The Managing Member shall also maintain errors and omissions or directors and officers insurance covering actions taken on behalf of the Company.</p>

<p style="${hdr}">ARTICLE VII<br>EXCULPATION AND INDEMNIFICATION</p>
<p><strong>7.1 Exculpation.</strong> The Managing Member, its affiliates, and their respective officers, directors, and employees (the "Covered Persons") shall not be liable to the Company or any Member for any loss, damage, or claim incurred by reason of any act or omission performed or omitted by such Covered Person in good faith on behalf of the Company, except for acts or omissions involving gross negligence, fraud, or willful misconduct.</p>
<p><strong>7.2 Indemnification.</strong> The Company shall indemnify and hold harmless the Covered Persons to the fullest extent permitted by law against any losses, judgments, liabilities, expenses (including reasonable attorneys' fees), and amounts paid in settlement of any claims sustained by them in connection with the Company, provided such Covered Person's conduct did not constitute gross negligence, fraud, or willful misconduct. The indemnification obligations of this Section shall survive the dissolution and winding up of the Company.</p>
<p><strong>7.3 Advancement of Expenses.</strong> Expenses (including reasonable attorneys' fees) incurred by a Covered Person in defending any action, suit, or proceeding shall be paid by the Company in advance of final disposition of such matter upon receipt of an undertaking by such Covered Person to repay such amount if it shall ultimately be determined that such Covered Person is not entitled to be indemnified hereunder.</p>

<p style="${hdr}">ARTICLE VIII<br>TRANSFERS OF INTERESTS</p>
<p><strong>8.1 Restrictions on Transfer.</strong> No Member may sell, assign, pledge, hypothecate, or otherwise transfer any portion of their Interest without the prior written consent of the Managing Member, which consent may be withheld in the Managing Member's sole and absolute discretion. Any purported transfer in violation of this Section shall be null and void and of no force or effect.</p>
<p><strong>8.2 Right of First Refusal.</strong> Prior to any permitted transfer, the transferring Member (the "Offering Member") shall deliver written notice (the "Transfer Notice") to the Managing Member specifying: (a) the proposed terms and conditions of the transfer; (b) the identity and qualifications of the proposed transferee; (c) the proposed purchase price (the "Offered Price"); and (d) evidence that the proposed transfer constitutes a bona fide, arm's-length transaction. The Company and/or the non-transferring Members shall have a right of first refusal exercisable within thirty (30) days of receipt of such Transfer Notice to purchase the Offering Member's Interest on the same terms and conditions set forth in the Transfer Notice.</p>
<p><strong>8.2.1 Valuation Methodology.</strong> If the Transfer Notice does not reflect a bona fide third-party offer, or if the parties dispute the Offered Price, the fair market value of the Offering Member's Interest shall be determined as follows:</p>
<ol type="i" style="margin-left: 20px;">
  <li style="margin-bottom: 6px;"><strong>Appraisal.</strong> The Managing Member shall engage a qualified, independent MAI-designated appraiser to determine the fair market value of the Property. The appraised value shall be used to calculate the net asset value ("NAV") of the Company by subtracting all outstanding Company liabilities (including mortgage debt, accrued expenses, and reserves) from the appraised value of the Property, plus any cash and other assets held by the Company.</li>
  <li style="margin-bottom: 6px;"><strong>Interest Valuation.</strong> The fair market value of the Offering Member's Interest shall equal such Member's pro-rata share of the NAV, based on the Offering Member's Percentage Interest, less a discount of fifteen percent (15%) for lack of marketability and minority interest (the "Discount"), unless the parties mutually agree to waive or modify the Discount.</li>
  <li style="margin-bottom: 6px;"><strong>Dispute Resolution.</strong> If the Offering Member disputes the appraisal, the Offering Member may, at its own expense, engage a second MAI-designated appraiser within fifteen (15) days of receiving the initial appraisal. If the two appraisals differ by more than 10%, the two appraisers shall jointly select a third appraiser, and the fair market value shall be the average of the two closest appraisals. The cost of the third appraisal shall be borne equally by the Offering Member and the Company.</li>
  <li style="margin-bottom: 6px;"><strong>Payment Terms.</strong> If the Company or non-transferring Members elect to exercise the right of first refusal, payment of the purchase price shall be made in cash at closing, or upon such other terms as specified in the Transfer Notice if the purchase is made on the same terms as the third-party offer. Closing shall occur within forty-five (45) days of the exercise of the right of first refusal.</li>
</ol>
<p><strong>8.3 Conditions of Transfer.</strong> No transfer shall be consummated unless: (a) the transferee delivers an executed written agreement to be bound by the terms of this Agreement; (b) the Managing Member determines in its reasonable judgment that such transfer will not cause the Company to be treated as a publicly traded partnership for tax purposes; (c) the transfer complies with all applicable federal and state securities laws; and (d) the transferring Member pays all reasonable costs and expenses incurred by the Company in connection with such transfer.</p>
<p><strong>8.4 No Withdrawal.</strong> No Member shall have the right to resign or withdraw from the Company or to demand or receive a return of all or any portion of their Capital Contribution, except as expressly provided herein or upon dissolution.</p>
<p><strong>8.5 Admission of Substitute Members.</strong> A transferee of a Member's Interest shall be admitted as a Substitute Member only with the written consent of the Managing Member. Until admitted as a Substitute Member, a transferee shall be an assignee entitled only to receive the distributions and allocations of income, gain, loss, deduction, and credit to which the transferring Member would have been entitled, but shall have no right to vote or participate in Company governance.</p>

<p style="${hdr}">ARTICLE IX<br>ACCOUNTING, RECORDS, AND TAX MATTERS</p>
<p><strong>9.1 Fiscal Year.</strong> The fiscal year of the Company shall be the calendar year.</p>
<p><strong>9.2 Books and Records.</strong> The Managing Member shall keep or cause to be kept proper and complete books of account and records of the Company, including: (a) a current list of the names, addresses, and Percentage Interests of all Members; (b) copies of federal, state, and local income tax returns for each year; (c) copies of this Agreement, the Certificate of Formation, and all amendments thereto; and (d) financial statements. Each Member shall have the right, upon reasonable advance notice and during normal business hours, to inspect and copy at such Member's expense any of the Company's books, records, and documents.</p>
<p><strong>9.3 Financial Reporting.</strong> The Managing Member shall furnish to each Member: (a) within 90 days after the end of each fiscal year, an annual report containing the Company's financial statements (balance sheet, income statement, statement of cash flows, and statement of Members' equity), prepared on an accrual basis in accordance with generally accepted accounting principles; and (b) quarterly updates on the status of the Property, material events, and a summary of distributions made or projected.</p>
<p><strong>9.4 Tax Returns and K-1s.</strong> The Managing Member shall cause the Company to file all required federal, state, and local tax returns and shall use commercially reasonable efforts to deliver a Schedule K-1 (IRS Form 1065) to each Member within 75 days after the end of each fiscal year. Each Member shall be responsible for filing their own individual tax returns and paying their own taxes on allocated Company income.</p>
<p><strong>9.5 Partnership Representative (BBA Audit Rules).</strong> The Managing Member is hereby designated as the "Partnership Representative" pursuant to Section 6223(a) of the Internal Revenue Code, as amended by the Bipartisan Budget Act of 2015 (the "BBA"). The Partnership Representative shall have sole authority to act on behalf of the Company in any federal tax audit or proceeding. The Partnership Representative shall keep the Members reasonably informed of any administrative or judicial proceedings. If the Company qualifies, the Partnership Representative may elect out of the centralized partnership audit regime under Section 6221(b) of the Code. If the Company does not elect out and an imputed underpayment is assessed, the Partnership Representative shall elect the "push-out" alternative under Section 6226 of the Code (passing the tax adjustment through to the Members for the reviewed year) unless the Partnership Representative determines in good faith that an alternative approach is more beneficial to the Members.</p>
<p><strong>9.6 Tax Elections.</strong> The Managing Member shall have the authority to make all tax elections on behalf of the Company, including but not limited to:</p>
<ol type="a" style="margin-left: 20px;">
  <li>An election under Section 754 of the Code to adjust the basis of Company property upon a transfer of a Member's Interest or a distribution of Company property, if the Managing Member determines such election is in the best interest of the Members;</li>
  <li>Elections regarding methods of depreciation, cost recovery, and accounting methods;</li>
  <li>An election to be treated as a partnership for federal income tax purposes (the Company shall not elect to be classified as a corporation or association taxable as a corporation);</li>
  <li>Any election available under applicable state or local tax law.</li>
</ol>
<p><strong>9.7 Tax Classification.</strong> The Members intend that the Company shall be treated as a partnership for federal and applicable state income tax purposes. No Member shall take any action inconsistent with such treatment. The Company shall not file an election to be classified as a corporation under Treasury Regulation Section 301.7701-3.</p>
<p><strong>9.8 Withholding.</strong> The Company is authorized to withhold from distributions to a Member, or with respect to allocations to a Member, and to pay over to any federal, state, or local government any amounts required to be so withheld pursuant to applicable tax law. Any amounts so withheld shall be treated as distributions to the relevant Member for all purposes of this Agreement.</p>
<p><strong>9.9 UBTI Notice.</strong> Members that are tax-exempt entities (including IRAs, pension plans, and other benefit plans subject to ERISA) should be aware that the Company may generate unrelated business taxable income ("UBTI") due to the use of debt financing. Each such Member should consult its own tax advisor regarding the potential impact of UBTI on such Member's tax-exempt status.</p>

<p style="${hdr}">ARTICLE X<br>ADDITIONAL CAPITAL AND DEFAULT</p>
<p><strong>10.1 No Obligation for Additional Capital.</strong> Except as provided in Section 10.2, no Member shall be required to make any additional capital contribution beyond such Member's initial Capital Contribution as set forth on Schedule A.</p>
<p><strong>10.2 Capital Calls.</strong> If the Managing Member determines in good faith that additional capital is necessary for the Company to meet its obligations or to preserve the value of the Property, the Managing Member may issue a capital call notice to all Members, specifying the amount requested and the purpose. Capital calls shall be pro-rata in accordance with each Member's Percentage Interest. Each Member shall have fifteen (15) business days from receipt of such notice to fund their pro-rata share.</p>
<p><strong>10.3 Failure to Fund (Default).</strong> If a Member fails to fund a capital call within the specified period (a "Defaulting Member"), the non-defaulting Members may, but are not required to, fund the Defaulting Member's shortfall. In such event, at the election of the Managing Member: (a) the Defaulting Member's Percentage Interest may be diluted proportionally to reflect the unfunded amount; (b) the funding provided by non-defaulting Members may be treated as a loan to the Defaulting Member at an annual interest rate of <strong>${defaultInterest}%</strong>, secured by the Defaulting Member's Interest; or (c) the Defaulting Member may be required to sell their Interest to the non-defaulting Members at a discount of <strong>${buyoutDiscount}%</strong> from its fair market value.</p>

<p style="${hdr}">ARTICLE XI<br>DISSOLUTION AND WINDING UP</p>
<p><strong>11.1 Events of Dissolution.</strong> The Company shall be dissolved upon the earliest to occur of the following: (a) the sale, exchange, or other disposition of all or substantially all of the Company's assets; (b) the unanimous written consent of the Members; (c) the entry of a decree of judicial dissolution; (d) the occurrence of any other event that makes it unlawful for the business of the Company to be continued; or (e) the bankruptcy, dissolution, or removal of the Managing Member, unless within ninety (90) days after such event a Majority-in-Interest of the remaining Members elect to continue the Company and appoint a successor Managing Member.</p>
<p><strong>11.2 Winding Up.</strong> Upon dissolution, the Managing Member (or, if the Managing Member is unable or unwilling to serve, a liquidating trustee appointed by a Majority-in-Interest of the Limited Members) shall wind up the affairs of the Company with reasonable promptness. During the winding up period, the Company shall continue solely for the purpose of winding up its affairs, collecting its assets, satisfying its liabilities, and distributing its remaining assets to the Members.</p>
<p><strong>11.3 Order of Liquidating Distributions.</strong> The assets of the Company, or the proceeds from the liquidation thereof, shall be applied and distributed in the following order: (a) first, to the payment of debts and liabilities of the Company (including debts owed to Members) and the expenses of liquidation; (b) second, to the establishment of any reserves that the liquidating party deems reasonably necessary for contingent or unforeseen liabilities of the Company; and (c) third, to the Members in accordance with the distribution priorities set forth in Section 4.2 of this Agreement.</p>
<p><strong>11.4 Final Accounting.</strong> Within a reasonable time following the completion of the liquidation, the liquidating party shall supply to each Member a statement that sets forth the assets and liabilities of the Company as of the date of dissolution, the manner in which the Company's assets were liquidated, and the amounts distributed to each Member.</p>
<p><strong>11.5 Certificate of Cancellation.</strong> Upon completion of the winding up and distribution of all Company assets, the Managing Member (or liquidating trustee) shall file a Certificate of Cancellation with the appropriate state authority.</p>

<p style="${hdr}">ARTICLE XII<br>STATE-SPECIFIC PROVISIONS</p>
${stateSection}

<p style="${hdr}">ARTICLE XIII<br>GENERAL PROVISIONS</p>
<p><strong>13.1 Amendments.</strong> This Agreement may be amended only by a written instrument signed by the Managing Member and approved by a Majority-in-Interest (over 50%) of the Limited Members; provided, however, that no amendment that adversely affects the economic rights of a Member (including distribution priorities, allocation of profits and losses, or capital account adjustments) shall be effective without the written consent of such affected Member. The Managing Member may amend Schedule A without Member consent to reflect the admission or withdrawal of Members and changes in Capital Contributions.</p>
<p><strong>13.2 Entire Agreement.</strong> This Agreement, including all exhibits and schedules attached hereto, constitutes the entire agreement among the parties regarding the subject matter hereof and supersedes all prior negotiations, representations, warranties, commitments, and understandings.</p>
<p><strong>13.3 Counterparts; Electronic Signatures.</strong> This Agreement may be executed in counterparts, each of which shall be deemed an original, and all of which together shall constitute one agreement. Signatures delivered by electronic means (including DocuSign or similar platforms) shall be binding and effective.</p>
<p><strong>13.4 Governing Law.</strong> This Agreement shall be governed by and construed in accordance with the laws of the State of ${state}, without regard to conflicts of law principles.</p>
<p><strong>13.5 Dispute Resolution.</strong> Any dispute, controversy, or claim arising out of or relating to this Agreement shall first be submitted to mediation administered by the American Arbitration Association or JAMS under its applicable mediation rules. If mediation is unsuccessful within sixty (60) days, any unresolved dispute shall be submitted to binding arbitration in the county where the Company's principal office is located, conducted by a single arbitrator in accordance with the Commercial Arbitration Rules of the American Arbitration Association. The arbitrator's award shall be final and binding and may be entered as a judgment in any court of competent jurisdiction. The prevailing party shall be entitled to recover its reasonable attorneys' fees and costs.</p>
<p><strong>13.6 Confidentiality.</strong> Each Member agrees to maintain the confidentiality of all non-public information regarding the Company, the Property, the Members, and the terms of this Agreement, and shall not disclose such information to any third party without the prior written consent of the Managing Member, except: (a) to such Member's legal, tax, and financial advisors who agree to maintain confidentiality; (b) as required by law or regulation; or (c) as necessary in connection with a permitted transfer of such Member's Interest.</p>
<p><strong>13.7 Notices.</strong> All notices, requests, demands, and other communications under this Agreement shall be in writing and shall be deemed duly given when delivered personally, sent by email with confirmation of receipt, or sent by nationally recognized overnight courier, to the addresses set forth on Schedule A or such other address as a party may designate in writing.</p>
<p><strong>13.8 Severability.</strong> If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect and shall be construed as if the invalid provision had not been included.</p>
<p><strong>13.9 Waiver.</strong> No waiver of any provision of this Agreement shall be effective unless in writing, and no waiver shall constitute a continuing waiver or a waiver of any other provision.</p>
<p><strong>13.10 Power of Attorney.</strong> Each Limited Member hereby irrevocably constitutes and appoints the Managing Member as such Member's attorney-in-fact, with full power and authority, to execute, acknowledge, swear to, file, and record on such Member's behalf any documents necessary to carry out the purposes of this Agreement, including amendments to the Certificate of Formation, and any documents required to effect the dissolution and termination of the Company.</p>
<p><strong>13.11 ERISA.</strong> The Company is not intended to hold "plan assets" of any employee benefit plan subject to the Employee Retirement Income Security Act of 1974, as amended ("ERISA"). If Benefit Plan Investors (as defined in 29 C.F.R. § 2510.3-101) hold 25% or more of the value of any class of equity interest in the Company, the Managing Member shall take reasonable steps to reduce such percentage below 25% or to ensure compliance with ERISA.</p>
<p><strong>13.12 No Third-Party Beneficiaries.</strong> This Agreement is for the sole benefit of the Members and their permitted successors and assigns. Nothing in this Agreement shall confer upon any other person any legal or equitable right, benefit, or remedy.</p>

<p style="text-align: center; margin-top: 48px; font-weight: bold; font-size: 11pt;">[SIGNATURE PAGE FOLLOWS]</p>

<div style="page-break-before: always; margin-top: 60px;">
  <p style="text-align: center; font-weight: bold; text-transform: uppercase; margin-bottom: 24px;">SIGNATURE PAGE TO<br>LIMITED LIABILITY COMPANY OPERATING AGREEMENT OF<br>${companyName}</p>
  <p style="text-align: justify;">IN WITNESS WHEREOF, the undersigned have executed this Limited Liability Company Operating Agreement as of the date first written above.</p>

  <div style="margin-top: 48px;">
    <p style="font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">MANAGING MEMBER:</p>
    <p style="margin-bottom: 4px;">${gpName}</p>
    <div style="margin-top: 36px;">
      <div style="border-bottom: 1px solid #000; width: 300px; margin-bottom: 4px;">&nbsp;</div>
      <p>By: ${gpRep}</p>
      <p>Its: Managing Member</p>
      <p style="margin-top: 12px;">Date: _______________________</p>
    </div>
  </div>

  <div style="margin-top: 48px;">
    <p style="font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">LIMITED MEMBERS:</p>
    <p>Each of the persons and entities listed on Schedule A attached hereto, by execution of a Subscription Agreement referencing this Agreement, hereby agrees to be bound by all terms and conditions hereof.</p>
  </div>
</div>

<div style="page-break-before: always; margin-top: 60px;">
  <p style="${hdr}">SCHEDULE A<br>MEMBERS AND CAPITAL CONTRIBUTIONS</p>
  
  <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11pt;">
    <thead>
      <tr>
        <th style="border-bottom: 2px solid #000; border-top: 2px solid #000; padding: 8px 10px; text-align: left; font-weight: bold;">Member Name</th>
        <th style="border-bottom: 2px solid #000; border-top: 2px solid #000; padding: 8px 10px; text-align: center; font-weight: bold;">Capital Contribution</th>
        <th style="border-bottom: 2px solid #000; border-top: 2px solid #000; padding: 8px 10px; text-align: center; font-weight: bold;">Percentage Interest</th>
        <th style="border-bottom: 2px solid #000; border-top: 2px solid #000; padding: 8px 10px; text-align: center; font-weight: bold;">Class</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border-bottom: 1px solid #ccc; padding: 8px 10px;">${gpName}</td>
        <td style="border-bottom: 1px solid #ccc; padding: 8px 10px; text-align: center;">${fmtMoney(equity * gpPct / 100)}</td>
        <td style="border-bottom: 1px solid #ccc; padding: 8px 10px; text-align: center;">${gpPct}%</td>
        <td style="border-bottom: 1px solid #ccc; padding: 8px 10px; text-align: center;">Managing Member</td>
      </tr>
      ${linkedInvestors && linkedInvestors.length > 0
        ? linkedInvestors.map(inv => `
      <tr>
        <td style="border-bottom: 1px solid #ccc; padding: 8px 10px;">${inv.firstName || ''} ${inv.lastName || ''}</td>
        <td style="border-bottom: 1px solid #ccc; padding: 8px 10px; text-align: center;">${fmtMoney(inv._committed || 0)}</td>
        <td style="border-bottom: 1px solid #ccc; padding: 8px 10px; text-align: center;">${inv._ownership ? inv._ownership + '%' : '—'}</td>
        <td style="border-bottom: 1px solid #ccc; padding: 8px 10px; text-align: center;">Limited Member</td>
      </tr>`).join('')
        : `<tr>
        <td style="border-bottom: 1px solid #ccc; padding: 8px 10px; font-style: italic;">[To be added upon subscription]</td>
        <td style="border-bottom: 1px solid #ccc; padding: 8px 10px; text-align: center;">${fmtMoney(equity * lpPct / 100)}</td>
        <td style="border-bottom: 1px solid #ccc; padding: 8px 10px; text-align: center;">${lpPct}%</td>
        <td style="border-bottom: 1px solid #ccc; padding: 8px 10px; text-align: center;">Limited Member(s)</td>
      </tr>`
      }
      <tr style="font-weight: bold;">
        <td style="border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 8px 10px; text-align: right;">TOTAL</td>
        <td style="border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 8px 10px; text-align: center;">${fmtMoney(equity)}</td>
        <td style="border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 8px 10px; text-align: center;">100%</td>
        <td style="border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 8px 10px;"></td>
      </tr>
    </tbody>
  </table>
  <p style="font-size: 10pt; margin-top: 16px; font-style: italic;">Schedule A shall be amended by the Managing Member from time to time to reflect the admission of additional Limited Members and changes in Capital Contributions, without requiring an amendment to this Agreement.</p>
</div>

<div style="page-break-before: always; margin-top: 60px;">
  <p style="${hdr}">EXHIBIT A<br>FORM OF SPOUSAL CONSENT</p>
  
  <p style="text-align: center; margin-bottom: 24px; font-size: 11pt;"><strong>CONSENT OF SPOUSE</strong></p>
  
  <p>I, the undersigned, am the spouse of _________________________________ (the "<strong>Member</strong>"), a member of <strong>${companyName}</strong>, a ${state} limited liability company (the "<strong>Company</strong>").</p>
  
  <p>I hereby acknowledge that I have read and understand the Limited Liability Company Operating Agreement of the Company dated ${today} (the "<strong>Agreement</strong>"), and I agree to be bound by all of the terms and provisions thereof as they relate to the community property interest, if any, that I may have in my spouse's Interest in the Company.</p>
  
  <p>I further agree that:</p>
  <ol style="margin-left: 20px;">
    <li style="margin-bottom: 8px;">My spouse's Interest in the Company, whether community property or otherwise, shall be subject to the terms and conditions of the Agreement, including but not limited to the restrictions on transfer set forth in Article VIII;</li>
    <li style="margin-bottom: 8px;">I will not, directly or indirectly, transfer, assign, pledge, or encumber any community property interest I may have in the Member's Interest without complying with the Agreement;</li>
    <li style="margin-bottom: 8px;">In the event of dissolution of my marriage, whether by divorce, annulment, or legal separation, I will be bound by the provisions of the Agreement with respect to any Interest or portion thereof that may be allocated or awarded to me;</li>
    <li style="margin-bottom: 8px;">I hereby consent to the Member's execution of the Agreement on my behalf to the extent that my consent is required by applicable community property law;</li>
    <li style="margin-bottom: 8px;">I hereby appoint the Member as my attorney-in-fact with respect to the exercise of any rights under the Agreement that may relate to my community property interest, if any.</li>
  </ol>
  
  <p style="margin-top: 8px;">This Consent is irrevocable and shall be binding upon my heirs, executors, administrators, legal representatives, and assigns.</p>
  
  <div style="margin-top: 48px;">
    <div style="display: flex; justify-content: space-between;">
      <div style="width: 45%;">
        <div style="border-bottom: 1px solid #000; margin-bottom: 5px; height: 30px;">&nbsp;</div>
        <p>Signature of Spouse</p>
        <div style="border-bottom: 1px solid #000; margin-bottom: 5px; height: 25px; margin-top: 16px;">&nbsp;</div>
        <p>Printed Name</p>
      </div>
      <div style="width: 45%;">
        <div style="border-bottom: 1px solid #000; margin-bottom: 5px; height: 25px; margin-top: 30px;">&nbsp;</div>
        <p>Date</p>
        <div style="border-bottom: 1px solid #000; margin-bottom: 5px; height: 25px; margin-top: 16px;">&nbsp;</div>
        <p>Name of Member (Spouse)</p>
      </div>
    </div>
  </div>
</div>
</div>
    `;
  }

  // ─── SUBSCRIPTION AGREEMENT ────────────────────────────────────────────────
  
  function generateSubDoc(deal, inv, gpName, gpRep) {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const dealName = safe(deal.name, '[DEAL NAME]');
    const companyName = safe(deal.companyName || gpName, '[COMPANY NAME]');
    const invName = safe(inv.firstName ? `${inv.firstName} ${inv.lastName}` : inv.name, '[INVESTOR NAME]');
    const invEmail = safe(inv.email, '[EMAIL]');
    const amount = safe(fmtMoney(inv.committed), '$[_______]');
    
    return `
<div style="font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.5; color: #000; background: #fff; padding: 40px; border: 1px solid #ccc;">

<div style="text-align: center; margin-bottom: 30px;">
  <h1 style="font-size: 14pt; margin: 0;">SUBSCRIPTION AGREEMENT AND INVESTOR QUESTIONNAIRE</h1>
  <p style="font-size: 11pt; margin-top: 5px;"><strong>${companyName}</strong></p>
  <p style="font-size: 10pt; text-transform: uppercase;">A Rule 506 Regulation D Offering</p>
</div>

<p>This Subscription Agreement (this "Agreement") is executed by the undersigned ("Subscriber") in connection with the offer and sale of limited liability company interests (the "Interests") in <strong>${companyName}</strong>, formed to acquire <strong>${dealName}</strong>.</p>

<h3 style="font-size: 11pt; border-bottom: 1px solid #000; padding-bottom: 3px;">1. SUBSCRIPTION COMMITMENT</h3>
<p>Subscriber hereby irrevocably subscribes for Interests in the Company in the amount of <strong>${amount}</strong> (the "Subscription Amount"). Subscriber agrees to wire funds in accordance with the instructions provided by the Managing Member upon acceptance of this Agreement.</p>

<h3 style="font-size: 11pt; border-bottom: 1px solid #000; padding-bottom: 3px;">2. INVESTOR INFORMATION</h3>
<table style="width:100%; border:none; margin-bottom: 20px;">
  <tr><td style="width:30%; padding:5px 0;"><strong>Name / Entity:</strong></td><td style="padding:5px 0; border-bottom:1px solid #ccc;">${invName}</td></tr>
  <tr><td style="width:30%; padding:5px 0;"><strong>Email Address:</strong></td><td style="padding:5px 0; border-bottom:1px solid #ccc;">${invEmail}</td></tr>
  <tr><td style="width:30%; padding:5px 0;"><strong>Mailing Address:</strong></td><td style="padding:5px 0; border-bottom:1px solid #ccc;">${inv.address || '________________________________________________'}</td></tr>
  <tr><td style="width:30%; padding:5px 0;"><strong>Phone Number:</strong></td><td style="padding:5px 0; border-bottom:1px solid #ccc;">${inv.phone || '_________________'}</td></tr>
  <tr><td style="width:30%; padding:5px 0;"><strong>SSN / EIN:</strong></td><td style="padding:5px 0; border-bottom:1px solid #ccc;">_________________________________</td></tr>
</table>

<h3 style="font-size: 11pt; border-bottom: 1px solid #000; padding-bottom: 3px;">3. INVESTOR TYPE AND ENTITY INFORMATION</h3>
<p><strong>3.1 Type of Subscriber</strong> (check one):</p>
<div style="margin-left: 10px;">
  <p>☐ <strong>Individual</strong></p>
  <p>☐ <strong>Joint Tenants</strong> (with right of survivorship)</p>
  <p>☐ <strong>Tenants in Common</strong></p>
  <p>☐ <strong>Community Property</strong></p>
  <p>☐ <strong>Revocable Trust</strong></p>
  <p>☐ <strong>Irrevocable Trust</strong></p>
  <p>☐ <strong>Limited Liability Company</strong></p>
  <p>☐ <strong>Limited Partnership</strong></p>
  <p>☐ <strong>Corporation (S-Corp / C-Corp)</strong></p>
  <p>☐ <strong>Self-Directed IRA / Solo 401(k)</strong></p>
  <p>☐ <strong>Other:</strong> _________________________________</p>
</div>

<p style="margin-top:14px;"><strong>3.2 Entity Details</strong> (complete if Subscriber is an entity, trust, or retirement account):</p>
<table style="width:100%; border:none; margin-bottom: 16px;">
  <tr><td style="width:35%; padding:5px 0;"><strong>Entity Legal Name:</strong></td><td style="padding:5px 0; border-bottom:1px solid #ccc;">________________________________________________</td></tr>
  <tr><td style="width:35%; padding:5px 0;"><strong>Type of Entity:</strong></td><td style="padding:5px 0; border-bottom:1px solid #ccc;">________________________________________________</td></tr>
  <tr><td style="width:35%; padding:5px 0;"><strong>State/Jurisdiction of Formation:</strong></td><td style="padding:5px 0; border-bottom:1px solid #ccc;">_________________</td></tr>
  <tr><td style="width:35%; padding:5px 0;"><strong>Date of Formation:</strong></td><td style="padding:5px 0; border-bottom:1px solid #ccc;">_________________</td></tr>
  <tr><td style="width:35%; padding:5px 0;"><strong>EIN / Tax ID:</strong></td><td style="padding:5px 0; border-bottom:1px solid #ccc;">_________________</td></tr>
  <tr><td style="width:35%; padding:5px 0;"><strong>Authorized Signatory Name &amp; Title:</strong></td><td style="padding:5px 0; border-bottom:1px solid #ccc;">________________________________________________</td></tr>
</table>

<h3 style="font-size: 11pt; border-bottom: 1px solid #000; padding-bottom: 3px;">4. ACCREDITED INVESTOR STATUS (REGULATION D)</h3>
<p>Subscriber represents and warrants that Subscriber is an "accredited investor" as defined in Rule 501(a) of Regulation D. Please check <strong>all</strong> that apply:</p>
<div style="margin-left: 10px;">
  <p>☐ <strong>Individual Net Worth:</strong> My net worth, or joint net worth with my spouse/spousal equivalent, exceeds $1,000,000 (excluding the value of my primary residence).</p>
  <p>☐ <strong>Individual Income:</strong> My individual income exceeded $200,000 in each of the two most recent years (or $300,000 joint income with spouse/spousal equivalent) and I reasonably expect the same this year.</p>
  <p>☐ <strong>Entity — All Equity Owners Accredited:</strong> Subscriber is an entity in which <em>all</em> equity owners are individually accredited investors.</p>
  <p>☐ <strong>Entity — Assets Over $5M:</strong> Subscriber is a trust, corporation, partnership, or other entity with total assets in excess of $5,000,000, not formed for the specific purpose of acquiring these Interests.</p>
  <p>☐ <strong>IRA / Benefit Plan:</strong> Subscriber is a self-directed IRA, employee benefit plan, or trust with total assets in excess of $5,000,000, directed by a person who has such knowledge and experience in financial and business matters as to be capable of evaluating the merits and risks of this investment.</p>
  <p>☐ <strong>Licensed Professional:</strong> I hold a valid Series 7, Series 65, or Series 82 license in good standing.</p>
  <p>☐ <strong>Knowledgeable Employee:</strong> I am a "knowledgeable employee" of the Company as defined in Rule 3c-5(a)(4) under the Investment Company Act of 1940.</p>
  <p>☐ <strong>Family Office / Family Client:</strong> Subscriber is a "family office" or "family client" as defined in Rule 501(a)(12)-(13) of Regulation D.</p>
</div>

<h3 style="font-size: 11pt; border-bottom: 1px solid #000; padding-bottom: 3px;">5. SUITABILITY REPRESENTATIONS</h3>
<p>Subscriber represents and warrants the following:</p>
<div style="margin-left: 10px;">
  <p>☐ I have adequate means of providing for my current financial needs and personal contingencies and have no need for liquidity of this investment.</p>
  <p>☐ I can bear the economic risk of this investment for an indefinite period, including the complete loss of my entire investment amount.</p>
  <p>☐ I have such knowledge and experience in financial and business matters as to be capable of evaluating the merits and risks of an investment in the Company, or I have engaged a qualified purchaser representative to assist me.</p>
  <p>☐ This investment does not exceed 10% of my net worth (excluding primary residence), or I acknowledge the concentration risk of a larger allocation.</p>
  <p>☐ I am investing for my own account (or the account of the entity identified above) for investment purposes only, and not with a view to resale or distribution of the Interests.</p>
  <p>☐ I understand that the Interests have not been registered under the Securities Act of 1933 and are subject to severe transfer restrictions.</p>
  <p>☐ I have received, read, and understand the Operating Agreement and Private Placement Memorandum (if any) for this offering.</p>
  <p>☐ I have had the opportunity to ask questions of, and receive answers from, the Managing Member concerning the terms and conditions of this offering, and all such questions have been answered to my satisfaction.</p>
</div>

<h3 style="font-size: 11pt; border-bottom: 1px solid #000; padding-bottom: 3px;">6. ERISA AND BENEFIT PLAN STATUS</h3>
<p>Subscriber represents the following regarding ERISA and benefit plan status (check one):</p>
<div style="margin-left: 10px;">
  <p>☐ <strong>Not a Benefit Plan Investor.</strong> Subscriber is NOT: (a) an "employee benefit plan" as defined in Section 3(3) of the Employee Retirement Income Security Act of 1974 ("ERISA"); (b) a "plan" as defined in Section 4975(e)(1) of the Internal Revenue Code; or (c) an entity whose underlying assets include "plan assets" by reason of a plan's investment in the entity.</p>
  <p>☐ <strong>Benefit Plan Investor.</strong> Subscriber IS a Benefit Plan Investor and acknowledges the following:</p>
  <div style="margin-left: 20px;">
    <p>(i) The fiduciary of the plan has determined that this investment is prudent and consistent with the plan's investment objectives;</p>
    <p>(ii) The investment does not constitute a "prohibited transaction" under ERISA Section 406 or Code Section 4975;</p>
    <p>(iii) The plan may generate Unrelated Business Taxable Income ("UBTI") due to the Company's use of debt financing, and the plan fiduciary has considered the UBTI implications;</p>
    <p>(iv) The custodian/administrator of the plan: _________________________________</p>
  </div>
</div>

<h3 style="font-size: 11pt; border-bottom: 1px solid #000; padding-bottom: 3px;">7. BAD ACTOR DISQUALIFICATION (RULE 506(d))</h3>
<p>Subscriber represents, warrants, and certifies that none of the following "Covered Persons" — including the Subscriber, any beneficial owner of 20% or more of the Subscriber's equity securities, any director, executive officer, or other officer participating in the offering, or any general partner or managing member of the Subscriber — is subject to any of the "Bad Actor" disqualifying events described in Rule 506(d)(1) of Regulation D, including but not limited to:</p>
<ul style="padding-left: 20px; font-size: 10pt;">
  <li style="margin-bottom: 4px;">Conviction of any felony or misdemeanor in connection with the purchase or sale of any security, involving false filings with the SEC, or arising out of the conduct of a financial intermediary;</li>
  <li style="margin-bottom: 4px;">Subject to any court injunction or restraining order related to securities;</li>
  <li style="margin-bottom: 4px;">Subject to any SEC disciplinary order, cease-and-desist order, or stop order;</li>
  <li style="margin-bottom: 4px;">Suspension or expulsion from membership in, or suspension or bar from association with a member of, a registered national securities exchange or FINRA;</li>
  <li style="margin-bottom: 4px;">Subject to any U.S. Postal Service false representation order.</li>
</ul>
<div style="margin-left: 10px; margin-top: 10px;">
  <p>☐ <strong>I confirm</strong> that no Covered Person is subject to any disqualifying event under Rule 506(d).</p>
  <p>☐ <strong>Disclosure:</strong> A Covered Person is or has been subject to a disqualifying event. Details are provided on a separate attachment.</p>
</div>

<h3 style="font-size: 11pt; border-bottom: 1px solid #000; padding-bottom: 3px;">8. ADDITIONAL REPRESENTATIONS AND WARRANTIES</h3>
<p>Subscriber further represents, warrants, and acknowledges to the Company and the Managing Member that:</p>
<ul style="padding-left: 20px;">
  <li style="margin-bottom: 6px;">Subscriber's principal residence (or principal place of business, if an entity) is located in the State of: _______________.</li>
  <li style="margin-bottom: 6px;">Subscriber is not a citizen or resident of any jurisdiction in which the offer or sale of these Interests would be unlawful.</li>
  <li style="margin-bottom: 6px;">The funds used for this investment are not derived from, and the investment will not constitute or facilitate, any money laundering or other illegal activity.</li>
  <li style="margin-bottom: 6px;">Subscriber is not a person or entity identified on the Specially Designated Nationals List maintained by the Office of Foreign Assets Control ("OFAC") of the U.S. Department of the Treasury.</li>
  <li style="margin-bottom: 6px;">Subscriber understands that the Company is not registered as an investment company under the Investment Company Act of 1940 and that the protections afforded by such Act are not available.</li>
  <li style="margin-bottom: 6px;">Subscriber has been advised to consult with their own attorney, accountant, and tax advisor regarding the legal, tax, and financial implications of this investment.</li>
  <li style="margin-bottom: 6px;">Subscriber acknowledges that the Managing Member and its affiliates may have conflicts of interest as described in the Private Placement Memorandum, and consents to such conflicts.</li>
</ul>

<div style="margin-top: 50px; display: flex; justify-content: space-between;">
  <div style="width: 45%;">
    <p style="font-weight: bold; margin-bottom: 30px;">SUBSCRIBER:</p>
    <div style="border-bottom: 1px solid #000; margin-bottom: 5px; height: 30px;">X</div>
    <p style="font-size: 9pt;">Signature</p>
    
    <div style="border-bottom: 1px solid #000; margin-bottom: 5px; height: 25px; margin-top: 15px;">${invName}</div>
    <p style="font-size: 9pt;">Printed Name</p>
    
    <div style="border-bottom: 1px solid #000; margin-bottom: 5px; height: 25px; margin-top: 15px;">${today}</div>
    <p style="font-size: 9pt;">Date</p>
  </div>
  
  <div style="width: 45%;">
    <p style="font-weight: bold; margin-bottom: 30px;">ACCEPTED BY THE COMPANY:</p>
    <div style="border-bottom: 1px solid #000; margin-bottom: 5px; height: 30px;">X</div>
    <p style="font-size: 9pt;">Signature</p>
    
    <div style="border-bottom: 1px solid #000; margin-bottom: 5px; height: 25px; margin-top: 15px;">${gpRep}, Managing Member</div>
    <p style="font-size: 9pt;">Printed Name / Title</p>
    
    <div style="border-bottom: 1px solid #000; margin-bottom: 5px; height: 25px; margin-top: 15px;"></div>
    <p style="font-size: 9pt;">Date of Acceptance</p>
  </div>
</div>


</div>
    `;
  }

  // ─── PRIVATE PLACEMENT MEMORANDUM ─────────────────────────────────────────

  function generatePPM(deal, gpName, gpRep, firmAddress, state, minInvest, settings) {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const equity   = deal.raise || deal.totalEquity || 0;
    const gpPct    = deal.gpEquity  || 10;
    const lpPct    = deal.lpEquity  || 90;
    const pref     = deal.prefReturn || 8;
    const promote  = deal.gpPromote  || 20;
    const lpResidual = 100 - promote;
    const acqFee   = deal.acqFee     || 3;
    const mgmtFee  = deal.assetMgmtFee || 2;
    const dispositionFee = deal.dispositionFee || 1;
    const constructionFee = deal.constructionFee || 5;
    const refinancingFee = deal.refinancingFee || 0.5;
    const dealName = safe(deal.name, '[PROPERTY NAME]');
    const loc      = safe(deal.location, '[PROPERTY LOCATION]');
    const company  = safe(deal.companyName || gpName, '[COMPANY NAME]');
    const min      = minInvest || 50000;
    const gpBio    = settings?.gpBio || '[Managing Member biography to be inserted here.]';
    const secExemption = settings?.defSEC === '506c' ? 'Rule 506(c)' : 'Rule 506(b)';
    const counsel  = settings?.defCounsel || '[Legal Counsel Name, Firm]';
    const wfType = deal.waterfallType || 'pref';
    const catchupRate = deal.catchupRate || 50;
    const wizData = deal.wizardData || deal;
    const tier2Hurdle = wizData.tier2Hurdle || 12;
    const tier2GPSplit = wizData.tier2GPSplit || 30;
    const tier3GPSplit = wizData.tier3GPSplit || 40;
    const tier2Catchup = wizData.tier2Catchup || 'yes';

    return `
<div style="font-family: 'Times New Roman', Times, serif; font-size: 10.5pt; line-height: 1.55; color: #000; background: #fff; padding: 48px; max-width: 900px; margin: 0 auto;">

<!-- Cover Page -->
<div style="text-align:center; page-break-after: always; min-height:700px; display:flex; flex-direction:column; justify-content:center; border: 3px double #000; padding: 60px 40px;">
  <p style="font-size:9pt; font-weight:bold; letter-spacing:3px; text-transform:uppercase;">CONFIDENTIAL PRIVATE PLACEMENT MEMORANDUM</p>
  <h1 style="font-size:20pt; margin:20px 0 10px; font-weight:bold;">${company}</h1>
  <p style="font-size:12pt; margin:0 0 5px;">A ${state} Limited Liability Company</p>
  <p style="font-size:12pt; margin-bottom:30px;">Formed to Acquire: <strong>${dealName}</strong></p>
  <div style="border:2px solid #000; padding:16px; margin:20px auto; max-width:500px;">
    <p style="font-size:10pt; font-weight:bold; margin-bottom:8px;">MAXIMUM OFFERING: ${fmtMoney(equity)}</p>
    <p style="font-size:9pt;">Interests in ${company} available only to <strong>Accredited Investors</strong><br>pursuant to ${secExemption} of Regulation D<br>under the Securities Act of 1933, as amended.</p>
  </div>
  <p style="font-size:9pt; margin-top:20px;">Minimum Investment: ${fmtMoney(min)}</p>
  <p style="font-size:9pt;">Preferred Return: ${pref}% &nbsp;·&nbsp; GP Promote: ${promote}%</p>
  <p style="font-size:9pt; margin-top:40px;">Presented by: <strong>${gpName}</strong></p>
  <p style="font-size:9pt;">Managing Member: ${gpRep}</p>
  <p style="font-size:9pt;">${firmAddress}</p>
  <div style="margin-top:40px; font-size:8pt; color:#555; text-align:left; border-top:1px solid #ccc; padding-top:12px;">
    THE SECURITIES OFFERED HEREBY HAVE NOT BEEN REGISTERED UNDER THE SECURITIES ACT OF 1933, AS AMENDED (THE "ACT"), OR UNDER ANY STATE SECURITIES LAWS. THESE SECURITIES ARE OFFERED PURSUANT TO AN EXEMPTION FROM REGISTRATION UNDER SECTION 4(a)(2) OF THE ACT AND THE RULES AND REGULATIONS PROMULGATED THEREUNDER. THESE SECURITIES MAY NOT BE SOLD, TRANSFERRED, OR OTHERWISE DISPOSED OF WITHOUT REGISTRATION UNDER THE ACT OR AN APPLICABLE EXEMPTION THEREFROM. INVESTING IN REAL ESTATE INVOLVES SIGNIFICANT RISKS. SEE "RISK FACTORS."${deal._cleanExport ? '' : '<br><br>THIS MEMORANDUM WAS PREPARED BY SOFTWARE AND IS A TEMPLATE. IT MUST BE REVIEWED AND REVISED BY LICENSED SECURITIES COUNSEL BEFORE USE.'}
  </div>
  <p style="font-size:8pt; margin-top:12px;"><strong>Date:</strong> ${today} &nbsp;·&nbsp; <strong>Legal Counsel:</strong> ${counsel}</p>
</div>

<!-- Table of Contents -->
<h2 style="font-size:13pt; text-align:center; margin-top:40px; text-decoration:underline;">TABLE OF CONTENTS</h2>
<table style="width:100%; border-collapse:collapse; margin:16px 0 40px;">
  ${[['1. OFFERING SUMMARY','3'],['2. THE COMPANY','4'],['3. THE PROPERTY','4'],['4. USE OF PROCEEDS','5'],['5. MANAGEMENT COMPENSATION','6'],['6. DISTRIBUTION WATERFALL','7'],['7. RISK FACTORS','8'],['8. INVESTOR SUITABILITY STANDARDS','9'],['9. TAX CONSIDERATIONS','10'],['10. CONFLICTS OF INTEREST','10'],['11. FINANCIAL PROJECTIONS','11'],['12. LEGAL MATTERS AND SEC NOTICE','12'],['13. HOW TO SUBSCRIBE','13']].map(([t,p])=>`<tr><td style="padding:5px 0; border-bottom:1px dotted #ccc;">${t}</td><td style="padding:5px 0; border-bottom:1px dotted #ccc; text-align:right;">${p}</td></tr>`).join('')}
</table>

<!-- Section 1: Offering Summary -->
<h2 style="font-size:12pt; text-decoration:underline; margin-top:30px;">SECTION 1 — OFFERING SUMMARY</h2>
<table style="width:100%; border-collapse:collapse; font-size:10pt; margin-bottom:20px;">
  ${[
    ['Issuer', company],
    ['Managing Member', gpName],
    ['Property', dealName],
    ['Location', loc],
    ['Property Type', (deal.type||'Real Estate').replace(/\b\w/g,c=>c.toUpperCase())],
    ['Total Offering Size', fmtMoney(equity)],
    ['GP Equity Contribution', `${gpPct}% of total equity (${fmtMoney(equity*gpPct/100)})`],
    ['LP Equity Raise', `${lpPct}% of total equity (${fmtMoney(equity*lpPct/100)})`],
    ['Minimum Investment', fmtMoney(min)],
    ['Preferred Return', wfType === 'simple' ? 'N/A — Simple split structure' : `${pref}% per annum, non-compounding`],
    ['GP Promote / Structure', wfType === 'simple' ? `${promote}/${lpResidual} GP/LP split on all profits above return of capital`
      : wfType === 'pref' ? `${promote}% of profits above the preferred return (no catch-up)`
      : wfType === 'tiered' ? `${tier2GPSplit}% up to ${tier2Hurdle}% IRR, then ${tier3GPSplit}% above`
      : `${promote}% of profits above the preferred return (with catch-up)`],
    ['Acquisition Fee', `${acqFee}% of purchase price, paid at closing`],
    ['Asset Management Fee', `${mgmtFee}% of gross revenues, paid monthly`],
    ['Offering Exemption', `${secExemption} of Regulation D`],
    ['Investor Eligibility', 'Accredited Investors only (Rule 501(a))'],
    ['Expected Hold Period', `${deal.holdPeriod||5} years`],
    ['Target IRR', deal.irr ? `${deal.irr.toFixed(1)}%` : 'To be determined'],
    ['Target Equity Multiple', deal.equity ? `${deal.equity.toFixed(2)}x` : 'To be determined'],
  ].map(([k,v])=>`<tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:7px 10px; font-weight:bold; width:40%; background:#fafafa;">${k}</td><td style="padding:7px 10px;">${v}</td></tr>`).join('')}
</table>

<!-- Section 2: The Company -->
<h2 style="font-size:12pt; text-decoration:underline; margin-top:30px;">SECTION 2 — THE COMPANY</h2>
<p>${company} (the "Company") is a ${state} limited liability company formed for the sole purpose of acquiring, owning, operating, and ultimately disposing of ${dealName}, located at ${loc} (the "Property"). The Company will be managed exclusively by ${gpName} as the Managing Member.</p>
<p>The Company is not a publicly traded entity. Interests in the Company are illiquid and subject to substantial restrictions on transfer. This offering is made only to accredited investors who can afford to bear the complete loss of their investment.</p>

<!-- Section 3: The Property -->
<h2 style="font-size:12pt; text-decoration:underline; margin-top:30px;">SECTION 3 — THE PROPERTY</h2>
<p><strong>Name/Address:</strong> ${dealName}, ${loc}</p>
<p><strong>Property Type:</strong> ${(deal.type||'Real Estate').replace(/\b\w/g,c=>c.toUpperCase())}${deal.units ? ` · ${deal.units} units` : ''}</p>
<p><strong>Business Plan:</strong> ${deal.notes || '[Description of the property acquisition strategy, value-add plan, and exit strategy to be completed by the Managing Member.]'}</p>
<p><strong>Purchase Price:</strong> ${deal.purchasePrice ? fmtMoney(deal.purchasePrice) : '[Purchase price to be inserted]'}</p>
<p><strong>Debt Financing:</strong> ${deal.loanAmount ? fmtMoney(deal.loanAmount) : '[Loan amount to be inserted]'}${deal.interestRate ? ` at approximately ${deal.interestRate}% interest` : ''}</p>
<p><strong>Total Equity Required:</strong> ${fmtMoney(equity)}</p>

<!-- Section 4: Use of Proceeds -->
<h2 style="font-size:12pt; text-decoration:underline; margin-top:30px;">SECTION 4 — USE OF PROCEEDS</h2>
${(function() {
  // Compute Use of Proceeds from actual deal data, not hard-coded percentages
  const purchasePrice = deal.purchasePrice || 0;
  const loanAmt = deal.loanAmount || 0;
  const equityPortion = purchasePrice > 0 ? Math.max(purchasePrice - loanAmt, 0) : 0;
  const acqFeeAmt = purchasePrice > 0 ? Math.round(purchasePrice * acqFee / 100) : 0;
  const closingCostsAmt = deal.closingCosts || 0;
  const capexAmt = deal.capexReserve || 0;
  // Operating reserve = whatever equity remains after the above line items
  const subtotal = equityPortion + acqFeeAmt + closingCostsAmt + capexAmt;
  const opReserve = Math.max(equity - subtotal, 0);
  const total = equityPortion + acqFeeAmt + closingCostsAmt + capexAmt + opReserve;
  const hasDealData = purchasePrice > 0;

  // Helper: percentage of total
  const pctOf = (amt) => total > 0 ? (amt / total * 100).toFixed(1) : '—';

  if (!hasDealData) {
    // No deal financials entered — show placeholder with advisory
    return '<p style="color:#666; font-style:italic;">Use of Proceeds will be calculated from the deal\'s financial data (purchase price, loan amount, closing costs, and capital expenditure reserves). Please ensure these fields are populated in the deal record.</p>' +
    '<table style="width:100%; border-collapse:collapse; font-size:10pt; margin-bottom:20px;">' +
    '<thead><tr style="background:#f1f5f9;"><th style="border:1px solid #ddd; padding:8px; text-align:left;">Use</th><th style="border:1px solid #ddd; padding:8px; text-align:right;">Estimated Amount</th><th style="border:1px solid #ddd; padding:8px; text-align:right;">% of Raise</th></tr></thead>' +
    '<tbody>' +
    '<tr><td style="border:1px solid #ddd; padding:8px;">Property Acquisition (Equity Portion)</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">[Purchase Price − Loan]</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">—</td></tr>' +
    '<tr><td style="border:1px solid #ddd; padding:8px;">Acquisition Fee (' + acqFee + '%)</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">[' + acqFee + '% × Purchase Price]</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">—</td></tr>' +
    '<tr><td style="border:1px solid #ddd; padding:8px;">Closing Costs &amp; Legal</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">[From deal record]</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">—</td></tr>' +
    '<tr><td style="border:1px solid #ddd; padding:8px;">Capital Expenditure Reserve</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">[From deal record]</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">—</td></tr>' +
    '<tr><td style="border:1px solid #ddd; padding:8px;">Operating Reserves</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">[Remainder]</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">—</td></tr>' +
    '<tr style="background:#f8fafc; font-weight:bold;"><td style="border:1px solid #ddd; padding:8px;">TOTAL</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">' + fmtMoney(equity) + '</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">100%</td></tr>' +
    '</tbody></table>';
  }

  return '<table style="width:100%; border-collapse:collapse; font-size:10pt; margin-bottom:20px;">' +
  '<thead><tr style="background:#f1f5f9;"><th style="border:1px solid #ddd; padding:8px; text-align:left;">Use</th><th style="border:1px solid #ddd; padding:8px; text-align:right;">Estimated Amount</th><th style="border:1px solid #ddd; padding:8px; text-align:right;">% of Raise</th></tr></thead>' +
  '<tbody>' +
  '<tr><td style="border:1px solid #ddd; padding:8px;">Property Acquisition (Equity Portion)<br><span style="font-size:8.5pt; color:#666;">Purchase Price ' + fmtMoney(purchasePrice) + ' less Debt Financing ' + fmtMoney(loanAmt) + '</span></td><td style="border:1px solid #ddd; padding:8px; text-align:right;">' + fmtMoney(equityPortion) + '</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">' + pctOf(equityPortion) + '%</td></tr>' +
  '<tr><td style="border:1px solid #ddd; padding:8px;">Acquisition Fee (' + acqFee + '% of Purchase Price)</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">' + fmtMoney(acqFeeAmt) + '</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">' + pctOf(acqFeeAmt) + '%</td></tr>' +
  '<tr><td style="border:1px solid #ddd; padding:8px;">Closing Costs &amp; Legal</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">' + fmtMoney(closingCostsAmt) + '</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">' + pctOf(closingCostsAmt) + '%</td></tr>' +
  '<tr><td style="border:1px solid #ddd; padding:8px;">Capital Expenditure Reserve</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">' + fmtMoney(capexAmt) + '</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">' + pctOf(capexAmt) + '%</td></tr>' +
  (opReserve > 0 ? '<tr><td style="border:1px solid #ddd; padding:8px;">Operating Reserves</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">' + fmtMoney(opReserve) + '</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">' + pctOf(opReserve) + '%</td></tr>' : '') +
  '<tr style="background:#f8fafc; font-weight:bold;"><td style="border:1px solid #ddd; padding:8px;">TOTAL</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">' + fmtMoney(total) + '</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">100%</td></tr>' +
  '</tbody></table>' +
  '<p style="font-size:9pt; color:#555;">The foregoing estimates are based on information available as of the date hereof and are subject to change. Actual amounts may vary based on final purchase terms, lender requirements, and market conditions. Any excess proceeds will be held as additional operating reserves.</p>';
})()}

<!-- Section 5: Management Compensation -->
<h2 style="font-size:12pt; text-decoration:underline; margin-top:30px;">SECTION 5 — MANAGEMENT COMPENSATION</h2>
<p>The Managing Member and its affiliates will receive the following fees and compensation in connection with the acquisition, operation, and disposition of the Property:</p>
<table style="width:100%; border-collapse:collapse; font-size:10pt; margin-bottom:16px;">
  <thead><tr style="background:#f1f5f9;"><th style="border:1px solid #ddd; padding:8px; text-align:left;">Fee</th><th style="border:1px solid #ddd; padding:8px; text-align:left;">Amount</th><th style="border:1px solid #ddd; padding:8px; text-align:left;">Timing / Basis</th></tr></thead>
  <tbody>
    <tr><td style="border:1px solid #ddd; padding:8px;"><strong>Acquisition Fee</strong></td><td style="border:1px solid #ddd; padding:8px;">${acqFee}% of gross purchase price${deal.purchasePrice ? ' (' + fmtMoney(Math.round(deal.purchasePrice * acqFee / 100)) + ')' : ''}</td><td style="border:1px solid #ddd; padding:8px;">One-time, paid at closing from offering proceeds</td></tr>
    <tr><td style="border:1px solid #ddd; padding:8px;"><strong>Asset Management Fee</strong></td><td style="border:1px solid #ddd; padding:8px;">${mgmtFee}% of gross revenues</td><td style="border:1px solid #ddd; padding:8px;">Ongoing, paid monthly in arrears</td></tr>
    <tr><td style="border:1px solid #ddd; padding:8px;"><strong>GP Promote (Carried Interest)</strong></td><td style="border:1px solid #ddd; padding:8px;">${promote}% of profits above Preferred Return</td><td style="border:1px solid #ddd; padding:8px;">Per distribution event, per the waterfall</td></tr>
    <tr><td style="border:1px solid #ddd; padding:8px;"><strong>Disposition Fee</strong></td><td style="border:1px solid #ddd; padding:8px;">${dispositionFee}% of gross sale price</td><td style="border:1px solid #ddd; padding:8px;">One-time, at sale — subordinated to LP return of capital and accrued pref</td></tr>
    <tr><td style="border:1px solid #ddd; padding:8px;"><strong>Construction Management Fee</strong></td><td style="border:1px solid #ddd; padding:8px;">Up to ${constructionFee}% of hard construction costs</td><td style="border:1px solid #ddd; padding:8px;">If GP directly oversees material capex; disclosed in advance</td></tr>
    <tr><td style="border:1px solid #ddd; padding:8px;"><strong>Refinancing Fee</strong></td><td style="border:1px solid #ddd; padding:8px;">Up to ${refinancingFee}% of new loan amount</td><td style="border:1px solid #ddd; padding:8px;">One-time per refinancing event, at closing</td></tr>
  </tbody>
</table>
<p style="font-size:9.5pt; color:#444;">The foregoing fees are in addition to the Managing Member's right to receive distributions as a Member (including the GP promote). The Managing Member believes these fees are consistent with industry standards for comparable real estate syndications, but investors should be aware that these fees reduce the net return on their investment. See "Conflicts of Interest" for additional discussion.</p>

<!-- Section 6: Distribution Waterfall -->
<h2 style="font-size:12pt; text-decoration:underline; margin-top:30px;">SECTION 6 — DISTRIBUTION WATERFALL</h2>
<p>All Distributable Cash (as defined in the Operating Agreement) shall be distributed in the following order:</p>
${buildWaterfallOASection(wfType, pref, promote, lpResidual, catchupRate, tier2Hurdle, tier2GPSplit, tier3GPSplit, tier2Catchup)}

<!-- Section 6: Risk Factors -->
<h2 style="font-size:12pt; text-decoration:underline; margin-top:30px;">SECTION 7 — RISK FACTORS</h2>
<p><em>This investment involves significant risk. You may lose your entire investment. The following is not an exhaustive list.</em></p>
<p><strong>Illiquidity Risk.</strong> There is no public market for the Interests. Investors may not be able to liquidate their investment and should be prepared to hold for the full expected hold period of ${deal.holdPeriod||5} years or longer.</p>
<p><strong>Real Estate Market Risk.</strong> The value of the Property may decline due to changes in local market conditions, interest rates, employment, or supply and demand imbalances.</p>
<p><strong>Financing Risk.</strong> The Company will use mortgage financing. Rising interest rates, changes in lender requirements, or the inability to refinance could adversely affect returns.</p>
<p><strong>Management Risk.</strong> The success of this investment depends substantially on the skill and judgment of ${gpName}. Loss of key personnel could adversely impact the investment.</p>
<p><strong>Projection Risk.</strong> The financial projections in this memorandum are estimates based on assumptions. Actual results may differ materially. Projections are not guarantees.</p>
<p><strong>Regulatory Risk.</strong> Changes in tax laws, zoning regulations, rent control laws, environmental requirements, or other regulations may adversely impact the investment.</p>
<p><strong>Concentration Risk.</strong> The Company will invest in a single property, providing no diversification.</p>
<p><strong>No Independent Manager.</strong> The Managing Member has significant discretion and control. Limited Members have limited rights to participate in management decisions.</p>
<p><strong>Tax Risk.</strong> Investors should consult their own tax advisors regarding the tax consequences of this investment. Tax laws are subject to change.</p>

<!-- Section 7: Suitability Standards -->
<h2 style="font-size:12pt; text-decoration:underline; margin-top:30px;">SECTION 8 — INVESTOR SUITABILITY</h2>
<p>This offering is available only to "Accredited Investors" as defined in Rule 501(a) of Regulation D. An Accredited Investor includes:</p>
<ul style="padding-left:20px;">
  <li>An individual with net worth (excluding primary residence) exceeding $1,000,000;</li>
  <li>An individual with annual income exceeding $200,000 (or $300,000 jointly with spouse) in each of the prior two years;</li>
  <li>A trust with assets exceeding $5,000,000 not formed for the specific purpose of acquiring these interests;</li>
  <li>An entity in which all equity owners are accredited investors;</li>
  <li>A licensed investment professional holding a valid Series 7, Series 65, or Series 82 license.</li>
</ul>
<p>By subscribing, investors represent that they meet at least one of the above criteria and have the financial sophistication to evaluate this investment.</p>

<!-- Section 8: Tax -->
<h2 style="font-size:12pt; text-decoration:underline; margin-top:30px;">SECTION 9 — TAX CONSIDERATIONS</h2>
<p>The Company intends to be treated as a partnership for U.S. federal income tax purposes. Each Member will receive a Schedule K-1 reporting their distributive share of income, gains, losses, deductions, and credits for each tax year. Prospective investors should consult with their own tax counsel regarding the tax consequences of an investment in the Company, including depreciation benefits and passive activity rules.</p>

<!-- Section 9: Conflicts of Interest -->
<h2 style="font-size:12pt; text-decoration:underline; margin-top:30px;">SECTION 10 — CONFLICTS OF INTEREST</h2>
<p><em>Prospective investors should carefully consider the following conflicts of interest, which are inherent in the structure of this offering and the relationship between the Managing Member and the Company.</em></p>

<p><strong>Compensation and Fees.</strong> The Managing Member and its affiliates will receive fees in connection with this investment, including an acquisition fee of ${acqFee}% and an ongoing asset management fee of ${mgmtFee}% of gross revenues (see "Management Compensation" above). These fees are payable regardless of whether the investment generates a positive return for the Limited Members. The Managing Member's interest in earning fees may conflict with its duty to manage the Company in the best interest of the Limited Members.</p>

<p><strong>Other Activities and Competing Investments.</strong> The Managing Member and its affiliates are not required to devote their full time and attention to the Company. The Managing Member may sponsor, manage, or invest in other real estate ventures, including ventures that compete directly with the Company for tenants, financing, or acquisition opportunities. The Managing Member is under no obligation to present any investment opportunity to the Company and may pursue such opportunities independently or for other entities.</p>

<p><strong>Related Party Transactions.</strong> The Managing Member or its affiliates may provide property management, construction management, brokerage, or other services to the Company. While the Operating Agreement requires that such services be provided on terms no less favorable than those available from unaffiliated third parties, there is an inherent conflict in the Managing Member's ability to determine the terms of affiliated transactions.</p>

<p><strong>GP Co-Investment.</strong> The Managing Member (and/or its affiliates) intends to contribute approximately ${gpPct}% of the total equity capitalization. While this aligns the Managing Member's interests with those of the Limited Members, the Managing Member's promote (carried interest) and fee income provide the Managing Member with returns in excess of its capital contribution, which may incentivize risk-taking beyond what is optimal for the Limited Members.</p>

<p><strong>Borrowing Decisions.</strong> The decision to finance the Property with mortgage debt, and the terms of such financing, will be made by the Managing Member. Leverage magnifies both gains and losses and increases the risk that the Company may be unable to meet its debt service obligations. The Managing Member's promote structure may incentivize the use of greater leverage than would be optimal from the Limited Members' perspective.</p>

<p><strong>Timing of Disposition.</strong> The Managing Member has sole discretion over the timing of the sale or disposition of the Property, subject to Major Decision approval. The Managing Member's promote may incentivize it to hold or sell the Property at a time that maximizes promote income rather than total return to the Limited Members.</p>

<p><strong>No Independent Representation.</strong> The legal counsel preparing the formation documents and this memorandum represents the Company and the Managing Member, not the individual Limited Members. Each prospective investor is urged to retain their own independent legal and tax counsel to review this offering.</p>

<!-- Section 10: Financial Projections -->
<h2 style="font-size:12pt; text-decoration:underline; margin-top:30px;">SECTION 11 — FINANCIAL PROJECTIONS</h2>
<p style="font-style:italic; color:#c00; border:1px solid #c00; padding:10px; margin-bottom:16px;"><strong>IMPORTANT:</strong> The following projections are estimates only and are based on assumptions that may not be realized. Actual results will differ, perhaps materially, from these projections. Past performance of the Managing Member or similar properties is not indicative of future results. These projections are not a guarantee or promise of any particular return.</p>

<p><strong>Key Assumptions:</strong></p>
<table style="width:100%; border-collapse:collapse; font-size:10pt; margin-bottom:16px;">
  <tbody>
    <tr style="border-bottom:1px solid #eee;"><td style="padding:6px 10px; font-weight:bold; width:45%; background:#fafafa;">Purchase Price</td><td style="padding:6px 10px;">${deal.purchasePrice ? fmtMoney(deal.purchasePrice) : '[To be determined]'}</td></tr>
    <tr style="border-bottom:1px solid #eee;"><td style="padding:6px 10px; font-weight:bold; background:#fafafa;">Total Equity Required</td><td style="padding:6px 10px;">${fmtMoney(equity)}</td></tr>
    <tr style="border-bottom:1px solid #eee;"><td style="padding:6px 10px; font-weight:bold; background:#fafafa;">Debt Financing</td><td style="padding:6px 10px;">${deal.loanAmount ? fmtMoney(deal.loanAmount) : '[To be determined]'}${deal.interestRate ? ' at ' + deal.interestRate + '% interest' : ''}</td></tr>
    <tr style="border-bottom:1px solid #eee;"><td style="padding:6px 10px; font-weight:bold; background:#fafafa;">Projected Hold Period</td><td style="padding:6px 10px;">${deal.holdPeriod || 5} years</td></tr>
    <tr style="border-bottom:1px solid #eee;"><td style="padding:6px 10px; font-weight:bold; background:#fafafa;">Distribution Waterfall</td><td style="padding:6px 10px;">${pref}% preferred return, ${promote}/${lpResidual} GP/LP split above pref</td></tr>
    <tr style="border-bottom:1px solid #eee;"><td style="padding:6px 10px; font-weight:bold; background:#fafafa;">Target IRR (Net to LP)</td><td style="padding:6px 10px;">${deal.irr ? deal.irr.toFixed(1) + '%' : '[To be determined based on final underwriting]'}</td></tr>
    <tr style="border-bottom:1px solid #eee;"><td style="padding:6px 10px; font-weight:bold; background:#fafafa;">Target Equity Multiple (Net to LP)</td><td style="padding:6px 10px;">${deal.equity ? deal.equity.toFixed(2) + 'x' : '[To be determined based on final underwriting]'}</td></tr>
    <tr style="border-bottom:1px solid #eee;"><td style="padding:6px 10px; font-weight:bold; background:#fafafa;">Assumed Annual Revenue Growth</td><td style="padding:6px 10px;">${deal.revenueGrowth ? deal.revenueGrowth + '%' : '2–3% (market assumption)'}</td></tr>
    <tr style="border-bottom:1px solid #eee;"><td style="padding:6px 10px; font-weight:bold; background:#fafafa;">Assumed Exit Cap Rate</td><td style="padding:6px 10px;">${deal.exitCapRate ? deal.exitCapRate + '%' : '[Based on market conditions at time of disposition]'}</td></tr>
  </tbody>
</table>

<p><strong>Sensitivity Disclaimer.</strong> The projected returns are sensitive to changes in key assumptions, including but not limited to: occupancy rates, rental rates, operating expenses, interest rates, capital expenditure requirements, and exit capitalization rates. A change of 50 basis points in the exit cap rate, or a 5% variance in operating expenses, can materially impact investor returns. The Managing Member makes no representation that any of the assumptions will prove correct or that the projected returns will be achieved.</p>

<p><strong>No Assurance of Distributions.</strong> There can be no assurance that the Company will generate sufficient cash flow to make distributions to the Members at any time. Distributions are subject to the availability of Distributable Cash after debt service, operating expenses, capital reserves, and other obligations of the Company. The Managing Member may, in its sole discretion, retain cash for reserves rather than make distributions.</p>

<!-- Section 11: Legal Matters -->
<h2 style="font-size:12pt; text-decoration:underline; margin-top:30px;">SECTION 12 — LEGAL MATTERS AND SEC NOTICE</h2>
<p>This offering is being made in reliance upon the exemption from registration provided by ${secExemption} of Regulation D under the Securities Act of 1933. A Form D notice will be filed with the Securities and Exchange Commission within 15 days of the first sale. State notice filings will be made as required.</p>
<p><strong>Legal Counsel:</strong> ${counsel}</p>
<p>No sale will be made to a resident of any state in which the offer is not exempt or does not qualify under applicable state securities laws.</p>

<!-- Section 12: How to Subscribe -->
<h2 style="font-size:12pt; text-decoration:underline; margin-top:30px;">SECTION 13 — HOW TO SUBSCRIBE</h2>
<ol style="padding-left:24px;">
  <li style="margin-bottom:8px;">Complete, sign, and return the Subscription Agreement and Investor Questionnaire.</li>
  <li style="margin-bottom:8px;">Provide documentation evidencing accredited investor status as requested by the Managing Member.</li>
  <li style="margin-bottom:8px;">Wire your subscription funds per the wire instructions provided by the Managing Member upon acceptance.</li>
  <li style="margin-bottom:8px;">Upon acceptance, you will receive a countersigned copy of the Subscription Agreement and will be added to the Operating Agreement as a Member.</li>
</ol>
<p>Subscriptions are subject to acceptance by the Managing Member in its sole discretion. The Managing Member reserves the right to close this offering at any time.</p>

<div style="margin-top:60px; border-top:2px solid #000; padding-top:20px; font-size:8.5pt; color:#444;">
  <strong>CONFIDENTIALITY NOTICE:</strong> This Private Placement Memorandum is confidential and has been prepared solely for the benefit of prospective investors in ${company}. Any reproduction or distribution without prior written consent of ${gpName} is strictly prohibited. This document is not an offer to sell or a solicitation of an offer to buy securities in any jurisdiction in which such offer or solicitation is unlawful.
</div>
</div>`;
  }

  return { generateOA, generateSubDoc, generatePPM };
})();
