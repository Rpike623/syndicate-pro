/**
 * GP Dashboard V3
 */
window.Dash = {
  init: function() {
    new Chart(document.getElementById('aumTrend').getContext('2d'), {
      type:'line',
      data:{ labels:['Q1','Q2','Q3','Q4','Q1'], datasets:[{ label:'AUM', data:[42,45,47,50,52.6], borderColor:'#6366f1', fill:true, backgroundColor:'rgba(99,102,241,0.1)' }] },
      options:{ plugins:{legend:{display:false}}, scales:{y:{ticks:{callback:v=>'$'+v+'M'}}} }
    });
    new Chart(document.getElementById('dealPerf').getContext('2d'), {
      type:'bar',
      data:{ labels:['Industrial','Sunset','Office','Retail'], datasets:[{ label:'IRR %', data:[16.8,18.5,14.2,12.5], backgroundColor:'#6366f1' }] },
      options:{ plugins:{legend:{display:false}}, scales:{y:{ticks:{callback:v=>v+'%'}}} }
    });
  }
};
