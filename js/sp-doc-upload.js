/**
 * sp-doc-upload.js — Bring Your Own Document (BYOD) Template Engine
 * 
 * Upload an attorney's DOCX/PDF → extract variables → save as reusable template
 * Variables are detected via pattern matching (entity names, dollar amounts,
 * percentages, dates, addresses, party names).
 * 
 * AI-enhanced parsing available via Cloud Function (optional, uses Claude Haiku).
 */

const SPDocUpload = (function() {
  'use strict';

  // ── Known variable patterns for real estate OAs ──────────────────────────
  const VARIABLE_PATTERNS = [
    // Entity / Company names — look for LLC, LP, Inc patterns
    { name: 'COMPANY_NAME', label: 'Company / Entity Name', patterns: [
      /([A-Z][A-Za-z\s&'.,-]+(?:LLC|L\.L\.C\.|Limited Liability Company|LP|L\.P\.|Limited Partnership|Inc\.|Corporation))/g,
    ], category: 'entity' },

    // State of formation
    { name: 'STATE', label: 'State of Formation', patterns: [
      /(?:organized|formed|established|formation)\s+(?:under the laws of|in|pursuant to)\s+(?:the\s+)?(?:State\s+of\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    ], category: 'entity' },

    // Addresses — street + city + state + zip
    { name: 'ADDRESS', label: 'Principal Address', patterns: [
      /(\d{1,5}\s+[A-Za-z\s.]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Road|Rd|Lane|Ln|Way|Suite|Ste|Floor|Fl)[.,\s]+[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)/g,
    ], category: 'entity' },

    // Dollar amounts
    { name: 'DOLLAR_AMOUNT', label: 'Dollar Amount', patterns: [
      /\$[\d,]+(?:\.\d{2})?/g,
      /(?:(?:Dollars?|USD)\s*\(?\$?)([\d,]+(?:\.\d{2})?)/gi,
    ], category: 'financial' },

    // Percentages (pref return, promote, ownership, etc.)
    { name: 'PERCENTAGE', label: 'Percentage', patterns: [
      /(\d{1,3}(?:\.\d{1,2})?)\s*(?:%|percent)/gi,
    ], category: 'financial' },

    // Person names — look for "Member:", "Manager:", "Managing Member:" patterns
    { name: 'GP_NAME', label: 'GP / Managing Member Name', patterns: [
      /(?:Managing\s+Member|Manager|General\s+Partner|GP)[\s:]+([A-Z][a-z]+\s+(?:[A-Z]\.\s+)?[A-Z][a-z]+)/g,
    ], category: 'parties' },

    // LP / Member names
    { name: 'LP_NAME', label: 'LP / Member Name', patterns: [
      /(?:Limited\s+Partner|LP|Member)[\s:]+([A-Z][a-z]+\s+(?:[A-Z]\.\s+)?[A-Z][a-z]+)/g,
    ], category: 'parties' },

    // Dates
    { name: 'DATE', label: 'Date', patterns: [
      /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/g,
      /\d{1,2}\/\d{1,2}\/\d{4}/g,
    ], category: 'dates' },

    // EIN / Tax ID
    { name: 'EIN', label: 'Federal EIN', patterns: [
      /\d{2}-\d{7}/g,
    ], category: 'entity' },

    // Preferred return percentage (contextual)
    { name: 'PREF_RETURN', label: 'Preferred Return', patterns: [
      /(?:preferred\s+return|pref(?:erred)?\s+rate|hurdle\s+rate)[^.]*?(\d{1,2}(?:\.\d{1,2})?)\s*%/gi,
    ], category: 'financial' },

    // Promote / carried interest
    { name: 'GP_PROMOTE', label: 'GP Promote / Carry', patterns: [
      /(?:promote|carried\s+interest|carry|performance\s+allocation)[^.]*?(\d{1,2}(?:\.\d{1,2})?)\s*%/gi,
    ], category: 'financial' },

    // Minimum investment
    { name: 'MIN_INVESTMENT', label: 'Minimum Investment', patterns: [
      /(?:minimum\s+(?:capital\s+)?(?:contribution|investment|commitment))[^.]*?\$?([\d,]+)/gi,
    ], category: 'financial' },
  ];

  // ── Extract text from DOCX using mammoth.js ──────────────────────────────
  async function parseDocx(file) {
    if (typeof mammoth === 'undefined') {
      throw new Error('mammoth.js not loaded');
    }
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  // ── Extract text from PDF using pdf.js ────────────────────────────────────
  async function parsePdf(file) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('pdf.js not loaded');
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }
    return text;
  }

  // ── Extract variables from text ───────────────────────────────────────────
  function extractVariables(text) {
    const variables = [];
    const seen = new Set();

    VARIABLE_PATTERNS.forEach(pattern => {
      pattern.patterns.forEach(regex => {
        // Reset regex state
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
          // Use the first capture group if exists, otherwise full match
          const value = (match[1] || match[0]).trim();
          if (!value || value.length < 2 || value.length > 200) continue;

          const key = `${pattern.name}:${value}`;
          if (seen.has(key)) continue;
          seen.add(key);

          // Find position context (surrounding text)
          const pos = match.index;
          const contextStart = Math.max(0, pos - 60);
          const contextEnd = Math.min(text.length, pos + match[0].length + 60);
          const context = text.substring(contextStart, contextEnd).replace(/\s+/g, ' ').trim();

          variables.push({
            id: 'var_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            name: pattern.name,
            label: pattern.label,
            category: pattern.category,
            value: value,
            context: context,
            position: pos,
            enabled: true,
            // Suggested variable placeholder
            placeholder: `{{${pattern.name}}}`,
          });
        }
      });
    });

    // Sort by position in document
    variables.sort((a, b) => a.position - b.position);

    // Deduplicate same-value entries, keep first occurrence
    const deduped = [];
    const seenValues = {};
    variables.forEach(v => {
      const k = v.name + ':' + v.value;
      if (!seenValues[k]) {
        seenValues[k] = true;
        // Count occurrences
        const escaped = v.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        try {
          v.occurrences = (text.match(new RegExp(escaped, 'g')) || []).length;
        } catch(e) {
          v.occurrences = 1;
        }
        deduped.push(v);
      }
    });

    return deduped;
  }

  // ── Build template from original text + variable map ──────────────────────
  function buildTemplate(originalText, variables) {
    let template = originalText;
    // Sort by value length descending to avoid partial replacements
    const sorted = [...variables].filter(v => v.enabled).sort((a, b) => b.value.length - a.value.length);

    sorted.forEach(v => {
      const escaped = v.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try {
        template = template.replace(new RegExp(escaped, 'g'), v.placeholder);
      } catch(e) { /* skip invalid regex */ }
    });

    return template;
  }

  // ── Save custom template to Firestore ─────────────────────────────────────
  async function saveTemplate(name, originalText, templateText, variables, docType) {
    const orgId = SP.getOrgId();
    if (!orgId) throw new Error('Not logged in');

    const templateData = {
      name: name,
      docType: docType || 'operating-agreement',
      originalText: originalText,
      templateText: templateText,
      variables: variables.filter(v => v.enabled).map(v => ({
        name: v.name,
        label: v.label,
        category: v.category,
        placeholder: v.placeholder,
        originalValue: v.value,
        occurrences: v.occurrences || 1,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'upload',
    };

    // Save to Firestore
    if (typeof SPFB !== 'undefined' && SPFB.isReady && SPFB.isReady()) {
      const db = firebase.firestore();
      const ref = await db.collection('orgs').doc(orgId)
        .collection('custom_templates').add(templateData);
      templateData.id = ref.id;
    } else {
      // Fallback: save via SP.save
      const templates = SP.load('custom_templates') || [];
      templateData.id = 'tpl_' + Date.now();
      templates.push(templateData);
      SP.save('custom_templates', templates);
    }

    return templateData;
  }

  // ── Load saved custom templates ───────────────────────────────────────────
  async function getTemplates() {
    const orgId = SP.getOrgId();
    if (!orgId) return [];

    try {
      if (typeof SPFB !== 'undefined' && SPFB.isReady && SPFB.isReady()) {
        const db = firebase.firestore();
        const snap = await db.collection('orgs').doc(orgId)
          .collection('custom_templates').orderBy('createdAt', 'desc').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch(e) {
      console.error('[DocUpload] Failed to load templates:', e);
    }

    return SP.load('custom_templates') || [];
  }

  // ── Generate document from custom template + deal data ────────────────────
  function generateFromTemplate(template, dealData) {
    let output = template.templateText;

    // Map deal data to variable placeholders
    const mapping = {
      '{{COMPANY_NAME}}': dealData.companyName || dealData.name || '',
      '{{STATE}}': dealData.state || 'Texas',
      '{{ADDRESS}}': dealData.address || dealData.location || '',
      '{{GP_NAME}}': dealData.gpName || '',
      '{{PREF_RETURN}}': dealData.prefReturn || dealData.pref || '8',
      '{{GP_PROMOTE}}': dealData.gpPromote || dealData.promote || '20',
      '{{MIN_INVESTMENT}}': dealData.minInvestment || '50,000',
      '{{EIN}}': dealData.ein || '',
    };

    // Apply mappings
    Object.entries(mapping).forEach(([placeholder, value]) => {
      if (value) {
        output = output.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
      }
    });

    // Also apply any custom variable mappings from the template
    if (dealData._customVars) {
      Object.entries(dealData._customVars).forEach(([placeholder, value]) => {
        if (value) {
          output = output.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
        }
      });
    }

    // Highlight any remaining unfilled variables
    output = output.replace(/\{\{([A-Z_]+)\}\}/g, '<span style="background:#FEF3C7;color:#92400E;padding:1px 4px;border-radius:3px;font-weight:600;">{{$1}}</span>');

    return output;
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    parseDocx,
    parsePdf,
    extractVariables,
    buildTemplate,
    saveTemplate,
    getTemplates,
    generateFromTemplate,
    VARIABLE_PATTERNS,
  };

})();
