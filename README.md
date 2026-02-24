# SyndicatePro

Real estate syndication platform with waterfall calculations, document generation, and investor management.

**Live:** https://rpike623.github.io/syndicate-pro/

## What It Does

A complete syndication workflow platform for real estate sponsors:

1. **Deal Modeling** - Waterfall calculator with 3 structure types
2. **Document Generation** - Operating agreements, PPMs, subscription docs
3. **Investor Management** - LP tracking, accreditation status, CRM
4. **Reporting** - Portfolio analytics, performance metrics
5. **Data Persistence** - Local storage + IndexedDB backend

## Current Features

### Deal Modeling (`index.html`)
✅ Interactive waterfall calculator
✅ 3 waterfall structures: Simple Split, Pref+Split, Catch-Up
✅ Real-time distribution visualization
✅ IRR/multiple calculations
✅ Save/load deals locally
✅ Investor allocation tracking

### Document Generation (`documents.html`)
✅ Operating Agreement generator (LLC)
✅ Limited Partnership Agreement template
✅ Private Placement Memorandum (PPM)
✅ Subscription Agreement
✅ Variable substitution from deal terms
✅ Export to PDF (jsPDF)
✅ Export to HTML/Word
✅ Preview before export
✅ Deal import for auto-population

### Investor Management (`investors.html`)
✅ Investor database with contact info
✅ Accredited investor tracking (5 verification methods)
✅ Investment preferences (property types)
✅ Search and filter
✅ Deal association
✅ Investment history per investor
✅ Stats dashboard (AUM, counts)

### Reports & Analytics (`reports.html`)
✅ Portfolio overview dashboard
✅ AUM tracking with trend charts
✅ Deal performance table
✅ Investor accreditation breakdown
✅ Document generation counters
✅ Exportable reports (JSON)

### Data Layer (`js/`)
✅ LocalStorage persistence
✅ IndexedDB backend for scale
✅ Deal/investor/document CRUD
✅ Export/import all data
✅ Cross-page data sharing

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
| `{{DISPOSITION_FEE}}` | Disposition fee % | Operating agreement |
| `{{REFI_FEE}}` | Refinance fee % | Operating agreement |
| `{{GP_NAME}}` | GP entity name | Documents |
| `{{GP_REP}}` | GP representative | Documents |
| `{{PROPERTY_ADDRESS}}` | Property location | All docs |

## Architecture

```
syndicate-pro/
├── index.html          # Waterfall calculator (main)
├── documents.html      # Document generator
├── investors.html      # Investor CRM
├── reports.html        # Analytics dashboard
├── js/
│   ├── storage.js      # LocalStorage API
│   └── database.js     # IndexedDB backend
└── README.md
```

- Pure HTML/CSS/JS - no build step required
- Single-page apps with shared data layer
- Works offline once loaded
- GitHub Pages compatible

## Workflow

### 1. Model a Deal
1. Open `index.html`
2. Enter deal terms (cost, loan, equity split, waterfall prefs)
3. Calculate waterfall to see distribution tiers
4. Save deal locally

### 2. Generate Documents
1. Open `documents.html`
2. Select document type (OA, PPM, Subscription)
3. Import saved deal to auto-populate fields
4. Fill in entity/parties information
5. Preview document
6. Export as PDF, Word, or HTML

### 3. Manage Investors
1. Open `investors.html`
2. Add investors with contact info
3. Track accredited status and verification method
4. Record investment preferences
5. Associate investors with deals

### 4. View Reports
1. Open `reports.html`
2. See portfolio overview (AUM, active deals, investor count)
3. Review deal performance metrics
4. Track document generation counts
5. Export data as needed

## Document Templates

### Operating Agreement
- Delaware LLC structure (customizable by state)
- Capital contribution sections
- Full waterfall provisions
- Return of capital → Preferred return → Catch-up → Residual split
- Sponsor compensation schedule
- Signature blocks

### Private Placement Memorandum
- SEC-compliant disclaimer language
- Risk factors section
- Summary of offering terms
- Use of proceeds breakdown
- Fee disclosure

### Subscription Agreement
- Subscriber information form
- Accredited investor representations (5 categories)
- Investment representations
- Wire instructions template
- Signature blocks

## Data Persistence

All data is stored locally in your browser:

- **LocalStorage**: Primary storage for deals, investors, settings
- **IndexedDB**: Backend for larger datasets, document storage
- **SessionStorage**: Temporary deal data between pages

### Export/Import

Backup or transfer all data:
```javascript
// Export all data
const data = Storage.exportAll();
// Copy to file or cloud storage

// Import data (merge or replace)
Storage.importAll(exportedDataObject);
```

## Roadmap

### Phase 1: Foundation ✅ COMPLETE
- [x] Waterfall engine with 3 structure types
- [x] Data persistence (LocalStorage + IndexedDB)
- [x] Document templates (OA, PPM, Subscription)
- [x] PDF export (jsPDF)
- [x] Investor CRM
- [x] Reports dashboard

### Phase 2: Enhanced Documents 🔄 IN PROGRESS
- [ ] State-specific operating agreements (CA, NY, FL, NV, WY)
- [ ] Amendments and side letters
- [ ] Custom clause library
- [ ] Template versioning

### Phase 3: Operations
- [ ] Distribution tracking by quarter
- [ ] K-1 placeholder generation
- [ ] Deal pipeline stages
- [ ] Capital call notices
- [ ] Investor portal (view-only)

### Phase 4: Platform
- [ ] Cloud backend option (Firebase/Supabase)
- [ ] E-signature integration (DocuSign/HelloSign)
- [ ] Email campaign templates
- [ ] Multi-user support with roles
- [ ] Mobile app

## Security & Compliance Notes

⚠️ **Important:** Documents generated by SyndicatePro are templates only. They should be reviewed by qualified securities counsel before use.

- This tool does not constitute legal advice
- Securities laws vary by jurisdiction
- Always consult with an attorney before offering securities
- Verify accredited investor status per SEC guidelines
- Maintain proper documentation for all offerings

## Tech Stack

- **Frontend:** Vanilla HTML5/CSS3/ES6+
- **Storage:** LocalStorage + IndexedDB
- **PDF Generation:** jsPDF (CDN)
- **Fonts:** Google Fonts (Inter, JetBrains Mono)
- **Hosting:** GitHub Pages

## Local Development

No build process required:

```bash
# Clone or download
cd syndicate-pro

# Open in browser
open index.html

# Or serve locally
python3 -m http.server 8000
# Then visit http://localhost:8000
```

## Contributing

This is a personal project, but suggestions welcome:
1. Open an issue on GitHub
2. Describe the feature or bug
3. Include use case details

## License

MIT - Feel free to use, modify, distribute.

---

Built for real estate syndicators who need fast, accurate modeling + automated docs.