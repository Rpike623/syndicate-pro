/**
 * deeltrack Comprehensive Audit Suite
 * Tests: Security rules, fresh signup flow, auth edge cases, redirects, funnel
 * Run: node tests/test-audit.js
 */

const admin = require('firebase-admin');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'deeltrack';
const REGION = 'us-central1';
const LIVE_SITE = 'https://rpike623.github.io/syndicate-pro';
const FIREBASE_SITE = 'https://deeltrack.web.app';

let db;
let passed = 0;
let failed = 0;
let skipped = 0;
const errors = [];

function ok(name) { passed++; console.log(`  ✅ ${name}`); }
function fail(name, err) { failed++; errors.push({ name, err: String(err) }); console.log(`  ❌ ${name}: ${err}`); }
function skip(name, reason) { skipped++; console.log(`  ⏭  ${name}: ${reason}`); }

function fetchUrl(url, opts = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) { reject(new Error('too many redirects')); return; }
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 15000, headers: opts.headers || {} }, (res) => {
      // Follow redirects
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location) {
        const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        res.resume(); // consume response
        fetchUrl(next, opts, redirects + 1).then(resolve).catch(reject);
        return;
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. FIRESTORE SECURITY RULES AUDIT (static analysis)
// ══════════════════════════════════════════════════════════════════════════════
function auditFirestoreRules() {
  console.log('\n🔐 FIRESTORE SECURITY RULES AUDIT');
  console.log('─'.repeat(50));
  
  const rulesPath = path.join(__dirname, '..', 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');
  
  // 1a. No open rules (allow read/write: if true)
  if (/allow\s+(read|write|create|update|delete)[^;]*:\s*if\s+true/.test(rules)) {
    fail('No open "if true" rules', 'Found permissive rule: allow if true');
  } else {
    ok('No open "if true" rules');
  }
  
  // 1b. No wildcard match without auth
  const wildcardNoAuth = rules.match(/match\s+\/\{[^}]+\}[\s\S]*?allow\s+\w+[^;]*?(?!isSignedIn|request\.auth)/g);
  // Better check: every allow line should reference auth
  const allowLines = rules.match(/allow\s+.*?;/g) || [];
  let unauthedAllows = 0;
  allowLines.forEach(line => {
    if (line.includes('if false')) return; // blocked rules are fine
    if (!line.includes('isSignedIn') && !line.includes('request.auth') && !line.includes('ownsOrg') && !line.includes('isOrgAdmin') && !line.includes('isInvestorRole') && !line.includes('false')) {
      unauthedAllows++;
    }
  });
  if (unauthedAllows > 0) {
    fail('All allows require auth', `${unauthedAllows} allow rule(s) without auth check`);
  } else {
    ok('All allows require auth');
  }
  
  // 1c. _config and _stripe_events locked to false
  if (rules.includes("match /_config/{docId}") && /\/_config\/\{docId\}[\s\S]*?allow read, write: if false/.test(rules)) {
    ok('_config collection locked (read/write: false)');
  } else {
    fail('_config collection locked', 'Config collection may be readable');
  }
  
  if (rules.includes("match /_stripe_events/{docId}") && /\/_stripe_events\/\{docId\}[\s\S]*?allow read, write: if false/.test(rules)) {
    ok('_stripe_events collection locked (read/write: false)');
  } else {
    fail('_stripe_events collection locked', 'Stripe events may be readable');
  }
  
  // 1d. Audit logs locked
  if (/\/auditLogs\/[\s\S]*?allow read: if false[\s\S]*?allow write: if false/.test(rules)) {
    ok('auditLogs locked (read/write: false)');
  } else {
    fail('auditLogs locked', 'Audit logs may be accessible');
  }
  
  // 1e. User can only read own profile
  if (/\/users\/\{userId\}[\s\S]*?allow read:.*uid\(\)\s*==\s*userId/.test(rules)) {
    ok('Users can only read own profile');
  } else {
    fail('Users can only read own profile', 'User read rule may be too broad');
  }
  
  // 1f. Role immutable on update (multiline rule — flatten then check)
  const flatRules = rules.replace(/\n/g, ' ');
  if (flatRules.includes('request.resource.data.role == resource.data.role')) {
    ok('User role is immutable on client update');
  } else {
    fail('User role immutable', 'Role may be changeable from client');
  }
  
  // 1g. orgId immutable on update
  if (flatRules.includes('request.resource.data.orgId == resource.data.orgId')) {
    ok('User orgId is immutable on client update');
  } else {
    fail('User orgId immutable', 'orgId may be changeable from client — ORG ESCAPE POSSIBLE');
  }
  
  // 1g2. orgIds (multi-org array) immutable on update
  if (flatRules.includes('request.resource.data.orgIds == resource.data.orgIds')) {
    ok('User orgIds array is immutable on client update');
  } else {
    fail('User orgIds immutable', 'orgIds array may be changeable — MULTI-ORG ESCAPE POSSIBLE');
  }
  
  // 1h. Investor can only read own investor record (by email)
  if (/\/investors\/[\s\S]*?isInvestorRole\(\)[\s\S]*?resource\.data\.email\s*==\s*request\.auth\.token\.email/.test(rules)) {
    ok('Investors can only read their own investor record (email match)');
  } else {
    fail('Investor record isolation', 'Investors may be able to read other investor records');
  }
  
  // 1i. Investors cannot write deals, investors, settings
  const investorWriteBlocks = [
    { collection: 'deals', pattern: /\/deals\/[\s\S]*?allow read, write:.*!isInvestorRole\(\)/ },
    { collection: 'investors', pattern: /\/investors\/[\s\S]*?allow read, write:.*!isInvestorRole\(\)/ },
    { collection: 'settings', pattern: /\/settings\/[\s\S]*?allow read, write:.*!isInvestorRole\(\)/ },
  ];
  investorWriteBlocks.forEach(({ collection, pattern }) => {
    if (pattern.test(rules)) {
      ok(`Investors cannot write to ${collection}`);
    } else {
      fail(`Investors blocked from ${collection} writes`, `Investor may have write access to ${collection}`);
    }
  });
  
  // 1j. Commitments — check for overly broad create
  if (/\/commitments\/[\s\S]*?allow create: if isSignedIn\(\)/.test(rules)) {
    console.log('  ⚠️  WARNING: commitments allow create for ANY signed-in user (by design for invest flow, but could be abused)');
  }
  
  // 1k. signing_requests — check for overly broad read/update
  if (/\/signing_requests\/[\s\S]*?allow read, update: if isSignedIn\(\)/.test(rules)) {
    console.log('  ⚠️  WARNING: signing_requests readable/updatable by ANY signed-in user (needed for cross-org signing, but risky)');
  }

  // 1l. deal_invites — readable by any signed-in user  
  if (/\/deal_invites\/[\s\S]*?allow read: if isSignedIn\(\)/.test(rules)) {
    console.log('  ⚠️  WARNING: deal_invites readable by ANY signed-in user (needed for invite flow)');
  }
  
  // 1m. team_invites — readable by any signed-in user
  if (/\/team_invites\/[\s\S]*?allow read: if isSignedIn\(\)/.test(rules)) {
    console.log('  ⚠️  WARNING: team_invites readable by ANY signed-in user (needed for accept flow)');
  }
  
  // 1n. _invites global index — writable by non-investors
  if (/\/_invites\/[\s\S]*?allow write:.*isSignedIn\(\).*!isInvestorRole\(\)/.test(rules)) {
    ok('_invites writable only by non-investor authenticated users');
  } else if (/\/_invites\/[\s\S]*?allow write/.test(rules)) {
    fail('_invites write restriction', 'Global invite index write rule may be too broad');
  }
  
  // 1o. No recursive wildcard {document=**} that allows access
  // Extract each recursive match block and check if ALL its allows are "if false"
  const recursiveBlocks = rules.match(/match\s+[^\n]*\{document=\*\*\}[^}]*\}/g) || [];
  const dangerousRecursive = recursiveBlocks.filter(block => {
    const allows = block.match(/allow\s+.*?;/g) || [];
    return allows.some(a => !a.includes('if false'));
  });
  if (dangerousRecursive.length > 0) {
    fail('No open recursive wildcards', `Found ${dangerousRecursive.length} open recursive wildcard(s)`);
  } else {
    ok('No open recursive wildcards (auditLogs {document=**} is locked)');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. STORAGE RULES AUDIT
// ══════════════════════════════════════════════════════════════════════════════
function auditStorageRules() {
  console.log('\n📁 STORAGE SECURITY RULES AUDIT');
  console.log('─'.repeat(50));
  
  const rulesPath = path.join(__dirname, '..', 'storage.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');
  
  // 2a. No open rules
  if (/allow\s+(read|write)[^;]*:\s*if\s+true/.test(rules)) {
    fail('No open storage rules', 'Found "allow if true"');
  } else {
    ok('No open storage rules');
  }
  
  // 2b. All rules require auth
  const storageAllows = rules.match(/allow\s+.*?;/g) || [];
  const unauthed = storageAllows.filter(l => !l.includes('request.auth'));
  if (unauthed.length > 0) {
    fail('All storage rules require auth', `${unauthed.length} rule(s) without auth`);
  } else {
    ok('All storage rules require auth');
  }
  
  // 2c. File size limits
  if (rules.includes('request.resource.size <')) {
    ok('File size limits enforced');
  } else {
    fail('File size limits', 'No file size limits in storage rules');
  }
  
  // 2d. Content type restrictions
  if (rules.includes('request.resource.contentType.matches')) {
    ok('Content type restrictions enforced');
  } else {
    fail('Content type restrictions', 'No content type checks in storage rules');
  }
  
  // 2e. Investors cannot write documents
  if (/documents\/.*role != 'Investor'/.test(rules)) {
    ok('Investors cannot upload documents');
  } else {
    fail('Investor document uploads blocked', 'Investors may be able to upload');
  }
  
  // 2f. Org isolation on documents
  if (/documents\/\{orgId\}[\s\S]*?\.orgId == orgId/.test(rules)) {
    ok('Document storage scoped to org');
  } else {
    fail('Document storage org scoping', 'Cross-org document access may be possible');
  }
  
  // 2g. No wildcard catch-all in storage
  if (/match\s+\/\{allPaths=\*\*\}/.test(rules) && !/allow.*if false/.test(rules)) {
    fail('No open wildcard in storage', 'Catch-all wildcard found');
  } else {
    ok('No open wildcard catch-all in storage');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. LIVE SITE REDIRECT AUDIT (all 137 coming-soon pages)
// ══════════════════════════════════════════════════════════════════════════════
async function auditRedirects() {
  console.log('\n🔄 COMING-SOON REDIRECT AUDIT (local file check)');
  console.log('─'.repeat(50));
  
  const rootDir = path.join(__dirname, '..');
  const allHtml = fs.readdirSync(rootDir).filter(f => f.endsWith('.html'));
  
  let redirectCount = 0;
  let brokenRedirects = [];
  
  allHtml.forEach(file => {
    const content = fs.readFileSync(path.join(rootDir, file), 'utf8');
    if (content.includes('coming-soon.html?feature=')) {
      redirectCount++;
      // Verify it has the meta refresh tag
      if (!content.includes('http-equiv="refresh"')) {
        brokenRedirects.push(file);
      }
      // Verify the feature param is URL-encoded properly
      const match = content.match(/coming-soon\.html\?feature=([^"']+)/);
      if (match) {
        try {
          decodeURIComponent(match[1]);
        } catch (e) {
          brokenRedirects.push(`${file} (bad encoding: ${match[1]})`);
        }
      }
    }
  });
  
  if (brokenRedirects.length === 0) {
    ok(`All ${redirectCount} coming-soon redirects have valid meta-refresh tags`);
  } else {
    fail(`Coming-soon redirects`, `${brokenRedirects.length} broken: ${brokenRedirects.join(', ')}`);
  }
  
  // Verify coming-soon.html itself exists and reads the feature param
  const csHtml = fs.readFileSync(path.join(rootDir, 'coming-soon.html'), 'utf8');
  if (csHtml.includes('feature') && csHtml.includes('URLSearchParams') || csHtml.includes('searchParams') || csHtml.includes("get('feature')") || csHtml.includes('getUrlParam')) {
    ok('coming-soon.html reads ?feature parameter');
  } else {
    fail('coming-soon.html feature param', 'Does not appear to read the feature parameter');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. SIGNUP FUNNEL AUDIT (landing → signup → onboarding → dashboard)
// ══════════════════════════════════════════════════════════════════════════════
async function auditFunnel() {
  console.log('\n🚀 SIGNUP FUNNEL AUDIT');
  console.log('─'.repeat(50));
  
  const rootDir = path.join(__dirname, '..');
  
  // 4a. index.html exists and links to signup/login
  const index = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  if (index.includes('signup.html') || index.includes('register.html') || index.includes('Get Started')) {
    ok('Landing page links to signup');
  } else {
    fail('Landing page signup link', 'index.html does not link to signup');
  }
  
  if (index.includes('login.html')) {
    ok('Landing page links to login');
  } else {
    fail('Landing page login link', 'index.html does not link to login');
  }
  
  // 4b. signup.html has required fields
  const signup = fs.readFileSync(path.join(rootDir, 'signup.html'), 'utf8');
  const requiredFields = ['email', 'password', 'firstName', 'lastName'];
  requiredFields.forEach(field => {
    if (signup.includes(`id="${field}"`)) {
      ok(`Signup has ${field} field`);
    } else {
      fail(`Signup ${field} field`, `Missing input#${field}`);
    }
  });
  
  // 4c. signup.html has Firebase Auth
  if (signup.includes('firebase-auth') && signup.includes('SPFB.signUp') || signup.includes('signUp')) {
    ok('Signup uses Firebase Auth');
  } else {
    fail('Signup Firebase Auth', 'May not be using Firebase Auth');
  }
  
  // 4d. signup redirects GP → onboarding
  if (signup.includes('onboarding.html')) {
    ok('GP signup redirects to onboarding');
  } else {
    fail('GP onboarding redirect', 'Signup does not redirect GP to onboarding');
  }
  
  // 4e. signup redirects LP → investor-portal  
  if (signup.includes('investor-portal.html')) {
    ok('LP signup redirects to investor portal');
  } else {
    fail('LP portal redirect', 'Signup does not redirect LP to investor portal');
  }
  
  // 4f. onboarding.html exists with wizard steps
  const onboarding = fs.readFileSync(path.join(rootDir, 'onboarding.html'), 'utf8');
  if (onboarding.includes('step1') && onboarding.includes('step2') && onboarding.includes('step3')) {
    ok('Onboarding has 3-step wizard');
  } else {
    fail('Onboarding wizard', 'Missing step structure');
  }
  
  // 4g. Onboarding saves to Firestore (not just localStorage)
  if (onboarding.includes('SPFB') || onboarding.includes('Firestore') || onboarding.includes('SP.save')) {
    ok('Onboarding persists data (SP.save → Firestore)');
  } else {
    fail('Onboarding persistence', 'May not save to Firestore');
  }
  
  // 4h. Onboarding has skip option for deal creation
  if (onboarding.includes('Skip') || onboarding.includes('skip')) {
    ok('Onboarding deal step is skippable');
  } else {
    fail('Onboarding skip option', 'User forced to create deal on signup');
  }
  
  // 4i. Login has forgot-password
  const login = fs.readFileSync(path.join(rootDir, 'login.html'), 'utf8');
  if (login.includes('sendPasswordResetEmail') || login.includes('forgotPassword') || login.includes('handleForgotPassword')) {
    ok('Login has forgot-password flow');
  } else {
    fail('Forgot password', 'No password reset flow');
  }
  
  // 4j. Login has Google auth
  if (login.includes('GoogleAuthProvider') || login.includes('googleSignIn') || login.includes('googleAuth')) {
    ok('Login supports Google sign-in');
  } else {
    fail('Google sign-in', 'No Google auth on login');
  }
  
  // 4k. Login has demo mode
  if (login.includes('fillDemo') || login.includes('demo')) {
    ok('Login has demo quick-fill');
  } else {
    fail('Demo mode', 'No demo account quick-fill');
  }
  
  // 4l. reset-password.html exists
  if (fs.existsSync(path.join(rootDir, 'reset-password.html'))) {
    ok('reset-password.html exists');
  } else {
    fail('Reset password page', 'reset-password.html missing');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. EMPTY STATE / FRESH ACCOUNT AUDIT (HTML analysis)
// ══════════════════════════════════════════════════════════════════════════════
function auditEmptyStates() {
  console.log('\n🆕 EMPTY STATE AUDIT (fresh account readiness)');
  console.log('─'.repeat(50));
  
  const rootDir = path.join(__dirname, '..');
  
  // Core pages that a new GP will hit
  const corePages = [
    'dashboard.html',
    'deals.html',
    'investors.html',
    'distributions.html',
    'settings.html',
    'documents.html',
    'capital-calls.html',
    'k1-generator.html',
    'pulse.html',
  ];
  
  corePages.forEach(page => {
    const filePath = path.join(rootDir, page);
    if (!fs.existsSync(filePath)) {
      fail(`${page} exists`, 'File not found');
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for empty-state handling: "no deals", "no investors", "empty", "get started", etc.
    const emptyStatePatterns = [
      /no\s+(deals|investors|distributions|documents|calls)/i,
      /get\s+started/i,
      /empty/i,
      /nothing\s+(here|yet|to show)/i,
      /add\s+your\s+first/i,
      /create\s+(your\s+first|a\s+new)/i,
      /\.length\s*===?\s*0/,
      /\.length\s*<\s*1/,
      /!.*\.length/,
    ];
    
    const hasEmptyState = emptyStatePatterns.some(p => p.test(content));
    
    if (hasEmptyState) {
      ok(`${page} handles empty state`);
    } else {
      console.log(`  ⚠️  ${page} — no obvious empty-state handling (may show blank or error for new users)`);
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. AUTH EDGE CASES
// ══════════════════════════════════════════════════════════════════════════════
function auditAuthEdgeCases() {
  console.log('\n🔑 AUTH EDGE CASES AUDIT');
  console.log('─'.repeat(50));
  
  const rootDir = path.join(__dirname, '..');
  
  // 6a. Login page handles already-logged-in state
  const login = fs.readFileSync(path.join(rootDir, 'login.html'), 'utf8');
  if (login.includes('isLoggedIn') || login.includes('spdata-ready') || login.includes('SP.getSession')) {
    ok('Login handles already-authenticated state');
  } else {
    fail('Login auth state', 'No check for existing session on login page');
  }
  
  // 6b. SP.requireGP exists on GP-only pages
  const gpPages = ['dashboard.html', 'deals.html', 'new-deal.html', 'investors.html', 'distributions.html', 'settings.html'];
  gpPages.forEach(page => {
    const filePath = path.join(rootDir, page);
    if (!fs.existsSync(filePath)) { skip(`${page} GP guard`, 'file not found'); return; }
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('SP.requireGP') || content.includes('requireGP')) {
      ok(`${page} has GP role guard`);
    } else if (content.includes('SP.requireAuth') || content.includes('requireAuth')) {
      ok(`${page} has auth guard (general)`);
    } else {
      console.log(`  ⚠️  ${page} — no role guard found (SP.requireGP missing)`);
    }
  });
  
  // 6c. Investor portal has auth guard
  const portal = path.join(rootDir, 'investor-portal.html');
  if (fs.existsSync(portal)) {
    const portalContent = fs.readFileSync(portal, 'utf8');
    if (portalContent.includes('requireAuth') || portalContent.includes('requireInvestor') || portalContent.includes('SP.requireLP') || portalContent.includes('SP.requireGP') || portalContent.includes('isLoggedIn')) {
      ok('investor-portal.html has auth guard');
    } else {
      fail('Investor portal auth guard', 'No auth check — unauthenticated users may see investor data');
    }
  } else {
    skip('Investor portal auth guard', 'file not found');
  }
  
  // 6d. Session expiry handling
  if (login.includes('loginTime') || login.includes('session') && login.includes('expire')) {
    ok('Session tracks login time (expiry possible)');
  } else {
    console.log('  ⚠️  No explicit session expiry handling found');
  }
  
  // 6e. Firebase auth state persistence check in sp-firebase.js
  const spFb = path.join(rootDir, 'js', 'sp-firebase.js');
  if (fs.existsSync(spFb)) {
    const fbContent = fs.readFileSync(spFb, 'utf8');
    if (fbContent.includes('onAuthStateChanged') || fbContent.includes('auth().onAuthStateChanged')) {
      ok('sp-firebase.js uses onAuthStateChanged listener');
    } else {
      fail('Auth state listener', 'sp-firebase.js may not handle auth state changes');
    }
    
    if (fbContent.includes('signOut') || fbContent.includes('auth().signOut')) {
      ok('sp-firebase.js has signOut capability');
    } else {
      fail('Sign out', 'No signOut in sp-firebase.js');
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. CSP / SECURITY HEADERS (from firebase.json)
// ══════════════════════════════════════════════════════════════════════════════
function auditSecurityHeaders() {
  console.log('\n🛡️  SECURITY HEADERS AUDIT (firebase.json)');
  console.log('─'.repeat(50));
  
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firebase.json'), 'utf8'));
  const headers = {};
  (config.hosting?.headers || []).forEach(h => {
    (h.headers || []).forEach(hh => { headers[hh.key.toLowerCase()] = hh.value; });
  });
  
  const required = [
    'x-frame-options',
    'x-content-type-options',
    'x-xss-protection',
    'referrer-policy',
    'strict-transport-security',
    'content-security-policy',
    'permissions-policy',
  ];
  
  required.forEach(h => {
    if (headers[h]) {
      ok(`${h}: ${headers[h].substring(0, 60)}${headers[h].length > 60 ? '…' : ''}`);
    } else {
      fail(`${h}`, 'Header not configured');
    }
  });
  
  // Check CSP specifics
  const csp = headers['content-security-policy'] || '';
  if (csp.includes("object-src 'none'")) ok("CSP blocks object-src");
  else fail("CSP object-src", "Should be 'none'");
  
  if (csp.includes("base-uri 'self'")) ok("CSP restricts base-uri");
  else fail("CSP base-uri", "Should be 'self'");
  
  if (csp.includes("'unsafe-inline'")) {
    console.log("  ⚠️  CSP allows 'unsafe-inline' for scripts (typical for inline JS apps, but weaker)");
  }
  if (csp.includes("'unsafe-eval'")) {
    console.log("  ⚠️  CSP allows 'unsafe-eval' — consider removing if not needed");
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 8. LIVE SITE SMOKE TEST
// ══════════════════════════════════════════════════════════════════════════════
async function auditLiveSite() {
  console.log('\n🌐 LIVE SITE SMOKE TEST');
  console.log('─'.repeat(50));
  
  const urls = [
    { url: `${LIVE_SITE}/`, name: 'Landing page' },
    { url: `${LIVE_SITE}/login.html`, name: 'Login page' },
    { url: `${LIVE_SITE}/signup.html`, name: 'Signup page' },
    { url: `${LIVE_SITE}/coming-soon.html?feature=Test`, name: 'Coming soon page' },
    { url: `${LIVE_SITE}/terms.html`, name: 'Terms of Service' },
    { url: `${LIVE_SITE}/privacy.html`, name: 'Privacy Policy' },
  ];
  
  for (const { url, name } of urls) {
    try {
      const res = await fetchUrl(url);
      if (res.status === 200) {
        // Check for real content, not a blank page
        if (res.body.length > 500 && res.body.includes('</html>')) {
          ok(`${name} → ${res.status} (${(res.body.length / 1024).toFixed(0)}KB)`);
        } else {
          fail(`${name}`, `${res.status} but body too small (${res.body.length} bytes)`);
        }
      } else if (res.status === 301 || res.status === 302 || res.status === 304) {
        ok(`${name} → ${res.status} redirect`);
      } else {
        fail(`${name}`, `HTTP ${res.status}`);
      }
    } catch (e) {
      fail(`${name}`, e.message);
    }
  }
  
  // Check a random sample of coming-soon redirects from live
  const sampleRedirects = ['audit-logs.html', 'property-comparator.html', 'eviction-tracker.html'];
  for (const page of sampleRedirects) {
    try {
      const res = await fetchUrl(`${LIVE_SITE}/${page}`);
      if (res.status === 200 && res.body.includes('coming-soon')) {
        ok(`Redirect: ${page} → coming-soon ✓`);
      } else {
        fail(`Redirect: ${page}`, `Status ${res.status}, doesn't redirect`);
      }
    } catch (e) {
      fail(`Redirect: ${page}`, e.message);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   deeltrack COMPREHENSIVE AUDIT SUITE                   ║');
  console.log('║   Security · Funnel · Redirects · Empty States · Auth   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  
  // Static analysis (no network needed)
  auditFirestoreRules();
  auditStorageRules();
  auditRedirects();
  auditFunnel();
  auditEmptyStates();
  auditAuthEdgeCases();
  auditSecurityHeaders();
  
  // Live site tests (need network)
  try {
    await auditLiveSite();
  } catch (e) {
    console.log(`\n  ⚠️  Live site tests skipped: ${e.message}`);
  }
  
  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}  ⏭ Skipped: ${skipped}`);
  console.log(`Total: ${passed + failed + skipped}`);
  
  if (errors.length > 0) {
    console.log('\n🚨 FAILURES:');
    errors.forEach(e => console.log(`  • ${e.name}: ${e.err}`));
  }
  
  console.log('═'.repeat(50));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error('Audit crashed:', err); process.exit(2); });
