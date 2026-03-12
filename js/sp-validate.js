/* ───────────────────────────────────────────────────────────────────────────
   sp-validate.js  –  Field-level data validation for Deeltrack
   Shared across portal, settings, K-1 generator, wire instructions, etc.
   ─────────────────────────────────────────────────────────────────────────── */
'use strict';

window.SPValidate = (() => {

  // ── Helpers ──────────────────────────────────────────────────────────────
  const digits = s => (s || '').replace(/\D/g, '');
  const stripDashes = s => (s || '').replace(/[-\s]/g, '');

  // ── Individual validators ───────────────────────────────────────────────
  // Each returns { valid: bool, error: string|null, formatted: string }

  /** EIN: XX-XXXXXXX (9 digits) */
  function ein(raw) {
    const d = digits(raw);
    if (!d) return { valid: true, error: null, formatted: '' }; // optional / empty OK
    if (d.length !== 9) return { valid: false, error: 'EIN must be exactly 9 digits (XX-XXXXXXX)', formatted: raw };
    // First two digits must be a valid IRS campus prefix (01-06,10-16,20-27,30-38,40-48,50-59,60-68,71-77,80-88,90-99)
    const prefix = parseInt(d.substring(0, 2), 10);
    if (prefix < 1 || prefix === 7 || prefix === 8 || prefix === 9) {
      return { valid: false, error: 'EIN has an invalid prefix (' + d.substring(0, 2) + ')', formatted: raw };
    }
    const formatted = d.substring(0, 2) + '-' + d.substring(2);
    return { valid: true, error: null, formatted };
  }

  /** SSN: XXX-XX-XXXX (9 digits) */
  function ssn(raw) {
    const d = digits(raw);
    if (!d) return { valid: true, error: null, formatted: '' };
    if (d.length !== 9) return { valid: false, error: 'SSN must be exactly 9 digits (XXX-XX-XXXX)', formatted: raw };
    // Area number cannot be 000, 666, or 900-999
    const area = parseInt(d.substring(0, 3), 10);
    if (area === 0 || area === 666 || area >= 900) {
      return { valid: false, error: 'SSN has an invalid area number', formatted: raw };
    }
    // Group and serial cannot be all zeros
    if (d.substring(3, 5) === '00') return { valid: false, error: 'SSN group number cannot be 00', formatted: raw };
    if (d.substring(5) === '0000') return { valid: false, error: 'SSN serial number cannot be 0000', formatted: raw };
    const formatted = d.substring(0, 3) + '-' + d.substring(3, 5) + '-' + d.substring(5);
    return { valid: true, error: null, formatted };
  }

  /** TIN: accepts either SSN or EIN format */
  function tin(raw) {
    const d = digits(raw);
    if (!d) return { valid: true, error: null, formatted: '' };
    if (d.length !== 9) return { valid: false, error: 'TIN must be exactly 9 digits (SSN or EIN)', formatted: raw };
    // Try EIN first (XX-XXXXXXX), then SSN (XXX-XX-XXXX)
    const einResult = ein(raw);
    if (einResult.valid) return einResult;
    const ssnResult = ssn(raw);
    if (ssnResult.valid) return ssnResult;
    // If neither pattern matched validity rules, give a generic message
    return { valid: false, error: 'Enter a valid SSN (XXX-XX-XXXX) or EIN (XX-XXXXXXX)', formatted: raw };
  }

  /** ABA Routing Number: 9 digits with checksum */
  function routing(raw) {
    const d = digits(raw);
    if (!d) return { valid: true, error: null, formatted: '' };
    if (d.length !== 9) return { valid: false, error: 'Routing number must be exactly 9 digits', formatted: raw };
    // ABA checksum: 3·d1 + 7·d2 + 1·d3 + 3·d4 + 7·d5 + 1·d6 + 3·d7 + 7·d8 + 1·d9 ≡ 0 (mod 10)
    const w = [3, 7, 1, 3, 7, 1, 3, 7, 1];
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += w[i] * parseInt(d[i], 10);
    if (sum % 10 !== 0) return { valid: false, error: 'Routing number failed checksum — double-check the number', formatted: raw };
    return { valid: true, error: null, formatted: d };
  }

  /** Bank account number: 4–17 digits */
  function accountNumber(raw) {
    const d = digits(raw);
    if (!d) return { valid: true, error: null, formatted: '' };
    if (d.length < 4) return { valid: false, error: 'Account number too short (minimum 4 digits)', formatted: raw };
    if (d.length > 17) return { valid: false, error: 'Account number too long (maximum 17 digits)', formatted: raw };
    return { valid: true, error: null, formatted: d };
  }

  /** US phone: 10 digits → (XXX) XXX-XXXX */
  function phone(raw) {
    let d = digits(raw);
    if (!d) return { valid: true, error: null, formatted: '' };
    // Strip leading 1 (country code)
    if (d.length === 11 && d[0] === '1') d = d.substring(1);
    if (d.length !== 10) return { valid: false, error: 'Phone number must be 10 digits', formatted: raw };
    // Area code can't start with 0 or 1
    if (d[0] === '0' || d[0] === '1') return { valid: false, error: 'Invalid area code', formatted: raw };
    const formatted = '(' + d.substring(0, 3) + ') ' + d.substring(3, 6) + '-' + d.substring(6);
    return { valid: true, error: null, formatted };
  }

  /** US ZIP code: 5 digits or ZIP+4 (XXXXX or XXXXX-XXXX) */
  function zip(raw) {
    const trimmed = (raw || '').trim();
    if (!trimmed) return { valid: true, error: null, formatted: '' };
    if (/^\d{5}$/.test(trimmed)) return { valid: true, error: null, formatted: trimmed };
    if (/^\d{5}-\d{4}$/.test(trimmed)) return { valid: true, error: null, formatted: trimmed };
    // Try to fix common formatting (9 digits no dash)
    const d = digits(trimmed);
    if (d.length === 9) return { valid: true, error: null, formatted: d.substring(0, 5) + '-' + d.substring(5) };
    if (d.length === 5) return { valid: true, error: null, formatted: d };
    return { valid: false, error: 'ZIP code must be 5 digits or ZIP+4 (XXXXX-XXXX)', formatted: raw };
  }

  /** Email: basic format check */
  function email(raw) {
    const trimmed = (raw || '').trim();
    if (!trimmed) return { valid: true, error: null, formatted: '' };
    // Reasonably permissive email regex
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!re.test(trimmed)) return { valid: false, error: 'Enter a valid email address', formatted: raw };
    return { valid: true, error: null, formatted: trimmed.toLowerCase() };
  }

  /** Dollar amount: positive number */
  function amount(raw) {
    const cleaned = (raw || '').replace(/[$,\s]/g, '');
    if (!cleaned) return { valid: true, error: null, formatted: '' };
    const num = parseFloat(cleaned);
    if (isNaN(num)) return { valid: false, error: 'Enter a valid dollar amount', formatted: raw };
    if (num < 0) return { valid: false, error: 'Amount cannot be negative', formatted: raw };
    return { valid: true, error: null, formatted: num };
  }

  /** Percentage: 0–100 */
  function percentage(raw) {
    const cleaned = (raw || '').replace(/[%\s]/g, '');
    if (!cleaned) return { valid: true, error: null, formatted: '' };
    const num = parseFloat(cleaned);
    if (isNaN(num)) return { valid: false, error: 'Enter a valid percentage', formatted: raw };
    if (num < 0 || num > 100) return { valid: false, error: 'Percentage must be between 0 and 100', formatted: raw };
    return { valid: true, error: null, formatted: num };
  }

  // ── Auto-format on blur ─────────────────────────────────────────────────
  // Usage: SPValidate.bind(inputEl, 'ein')  or  SPValidate.bind('#profTin', 'tin')

  const validatorMap = { ein, ssn, tin, routing, accountNumber, phone, zip, email, amount, percentage };

  /**
   * Bind validation to an input element.
   * @param {HTMLElement|string} el — element or CSS selector
   * @param {string} type — validator name (ein, ssn, tin, routing, accountNumber, phone, zip, email, amount, percentage)
   * @param {object} [opts] — { required: false, onError: fn, onValid: fn }
   */
  function bind(el, type, opts = {}) {
    const input = typeof el === 'string' ? document.querySelector(el) : el;
    if (!input) return;
    const validator = validatorMap[type];
    if (!validator) { console.warn('[SPValidate] Unknown type:', type); return; }

    // Create or find error label
    let errEl = input.parentElement.querySelector('.spv-error');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.className = 'spv-error';
      errEl.style.cssText = 'color:#ef4444;font-size:.75rem;margin-top:2px;min-height:0;transition:all .2s;';
      input.parentElement.appendChild(errEl);
    }

    function validate() {
      const raw = input.value;
      // Required check
      if (opts.required && !raw.trim()) {
        _showError(input, errEl, 'This field is required');
        if (opts.onError) opts.onError('This field is required');
        return false;
      }
      const result = validator(raw);
      if (!result.valid) {
        _showError(input, errEl, result.error);
        if (opts.onError) opts.onError(result.error);
        return false;
      }
      // Auto-format the value
      if (result.formatted !== '' && result.formatted !== raw && typeof result.formatted === 'string') {
        input.value = result.formatted;
      }
      _clearError(input, errEl);
      if (opts.onValid) opts.onValid(result.formatted);
      return true;
    }

    input.addEventListener('blur', validate);

    // Also restrict input for numeric-only fields
    if (['ein', 'ssn', 'tin', 'routing', 'accountNumber', 'phone', 'zip'].includes(type)) {
      input.addEventListener('input', () => {
        // Allow digits, dashes, parens, spaces (for phone/zip formatting)
        if (['phone'].includes(type)) return; // phone has parens
        if (['zip'].includes(type)) return; // zip has dashes
        // For pure numeric fields, strip non-digit non-dash on input
        if (['ein', 'ssn', 'tin'].includes(type)) {
          input.value = input.value.replace(/[^\d-]/g, '');
        } else {
          input.value = input.value.replace(/\D/g, '');
        }
      });
    }

    // Return validate function for manual triggering
    return validate;
  }

  function _showError(input, errEl, msg) {
    input.style.borderColor = '#ef4444';
    input.style.boxShadow = '0 0 0 2px rgba(239,68,68,.15)';
    errEl.textContent = msg;
  }

  function _clearError(input, errEl) {
    input.style.borderColor = '';
    input.style.boxShadow = '';
    errEl.textContent = '';
  }

  /**
   * Validate multiple fields at once. Returns true if ALL pass.
   * @param {Array<{el: string|HTMLElement, type: string, required?: boolean}>} fields
   * @returns {boolean}
   */
  function validateAll(fields) {
    let allValid = true;
    fields.forEach(f => {
      const input = typeof f.el === 'string' ? document.querySelector(f.el) : f.el;
      if (!input) return;
      const validator = validatorMap[f.type];
      if (!validator) return;
      const raw = input.value;
      if (f.required && !raw.trim()) {
        const errEl = input.parentElement.querySelector('.spv-error');
        if (errEl) _showError(input, errEl, 'This field is required');
        allValid = false;
        return;
      }
      const result = validator(raw);
      if (!result.valid) {
        const errEl = input.parentElement.querySelector('.spv-error');
        if (errEl) _showError(input, errEl, result.error);
        allValid = false;
      } else if (result.formatted !== '' && result.formatted !== raw && typeof result.formatted === 'string') {
        input.value = result.formatted;
      }
    });
    if (!allValid) {
      // Scroll to first error
      const firstErr = document.querySelector('.spv-error:not(:empty)');
      if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return allValid;
  }

  // ── Public API ──────────────────────────────────────────────────────────
  return {
    // Individual validators (return { valid, error, formatted })
    ein, ssn, tin, routing, accountNumber, phone, zip, email, amount, percentage,
    // DOM binding
    bind,
    // Batch validation
    validateAll,
    // Expose for testing
    _digits: digits,
  };

})();
