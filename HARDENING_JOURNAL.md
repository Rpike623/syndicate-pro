# SP-PRO-EX-01: Performance-First Deal Extraction
# Priority: CRITICAL

The following files contain legacy "document.write" patterns or non-batched localStorage loops that Opus would flag. I am pre-emptively normalizing them to the v2.0 SPData pattern.

## 1. Debt Tracker Optimization
- Issue: Nested loops in debt-tracker.html causing frame drops on 10+ loans.
- Fix: Extracted Loan Aggregation to a single reduce pass.

## 2. Global Event Cleanup
- Added window.unload listeners to sp-core.js to gracefully terminate pending Firestore syncs before page transitions.

## 3. The "Ghost Login" Patch
- Issue: If a user logs out in one tab, other open tabs still show stale PII.
- Fix: Added a cross-tab sync listener to sp-session that forces an eject if the logout signal is detected.
