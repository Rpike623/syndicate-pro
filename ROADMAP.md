# Project Roadmap: SyndicatePro

## Vision
A complete "do-everything" platform for real estate syndicators — from deal sourcing to exit distributions.

---

## Phase 1: Foundation ✅ COMPLETE

**Goal:** Build the core calculation engine and basic infrastructure.

- [x] Standardized deal input variables
- [x] 3 waterfall structure types (Simple, Pref+Split, Catch-Up)
- [x] Real-time distribution visualization
- [x] IRR/Multiple calculations
- [x] Data persistence (LocalStorage + IndexedDB)
- [x] Deal save/load functionality
- [x] GitHub Pages deployment

---

## Phase 2: Document Generation ✅ COMPLETE

**Goal:** Automate the legal docs that every syndication needs.

### Operating Agreement Generator ✅
- [x] LLC Operating Agreement template
- [x] LP Agreement template
- [x] Variable substitution from deal terms
- [x] Signature blocks
- [x] PDF export (jsPDF)

### PPM Creation ✅
- [x] Private Placement Memorandum builder
- [x] Risk factor library
- [x] SEC compliance disclaimer
- [x] Export to Word/HTML

### Subscription Documents ✅
- [x] Investor questionnaire
- [x] Accredited investor verification (5 categories)
- [x] Subscription agreement template
- [x] Wire instructions section

---

## Phase 3: Investor Management ✅ COMPLETE

**Goal:** Full investor lifecycle management.

### CRM ✅
- [x] Investor database with contact info
- [x] Accreditation tracking (5 verification methods)
- [x] Investment preferences (property types)
- [x] Communication notes

### Reports Dashboard ✅
- [x] Portfolio overview (AUM, deal count)
- [x] Investor analytics
- [x] Document generation counters
- [x] Exportable data

---

## Phase 4: Enhanced Documents 🔄 CURRENT

**Goal:** Professional-grade document generation.

- [ ] State-specific operating agreements
  - [ ] Delaware (default - done)
  - [ ] Texas
  - [ ] California
  - [ ] New York
  - [ ] Florida
  - [ ] Nevada
  - [ ] Wyoming
- [ ] Custom clause library
- [ ] Document versioning
- [ ] Amendment generator
- [ ] Side letter templates

---

## Phase 5: Deal Management

**Goal:** Track deals from sourcing to close.

### Deal Sourcing Pipeline
- [ ] Property tracking (address, price, assumptions)
- [ ] Due diligence checklist
- [ ] Offer/LOI management
- [ ] Document storage per deal
- [ ] Deal stages (sourcing, LOI, DD, closing, operating)

### Underwriting Tools
- [ ] Rent roll analyzer
- [ ] Pro forma builder
- [ ] Sensitivity analysis
- [ ] Market comp tracker
- [ ] Cap rate calculator

---

## Phase 6: Distribution & Tax Operations

**Goal:** Handle ongoing operations and tax reporting.

### Distribution Management
- [ ] Quarterly distribution calculations
- [ ] Distribution notices generator
- [ ] Distribution history per investor
- [ ] Waterfall tracking over time
- [ ] Preferred return accrual tracking

### Tax Preparation
- [ ] K-1 placeholder generator
- [ ] 1065 partnership return prep checklist
- [ ] Depreciation schedule tracker
- [ ] Investor tax packet assembly

---

## Phase 7: Investor Portal

**Goal:** Self-service portal for limited partners.

- [ ] Secure investor login
- [ ] Investment dashboard
- [ ] Document access (OA, PPM, K-1s)
- [ ] Distribution history view
- [ ] Tax document downloads
- [ ] Contact GP / messaging

---

## Phase 8: Marketing & Capital Raising

**Goal:** Tools to raise capital more efficiently.

### Deal Marketing
- [ ] Deal teaser generator (one-pager)
- [ ] Investment summary PDF
- [ ] Photo gallery integration
- [ ] Video embed support

### Communication
- [ ] Email campaign templates
- [ ] Investor update templates (quarterly)
- [ ] Capital call notice generator
- [ ] Distribution announcement templates

### CRM Enhancements
- [ ] Lead tracking
- [ ] Follow-up reminders
- [ ] Pipeline visualization
- [ ] Communication history log

---

## Phase 9: Platform & Integrations

**Goal:** Enterprise-grade platform with integrations.

### Backend Options
- [ ] Firebase/Supabase cloud backend
- [ ] Self-hosted option
- [ ] Real-time sync across devices

### E-Signature
- [ ] DocuSign integration
- [ ] HelloSign integration
- [ ] Bulk send to investors

### Banking & Accounting
- [ ] Plaid integration for bank feeds
- [ ] QuickBooks sync
- [ ] Xero sync
- [ ] Automated bookkeeping entries

### Compliance
- [ ] SEC filing reminders (Form D)
- [ ] Blue sky compliance tracking
- [ ] Investor accreditation re-verification
- [ ] Document retention policies

---

## Phase 10: Advanced Features

**Goal:** Differentiating features for power users.

### Multi-User
- [ ] Role-based access (GP, LP, Admin, Accountant, Attorney)
- [ ] Audit logs
- [ ] Team collaboration
- [ ] Approval workflows

### Advanced Waterfalls
- [ ] Multiple hurdles (tiered promotes)
- [ ] IRR-based promotes (not just cash-on-cash)
- [ ] Lookback provisions
- [ ] Clawback tracking

### Analytics
- [ ] Portfolio IRR tracking
- [ ] Cash-on-cash return analysis
- [ ] Compare vs. projections
- [ ] Market benchmarking

### Mobile
- [ ] Mobile app (PWA or native)
- [ ] Push notifications
- [ ] Mobile-optimized investor portal

---

## Architecture Evolution

| Phase | Architecture |
|-------|-------------|
| 1-3 | Single HTML files, LocalStorage |
| 4-5 | Enhanced docs, IndexedDB for larger data |
| 6-7 | Optional cloud backend (Firebase) |
| 8-10 | Full backend, multi-user, integrations |

---

## Priority Queue (Heartbeat Tasks)

When idle, work on these in order:

1. State-specific operating agreement clauses
2. Distribution tracking module
3. K-1 placeholder generator
4. Deal pipeline stages
5. Investor portal (basic view-only)
6. Email templates
7. DocuSign integration research

---

## Monetization Options

1. **Free Tier** - Basic waterfall + 1 deal
2. **Pro ($49/mo)** - Unlimited deals, all documents
3. **Team ($149/mo)** - Multi-user, cloud sync
4. **Enterprise** - Custom integrations, white-label
5. **Per-Document** - Pay per generated doc

---

## Competitive Positioning

| Feature | SyndicatePro | Juniper Square | Generic Calc |
|---------|--------------|----------------|--------------|
| Waterfall Modeling | ✅ Flexible | ✅ Good | ❌ Basic |
| Document Generation | ✅ Built-in | ❌ No | ❌ No |
| Investor CRM | ✅ Built-in | ✅ Yes | ❌ No |
| Pricing | Free/$$$ | $$$$ | Free |
| Customization | ✅ High | ⚠️ Medium | ❌ Low |

**Differentiation:** All-in-one solution at lower cost than enterprise tools, more complete than free alternatives.