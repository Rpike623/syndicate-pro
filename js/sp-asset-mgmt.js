/**
 * SP Asset Management
 */
window.AssetMgmt = {
  properties: [],
  init: function() {
    this.properties = [
      { name:'Sunset Apartments', type:'Multifamily', units:100, occupancy:96, noi:850000, capRate:5.8, value:14500000 },
      { name:'Downtown Office', type:'Office', units:50, occupancy:88, noi:620000, capRate:6.5, value:9200000 },
      { name:'Industrial Portfolio', type:'Industrial', units:3, occupancy:100, noi:1400000, capRate:6.2, value:21000000 },
      { name:'Coastal Retail', type:'Retail', units:12, occupancy:92, noi:480000, capRate:6.8, value:7100000 }
    ];
    this.render();
  },
  render: function() {
    new Chart(document.getElementById('assetChart').getContext('2d'), {
      type:'doughnut',
      data:{ labels:this.properties.map(p => p.name), datasets:[{ data:this.properties.map(p => p.value), backgroundColor:['#6366f1','#22c55e','#f59e0b','#ef4444'] }] },
      options:{ plugins:{ legend:{ position:'right' } } }
    });
    document.getElementById('perfList').innerHTML = this.properties.map(p => `<div class="perf-item"><strong>${p.name}</strong><span>${p.occupancy}% occupied</span></div>`).join('');
    document.getElementById('metricsTable').innerHTML = this.properties.map(p => `<tr><td>${p.name}</td><td>${p.type}</td><td class="text-success">${p.occupancy}%</td><td>$${(p.noi/1000).toFixed(0)}K</td><td>${p.capRate}%</td><td>$${(p.value/1000000).toFixed(1)}M</td></tr>`).join('');
  }
};
