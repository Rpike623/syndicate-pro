# Deeltrack Firebase Architecture - Critical Rules

## ⚠️ NEVER BREAK THESE RULES

### 1. localStorage is NOT a Database
- localStorage is a **write-through cache ONLY**
- NEVER read from localStorage expecting current data
- Source of truth is ALWAYS Firestore
- `SP.getDeals()` now reads from SPData (Firestore-backed), not localStorage

### 2. Use SP.onDataReady() For Everything
- NEVER call `init()` directly at page load
- NEVER use `window.addEventListener('spdata-ready', ...)`
- ALWAYS use `SP.onDataReady(callback)`
- This guarantees Firestore data is loaded before your code runs

### 3. Script Loading Order (CRITICAL)
Every HTML page MUST load in this exact order:
```html
<script src="js/sp-core.js?v2"></script>
<script src="js/sp-data.js?v2"></script>   <!-- DO NOT SKIP -->
<script src="js/sp-firebase.js?v2"></script>
```

**If sp-data.js is missing, Firestore data won't populate.**

### 4. The Data Flow
```
Page Load → sp-core.js → sp-data.js → sp-firebase.js
                ↓              ↓              ↓
          SP.onDataReady()  SPData      Firebase Auth
                ↓              ↓              ↓
          Callback fires   Firestore     spdata-ready
                           fetch         event
```

### 5. Common Anti-Patterns (NEVER DO THIS)

```javascript
// ❌ WRONG - Runs before data loads
function init() {
  const deals = SP.getDeals();
}
init();

// ❌ WRONG - Redundant and race-prone
window.addEventListener('spdata-ready', init);
if (SPData.isReady()) init();
setTimeout(init, 500);

// ❌ WRONG - localStorage is stale
const deals = JSON.parse(localStorage.getItem('sp_deals'));

// ✅ CORRECT
SP.onDataReady(() => {
  const deals = SP.getDeals(); // Firestore data guaranteed
});
```

### 6. If a Page Has Empty Dropdowns

1. Check it loads sp-data.js
2. Check it uses SP.onDataReady(init)
3. Check SP.getDeals() returns SPData.getDeals() when ready

### 7. Quick Debug Commands

```javascript
// Check if data loaded
SPData.isReady()  // should return true
SPData.getDeals() // should return array with deals

// Check localStorage (should be populated AFTER Firestore load)
localStorage.getItem('sp_org_kiqlcx_deals')
```

### 8. Key Files

| File | Purpose |
|------|---------|
| `js/sp-core.js` | Defines SP.* API, SP.onDataReady() |
| `js/sp-data.js` | SPData - Firestore cache layer |
| `js/sp-firebase.js` | Firebase Auth, triggers data fetch |
| `docs/FIREBASE_DATA_LOADING.md` | Full architecture docs |

### 9. When Adding a New Page

1. Copy script loading order from distribution-calc.html
2. Wrap all data-reading code in SP.onDataReady()
3. Use SP.getDeals(), never localStorage directly
4. Test in Incognito mode (fresh localStorage)

### 10. The Golden Rule

**If you're reading data, you MUST be inside SP.onDataReady() or called from it.**

No exceptions. No "just this once". No "it works on my machine".

## History

2026-03-07: Complete refactor to fix empty dropdowns on mobile/fresh devices
- 51 files changed
- All pages converted to SP.onDataReady()
- Firestore is now the single source of truth
- localStorage is demoted to write-through cache only
