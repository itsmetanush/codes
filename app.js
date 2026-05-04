const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const elements = {
  symbols: document.getElementById('symbols'),
  refreshBtn: document.getElementById('refreshBtn'),
  status: document.getElementById('status'),
  lastUpdated: document.getElementById('lastUpdated'),
  stockBody: document.getElementById('stockBody')
};

const formatCurrency = (value) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
    : '—';

const formatPercent = (value) =>
  Number.isFinite(value) ? `${value.toFixed(2)}%` : '—';

const normalizeSymbols = (input) =>
  [...new Set(input.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))];

const valueScore = (pe) => {
  if (!Number.isFinite(pe) || pe <= 0) return 0;
  return Math.max(0, 25 - pe) * 1.2;
};

const scoreStock = (stock) => {
  const targetUpside = Number.isFinite(stock.targetUpside) ? stock.targetUpside : 0;
  const dailyMomentum = Number.isFinite(stock.regularMarketChangePercent)
    ? stock.regularMarketChangePercent
    : 0;

  return targetUpside * 1.5 + dailyMomentum * 1.1 + valueScore(stock.trailingPE);
};

const renderRows = (stocks) => {
  elements.stockBody.innerHTML = '';

  stocks.forEach((stock, idx) => {
    const row = document.createElement('tr');

    const changeClass = stock.regularMarketChangePercent >= 0 ? 'positive' : 'negative';
    const targetClass = stock.targetUpside >= 0 ? 'positive' : 'negative';

    row.innerHTML = `
      <td>${idx + 1}</td>
      <td>${stock.symbol}</td>
      <td>${formatCurrency(stock.regularMarketPrice)}</td>
      <td class="${changeClass}">${formatPercent(stock.regularMarketChangePercent)}</td>
      <td>${Number.isFinite(stock.trailingPE) ? stock.trailingPE.toFixed(2) : '—'}</td>
      <td class="${targetClass}">${formatPercent(stock.targetUpside)}</td>
      <td>${stock.score.toFixed(2)}</td>
    `;

    elements.stockBody.appendChild(row);
  });
};

const fetchQuotes = async (symbols) => {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
    symbols.join(',')
  )}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  return payload?.quoteResponse?.result ?? [];
};

const refresh = async () => {
  const symbols = normalizeSymbols(elements.symbols.value);
  if (!symbols.length) {
    elements.status.textContent = 'Please enter at least one symbol.';
    elements.stockBody.innerHTML = '';
    return;
  }

  try {
    elements.status.textContent = 'Refreshing market data…';

    const quotes = await fetchQuotes(symbols);
    const ranked = quotes
      .map((q) => {
        const targetUpside =
          Number.isFinite(q.targetMeanPrice) && Number.isFinite(q.regularMarketPrice)
            ? ((q.targetMeanPrice - q.regularMarketPrice) / q.regularMarketPrice) * 100
            : NaN;

        const item = {
          symbol: q.symbol,
          regularMarketPrice: q.regularMarketPrice,
          regularMarketChangePercent: q.regularMarketChangePercent,
          trailingPE: q.trailingPE,
          targetUpside
        };

        return { ...item, score: scoreStock(item) };
      })
      .sort((a, b) => b.score - a.score);

    renderRows(ranked);
    elements.status.textContent = `Showing ${ranked.length} stocks. Auto-refresh every 15 minutes.`;
    elements.lastUpdated.textContent = `Last updated: ${new Date().toLocaleString()}`;
  } catch (error) {
    console.error(error);
    elements.status.textContent =
      'Could not load market data. This can happen if the data source blocks browser requests.';
  }
};

elements.refreshBtn.addEventListener('click', refresh);
setInterval(refresh, REFRESH_INTERVAL_MS);
refresh();

