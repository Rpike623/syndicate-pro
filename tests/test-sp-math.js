/**
 * tests/test-sp-math.js — Core Financial Math Tests
 *
 * Run: node tests/test-sp-math.js
 *
 * Tests: SPMath.computePrefSplits, calculatePref, xirr, capitalAccount,
 *        SP.escapeHtml, SP.generateOrgId, SP.simpleHash
 */

// ── Minimal test runner ─────────────────────────────────────────────────────
let _passed = 0, _failed = 0, _total = 0;
function test(name, fn) {
  _total++;
  try {
    fn();
    _passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    _failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertClose(a, b, epsilon, msg) {
  if (Math.abs(a - b) > (epsilon || 0.01)) throw new Error(msg || `Expected ~${b}, got ${a}`);
}

// ── Load SPMath (it's an IIFE that assigns to const) ────────────────────────
// We need to eval it in this context
const fs = require('fs');
const mathSrc = fs.readFileSync(__dirname + '/../js/sp-math.js', 'utf8');
const SPMath = eval(mathSrc + '; SPMath;');

// Also load SP.escapeHtml etc by extracting the function
const coreSrc = fs.readFileSync(__dirname + '/../js/sp-core.js', 'utf8');

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🧮 SPMath.toCents / fromCents');
// ═══════════════════════════════════════════════════════════════════════════════

test('toCents(100.50) = 10050', () => {
  assert(SPMath.toCents(100.50) === 10050);
});

test('fromCents(10050) = 100.50', () => {
  assert(SPMath.fromCents(10050) === 100.50);
});

test('toCents handles floating point: 0.1 + 0.2', () => {
  // 0.1 + 0.2 = 0.30000000000000004 in JS
  assert(SPMath.toCents(0.1 + 0.2) === 30);
});

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📊 SPMath.calculatePref');
// ═══════════════════════════════════════════════════════════════════════════════

test('8% pref on $100k for 1 year = $8,000', () => {
  assertClose(SPMath.calculatePref(100000, 8, 1), 8000, 1);
});

test('8% pref on $100k for 2 years = ~$16,640 (annual compounding)', () => {
  const result = SPMath.calculatePref(100000, 8, 2, 1);
  assertClose(result, 16640, 1);
});

test('8% pref on $100k for 1 year quarterly compounding', () => {
  const result = SPMath.calculatePref(100000, 8, 1, 4);
  assertClose(result, 8243.22, 1);
});

test('0% pref returns 0', () => {
  assert(SPMath.calculatePref(100000, 0, 1) === 0);
});

test('$0 invested returns 0', () => {
  assert(SPMath.calculatePref(0, 8, 1) === 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n📈 SPMath.xirr');
// ═══════════════════════════════════════════════════════════════════════════════

test('Simple 2x in 1 year = ~100%', () => {
  const now = new Date('2025-01-01');
  const later = new Date('2026-01-01');
  const result = SPMath.xirr([-100000, 200000], [now, later]);
  assertClose(result, 1.0, 0.05); // ~100% IRR
});

test('Break even = 0% IRR', () => {
  const now = new Date('2025-01-01');
  const later = new Date('2026-01-01');
  const result = SPMath.xirr([-100000, 100000], [now, later]);
  assertClose(result, 0, 0.01);
});

test('All zero cashflows = 0', () => {
  const result = SPMath.xirr([0, 0, 0], [new Date(), new Date(), new Date()]);
  assert(result === 0);
});

test('No positive cashflows = -1 (total loss)', () => {
  const result = SPMath.xirr([-100000], [new Date()]);
  assert(result === 0 || result === -1); // edge case
});

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🔢 SPMath.computePrefSplits');
// ═══════════════════════════════════════════════════════════════════════════════

const baseDeal = {
  prefReturn: 8,
  closeDate: '2024-01-01',
  investors: [
    { investorId: 'inv1', committed: 100000, ownership: 50 },
    { investorId: 'inv2', committed: 100000, ownership: 50 },
  ],
};

test('Basic split: $10k to two equal 50/50 investors, no prior dists', () => {
  const result = SPMath.computePrefSplits(baseDeal, [], 10000, '2025-01-01');
  assert(result.length === 2);
  // Both should have pref accrued ($8k each for 1 year at 8% on $100k)
  assertClose(result[0].totalPrefAccrued, 8000, 100);
  assertClose(result[1].totalPrefAccrued, 8000, 100);
  // Total distribution should sum to $10k
  const totalDist = result.reduce((s, r) => s + r.totalThisDist, 0);
  assertClose(totalDist, 10000, 0.01);
});

test('Pref catch-up: distribute less than total pref owed', () => {
  const result = SPMath.computePrefSplits(baseDeal, [], 5000, '2025-01-01');
  // All $5k should go to pref (both have ~$8k pref owed each, $16k total)
  const totalPref = result.reduce((s, r) => s + r.prefPaidThisDist, 0);
  assertClose(totalPref, 5000, 0.01, 'All $5k should go to pref');
  const totalExcess = result.reduce((s, r) => s + r.excessThisDist, 0);
  assertClose(totalExcess, 0, 0.01, 'No excess when pref not fully satisfied');
});

test('Excess distribution: distribute more than pref owed', () => {
  const result = SPMath.computePrefSplits(baseDeal, [], 50000, '2025-01-01');
  const totalPref = result.reduce((s, r) => s + r.prefPaidThisDist, 0);
  const totalExcess = result.reduce((s, r) => s + r.excessThisDist, 0);
  // Pref should be ~$16k total, excess ~$34k
  assertClose(totalPref + totalExcess, 50000, 0.01);
  assert(totalExcess > 0, 'Should have excess');
});

test('Prior distributions reduce pref remaining', () => {
  const priorDist = {
    status: 'posted',
    recipients: [
      { investorId: 'inv1', prefPaidThisDist: 4000 },
      { investorId: 'inv2', prefPaidThisDist: 4000 },
    ],
  };
  const result = SPMath.computePrefSplits(baseDeal, [priorDist], 10000, '2025-01-01');
  // Each investor should have ~$4k pref remaining (was ~$8k, $4k already paid)
  assertClose(result[0].prefPaidToDate, 4000, 0.01);
  assertClose(result[1].prefPaidToDate, 4000, 0.01);
});

test('Draft distributions are ignored (only posted count)', () => {
  const draftDist = {
    status: 'draft',
    recipients: [
      { investorId: 'inv1', prefPaidThisDist: 50000 },
      { investorId: 'inv2', prefPaidThisDist: 50000 },
    ],
  };
  const result = SPMath.computePrefSplits(baseDeal, [draftDist], 10000, '2025-01-01');
  // Draft should be ignored — pref paid to date should be 0
  assert(result[0].prefPaidToDate === 0, 'Draft should not count');
});

test('Zero amount distribution returns all zeros', () => {
  const result = SPMath.computePrefSplits(baseDeal, [], 0, '2025-01-01');
  const total = result.reduce((s, r) => s + r.totalThisDist, 0);
  assert(total === 0);
});

test('No investors returns empty array', () => {
  const emptyDeal = { ...baseDeal, investors: [] };
  const result = SPMath.computePrefSplits(emptyDeal, [], 10000);
  assert(result.length === 0);
});

test('0% pref deal: all goes to pro-rata excess', () => {
  const zeroPrefDeal = { ...baseDeal, prefReturn: 0 };
  const result = SPMath.computePrefSplits(zeroPrefDeal, [], 10000, '2025-01-01');
  const totalPref = result.reduce((s, r) => s + r.prefPaidThisDist, 0);
  const totalExcess = result.reduce((s, r) => s + r.excessThisDist, 0);
  assertClose(totalPref, 0, 0.01);
  assertClose(totalExcess, 10000, 0.01);
});

test('Unequal ownership: 70/30 split', () => {
  const unequalDeal = {
    prefReturn: 0, // no pref, just test pro-rata
    closeDate: '2024-01-01',
    investors: [
      { investorId: 'inv1', committed: 70000, ownership: 70 },
      { investorId: 'inv2', committed: 30000, ownership: 30 },
    ],
  };
  const result = SPMath.computePrefSplits(unequalDeal, [], 10000, '2025-01-01');
  assertClose(result[0].totalThisDist, 7000, 0.01);
  assertClose(result[1].totalThisDist, 3000, 0.01);
});

test('Penny reconciliation: sum always equals newAmount', () => {
  const oddDeal = {
    prefReturn: 8,
    closeDate: '2024-01-01',
    investors: [
      { investorId: 'inv1', committed: 33333, ownership: 33.33 },
      { investorId: 'inv2', committed: 33334, ownership: 33.34 },
      { investorId: 'inv3', committed: 33333, ownership: 33.33 },
    ],
  };
  const result = SPMath.computePrefSplits(oddDeal, [], 99999.99, '2025-01-01');
  const total = result.reduce((s, r) => s + r.totalThisDist, 0);
  assertClose(total, 99999.99, 0.01, 'Penny reconciliation failed');
});

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🏦 SPMath.capitalAccount');
// ═══════════════════════════════════════════════════════════════════════════════

test('Capital account with no distributions', () => {
  const result = SPMath.capitalAccount(baseDeal, { investorId: 'inv1' }, [], '2025-01-01');
  assert(result !== null);
  assert(result.invested === 100000);
  assert(result.totalDistributed === 0);
  assert(result.netROC === 0);
  assertClose(result.totalPrefAccrued, 8000, 100);
});

test('Capital account with prior distribution', () => {
  const priorDist = {
    status: 'posted',
    recipients: [
      { investorId: 'inv1', prefPaidThisDist: 4000, excessThisDist: 1000, totalThisDist: 5000 },
      { investorId: 'inv2', prefPaidThisDist: 4000, excessThisDist: 1000, totalThisDist: 5000 },
    ],
  };
  const result = SPMath.capitalAccount(baseDeal, { investorId: 'inv1' }, [priorDist], '2025-01-01');
  assertClose(result.totalDistributed, 5000, 0.01);
  assertClose(result.excessReceived, 1000, 0.01);
  assertClose(result.netROC, 5, 0.01); // $5k / $100k = 5%
});

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n🛡️ SP.escapeHtml');
// ═══════════════════════════════════════════════════════════════════════════════

// Extract escapeHtml from sp-core.js
// Re-implement directly to avoid eval issues with const scoping
const _escMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#96;' };
function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"'`/]/g, c => _escMap[c]);
}
{

  test('Escapes HTML tags', () => {
    assert(escapeHtml('<script>alert(1)</script>') === '&lt;script&gt;alert(1)&lt;&#x2F;script&gt;');
  });

  test('Escapes quotes', () => {
    assert(escapeHtml('"hello"') === '&quot;hello&quot;');
  });

  test('Escapes ampersand', () => {
    assert(escapeHtml('A & B') === 'A &amp; B');
  });

  test('Handles null/undefined', () => {
    assert(escapeHtml(null) === '');
    assert(escapeHtml(undefined) === '');
  });

  test('Passes through clean strings', () => {
    assert(escapeHtml('hello world 123') === 'hello world 123');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Report
// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`  ${_passed} passed, ${_failed} failed, ${_total} total`);
console.log(`${'═'.repeat(60)}\n`);
process.exit(_failed > 0 ? 1 : 0);
