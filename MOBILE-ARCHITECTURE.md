# SyndicatePro Mobile Architecture

## Core Navigation (Bottom Tab Bar)
```
[Home] [Deals] [+] [Investors] [More]
```

### Tab 1: Home (Dashboard)
- Portfolio overview (AUM, active deals, investors)
- Quick actions (New Deal, Send Capital Call, Run Distribution)
- Recent activity feed
- Upcoming deadlines/alerts

### Tab 2: Deals
- Two views: Pipeline vs List
- Pipeline: Kanban columns (Sourcing → DD → Closing → Operating)
- List: All deals with search/filter
- Quick add new deal

### Tab 3: Plus (+)
- Action sheet with:
  - New Deal
  - Quick Underwrite
  - Send Capital Call
  - Run Distribution
  - New Investor

### Tab 4: Investors
- Two views: Active vs Leads
- Active: Current LPs with investment summary
- Leads: Pipeline of potential investors
- Quick actions per investor

### Tab 5: More
- Profile/Settings
- Documents
- Reports
- Notifications
- Support

## Key User Flows

### Flow 1: Evaluate New Deal (60 seconds)
1. Tap [+] → Quick Underwrite
2. Enter basic numbers (price, units, NOI)
3. See instant metrics and recommendation
4. Save to sourcing CRM or discard

### Flow 2: Send Capital Call (90 seconds)
1. Tap [+] → Capital Call
2. Select deal
3. Select investors (multi-select)
4. Review amounts
5. Preview & send

### Flow 3: Review Deal Pipeline (30 seconds)
1. Tap [Deals]
2. See pipeline view instantly
3. Swipe horizontally to see all stages
4. Tap any deal for details

### Flow 4: Add New Investor Lead (45 seconds)
1. Tap [Investors] tab
2. Toggle to "Leads" view
3. Tap [+] button
4. Enter name, email, capacity
5. Save & schedule follow-up

## Screen Specifications

### Home Screen
```
┌─────────────────────┐
│ ≡  SyndicatePro  🔔│  Header
├─────────────────────┤
│ $12.4M   │ $847K   │  Stats Row
│ AUM      │ Raised  │
├─────────────────────┤
│ 47 Active Investors │
│ 8 Active Deals      │
├─────────────────────┤
│ Quick Actions       │
│ [New] [Call] [Pay]  │
├─────────────────────┤
│ Recent Activity     │  Scrollable
│ • Sarah committed.. │
│ • Q4 dist sent...   │
│ • New deal added... │
└─────────────────────┘
```

### Deals Screen (Pipeline View)
```
┌─────────────────────┐
│ ≡  Deals       [🔍]│
├─────────────────────┤
│ [Pipeline] [List]   │  Toggle
├─────────────────────┤
│ ← Sourcing (2) →    │  Horizontal
│ [Deal] [Deal]       │  Scroll cards
├─────────────────────┤
│ ← LOI Sent (1) →    │
│ [Deal]              │
├─────────────────────┤
│ ← Due Diligence (1) │
│ [Deal]              │
└─────────────────────┘
```

### Deal Detail Screen
```
┌─────────────────────┐
│ ←  Arlington Heights│
├─────────────────────┤
│ [Big Status Card]   │
│ Fundraising 72%     │
│ Progress bar        │
├─────────────────────┤
│ $2.5M / $3.2M       │
│ Key Stats Row       │
├─────────────────────┤
│ Actions             │
│ [Investors] [Docs]  │
│ [Capital] [Analytics│
├─────────────────────┤
│ Recent Activity     │
│ Timeline of events  │
└─────────────────────┘
```

## Design Principles

1. **Thumb Zones**: Primary actions in bottom 25% of screen
2. **Card-Based**: All content in scrollable cards
3. **Progressive Disclosure**: Show summary, tap for details
4. **Consistent Actions**: Same pattern save/close/cancel
5. **Offline-First**: Cache data, sync when connected
6. **Quick Actions**: 90% of tasks in 3 taps or less

## Responsive Breakpoints

- Mobile: < 768px (this architecture)
- Tablet: 768px - 1024px (hybrid)
- Desktop: > 1024px (full sidebar)

## Performance Targets

- First paint: < 1s
- Time to interactive: < 2s
- Route change: < 300ms
- Lighthouse score: > 90