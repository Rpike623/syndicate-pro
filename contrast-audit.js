/**
 * contrast-audit.js — WCAG 2.0 Contrast Ratio Auditor
 * Usage: paste into browser console on any page, or inject via script tag.
 * Returns an array of failures and logs a summary table.
 * 
 * Save location: syndicate-pro/contrast-audit.js
 * Re-run anytime: copy-paste into DevTools console on any page.
 */
(function runContrastAudit() {
  'use strict';

  // ── WCAG helpers ──────────────────────────────────────────────────────────

  function parseRgb(colorStr) {
    if (!colorStr) return null;
    const m = colorStr.match(/rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)(?:,\s*([\d.]+))?\)/);
    if (!m) return null;
    return {
      r: parseFloat(m[1]),
      g: parseFloat(m[2]),
      b: parseFloat(m[3]),
      a: m[4] !== undefined ? parseFloat(m[4]) : 1
    };
  }

  function toLinear(c) {
    const srgb = c / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  }

  function luminance(r, g, b) {
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  }

  function contrastRatio(fg, bg) {
    const L1 = luminance(fg.r, fg.g, fg.b);
    const L2 = luminance(bg.r, bg.g, bg.b);
    const lighter = Math.max(L1, L2);
    const darker  = Math.min(L1, L2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /** Composite a semi-transparent color onto an opaque background */
  function composite(fg, bg) {
    const a = fg.a;
    return {
      r: Math.round(fg.r * a + bg.r * (1 - a)),
      g: Math.round(fg.g * a + bg.g * (1 - a)),
      b: Math.round(fg.b * a + bg.b * (1 - a)),
      a: 1
    };
  }

  /** Walk up the DOM to find the first opaque background color */
  function getEffectiveBg(el) {
    let node = el;
    let accumulated = { r: 255, g: 255, b: 255, a: 1 }; // default white canvas

    while (node && node !== document.documentElement) {
      const style = window.getComputedStyle(node);
      const bg = parseRgb(style.backgroundColor);
      if (bg && bg.a > 0) {
        if (bg.a >= 1) {
          // Fully opaque — this is our background
          return { r: bg.r, g: bg.g, b: bg.b, a: 1 };
        } else {
          // Semi-transparent — composite against what we've accumulated so far
          // and keep walking up
          accumulated = composite(bg, accumulated);
        }
      }
      node = node.parentElement;
    }

    // Check body/html
    const bodyStyle = window.getComputedStyle(document.body);
    const bodyBg = parseRgb(bodyStyle.backgroundColor);
    if (bodyBg && bodyBg.a >= 1) return bodyBg;

    return accumulated;
  }

  /** Check if element is actually visible */
  function isVisible(el, style) {
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return true;
  }

  /** Get direct text content (not nested) */
  function getDirectText(el) {
    let text = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    }
    return text.trim();
  }

  /** Get section/area context for an element */
  function getSection(el) {
    const areas = [
      { selector: '.sidebar, aside', label: 'SIDEBAR' },
      { selector: 'header, .top-bar, .dt-header, .page-header', label: 'HEADER' },
      { selector: '.modal, [role="dialog"]', label: 'MODAL' },
      { selector: '.card, .dt-card, .glass-card, .kpi-card', label: 'CARD' },
      { selector: 'table, .table-wrapper', label: 'TABLE' },
      { selector: 'footer, .sidebar-footer', label: 'FOOTER' },
      { selector: 'nav, .nav', label: 'NAV' },
      { selector: 'form, .form-group', label: 'FORM' },
      { selector: 'main, .main, .content, .page-content', label: 'MAIN' },
    ];
    for (const area of areas) {
      try {
        if (el.closest(area.selector)) return area.label;
      } catch(e) {}
    }
    return 'BODY';
  }

  // ── Main audit ────────────────────────────────────────────────────────────

  const TEXT_TAGS = new Set(['p','h1','h2','h3','h4','h5','h6','span','a','li',
    'td','th','label','button','div','strong','em','b','i','small','caption',
    'legend','figcaption','summary','dt','dd','blockquote','pre','code',
    'input','select','textarea','option']);

  const failures = [];
  const all = document.querySelectorAll('*');

  for (const el of all) {
    const tag = el.tagName.toLowerCase();
    if (!TEXT_TAGS.has(tag)) continue;

    const style = window.getComputedStyle(el);
    if (!isVisible(el, style)) continue;

    // Get direct text OR for inputs, check placeholder separately
    let text = getDirectText(el);
    const isInput = ['input','select','textarea'].includes(tag);
    if (!text && !isInput) continue;
    if (!text && isInput) text = el.placeholder || el.value || '[input field]';
    if (!text) continue;
    if (text.length < 1) continue;

    const fgStr = style.color;
    const fg = parseRgb(fgStr);
    if (!fg) continue;

    // For inputs, also check placeholder color
    if (isInput) {
      // Will be handled by ::placeholder pseudo — skip for now, just check value color
    }

    const bg = getEffectiveBg(el);

    // Composite fg if semi-transparent
    const effectiveFg = fg.a < 1 ? composite(fg, bg) : fg;
    const ratio = contrastRatio(effectiveFg, bg);

    // WCAG thresholds
    const fontSize = parseFloat(style.fontSize);
    const fontWeight = parseInt(style.fontWeight) || 400;
    const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
    const threshold = isLargeText ? 3.0 : 4.5;

    if (ratio < threshold) {
      const fgHex = rgbToHex(effectiveFg.r, effectiveFg.g, effectiveFg.b);
      const bgHex = rgbToHex(bg.r, bg.g, bg.b);

      // Build selector string
      const id   = el.id ? `#${el.id}` : '';
      const cls  = el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().replace(/\s+/g,' ').split(' ').slice(0,3).join('.')
        : '';
      const selector = `${tag}${id}${cls}`;

      failures.push({
        tag,
        selector,
        id: el.id || '',
        classes: typeof el.className === 'string' ? el.className.trim() : '',
        text: text.slice(0, 60),
        fg: fgStr,
        fgHex,
        bg: `rgb(${bg.r},${bg.g},${bg.b})`,
        bgHex,
        ratio: Math.round(ratio * 100) / 100,
        threshold,
        isLargeText,
        fontSize: Math.round(fontSize),
        fontWeight,
        section: getSection(el),
        page: window.location.pathname.split('/').pop() || 'index'
      });
    }
  }

  // ── Output ────────────────────────────────────────────────────────────────

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
  }

  // Group by CSS class pattern to identify systemic issues
  const byClass = {};
  for (const f of failures) {
    const key = f.classes.split(' ').slice(0,2).join(' ') || f.tag;
    if (!byClass[key]) byClass[key] = [];
    byClass[key].push(f);
  }

  console.group(`%c⚠️ CONTRAST AUDIT: ${failures.length} failures on ${window.location.pathname}`, 
    'font-size:14px;font-weight:bold;color:#ef4444');

  if (failures.length === 0) {
    console.log('%c✅ No contrast failures found!', 'color:green;font-size:13px');
  } else {
    console.log('%cGrouped by element class (systemic issues first):', 'font-weight:bold');
    
    // Sort by count descending
    const sorted = Object.entries(byClass).sort((a,b) => b[1].length - a[1].length);
    for (const [cls, items] of sorted) {
      console.group(`${items.length}x [${cls}] — ratio range: ${Math.min(...items.map(i=>i.ratio)).toFixed(2)}–${Math.max(...items.map(i=>i.ratio)).toFixed(2)}`);
      for (const f of items.slice(0, 5)) {
        console.log(
          `  ${f.section} | ${f.selector} | fg:${f.fgHex} bg:${f.bgHex} | ratio:${f.ratio} (need ${f.threshold}) | "${f.text.slice(0,40)}"`
        );
      }
      if (items.length > 5) console.log(`  ... and ${items.length - 5} more`);
      console.groupEnd();
    }

    console.log('\n%cFull failures array (copy as JSON):', 'font-weight:bold');
    console.log(JSON.stringify(failures.map(f => ({
      selector: f.selector,
      section: f.section,
      fg: f.fgHex,
      bg: f.bgHex,
      ratio: f.ratio,
      threshold: f.threshold,
      text: f.text.slice(0,40)
    })), null, 2));
  }

  console.groupEnd();

  // Expose on window for easy access
  window.__contrastFailures = failures;
  window.__contrastByClass  = byClass;

  console.log(`\n%c📋 Summary: window.__contrastFailures (${failures.length} items), window.__contrastByClass`, 
    'font-style:italic;color:#888');

  return failures;
})();
