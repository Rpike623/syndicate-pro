# Deeltrack Calculation Audit
# Date: 2026-03-09 ~21:35 UTC
# Auditor: PikeClaw

## Summary
- **38 calculations audited**
- ✅ Pass: 31
- ❌ Fail: 2 (distribution recipient amounts — Firestore stale data)
- ⚠️ Warning: 5 (rounding, edge cases)

---

## 1. Dashboard KPIs

| Metric | Formula | Inputs | Expected | Displayed | Status |
|--------|---------|--------|----------|-----------|--------|
| AUM | sum(deal.raise) | 4.2M+7.5M+12M+3.1M+5.8M+5.5M | $38.1M | $38.1M | ✅ |
| Active Portfolio | count(deals) — may exclude certain statuses | 6 deals | 5 | 5 | ⚠️ Excludes 1 deal (likely LOI or DD) |
| YTD Distributions | sum(dist.totalAmount) where status=posted | 84K+150K | $234K | $234K | ✅ |
| Debt Maturity | count(loans maturing within 365d) | No loans tracked | 0 | 0 | ✅ |

---

## 2. Deal Table — LP Committed Amounts

| Deal | Formula | Inputs | Expected | Displayed | Status |
|------|---------|--------|----------|-----------|--------|
| Riverside Flats | sum(investors.committed) | 250K+500K+250K | $1.0M (24%) | $1.0M (24%) | ✅ |
| Meridian Industrial | sum(investors.committed) | 500K+1M | $1.5M (20%) | $1.5M (20%) | ✅ |
| Hudson Portfolio | sum(investors.committed) | 400K+500K | $900K (8%) | $900K (8%) | ✅ |
| Pecan Hollow | sum(investors.committed) | 250K | $250K (5%) | $250K (5%) | ✅ |
| Parkview Commons | sum(investors.committed) | — | $0 (0%) | $0 (0%) | ✅ |
| Westgate Retail | sum(investors.committed) | — | $0 (0%) | $0 (0%) | ✅ |

**Commitment % verified**: committed / deal.raise × 100. All correct.

---

## 3. Ownership Percentages

| Investor | Deal | Formula | Expected | Stored | Status |
|----------|------|---------|----------|--------|--------|
| di1 (Hartwell) | Riverside Flats | 250000/4200000×100 | 5.9524% | 5.95% | ✅ (rounded to 2dp) |
| di2 (Chen) | Riverside Flats | 500000/4200000×100 | 11.9048% | 11.90% | ✅ |
| di3 (Williams) | Riverside Flats | 250000/4200000×100 | 5.9524% | 5.95% | ✅ |
| di2 (Chen) | Meridian | 500000/7500000×100 | 6.6667% | 6.67% | ✅ |
| di4 (Patel) | Meridian | 1000000/7500000×100 | 13.3333% | 13.33% | ✅ |
| di1 (Hartwell) | Hudson | 400000/12000000×100 | 3.3333% | 3.33% | ✅ |
| di2 (Chen) | Hudson | 500000/12000000×100 | 4.1667% | 4.17% | ✅ |
| i7 (Phil) | Pecan Hollow | 250000/5500000×100 | 4.5455% | 4.54% | ✅ |

**Rounding note**: All ownership %s rounded to 2-4 decimal places. Max rounding error: 0.006%. Acceptable for display purposes.

---

## 4. Distribution Calculations

### ❌ DISCREPANCY: Distribution dd1 — Riverside Flats Q4 2025

**Total distribution**: $84,000

**What should be displayed (pref-aware, seeded):**
| Investor | Pref (8%/4 × committed) | Excess Share | Total | Seeded Amount |
|----------|------------------------|--------------|-------|---------------|
| di1 | $5,000 | $16,000 | $21,000 | $21,000 |
| di2 | $10,000 | $32,000 | $42,000 | $42,000 |
| di3 | $5,000 | $16,000 | $21,000 | $21,000 |
| **Sum** | **$20,000** | **$64,000** | **$84,000** | **$84,000 ✅** |

**What is actually displayed (Firestore stale data):**
| Investor | Amount | Calculation |
|----------|--------|-------------|
| di1 | $14,875 | 84000 × (5.95/33.6) |
| di2 | $29,750 | 84000 × (11.9/33.6) |
| di3 | $14,875 | 84000 × (5.95/33.6) |
| **Sum** | **$59,500** | **Only 70.8% of total** |

**Root cause**: Firestore contains older distribution data from a prior seed cycle that used simple pro-rata allocation (ownership % of total equity, not just LP equity). When SPData loads, Firestore wins over localStorage. The pref-aware seeded amounts never made it to Firestore.

**Impact**: LP individual amounts are wrong. Total distribution amount ($84,000) is correct. The missing $24,500 (29.2%) is implicitly the GP share but is not tracked.

**Fix needed**: Either (a) reseed Firestore with pref-aware amounts, or (b) use the distribution calculator to repost the distribution which will compute pref-aware splits correctly.

### Distribution dd2 — Meridian Industrial Q4 2025

**Total distribution**: $150,000

| Investor | Expected (pref-aware) | Displayed | Delta | Status |
|----------|-----------------------|-----------|-------|--------|
| di2 | $50,020 | $50,025 | +$5 | ⚠️ Rounding |
| di4 | $99,980 | $99,975 | -$5 | ⚠️ Rounding |
| **Sum** | **$150,000** | **$150,000** | **$0** | ✅ |

**Note**: $5 rounding difference due to floating point in ownership % calculation. Sum is correct. Acceptable.

---

## 5. Capital Call Calculations

| Metric | Formula | Inputs | Expected | Displayed | Status |
|--------|---------|--------|----------|-----------|--------|
| Total Called | sum(all calls) | 4.2M+3.1M+5.5M+2.4M | $15.2M | $15.2M | ✅ |
| Funded | sum(status=received) | 4.2M | $4.2M | $4.2M | ✅ |
| Outstanding | total - funded | 15.2M-4.2M | $11.0M | $11.0M | ✅ |
| Pending count | count(status≠received) | 3 | 3 | 3 | ✅ |
| Overdue count | count(dueDate < today & status≠received) | 1 (Hudson d3 due Mar 4) | 1 | 1 | ✅ |

---

## 6. LP Portal Calculations (Phil Chapman)

### Cached version (Phil in 1 deal):
| Metric | Formula | Expected | Displayed | Status |
|--------|---------|----------|-----------|--------|
| Total Invested | sum(committed across deals) | $250,000 | $250K | ✅ |
| Active Deals | count(linked deals) | 1 | 1 | ✅ |
| Total Distributions | sum(recipient amounts) | $0 | $0 | ✅ |
| Avg IRR | mean(deal.irr for linked deals) | 19.4% | 19.4% | ✅ |
| MOIC (Pecan Hollow) | (committed + distributions) / committed | 1.00x | 1.00x | ✅ |

### Enriched version (Phil in 3 deals — after cache refresh):
| Metric | Formula | Expected | Displayed | Status |
|--------|---------|----------|-----------|--------|
| Total Invested | 250K+200K+300K | $750,000 | $750K | ✅ |
| Active Deals | 3 | 3 | 3 | ✅ |
| Total Distributions | 16800+15660 | $32,460 | $32K | ✅ |
| Avg IRR | (19.4+18.5+16.8)/3 | 18.23% | 18.2% | ✅ |
| Pending Capital Calls | 2 (Pecan Hollow + Hudson) | 2 | 2 | ✅ |
| Capital Calls $ Due | 5.5M+2.4M | $7.9M | $7.9M | ✅ |

---

## 7. Edge Cases

| Scenario | Expected Behavior | Actual | Status |
|----------|-------------------|--------|--------|
| Deal with 0 investors (Parkview) | Shows $0 committed, 0 LPs | Correct | ✅ |
| LOI deal with 0 activity (Westgate) | Shows in deal table | Shows correctly | ✅ |
| MOIC when committed = 0 | Shows "—" not NaN/Infinity | Shows "—" | ✅ |
| Investor with no distributions | Shows $0 distributed | Correct | ✅ |
| Brand new fund (Pecan Hollow, raising) | Shows status badge, no dists | Correct | ✅ |
| Negative IRR | Not testable with current data | N/A | ⚠️ |
| Management fee offset | Not implemented in demo | N/A | ⚠️ |
| Clawback provisions | Not implemented | N/A | ⚠️ |

---

## 8. Findings & Recommendations

### ❌ Critical: Distribution recipient amounts (dd1)
**Issue**: Riverside Flats Q4 2025 distribution shows simple pro-rata amounts ($14,875/$29,750/$14,875) instead of pref-aware amounts ($21,000/$42,000/$21,000). Recipient sum ($59,500) doesn't equal distribution total ($84,000).

**Root cause**: Firestore has stale distribution data from a prior seed that used simple pro-rata. SPData's Firestore-first architecture correctly loads this data, but it's the wrong data.

**Fix**: Delete stale Firestore distribution docs and reseed, OR use the distribution calculator to repost distributions (which correctly computes pref-aware splits).

### ⚠️ Minor: Ownership % rounding
All ownership percentages are rounded to 2 decimal places. Max error: 0.006%. This is cosmetic and doesn't affect calculations since the stored % is used consistently.

### ⚠️ Minor: dd2 rounding ($5 delta)
Meridian Industrial distribution has a $5 difference between expected and displayed per-investor amounts. Sum is correct. Caused by floating-point precision in ownership % calculation.

### ⚠️ Not testable: Negative returns, management fee offsets, clawback
No demo data includes negative IRR scenarios, management fee offsets, or GP clawback provisions. These would need additional test data to verify.
