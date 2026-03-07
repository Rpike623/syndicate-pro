/**
 * SP Tax Calendar
 */
window.TaxCal = {
  init: function() {
    const y = new Date().getFullYear();
    const deadlines = [
      { date:`${y}-03-31`, form:'K-1s', jurisdiction:'Federal', property:'All', status:'upcoming' },
      { date:`${y}-04-15`, form:'Personal Extension', jurisdiction:'Federal', property:'N/A', status:'upcoming' },
      { date:`${y}-04-30`, form:'State K-1s', jurisdiction:'TX', property:'All', status:'upcoming' },
      { date:`${y}-05-01`, form:'Property Tax', jurisdiction:'County', property:'Sunset Apartments', status:'pending' },
      { date:`${y}-06-15`, form:'Partnership Extension', jurisdiction:'Federal', property:'All', status:'pending' },
      { date:`${y}-09-15`, form:'Partnership Return', jurisdiction:'Federal', property:'All', status:'pending' },
      { date:`${y}-10-15`, form:'Extended Return', jurisdiction:'Federal', property:'All', status:'pending' }
    ];
    document.getElementById('taxCal').innerHTML = deadlines.map(d => `<tr><td>${new Date(d.date).toLocaleDateString()}</td><td>${d.form}</td><td>${d.jurisdiction}</td><td>${d.property}</td><td><span class="badge badge-${d.status==='upcoming'?'warning':'secondary'}">${d.status}</span></td></tr>`).join('');
  }
};