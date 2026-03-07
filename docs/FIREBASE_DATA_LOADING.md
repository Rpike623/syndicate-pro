# Firebase Data Loading Architecture

## The Problem (Why the dropdown was empty)

**Root Cause:** `SP.getDeals()` was reading from `localStorage` before Firebase loaded the real data from Firestore.

**Sequence of failure:**
1. Page loads, scripts execute
2. `init()` runs immediately (DOMContentLoaded)
3. `SP.getDeals()` reads `localStorage` → empty on fresh device
4. Firebase auth happens asynchronously
5. Firestore data loads (too late)
6. Dropdown already rendered with 0 options

## The Solution

### 1. Single Entry Point: `SP.onDataReady()`

All pages must use `SP.onDataReady(callback)` instead of calling `init()` directly.

```javascript
// WRONG - runs before data loads
init();

// WRONG - works but redundant/complex
window.addEventListener('spdata-ready', init);
if (typeof SPData !== 'undefined' && SPData.isReady()) init();
setTimeout(init, 1000); // desperation retry

// CORRECT - fires once when Firestore data is ready
SP.onDataReady(init);
```

### 2. How It Works

**In `js/sp-core.js`:**
```javascript
const _dataReadyQueue = [];
let _dataReady = false;

function onDataReady(cb) {
  if (_dataReady || (typeof SPData !== 'undefined' && SPData.isReady && SPData.isReady())) {
    _dataReady = true;
    try { cb(); } catch(e) {}
    return;
  }
  _dataReadyQueue.push(cb);
}

window.addEventListener('spdata-ready', () => {
  _dataReady = true;
  while (_dataReadyQueue.length) {
    try { _dataReadyQueue.shift()(); } catch(e) {}
  }
});
```

**In `js/sp-firebase.js`:**
1. Firebase Auth resolves
2. `SPData.init(db, orgId)` fetches from Firestore
3. Once data is in memory, fires `spdata-ready` event
4. `SP.onDataReady()` callbacks execute
5. Pages render with real data

### 3. Page Patterns

**Simple page with deal dropdown:**
```javascript
function init() {
  const deals = SP.getDeals(); // Now returns Firestore data
  // populate dropdown
}

SP.onDataReady(init);
```

**Page that needs auth + data:**
```javascript
SP.onDataReady(() => {
  if (!SP.isLoggedIn()) { window.location.href = 'login.html'; return; }
  init();
});
```

### 4. Data Flow

```
Page Load
    │
    ▼
sp-core.js loads → defines SP.onDataReady()
    │
    ▼
sp-data.js loads → defines SPData (not yet initialized)
    │
    ▼
sp-firebase.js loads → initializes Firebase Auth
    │
    ▼
Auth state resolves → _markReady() called
    │
    ▼
SPData.init(db, orgId) → fetches deals/investors/distributions from Firestore
    │
    ▼
Firestore data cached in memory → spdata-ready event fired
    │
    ▼
SP.onDataReady() callbacks execute → Pages render with real data
```

### 5. Key Rules

1. **Never call `init()` directly** at the bottom of your script
2. **Never use `localStorage` as source of truth** — it's only a write-through cache
3. **Always use `SP.onDataReady()`** for any code that reads deals/investors/distributions
4. **All pages must load:**
   - `sp-core.js`
   - `sp-data.js` 
   - `sp-firebase.js`

### 6. What SP.onDataReady Guarantees

When your callback runs:
- ✅ Firebase Auth is initialized
- ✅ Firestore data has been fetched
- ✅ `SP.getDeals()` returns real data
- ✅ `SP.getInvestors()` returns real data
- ✅ `SP.getDistributions()` returns real data
- ✅ `SPData.getDeals()` returns real data (same cache)

### 7. Pages Converted

All 40+ pages with deal dropdowns have been converted to use `SP.onDataReady()`:
- distribution-calc.html
- distributions.html
- capital-calls.html
- cap-table.html
- deal-compare.html
- deal-detail.html
- documents.html
- investors.html
- dashboard.html
- etc.

### 8. Testing Checklist

Before declaring "it works":
- [ ] Open page in Incognito/Private mode (no localStorage)
- [ ] Verify deal dropdown populates
- [ ] Check browser console for no "firebase.storage is not a function" errors
- [ ] Check browser console for no "undefined" errors
- [ ] Verify selecting a deal works
- [ ] Refresh page, verify data persists

## Common Mistakes

### Mistake 1: Calling init() immediately
```javascript
function init() { /* uses SP.getDeals() */ }
init(); // Runs before data loads!
```

### Mistake 2: Checking localStorage first
```javascript
function getDeals() {
  const cached = localStorage.getItem('deals');
  if (cached) return JSON.parse(cached); // May be stale/empty
  // ...fetch from Firestore
}
```

### Mistake 3: Missing sp-data.js
```html
<script src="js/sp-core.js"></script>
<!-- MISSING sp-data.js -->
<script src="js/sp-firebase.js"></script>
```

## Files That Implement This Pattern

- `js/sp-core.js` - defines `SP.onDataReady()`
- `js/sp-data.js` - defines `SPData`, fetches from Firestore
- `js/sp-firebase.js` - initializes Firebase, triggers `spdata-ready`

## Migration Guide (for future pages)

Old code:
```javascript
document.addEventListener('DOMContentLoaded', init);
window.addEventListener('spdata-ready', init);
if (typeof SPData !== 'undefined' && SPData.isReady()) init();
setTimeout(init, 500);
```

New code:
```javascript
SP.onDataReady(init);
```
