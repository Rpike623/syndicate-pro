/**
 * sp-ai.js — Gemini AI utilities for deeltrack
 * 
 * Shared module for AI-powered features:
 * 1. Investor Update Drafting — bullet points → polished quarterly update
 * 2. Deal Import from Broker OMs — paste OM text → structured deal data
 * 3. Document Review — compare OA terms against deal data
 * 
 * All AI calls go through Cloud Functions (parseDocumentVariables pattern)
 * to keep API keys server-side and rate-limit per user.
 */

const SPAI = (function() {
  'use strict';

  // ── Call a Gemini Cloud Function ──────────────────────────────────────────
  async function callAI(functionName, data) {
    if (typeof firebase === 'undefined' || !firebase.functions) {
      throw new Error('Firebase not available');
    }
    const callable = firebase.functions().httpsCallable(functionName);
    const result = await callable(data);
    return result.data;
  }

  // ── 1. Investor Update Drafting ───────────────────────────────────────────
  /**
   * Takes rough bullet points / notes and generates polished investor update copy.
   * @param {object} params
   * @param {string} params.dealName - Property name
   * @param {string} params.period - "Q4 2025" etc.
   * @param {string} params.updateType - quarterly|monthly|annual|construction|lease-up
   * @param {string} params.bullets - Raw notes/bullet points from GP
   * @param {object} params.metrics - Optional KPI data (occupancy, NOI, etc.)
   * @returns {object} { greeting, operations, outlook, capex }
   */
  async function draftInvestorUpdate(params) {
    return await callAI('aiDraftInvestorUpdate', params);
  }

  // ── 2. Deal Import from Broker OM ─────────────────────────────────────────
  /**
   * Extracts structured deal data from a pasted broker's offering memorandum.
   * @param {string} omText - Raw text from a broker's OM
   * @returns {object} Structured deal fields (name, location, type, raise, etc.)
   */
  async function parseBrokerOM(omText) {
    return await callAI('aiParseBrokerOM', { text: omText });
  }

  // ── 3. Document Review ────────────────────────────────────────────────────
  /**
   * Compares a generated document against deal data to find mismatches.
   * @param {string} documentText - The generated document content
   * @param {object} dealData - The deal's stored data
   * @returns {object} { matches: [], mismatches: [], warnings: [] }
   */
  async function reviewDocument(documentText, dealData) {
    return await callAI('aiReviewDocument', { documentText, dealData });
  }

  return {
    callAI,
    draftInvestorUpdate,
    parseBrokerOM,
    reviewDocument,
  };
})();
