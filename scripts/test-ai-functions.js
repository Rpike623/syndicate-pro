#!/usr/bin/env node
/**
 * test-ai-functions.js — calls all 10 AI Cloud Functions via Firebase callable protocol
 * Uses service account to get an ID token, then calls each function with realistic test data.
 */
const { GoogleAuth } = require('google-auth-library');
const https = require('https');
const http = require('http');

const PROJECT_ID = 'deeltrack';
const REGION = 'us-central1';
const SA_PATH = '/root/.openclaw/secrets/deeltrack-service-account.json';

// Set env for google-auth-library
process.env.GOOGLE_APPLICATION_CREDENTIALS = SA_PATH;

const TESTS = [
  {
    name: 'aiDraftInvestorUpdate',
    data: {
      dealName: 'Oakwood Heights Apartments',
      period: 'Q1 2026',
      updateType: 'quarterly',
      bullets: 'Occupancy dropped from 94% to 74% this quarter due to roof repairs displacing 12 units. We replaced the entire HVAC system in Building C — $180K over budget. Rents are up 3% on renewed leases. Two tenant complaints about mold in ground floor units — remediation scheduled for April. Insurance claim filed for hail damage from February storm. We expect to stabilize back at 90%+ by Q3.',
      metrics: { occupancy: 94.6, noi: 450000, collections: 98.2 }
    }
  },
  {
    name: 'aiParseBrokerOM',
    data: {
      text: `OFFERING MEMORANDUM
Sunset Ridge Apartments — 248 Units
4500 Sunset Ridge Blvd, Fort Worth, TX 76109

INVESTMENT HIGHLIGHTS
• 248-unit garden-style multifamily community built in 1998
• 95.2% occupied with average in-place rents of $1,150/unit
• Asking Price: $32,500,000 ($131,048/unit)
• Going-in Cap Rate: 5.8% | NOI: $1,885,000
• Value-add opportunity: $8K-12K/unit renovation potential
• Submarket vacancy: 4.1% (vs. metro 5.7%)
• Strong employment drivers: Lockheed Martin, Bell Helicopter, Texas Health
• 2024 tax assessment: $28.1M (appealed)
• RISKS: Roof replacement needed on 3 of 8 buildings ($650K est.), foundation settling on Building D, potential flood zone reclassification`
    }
  },
  {
    name: 'aiReviewDocument',
    data: {
      documentText: `OPERATING AGREEMENT OF OAKWOOD HEIGHTS INVESTORS, LLC
A Texas Limited Liability Company
Effective Date: January 15, 2026
ARTICLE I - ORGANIZATION
1.1 Formation. Oakwood Heights Investors, LLC was formed on January 10, 2026.
1.2 Members. Robert Pike (Managing Member, 20% interest), Limited Partners as set forth in Exhibit A.
1.3 Capital Contributions. Minimum investment: $50,000. Total raise: $4,200,000.
ARTICLE IV - DISTRIBUTIONS
4.1 Preferred Return. 8% annual preferred return (accruing, non-compounding).
4.2 Waterfall. After pref: 70% LP / 30% GP until 15% IRR, then 60/40.
4.3 Management Fee. 2% of invested capital annually.`,
      dealData: {
        name: 'Oakwood Heights Apartments',
        raise: 4500000,  // intentional mismatch
        prefReturn: 0.08,
        gpSplit: 30,
        lpSplit: 70,
        managementFee: 1.5,  // intentional mismatch
        minInvestment: 50000,
        irr: 18.5
      }
    }
  },
  {
    name: 'aiDraftNotice',
    data: {
      noticeType: 'capital_call',
      dealName: 'Oakwood Heights Apartments',
      amount: '$250,000',
      dueDate: 'April 15, 2026',
      notes: 'Capital call for HVAC replacement in Buildings A & B. Emergency repair — original contractor defaulted.',
      investors: 14
    }
  },
  {
    name: 'aiDueDiligenceChecklist',
    data: {
      propertyType: 'multifamily',
      dealSize: '32500000',
      units: '248',
      state: 'Texas',
      strategy: 'value-add'
    }
  },
  {
    name: 'aiCompareDeal',
    data: {
      dealA: {
        name: 'Sunset Ridge Apartments',
        units: 248, price: 32500000, capRate: 5.8, noi: 1885000,
        occupancy: 95.2, yearBuilt: 1998, type: 'multifamily',
        location: 'Fort Worth, TX', strategy: 'value-add',
        renovBudget: 2500000, raise: 8000000, irr: 18.5
      },
      dealB: {
        name: 'Magnolia Crossing',
        units: 164, price: 18750000, capRate: 6.2, noi: 1162500,
        occupancy: 91.5, yearBuilt: 2005, type: 'multifamily',
        location: 'Arlington, TX', strategy: 'light value-add',
        renovBudget: 900000, raise: 5200000, irr: 15.2
      }
    }
  },
  {
    name: 'aiCategorizeDocument',
    data: {
      fileName: 'Oakwood_Heights_Phase_II_Environmental_Assessment_2025.pdf',
      textPreview: 'PHASE II ENVIRONMENTAL SITE ASSESSMENT\nPrepared for: Pike Capital Ventures, LLC\nProperty: Oakwood Heights Apartments, 1200 Oak Street, Fort Worth, TX\nDate: November 2025\n\nEXECUTIVE SUMMARY\nThis Phase II ESA was conducted to evaluate recognized environmental conditions (RECs) identified in the Phase I ESA dated September 2025. Soil and groundwater sampling was performed at 12 locations. Results indicate no concentrations exceeding TCEQ Tier 1 Protective Concentration Levels.'
    }
  },
  {
    name: 'aiUnderwritingCheck',
    data: {
      assumptions: {
        propertyType: 'multifamily',
        location: 'Fort Worth, TX',
        units: 248,
        purchasePrice: 32500000,
        goingInCapRate: 5.8,
        exitCapRate: 5.5,
        holdPeriod: 5,
        rentGrowth: 4.5,
        expenseRatio: 0.42,
        vacancy: 5,
        renovCostPerUnit: 12000,
        totalRaise: 8000000,
        ltv: 0.75,
        debtRate: 6.8,
        ioPeriod: 2,
        prefReturn: 0.08,
        gpPromote: '30/40 (above 8% pref / above 15% IRR)',
        managementFee: 0.02,
        acquisitionFee: 0.015,
        dispositionFee: 0.01
      }
    }
  },
  {
    name: 'aiInvestorQA',
    data: {
      question: 'When is the next distribution expected, and how is my preferred return calculated?',
      dealContext: {
        name: 'Oakwood Heights Apartments',
        prefReturn: '8% annual, accruing, non-compounding',
        distributionFrequency: 'Quarterly',
        lastDistribution: 'January 15, 2026 — $42,500 total',
        nextExpected: 'April 2026',
        holdPeriod: '5 years',
        investorCommitment: 250000
      },
      documentExcerpts: 'Section 4.1 Preferred Return: Limited Partners shall receive a cumulative, non-compounding preferred return of eight percent (8%) per annum on their unreturned capital contributions, calculated from the date of contribution and payable quarterly in arrears. Section 4.2 Distribution Waterfall: After satisfaction of the Preferred Return, Net Cash Flow shall be distributed 70% to Limited Partners and 30% to the General Partner until Limited Partners achieve a 15% IRR.'
    }
  },
  {
    name: 'parseDocumentVariables',
    data: {
      text: `OPERATING AGREEMENT OF PCRP GROUP, LLC
A Texas Limited Liability Company
Effective Date: March 18, 2026
State of Formation: Texas
File Number: 806499674

ARTICLE I - ORGANIZATION
1.1 Name. PCRP Group, LLC (the "Company").
1.2 Registered Agent. Philip C Chapman, 123 Main Street, Fort Worth, Texas 76102.
1.3 Principal Office. 456 Commerce Street, Suite 200, Fort Worth, Texas 76102.

ARTICLE II - MEMBERS
2.1 Members and Interests:
  Philip C Chapman — 50% Membership Interest
  Robert Pike — 50% Membership Interest

2.2 Capital Contributions. Each Member shall contribute Twenty-Five Thousand Dollars ($25,000).
2.3 Partnership Representative. Philip C Chapman shall serve as the Partnership Representative.

ARTICLE IV - DISTRIBUTIONS
4.1 Preferred Return. 8% annual preferred return on unreturned capital.
4.2 Promote. After pref: 70% LP / 30% GP.
4.3 Management Fee. 1.5% of invested capital.`,
      docType: 'operating agreement'
    }
  }
];

// ── Get a Firebase-compatible ID token from service account ──
async function getIdToken() {
  const sa = require(SA_PATH);
  const jwt = require('jsonwebtoken');
  
  // Create a custom JWT to exchange for an ID token
  const now = Math.floor(Date.now() / 1000);
  const customToken = jwt.sign(
    {
      iss: sa.client_email,
      sub: sa.client_email,
      aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
      iat: now,
      exp: now + 3600,
      uid: 'test-ai-runner',
    },
    sa.private_key,
    { algorithm: 'RS256' }
  );

  // Exchange custom token for ID token using Firebase Auth REST API
  const apiKey = 'AIzaSyApYFLlP39E8_LGLsSOgzqFbt333U5Yli4'; // Firebase Web API key
  
  const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  
  const data = await resp.json();
  if (!data.idToken) {
    // Try getting the web API key from firebase config
    console.error('Could not get ID token:', JSON.stringify(data));
    throw new Error('Failed to get Firebase ID token');
  }
  return data.idToken;
}

// ── Call a callable function via HTTP ──
async function callFunction(name, data, idToken) {
  const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${name}`;
  
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data }),
  });
  
  const text = await resp.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  
  return { status: resp.status, body: parsed };
}

// ── Main ──
async function main() {
  console.log('🧪 Deeltrack AI Functions Test Suite\n');
  console.log('Getting Firebase ID token...');
  
  let idToken;
  try {
    idToken = await getIdToken();
    console.log('✅ Got ID token\n');
  } catch (err) {
    console.error('❌ Failed to get ID token:', err.message);
    console.log('\nTrying without jsonwebtoken — using service account directly...');
    // Fallback: use Google Auth access token + custom header approach
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    idToken = token.token;
    console.log('✅ Got access token (fallback)\n');
  }
  
  const results = [];
  
  for (const test of TESTS) {
    process.stdout.write(`Testing ${test.name}... `);
    const start = Date.now();
    
    try {
      const resp = await callFunction(test.name, test.data, idToken);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      
      if (resp.status === 200 && resp.body?.result) {
        const result = resp.body.result;
        // Validate structure
        const keys = typeof result === 'object' ? Object.keys(result) : [];
        console.log(`✅ ${elapsed}s — keys: [${keys.join(', ')}]`);
        results.push({ name: test.name, status: 'PASS', elapsed, keys, sample: JSON.stringify(result).substring(0, 200) });
      } else {
        console.log(`❌ ${elapsed}s — HTTP ${resp.status}`);
        const errMsg = resp.body?.error?.message || JSON.stringify(resp.body).substring(0, 300);
        console.log(`   Error: ${errMsg}`);
        results.push({ name: test.name, status: 'FAIL', elapsed, error: errMsg });
      }
    } catch (err) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`❌ ${elapsed}s — ${err.message}`);
      results.push({ name: test.name, status: 'FAIL', elapsed, error: err.message });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  console.log(`\n  ✅ Passed: ${pass}/${results.length}`);
  console.log(`  ❌ Failed: ${fail}/${results.length}\n`);
  
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`  ${icon} ${r.name} (${r.elapsed}s)`);
    if (r.status === 'PASS') {
      console.log(`     Keys: [${r.keys.join(', ')}]`);
      console.log(`     Sample: ${r.sample}`);
    } else {
      console.log(`     Error: ${r.error}`);
    }
    console.log();
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
