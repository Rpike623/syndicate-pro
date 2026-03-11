# Email Deliverability: SPF/DKIM/DMARC for deeltrack.com

Emails from admin@deeltrack.com are going to junk folders. These DNS records fix that.

## Where to add: GoDaddy DNS Manager for deeltrack.com

### 1. SPF Record (tells receivers which servers can send for deeltrack.com)

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | @ | `v=spf1 include:spf.protection.outlook.com -all` | 1 hour |

> If an SPF record already exists, add `include:spf.protection.outlook.com` before the `-all`.

### 2. DKIM Records (Microsoft 365 signs outgoing emails)

Generate these in Microsoft 365 Admin Center:
1. Go to https://security.microsoft.com/dkimv2
2. Select `deeltrack.com`
3. Click "Enable" → Microsoft will show you two CNAME records
4. Add them in GoDaddy:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | selector1._domainkey | `selector1-deeltrack-com._domainkey.deeltrack.onmicrosoft.com` | 1 hour |
| CNAME | selector2._domainkey | `selector2-deeltrack-com._domainkey.deeltrack.onmicrosoft.com` | 1 hour |

> The exact values may differ — use what Microsoft 365 shows you.

### 3. DMARC Record (tells receivers what to do with failed SPF/DKIM)

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | _dmarc | `v=DMARC1; p=quarantine; ruf=mailto:admin@deeltrack.com; pct=100` | 1 hour |

> Start with `p=quarantine` (sends failures to spam). After 2 weeks of clean reports, change to `p=reject`.

## Verification

After adding records, wait 1-2 hours, then verify:
- SPF: `nslookup -type=txt deeltrack.com`
- DKIM: `nslookup -type=cname selector1._domainkey.deeltrack.com`
- DMARC: `nslookup -type=txt _dmarc.deeltrack.com`

Or use: https://mxtoolbox.com/emailhealth/deeltrack.com

## Current Problem

Without these records, Microsoft 365 sends emails from admin@deeltrack.com but:
- Gmail marks them as spam (no SPF alignment)
- Outlook/Hotmail may reject them (no DKIM signature)
- Any receiver can spoof deeltrack.com emails (no DMARC policy)
