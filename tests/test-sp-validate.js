/**
 * tests/test-sp-validate.js — Data Validation Tests
 *
 * Run: node tests/test-sp-validate.js
 */

// ── Minimal test runner ─────────────────────────────────────────────────────
let _passed = 0, _failed = 0, _total = 0;
function test(name, fn) {
  _total++;
  try { fn(); _passed++; }
  catch (e) { _failed++; console.error(`  ✗ ${name}: ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `Expected "${b}", got "${a}"`); }

// ── Load module (DOM-free) ──────────────────────────────────────────────────
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../js/sp-validate.js', 'utf8');
// Provide minimal window object
global.window = {};
eval(src);
const V = global.window.SPValidate;

// ════════════════════════════════════════════════════════════════════════════
// EIN Tests
// ════════════════════════════════════════════════════════════════════════════
console.log('\n📋 EIN Validation');

test('EIN: empty is valid (optional)', () => {
  const r = V.ein('');
  assert(r.valid, 'Empty should be valid');
});

test('EIN: valid 47-9876543', () => {
  const r = V.ein('47-9876543');
  assert(r.valid, 'Should be valid');
  assertEqual(r.formatted, '47-9876543');
});

test('EIN: valid without dash 479876543', () => {
  const r = V.ein('479876543');
  assert(r.valid, 'Should be valid');
  assertEqual(r.formatted, '47-9876543', 'Should auto-format');
});

test('EIN: too short', () => {
  const r = V.ein('47-123');
  assert(!r.valid, 'Should be invalid');
});

test('EIN: too long', () => {
  const r = V.ein('47-98765432');
  assert(!r.valid, 'Should be invalid');
});

test('EIN: invalid prefix 00', () => {
  const r = V.ein('00-1234567');
  assert(!r.valid, 'Prefix 00 should be invalid');
});

test('EIN: valid prefix 12', () => {
  const r = V.ein('12-3456789');
  assert(r.valid, 'Prefix 12 should be valid');
});

// ════════════════════════════════════════════════════════════════════════════
// SSN Tests
// ════════════════════════════════════════════════════════════════════════════
console.log('\n📋 SSN Validation');

test('SSN: empty is valid (optional)', () => {
  assert(V.ssn('').valid);
});

test('SSN: valid 123-45-6789', () => {
  const r = V.ssn('123-45-6789');
  assert(r.valid);
  assertEqual(r.formatted, '123-45-6789');
});

test('SSN: valid without dashes', () => {
  const r = V.ssn('123456789');
  assert(r.valid);
  assertEqual(r.formatted, '123-45-6789');
});

test('SSN: area 000 invalid', () => {
  assert(!V.ssn('000-12-3456').valid);
});

test('SSN: area 666 invalid', () => {
  assert(!V.ssn('666-12-3456').valid);
});

test('SSN: area 900+ invalid', () => {
  assert(!V.ssn('900-12-3456').valid);
  assert(!V.ssn('999-12-3456').valid);
});

test('SSN: group 00 invalid', () => {
  assert(!V.ssn('123-00-3456').valid);
});

test('SSN: serial 0000 invalid', () => {
  assert(!V.ssn('123-45-0000').valid);
});

test('SSN: too short', () => {
  assert(!V.ssn('123-45-678').valid);
});

// ════════════════════════════════════════════════════════════════════════════
// TIN Tests (SSN or EIN)
// ════════════════════════════════════════════════════════════════════════════
console.log('\n📋 TIN Validation (SSN or EIN)');

test('TIN: accepts valid EIN', () => {
  assert(V.tin('47-9876543').valid);
});

test('TIN: accepts valid SSN', () => {
  assert(V.tin('123-45-6789').valid);
});

test('TIN: rejects wrong length', () => {
  assert(!V.tin('12345').valid);
});

// ════════════════════════════════════════════════════════════════════════════
// Routing Number Tests
// ════════════════════════════════════════════════════════════════════════════
console.log('\n📋 Routing Number Validation');

test('Routing: empty is valid (optional)', () => {
  assert(V.routing('').valid);
});

test('Routing: valid 021000021 (JPMorgan Chase)', () => {
  const r = V.routing('021000021');
  assert(r.valid, 'Chase routing should be valid');
});

test('Routing: valid 111000025 (Bank of America TX)', () => {
  assert(V.routing('111000025').valid);
});

test('Routing: too short', () => {
  assert(!V.routing('02100002').valid);
});

test('Routing: too long', () => {
  assert(!V.routing('0210000210').valid);
});

test('Routing: bad checksum', () => {
  const r = V.routing('021000022');
  assert(!r.valid, 'Bad checksum should fail');
  assert(r.error.includes('checksum'), 'Error should mention checksum');
});

// ════════════════════════════════════════════════════════════════════════════
// Account Number Tests
// ════════════════════════════════════════════════════════════════════════════
console.log('\n📋 Account Number Validation');

test('Account: empty is valid', () => {
  assert(V.accountNumber('').valid);
});

test('Account: valid 4 digits', () => {
  assert(V.accountNumber('1234').valid);
});

test('Account: valid 17 digits', () => {
  assert(V.accountNumber('12345678901234567').valid);
});

test('Account: too short (3 digits)', () => {
  assert(!V.accountNumber('123').valid);
});

test('Account: too long (18 digits)', () => {
  assert(!V.accountNumber('123456789012345678').valid);
});

// ════════════════════════════════════════════════════════════════════════════
// Phone Tests
// ════════════════════════════════════════════════════════════════════════════
console.log('\n📋 Phone Validation');

test('Phone: empty is valid', () => {
  assert(V.phone('').valid);
});

test('Phone: valid (214) 555-0101', () => {
  const r = V.phone('(214) 555-0101');
  assert(r.valid);
  assertEqual(r.formatted, '(214) 555-0101');
});

test('Phone: valid raw digits 2145550101', () => {
  const r = V.phone('2145550101');
  assert(r.valid);
  assertEqual(r.formatted, '(214) 555-0101');
});

test('Phone: strips country code 1', () => {
  const r = V.phone('12145550101');
  assert(r.valid);
  assertEqual(r.formatted, '(214) 555-0101');
});

test('Phone: too short', () => {
  assert(!V.phone('214555').valid);
});

test('Phone: area code starts with 0', () => {
  assert(!V.phone('014-555-0101').valid);
});

test('Phone: area code starts with 1', () => {
  assert(!V.phone('114-555-0101').valid);
});

// ════════════════════════════════════════════════════════════════════════════
// ZIP Code Tests
// ════════════════════════════════════════════════════════════════════════════
console.log('\n📋 ZIP Code Validation');

test('ZIP: empty is valid', () => {
  assert(V.zip('').valid);
});

test('ZIP: valid 5-digit', () => {
  assert(V.zip('76102').valid);
});

test('ZIP: valid ZIP+4', () => {
  const r = V.zip('76102-1234');
  assert(r.valid);
  assertEqual(r.formatted, '76102-1234');
});

test('ZIP: auto-formats 9 digits', () => {
  const r = V.zip('761021234');
  assert(r.valid);
  assertEqual(r.formatted, '76102-1234');
});

test('ZIP: too short', () => {
  assert(!V.zip('7610').valid);
});

test('ZIP: invalid chars', () => {
  assert(!V.zip('7610A').valid);
});

// ════════════════════════════════════════════════════════════════════════════
// Email Tests
// ════════════════════════════════════════════════════════════════════════════
console.log('\n📋 Email Validation');

test('Email: empty is valid', () => {
  assert(V.email('').valid);
});

test('Email: valid standard', () => {
  assert(V.email('test@example.com').valid);
});

test('Email: lowercases', () => {
  assertEqual(V.email('Test@Example.COM').formatted, 'test@example.com');
});

test('Email: no @ sign', () => {
  assert(!V.email('testexample.com').valid);
});

test('Email: no domain', () => {
  assert(!V.email('test@').valid);
});

test('Email: no TLD', () => {
  assert(!V.email('test@example').valid);
});

// ════════════════════════════════════════════════════════════════════════════
// Amount & Percentage Tests
// ════════════════════════════════════════════════════════════════════════════
console.log('\n📋 Amount & Percentage Validation');

test('Amount: empty is valid', () => {
  assert(V.amount('').valid);
});

test('Amount: valid $1,000.50', () => {
  const r = V.amount('$1,000.50');
  assert(r.valid);
  assertEqual(r.formatted, 1000.5);
});

test('Amount: negative fails', () => {
  assert(!V.amount('-500').valid);
});

test('Amount: non-numeric fails', () => {
  assert(!V.amount('abc').valid);
});

test('Percentage: valid 8.5%', () => {
  const r = V.percentage('8.5%');
  assert(r.valid);
  assertEqual(r.formatted, 8.5);
});

test('Percentage: over 100 fails', () => {
  assert(!V.percentage('101').valid);
});

test('Percentage: negative fails', () => {
  assert(!V.percentage('-5').valid);
});

// ════════════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`  ${_passed}/${_total} passed${_failed ? ` · ${_failed} FAILED` : ' ✅'}`);
console.log('═'.repeat(60));
process.exit(_failed ? 1 : 0);
