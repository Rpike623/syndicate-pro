// sp-documents.js
// Thorough legal document generation for SyndicatePro

const SPDocs = (function() {

  function safe(val, def = '[____]') {
    return val !== undefined && val !== null && val !== '' ? val : def;
  }

  function fmtMoney(num) {
    if (!num) return '$0';
    return '$' + Number(num).toLocaleString();
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

    return `
<div style="font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.5; color: #000; background: #fff; padding: 40px; border: 1px solid #ccc;">

<div style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px;">
  <p style="font-size: 10pt; font-weight: bold; letter-spacing: 2px;">OPERATING AGREEMENT OF</p>
  <h1 style="font-size: 18pt; margin: 10px 0;">${companyName}</h1>
  <p style="font-size: 11pt;">A ${state} Limited Liability Company</p>
  <p style="font-size: 11pt;">Dated as of ${today}</p>
</div>

<div style="background: #fdf2f8; border: 1px solid #fecdd3; padding: 15px; margin-bottom: 30px; font-family: sans-serif; font-size: 9pt; color: #be123c;">
  <strong>DRAFT / TEMPLATE:</strong> This document was auto-generated by software based on user inputs. It is for organizational and drafting purposes only. It does not constitute legal advice and has not been reviewed by an attorney. DO NOT EXECUTE OR DISTRIBUTE WITHOUT REVIEW BY LICENSED SECURITIES COUNSEL.
</div>

<p>This LIMITED LIABILITY COMPANY OPERATING AGREEMENT (this "<strong>Agreement</strong>") is made and entered into as of ${today} (the "<strong>Effective Date</strong>"), by and among <strong>${gpName}</strong>, as the managing member (the "<strong>Managing Member</strong>" or "<strong>GP</strong>"), and the persons and entities listed on Schedule A attached hereto, as limited members (the "<strong>Limited Members</strong>", "<strong>Limited Partners</strong>", or "<strong>LPs</strong>").</p>

<!-- REMAINDER OF OA -->
<h2 style="font-size: 12pt; text-align: center; margin-top: 30px; text-decoration: underline;">ARTICLE I: FORMATION AND OVERVIEW</h2>
<p><strong>1.1 Formation.</strong> The Company was formed as a limited liability company under the laws of the State of ${state} by the filing of its formation documents with the appropriate state authority.</p>
<p><strong>1.2 Name.</strong> The name of the Company is ${companyName}. The business of the Company may be conducted under any other name designated by the Managing Member.</p>
<p><strong>1.3 Principal Office.</strong> The principal office of the Company shall be located at ${safe(firmAddress, '[FIRM ADDRESS]')}, or such other place as the Managing Member may determine.</p>
<p><strong>1.4 Purpose.</strong> The purpose of the Company is to acquire, own, operate, manage, finance, refinance, lease, and eventually sell or dispose of that certain real property commonly known as <strong>${dealName}</strong>, located at ${loc} (the "<strong>Property</strong>"), and to engage in any and all other activities necessary or incidental to the foregoing.</p>

<h2 style="font-size: 12pt; text-align: center; margin-top: 30px; text-decoration: underline;">ARTICLE II: CAPITAL CONTRIBUTIONS</h2>
<p><strong>2.1 Total Capitalization.</strong> The projected total equity capitalization of the Company is <strong>${fmtMoney(equity)}</strong>.</p>
<p><strong>2.2 Managing Member Contribution.</strong> The Managing Member (and/or its affiliates) agrees to contribute cash or sweat equity such that its Capital Account initially equals <strong>${gpPct}%</strong> of the total equity capitalization.</p>
<p><strong>2.3 Limited Member Contributions.</strong> The Limited Members shall contribute cash in the amounts set forth opposite their respective names on Schedule A, collectively representing <strong>${lpPct}%</strong> of the initial equity capitalization. The minimum investment for any Limited Member is ${fmtMoney(minInvest)}, unless waived by the Managing Member.</p>
<p><strong>2.4 Capital Accounts.</strong> A separate Capital Account shall be maintained for each Member in accordance with the rules of Treasury Regulation Section 1.704-1(b)(2)(iv).</p>

<h2 style="font-size: 12pt; text-align: center; margin-top: 30px; text-decoration: underline;">ARTICLE III: DISTRIBUTIONS & WATERFALL</h2>
<p><strong>3.1 Distributable Cash.</strong> "Distributable Cash" means all cash funds of the Company on hand from operations or capital events, less amounts required for debt service, operating expenses, and reasonable reserves as determined by the Managing Member.</p>
<p><strong>3.2 Distribution Priority (The Waterfall).</strong> Except as otherwise provided upon liquidation, Distributable Cash shall be distributed to the Members in the following order of priority:</p>
<ol type="a">
  <li style="margin-bottom: 8px;"><strong>First (Return of Capital):</strong> 100% to all Members in proportion to their unreturned Capital Contributions, until their Capital Account balances have been reduced to zero;</li>
  <li style="margin-bottom: 8px;"><strong>Second (Preferred Return):</strong> 100% to the Limited Members, in proportion to their accrued but unpaid Preferred Return, until each Limited Member has received a cumulative, non-compounding return of <strong>${pref}% per annum</strong> on their unreturned capital;</li>
  <li style="margin-bottom: 8px;"><strong>Third (GP Catch-Up):</strong> 100% to the Managing Member until the Managing Member has received <strong>${promote}%</strong> of all distributions made under subsection (b) and this subsection (c) combined;</li>
  <li style="margin-bottom: 8px;"><strong>Fourth (Residual Split):</strong> Thereafter, the balance shall be distributed <strong>${promote}% to the Managing Member</strong> and <strong>${lpResidual}% to the Limited Members</strong>.</li>
</ol>
<p><strong>3.3 Tax Distributions.</strong> To the extent legally and financially permissible, the Managing Member shall use commercially reasonable efforts to make distributions to the Members sufficient to cover federal and state income tax liabilities reasonably expected to result from the allocation of Company taxable income.</p>

<h2 style="font-size: 12pt; text-align: center; margin-top: 30px; text-decoration: underline;">ARTICLE IV: MANAGEMENT AND FEES</h2>
<p><strong>4.1 Authority of Managing Member.</strong> The business and affairs of the Company shall be managed exclusively by the Managing Member, acting through its authorized representative, <strong>${gpRep}</strong>. The Managing Member shall have full and complete authority, power, and discretion to manage and control the business.</p>
<p><strong>4.2 Compensation and Fees.</strong> For services rendered to the Company, the Managing Member (or an affiliate) shall receive:</p>
<ul>
  <li><strong>Acquisition Fee:</strong> A one-time fee equal to <strong>${acqFee}%</strong> of the gross purchase price of the Property, payable at closing.</li>
  <li><strong>Asset Management Fee:</strong> An ongoing fee equal to <strong>${mgmtFee}%</strong> of the gross monthly revenues collected by the Property.</li>
</ul>
<p><strong>4.3 Limitation on Authority (Major Decisions).</strong> Notwithstanding the foregoing, the Managing Member shall not take any of the following "Major Decisions" without the affirmative vote or written consent of a Majority-in-Interest (over 50%) of the Limited Members: (i) filing for bankruptcy; (ii) dissolving the Company; or (iii) performing any act in contravention of this Agreement.</p>

<h2 style="font-size: 12pt; text-align: center; margin-top: 30px; text-decoration: underline;">ARTICLE V: EXCULPATION AND INDEMNIFICATION</h2>
<p><strong>5.1 Exculpation.</strong> The Managing Member, its affiliates, and their respective officers, directors, and employees (the "Covered Persons") shall not be liable to the Company or any Member for any loss, damage, or claim incurred by reason of any act or omission performed or omitted by such Covered Person in good faith on behalf of the Company, except for acts or omissions involving gross negligence, fraud, or willful misconduct.</p>
<p><strong>5.2 Indemnification.</strong> The Company shall indemnify and hold harmless the Covered Persons to the fullest extent permitted by law against any losses, judgments, liabilities, expenses, and amounts paid in settlement of any claims sustained by them in connection with the Company, provided such Covered Person's conduct did not constitute gross negligence, fraud, or willful misconduct.</p>

<h2 style="font-size: 12pt; text-align: center; margin-top: 30px; text-decoration: underline;">ARTICLE VI: TRANSFERS OF INTERESTS</h2>
<p><strong>6.1 Restrictions on Transfer.</strong> No Member may sell, assign, pledge, or otherwise transfer any portion of their Interest without the prior written consent of the Managing Member, which consent may be withheld in the Managing Member's sole and absolute discretion.</p>
<p><strong>6.2 Right of First Refusal.</strong> If the Managing Member consents to a proposed transfer, the Company and/or the non-transferring Members shall have a right of first refusal to purchase the transferring Member's Interest on the same terms and conditions.</p>

<h2 style="font-size: 12pt; text-align: center; margin-top: 30px; text-decoration: underline;">ARTICLE VII: ACCOUNTING, RECORDS, AND TAX</h2>
<p><strong>7.1 Fiscal Year.</strong> The fiscal year of the Company shall be the calendar year.</p>
<p><strong>7.2 Books and Records.</strong> The Managing Member shall keep or cause to be kept proper and complete books of account using appropriate accounting principles.</p>
<p><strong>7.3 Tax Reports (K-1s).</strong> The Managing Member shall use commercially reasonable efforts to deliver a Schedule K-1 (or equivalent) to each Member within 75 days after the end of each fiscal year.</p>
<p><strong>7.4 Partnership Representative.</strong> The Managing Member is hereby designated as the "Partnership Representative" pursuant to Section 6223(a) of the Internal Revenue Code.</p>

<h2 style="font-size: 12pt; text-align: center; margin-top: 30px; text-decoration: underline;">ARTICLE VIII: STATE PROVISIONS & MISCELLANEOUS</h2>
${stateSection}
<p><strong>8.2 Entire Agreement.</strong> This Agreement, including any exhibits and schedules, constitutes the entire agreement among the parties regarding the subject matter hereof.</p>
<p><strong>8.3 Counterparts.</strong> This Agreement may be executed in counterparts, each of which shall be deemed an original, and all of which together shall constitute one agreement.</p>
<p><strong>8.4 Governing Law.</strong> This Agreement shall be governed by and construed in accordance with the laws of the State of ${state}, without regard to conflicts of law principles.</p>

<div style="page-break-inside: avoid; margin-top: 60px;">
  <p>IN WITNESS WHEREOF, the parties hereto have executed this Agreement as of the date first above written.</p>
  <div style="display: flex; justify-content: space-between; margin-top: 50px;">
    <div style="width: 45%;">
      <p style="border-top: 1px solid #000; padding-top: 5px; margin-top: 40px; font-weight: bold;">MANAGING MEMBER:</p>
      <p>${gpName}</p>
      <p>By: ${gpRep}</p>
      <p>Title: Managing Member / Authorized Representative</p>
    </div>
    <div style="width: 45%;">
      <p style="border-top: 1px solid #000; padding-top: 5px; margin-top: 40px; font-weight: bold;">LIMITED MEMBER(S):</p>
      <p>The persons and entities listed on Schedule A,</p>
      <p>whose signatures are affixed to their respective Subscription Agreements.</p>
    </div>
  </div>
</div>

<div style="page-break-before: always; margin-top: 60px;">
  <h2 style="font-size: 12pt; text-align: center; text-decoration: underline;">SCHEDULE A</h2>
  <h3 style="font-size: 11pt; text-align: center;">MEMBERS AND CAPITAL CONTRIBUTIONS</h3>
  
  <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
    <thead>
      <tr style="background: #f1f5f9;">
        <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">Member Name</th>
        <th style="border: 1px solid #ccc; padding: 10px; text-align: center;">Capital Contribution</th>
        <th style="border: 1px solid #ccc; padding: 10px; text-align: center;">Class / Role</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border: 1px solid #ccc; padding: 10px;">${gpName}</td>
        <td style="border: 1px solid #ccc; padding: 10px; text-align: center;">${fmtMoney(equity * gpPct / 100)}</td>
        <td style="border: 1px solid #ccc; padding: 10px; text-align: center;">Managing Member</td>
      </tr>
      ${linkedInvestors && linkedInvestors.length > 0
        ? linkedInvestors.map(inv => `
      <tr>
        <td style="border: 1px solid #ccc; padding: 10px;">${inv.firstName || ''} ${inv.lastName || ''}<br><span style="font-size:9pt;color:#666;">${inv.email || ''}</span></td>
        <td style="border: 1px solid #ccc; padding: 10px; text-align: center;">${fmtMoney(inv._committed || 0)}</td>
        <td style="border: 1px solid #ccc; padding: 10px; text-align: center;">Limited Member</td>
      </tr>`).join('')
        : `<tr>
        <td style="border: 1px solid #ccc; padding: 10px; font-style: italic; color: #666;">[Limited Partners — added as they subscribe]</td>
        <td style="border: 1px solid #ccc; padding: 10px; text-align: center;">${fmtMoney(equity * lpPct / 100)}</td>
        <td style="border: 1px solid #ccc; padding: 10px; text-align: center;">Limited Member</td>
      </tr>`
      }
      <tr style="background: #f8fafc; font-weight: bold;">
        <td style="border: 1px solid #ccc; padding: 10px; text-align: right;">TOTAL:</td>
        <td style="border: 1px solid #ccc; padding: 10px; text-align: center;">${fmtMoney(equity)}</td>
        <td style="border: 1px solid #ccc; padding: 10px;"></td>
      </tr>
    </tbody>
  </table>
  <p style="font-size: 9pt; color: #666; margin-top: 10px;">* Schedule A is updated dynamically by the Managing Member as Limited Members execute Subscription Agreements and fund their commitments.</p>
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

<h3 style="font-size: 11pt; border-bottom: 1px solid #000; padding-bottom: 3px;">3. ACCREDITED INVESTOR STATUS (REGULATION D)</h3>
<p>Subscriber represents and warrants that Subscriber is an "accredited investor" as defined in Rule 501(a) of Regulation D. Please check all that apply:</p>
<div style="margin-left: 10px;">
  <p>☐ <strong>Individual Net Worth:</strong> My net worth, or joint net worth with my spouse, exceeds $1,000,000 (excluding the value of my primary residence).</p>
  <p>☐ <strong>Individual Income:</strong> My individual income exceeded $200,000 in each of the two most recent years (or $300,000 joint income with spouse) and I expect the same this year.</p>
  <p>☐ <strong>Entity:</strong> Subscriber is an entity wherein all equity owners are accredited investors, or the entity has total assets in excess of $5,000,000 and was not formed solely for the purpose of this investment.</p>
  <p>☐ <strong>License Holder:</strong> I hold a valid Series 7, Series 65, or Series 82 license.</p>
</div>

<h3 style="font-size: 11pt; border-bottom: 1px solid #000; padding-bottom: 3px;">4. REPRESENTATIONS AND WARRANTIES</h3>
<p>Subscriber represents, warrants, and acknowledges to the Company and the Managing Member that:</p>
<ul style="padding-left: 20px;">
  <li style="margin-bottom: 6px;">Subscriber has received, read, and understands the Operating Agreement and Private Placement Memorandum (if any).</li>
  <li style="margin-bottom: 6px;">Subscriber is purchasing the Interests for their own account for investment purposes, not with a view to resale or distribution.</li>
  <li style="margin-bottom: 6px;">Subscriber understands that the Interests have not been registered with the SEC and are subject to severe transfer restrictions.</li>
  <li style="margin-bottom: 6px;">Subscriber has sufficient financial experience to evaluate the risks and can bear the complete loss of this investment.</li>
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
    const acqFee   = deal.acqFee     || 3;
    const mgmtFee  = deal.assetMgmtFee || 2;
    const dealName = safe(deal.name, '[PROPERTY NAME]');
    const loc      = safe(deal.location, '[PROPERTY LOCATION]');
    const company  = safe(deal.companyName || gpName, '[COMPANY NAME]');
    const min      = minInvest || 50000;
    const gpBio    = settings?.gpBio || '[Managing Member biography to be inserted here.]';
    const secExemption = settings?.defSEC === '506c' ? 'Rule 506(c)' : 'Rule 506(b)';
    const counsel  = settings?.defCounsel || '[Legal Counsel Name, Firm]';

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
    THE SECURITIES OFFERED HEREBY HAVE NOT BEEN REGISTERED UNDER THE SECURITIES ACT OF 1933, AS AMENDED (THE "ACT"), OR UNDER ANY STATE SECURITIES LAWS. THESE SECURITIES ARE OFFERED PURSUANT TO AN EXEMPTION FROM REGISTRATION UNDER SECTION 4(a)(2) OF THE ACT AND THE RULES AND REGULATIONS PROMULGATED THEREUNDER. THESE SECURITIES MAY NOT BE SOLD, TRANSFERRED, OR OTHERWISE DISPOSED OF WITHOUT REGISTRATION UNDER THE ACT OR AN APPLICABLE EXEMPTION THEREFROM. INVESTING IN REAL ESTATE INVOLVES SIGNIFICANT RISKS. SEE "RISK FACTORS."<br><br>
    THIS MEMORANDUM WAS PREPARED BY SOFTWARE AND IS A TEMPLATE. IT MUST BE REVIEWED AND REVISED BY LICENSED SECURITIES COUNSEL BEFORE USE.
  </div>
  <p style="font-size:8pt; margin-top:12px;"><strong>Date:</strong> ${today} &nbsp;·&nbsp; <strong>Legal Counsel:</strong> ${counsel}</p>
</div>

<!-- Table of Contents -->
<h2 style="font-size:13pt; text-align:center; margin-top:40px; text-decoration:underline;">TABLE OF CONTENTS</h2>
<table style="width:100%; border-collapse:collapse; margin:16px 0 40px;">
  ${[['OFFERING SUMMARY','3'],['THE COMPANY','4'],['THE PROPERTY','4'],['USE OF PROCEEDS','5'],['STRUCTURE OF THE OFFERING','5'],['DISTRIBUTION WATERFALL','6'],['MANAGEMENT COMPENSATION','6'],['RISK FACTORS','7'],['INVESTOR SUITABILITY STANDARDS','8'],['CONFLICTS OF INTEREST','9'],['TAX CONSIDERATIONS','9'],['FINANCIAL PROJECTIONS','10'],['LEGAL MATTERS','11'],['HOW TO SUBSCRIBE','11']].map(([t,p])=>`<tr><td style="padding:5px 0; border-bottom:1px dotted #ccc;">${t}</td><td style="padding:5px 0; border-bottom:1px dotted #ccc; text-align:right;">${p}</td></tr>`).join('')}
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
    ['Preferred Return', `${pref}% per annum, non-compounding`],
    ['GP Promote', `${promote}% of profits above the preferred return`],
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
<table style="width:100%; border-collapse:collapse; font-size:10pt; margin-bottom:20px;">
  <thead><tr style="background:#f1f5f9;"><th style="border:1px solid #ddd; padding:8px; text-align:left;">Use</th><th style="border:1px solid #ddd; padding:8px; text-align:right;">Estimated Amount</th></tr></thead>
  <tbody>
    <tr><td style="border:1px solid #ddd; padding:8px;">Property Acquisition (Equity Portion)</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">${fmtMoney(Math.round(equity*0.78))}</td></tr>
    <tr><td style="border:1px solid #ddd; padding:8px;">Acquisition Fee (${acqFee}%)</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">${deal.purchasePrice ? fmtMoney(Math.round(deal.purchasePrice*acqFee/100)) : '[Amount]'}</td></tr>
    <tr><td style="border:1px solid #ddd; padding:8px;">Closing Costs & Legal</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">${fmtMoney(Math.round(equity*0.04))}</td></tr>
    <tr><td style="border:1px solid #ddd; padding:8px;">Capital Expenditure Reserve</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">${fmtMoney(Math.round(equity*0.06))}</td></tr>
    <tr><td style="border:1px solid #ddd; padding:8px;">Operating Reserves</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">${fmtMoney(Math.round(equity*0.04))}</td></tr>
    <tr style="background:#f8fafc; font-weight:bold;"><td style="border:1px solid #ddd; padding:8px;">TOTAL</td><td style="border:1px solid #ddd; padding:8px; text-align:right;">${fmtMoney(equity)}</td></tr>
  </tbody>
</table>

<!-- Section 5: Distribution Waterfall -->
<h2 style="font-size:12pt; text-decoration:underline; margin-top:30px;">SECTION 5 — DISTRIBUTION WATERFALL</h2>
<p>All Distributable Cash (as defined in the Operating Agreement) shall be distributed in the following order:</p>
<ol style="padding-left:24px;">
  <li style="margin-bottom:8px;"><strong>Return of Capital:</strong> 100% to all Members, pro-rata, until each Member has received a full return of their capital contribution.</li>
  <li style="margin-bottom:8px;"><strong>Preferred Return:</strong> 100% to the Limited Members until they have received a cumulative, non-compounding preferred return of <strong>${pref}% per annum</strong> on their invested capital.</li>
  <li style="margin-bottom:8px;"><strong>GP Catch-Up:</strong> 100% to the Managing Member until it has received <strong>${promote}%</strong> of all amounts distributed in tier (2) and (3) combined.</li>
  <li style="margin-bottom:8px;"><strong>Residual Split:</strong> ${promote}% to the Managing Member / ${100-promote}% to the Limited Members on all remaining cash.</li>
</ol>

<!-- Section 6: Risk Factors -->
<h2 style="font-size:12pt; text-decoration:underline; margin-top:30px;">SECTION 6 — RISK FACTORS</h2>
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
<h2 style="font-size:12pt; text-decoration:underline; margin-top:30px;">SECTION 7 — INVESTOR SUITABILITY</h2>
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
<h2 style="font-size:12pt; text-decoration:underline; margin-top:30px;">SECTION 8 — TAX CONSIDERATIONS</h2>
<p>The Company intends to be treated as a partnership for U.S. federal income tax purposes. Each Member will receive a Schedule K-1 reporting their distributive share of income, gains, losses, deductions, and credits for each tax year. Prospective investors should consult with their own tax counsel regarding the tax consequences of an investment in the Company, including depreciation benefits and passive activity rules.</p>

<!-- Section 9: Legal Matters -->
<h2 style="font-size:12pt; text-decoration:underline; margin-top:30px;">SECTION 9 — LEGAL MATTERS AND SEC NOTICE</h2>
<p>This offering is being made in reliance upon the exemption from registration provided by ${secExemption} of Regulation D under the Securities Act of 1933. A Form D notice will be filed with the Securities and Exchange Commission within 15 days of the first sale. State notice filings will be made as required.</p>
<p><strong>Legal Counsel:</strong> ${counsel}</p>
<p>No sale will be made to a resident of any state in which the offer is not exempt or does not qualify under applicable state securities laws.</p>

<!-- Section 10: How to Subscribe -->
<h2 style="font-size:12pt; text-decoration:underline; margin-top:30px;">SECTION 10 — HOW TO SUBSCRIBE</h2>
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
