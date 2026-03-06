document.addEventListener('DOMContentLoaded', () => {
  const tierChart = document.getElementById('tier-chart');
  const tierLegend = document.getElementById('tier-legend');
  const explainerCards = document.getElementById('explainer-cards');
  const heroSummary = {
    totalProceeds: document.getElementById('total-proceeds'),
    gpMultiple: document.getElementById('gp-multiple'),
    lpMultiple: document.getElementById('lp-multiple')
  };
  const summaryFields = {
    gpIrr: document.getElementById('gp-irr'),
    lpIrr: document.getElementById('lp-irr'),
    residualSplit: document.getElementById('residual-split')
  };

  const inputs = {
    totalEquity: document.getElementById('total-equity'),
    exitMultiple: document.getElementById('exit-multiple'),
    prefReturn: document.getElementById('pref-return'),
    holdPeriod: document.getElementById('hold-period'),
    waterfallType: document.getElementById('waterfall-type'),
    gpPromote: document.getElementById('gp-promote'),
    catchupRate: document.getElementById('catchup-rate')
  };

  const colors = ['#2563eb', '#10b981', '#f59e0b', '#c026d3'];

  function formatCurrency(value) {
    return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  function formatPercent(value) {
    return `${value.toFixed(1)}%`;
  }

  function renderTierChart(data) {
    tierChart.innerHTML = '';
    tierLegend.innerHTML = '';

    data.waterfall.forEach((tier, index) => {
      const bar = document.createElement('div');
      bar.className = 'tier-bar';
      bar.style.setProperty('--tier-color', colors[index % colors.length]);
      bar.innerHTML = `
        <div class="tier-label">
          <span>${tier.name}</span>
          <strong>${formatCurrency(tier.total)}</strong>
        </div>
        <div class="bar-fill" style="width:${Math.min(100, (tier.total / data.summary.totalProceeds) * 100)}%; background:linear-gradient(90deg, var(--tier-color) 0%, rgba(15,23,42,0.6) 100%);"></div>
        <div class="tier-split">
          <span>GP ${formatCurrency(tier.gp)}</span>
          <span>LP ${formatCurrency(tier.lp)}</span>
        </div>
      `;
      tierChart.appendChild(bar);

      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      legendItem.innerHTML = `<span class="legend-dot" style="background:${colors[index % colors.length]}"></span>${tier.name}`;
      tierLegend.appendChild(legendItem);
    });
  }

  function renderExplainerCards(data) {
    explainerCards.innerHTML = '';

    data.waterfall.forEach((tier) => {
      const card = document.createElement('article');
      card.className = 'explainer-card';
      card.innerHTML = `
        <div class="card-title">
          <span>${tier.name}</span>
          <strong>${formatCurrency(tier.total)}</strong>
        </div>
        <p>${tier.description}</p>
        <div class="card-split">
          <span>GP: ${formatCurrency(tier.gp)}</span>
          <span>LP: ${formatCurrency(tier.lp)}</span>
        </div>
      `;
      explainerCards.appendChild(card);
    });
  }

  function renderSummary(data) {
    heroSummary.totalProceeds.textContent = formatCurrency(data.summary.totalProceeds);
    heroSummary.gpMultiple.textContent = `${data.summary.gpMultiple.toFixed(2)}x`;
    heroSummary.lpMultiple.textContent = `${data.summary.lpMultiple.toFixed(2)}x`;
    summaryFields.gpIrr.textContent = formatPercent(data.summary.gpIRR);
    summaryFields.lpIrr.textContent = formatPercent(data.summary.lpIRR);
    const gpSplit = (data.summary.gpTotal / data.summary.totalProceeds) * 100;
    const lpSplit = (data.summary.lpTotal / data.summary.totalProceeds) * 100;
    summaryFields.residualSplit.textContent = `${gpSplit.toFixed(1)}% / ${lpSplit.toFixed(1)}%`;
  }

  function calculateWaterfall() {
    const deal = {
      totalEquity: Number(inputs.totalEquity.value) || 0,
      gpEquityPct: 10,
      lpEquityPct: 90,
      prefReturn: Number(inputs.prefReturn.value) || 0,
      gpPromotePct: Number(inputs.gpPromote.value) || 0,
      catchupRate: Number(inputs.catchupRate.value) || 0,
      exitMultiple: Number(inputs.exitMultiple.value) || 1,
      holdPeriod: Number(inputs.holdPeriod.value) || 1,
      waterfallType: inputs.waterfallType.value
    };

    const result = WaterfallCalculator.calculate(deal);
    renderTierChart(result);
    renderExplainerCards(result);
    renderSummary(result);
  }

  Object.values(inputs).forEach((input) => {
    input.addEventListener('input', calculateWaterfall);
  });

  calculateWaterfall();
});
