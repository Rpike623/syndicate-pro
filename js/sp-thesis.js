/**
 * SP Investment Thesis
 */
window.Thesis = {
  init: function() { this.preview(); },
  f: function(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v); },
  preview: function() {
    const name = document.getElementById('tName').value;
    const cls = document.getElementById('tClass').value;
    const price = parseInt(document.getElementById('tPrice').value)||0;
    const sf = parseInt(document.getElementById('tSf').value)||0;
    const priceSf = Math.round(price/sf);
    document.getElementById('previewContent').innerHTML = `<h3>${name}</h3><p class="text-muted">${cls}</p><hr><p><strong>Purchase Price:</strong> ${this.f(price)}</p><p><strong>Price/SF:</strong> $${priceSf}</p><hr><h4>Investment Thesis</h4><p>${document.getElementById('tStrategy').value}</p><h4>Market Opportunity</h4><p>${document.getElementById('tMarket').value}</p><h4>Exit Strategy</h4><p>${document.getElementById('tExit').value}</p><h4>Risk Factors</h4><p>${document.getElementById('tRisks').value}</p>`;
  },
  save: function() { alert('Thesis saved!'); SP.save('thesis', document.getElementById('tName').value); },
  export: function() {
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Investment Thesis</title><style>body{font-family:-apple-system,sans-serif;max-width:800px;margin:40px auto;padding:20px;}h1{color:#6366f1}hr{border:1px solid #eee;margin:20px 0;}</style></head><body>${document.getElementById('previewContent').innerHTML}</body></html>`);
    win.document.close(); setTimeout(() => win.print(), 500);
  }
};
