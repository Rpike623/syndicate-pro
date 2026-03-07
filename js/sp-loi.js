/**
 * SP LOI Generator
 */
window.LOI = {
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  generate: function() {
    const buyer = document.getElementById('loiBuyer').value;
    const seller = document.getElementById('loiSeller').value;
    const prop = document.getElementById('loiProperty').value;
    const price = parseInt(document.getElementById('loiPrice').value) || 0;
    const due = document.getElementById('loiDue').value;
    const close = document.getElementById('loiClose').value;
    const earnest = parseInt(document.getElementById('loiEarnest').value) || 0;
    const today = new Date().toLocaleDateString();
    document.getElementById('loiPreview').textContent = `LETTER OF INTENT

Date: ${today}

${buyer} ("Buyer") proposes to acquire from ${seller} ("Seller") the following property:

PROPERTY: ${prop}
PURCHASE PRICE: ${this.f(price)}

TERMS:
1. Earnest Money Deposit: ${this.f(earnest)} (to be deposited within 5 business days)
2. Due Diligence Period: ${due} days from contract execution
3. Closing: Within ${close} days of expiration of due diligence
4. Financing: Buyer to obtain financing or close with cash

The Purchase Price shall be adjusted for prorations at closing including (but not limited to) taxes, utilities, and rents.

This LOI is non-binding and is intended solely as a summary of the proposed terms. A formal Purchase and Sale Agreement shall be prepared by Seller's attorney.

ACCEPTED AND AGREED:

_______________________          _______________________
${buyer} (Buyer)                 ${seller} (Seller)
Date:                           Date:`;
  }
};