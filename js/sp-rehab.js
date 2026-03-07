/**
 * SP Rehab Estimator
 */
window.Rehab = {
  init: function() { this.calc(); },
  calc: function() {
    const kitchen = parseFloat(document.getElementById('reKitchen').value) || 0;
    const bath = parseFloat(document.getElementById('reBath').value) || 0;
    const floor = parseFloat(document.getElementById('reFloor').value) || 0;
    const paint = parseFloat(document.getElementById('rePaint').value) || 0;
    const units = parseFloat(document.getElementById('reUnits').value) || 0;
    const sqft = parseFloat(document.getElementById('reSqft').value) || 0;
    const kTotal = kitchen * units;
    const bTotal = bath * units;
    const fTotal = floor * sqft * units;
    const pTotal = paint * sqft * units;
    const total = kTotal + bTotal + fTotal + pTotal;
    const fmt = v => '$' + Math.round(v).toLocaleString();
    document.getElementById('reSummary').innerHTML = `<table style="width:100%"><tr><td>Kitchen</td><td>${fmt(kTotal)}</td></tr><tr><td>Bath</td><td>${fmt(bTotal)}</td></tr><tr><td>Flooring</td><td>${fmt(fTotal)}</td></tr><tr><td>Paint</td><td>${fmt(pTotal)}</td></tr><tr style="font-weight:bold"><td>Total</td><td>${fmt(total)}</td></tr><tr><td>Per Unit</td><td>${fmt(total/units)}</td></tr><tr><td>Per Sqft</td><td>${fmt(total/(units*sqft))}</td></tr></table>`;
  }
};