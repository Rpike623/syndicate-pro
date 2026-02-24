# SyndicatePro

Real estate syndication platform with waterfall calculations, document generation, and investor management.

**Live:** https://rpike623.github.io/syndicate-pro/

## What It Does

A complete syndication workflow platform for real estate sponsors:

1. **Deal Modeling** - Waterfall calculator with 3 structure types
2. **Document Generation** - Operating agreements, PPMs, subscription docs
3. **Investor Management** - LP tracking, accreditation status, CRM
4. **Data Persistence** - Local storage + IndexedDB backend

## Current Features

### Deal Modeling (`index.html`)
✅ Interactive waterfall calculator
✅ 3 waterfall structures: Simple Split, Pref+Split, Catch-Up
✅ Real-time distribution visualization
✅ IRR/multiple calculations
✅ Save/load deals locally

### Document Generation (`documents.html`)
✅ Operating Agreement generator
✅ Private Placement Memorandum (PPM) template
✅ Variable substitution from deal terms
✅ Export to HTML/Word
✅ Preview before export

### Investor Management (`investors.html`)
✅ Investor database with contact info
✅ Accredited investor tracking
✅ Investment preferences
✅ Search and filter
✅ Deal association

### Data Layer (`js/`)
✅ LocalStorage persistence
✅ IndexedDB backend for scale
✅ Deal/investor/document CRUD
✅ Export/import all data

## Standardized Deal Variables

| Variable | Description | Used In |
|----------|-------------|---------|
| `{{COMPANY_NAME}}` | LLC/LP entity name | All docs |
| `{{STATE}}` | Formation state | Operating agreement |
| `{{TOTAL_EQUITY}}` | Total equity raise | Waterfall, docs |
| `{{GP_EQUITY}}` / `{{LP_EQUITY}}` | Equity split percentages | Waterfall, docs |
| `{{PREF_RETURN}}` | Preferred return hurdle | Waterfall, docs |
| `{{GP_PROMOTE}}` | GP promote percentage | Waterfall, docs |
| `{{CATCHUP_RATE}}` | GP catch-up rate | Waterfall (catchup type) |
| `{{ACQ_FEE}}` | Acquisition fee % | Operating agreement |
| `{{ASSET_MGMT_FEE}}` | Asset management fee % | Operating agreement |

## Architecture

```
syndicate-pro/
├── index.html          # Waterfall calculator (main)
├── documents.html      # Document generator
├── investors.html      # Investor CRM
├── js/
│   ├── storage.js      # LocalStorage API
│   └── database.js     # IndexedDB backend
└── README.md
```

- Pure HTML/CSS/JS - no build step required
- Single-page apps with shared data layer
- Works offline once loaded
- GitHub Pages compatible

## Roadmap

### Phase 1: Foundation ✅ COMPLETE
- [x] Waterfall engine
- [x] 3 structure types
- [x] Data persistence
- [x] Document templates

### Phase 2: Enhanced Documents 🔄 IN PROGRESS
- [ ] State-specific operating agreements
- [ ] Subscription agreement generator
- [ ] PDF export (via jsPDF or server)
- [ ] Template library

### Phase 3: Operations
- [ ] Distribution tracking
- [ ] K-1 placeholders
- [ ] Deal pipeline
- [ ] Reporting dashboard

### Phase 4: Platform
- [ ] Cloud backend option (Firebase/Supabase)
- [ ] E-signature integration
- [ ] Email campaigns
- [ ] Multi-user support

## Usage

1. **Model a Deal:** Open `index.html`, enter deal terms, calculate waterfall
2. **Save the Deal:** Click "Save Deal" to persist to local storage
3. **Generate Documents:** Open `documents.html`, import deal, fill details, export
4. **Manage Investors:** Open `investors.html`, add LPs, track accreditation

All data stays in your browser until you export it.

## Export/Import

Data can be exported as JSON for backup or transfer:
```javascript
// In browser console
Storage.exportAll() // Returns complete data object
```

## Tech Stack

- Vanilla HTML5/CSS3/ES6+
- IndexedDB (via wrapper)
- LocalStorage fallback
- No external dependencies (except Google Fonts)

---

Built for real estate syndicators who need fast, accurate modeling + automated docs.