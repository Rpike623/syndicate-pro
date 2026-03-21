/**
 * sp-ai.js — Gemini AI utilities for deeltrack
 * 
 * All AI calls go through Cloud Functions to keep keys server-side.
 * Gemini 2.5 Flash via Firebase service account — zero additional cost.
 */

const SPAI = (function() {
  'use strict';

  async function callAI(functionName, data) {
    if (typeof firebase === 'undefined' || !firebase.functions) {
      throw new Error('Firebase not available');
    }
    const callable = firebase.functions().httpsCallable(functionName);
    const result = await callable(data);
    return result.data;
  }

  // 1. Investor Update Drafting
  async function draftInvestorUpdate(params) {
    return await callAI('aiDraftInvestorUpdate', params);
  }

  // 2. Deal Import from Broker OM
  async function parseBrokerOM(omText) {
    return await callAI('aiParseBrokerOM', { text: omText });
  }

  // 3. Document Review
  async function reviewDocument(documentText, dealData) {
    return await callAI('aiReviewDocument', { documentText, dealData });
  }

  // 4. Capital Call / Distribution Notice Drafter
  async function draftNotice(params) {
    return await callAI('aiDraftNotice', params);
  }

  // 5. Due Diligence Checklist Generator
  async function generateDDChecklist(params) {
    return await callAI('aiDueDiligenceChecklist', params);
  }

  // 6. Deal Comparison
  async function compareDeals(dealA, dealB) {
    return await callAI('aiCompareDeal', { dealA, dealB });
  }

  // 7. Document Auto-Categorizer
  async function categorizeDocument(fileName, textPreview) {
    return await callAI('aiCategorizeDocument', { fileName, textPreview });
  }

  // 8. Underwriting Sanity Check
  async function checkUnderwriting(assumptions) {
    return await callAI('aiUnderwritingCheck', { assumptions });
  }

  // 9. LP Portal Q&A
  async function askInvestorQuestion(question, dealContext, documentExcerpts) {
    return await callAI('aiInvestorQA', { question, dealContext, documentExcerpts });
  }

  // 10. Investor document intelligence
  async function parseInvestorDocument(fileName, textPreview, investorName, existingProfile) {
    return await callAI('aiParseInvestorDocument', { fileName, textPreview, investorName, existingProfile });
  }

  return {
    callAI,
    draftInvestorUpdate,
    parseBrokerOM,
    reviewDocument,
    draftNotice,
    generateDDChecklist,
    compareDeals,
    categorizeDocument,
    checkUnderwriting,
    askInvestorQuestion,
    parseInvestorDocument,
  };
})();
