/**
 * SP PM Agreement Generator
 */
window.PM = {
  generate: function() {
    const prop = document.getElementById('pmProperty').value;
    const co = document.getElementById('pmCompany').value;
    const fee = document.getElementById('pmFee').value;
    const lease = document.getElementById('pmLeasing').value;
    const term = document.getElementById('pmTerm').value;
    const today = new Date().toLocaleDateString();
    document.getElementById('pmPreview').textContent = `PROPERTY MANAGEMENT AGREEMENT

Date: ${today}

PARTIES: Owner ("Client") and ${co} ("Manager")

PROPERTY: ${prop}

1. TERM: This Agreement shall be effective for a period of ${term} months from the date above.

2. MANAGEMENT FEE: Client agrees to pay Manager a monthly management fee equal to ${fee}% of gross collected revenue.

3. LEASING FEE: Manager shall receive a leasing fee equal to ${lease}% of the first year's rent for any new tenant procured.

4. DUTIES: Manager shall:
   - Collect rent and other income
   - Pay bills and expenses from operating account
   - Maintain property in good condition
   - Screen and lease tenants
   - Provide monthly financial reports

5. INSURANCE: Manager shall maintain liability insurance and name Client as additional insured.

6. TERMINATION: Either party may terminate with 30 days written notice.

7. ACCOUNTING: Manager shall provide monthly operating statements and annual year-end reports.

_______________________          _______________________
${co} (Manager)                 Owner (Client)`;
  }
};