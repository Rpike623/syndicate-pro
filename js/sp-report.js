/**
 * SP Quarterly Report Builder
 */
window.Report = {
  preview: function() {
    const q = document.getElementById('qQuarter').value;
    const deal = document.getElementById('qDeal').value;
    document.getElementById('previewTitle').textContent = q + ' 2026';
  },
  export: function() {
    const content = document.getElementById('reportPreview').innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Quarterly Report</title><style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
      .report-header { text-align: center; border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px; }
      .report-header h1 { margin: 0; color: #1e293b; }
      .report-header h2 { margin: 8px 0 0; color: #6366f1; font-weight: 400; }
      .report-section { margin-bottom: 30px; }
      .report-section h3 { color: #6366f1; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
      .report-table table { width: 100%; border-collapse: collapse; }
      .report-table th, .report-table td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
      .report-table th { background: #f8fafc; }
      .property-summary { display: grid; gap: 12px; }
      .ps-card { background: #f8fafc; padding: 16px; border-radius: 8px; }
      .ps-card h4 { margin: 0 0 4px; }
      .ps-card p { margin: 0; color: #64748b; font-size: 14px; }
    </style></head><body>${content}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  }
};
