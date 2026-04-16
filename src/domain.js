export function safeId(prefix = "id") {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${time}_${random}`;
}

export function calcPricePaid(priceInput, onnuriUsed) {
  const numeric = Number(priceInput) || 0;
  if (!onnuriUsed) return Math.round(numeric);
  return Math.round(numeric * 0.9);
}

export function wineLots(lots, wineId) {
  return lots.filter((lot) => lot.wineId === wineId);
}

export function totalQty(lotsForWine) {
  return lotsForWine.reduce((sum, lot) => sum + (Number(lot.remaining) || 0), 0);
}

export function avgCost(lotsForWine) {
  const activeLots = lotsForWine.filter((lot) => (Number(lot.remaining) || 0) > 0);

  const totalRemaining = activeLots.reduce(
    (sum, lot) => sum + (Number(lot.remaining) || 0),
    0
  );

  if (totalRemaining === 0) return 0;

  const weighted = activeLots.reduce((sum, lot) => {
    return sum + (Number(lot.remaining) || 0) * (Number(lot.pricePaid) || 0);
  }, 0);

  return Math.round(weighted / totalRemaining);
}

export function vintageSummary(lotsForWine) {
  const vintages = lotsForWine
    .filter((lot) => (Number(lot.remaining) || 0) > 0 && lot.vintage !== null && lot.vintage !== "")
    .map((lot) => Number(lot.vintage))
    .filter((value) => !Number.isNaN(value));

  const uniqueSorted = [...new Set(vintages)].sort((a, b) => a - b);

  return uniqueSorted;
}

export function computeSummary(lots, wineId) {
  const lotsForWine = wineLots(lots, wineId);
  return {
    totalQty: totalQty(lotsForWine),
    avgCost: avgCost(lotsForWine),
    vintages: vintageSummary(lotsForWine),
  };
}

export function fifoPlan(lotsForWine, count = 1) {
  const needed = Number(count) || 0;
  if (needed <= 0) return [];

  const candidates = lotsForWine
    .filter((lot) => (Number(lot.remaining) || 0) > 0)
    .slice()
    .sort((a, b) => {
      if (a.purchasedAt < b.purchasedAt) return -1;
      if (a.purchasedAt > b.purchasedAt) return 1;
      return String(a.id).localeCompare(String(b.id));
    });

  let rest = needed;
  const allocations = [];

  for (const lot of candidates) {
    if (rest <= 0) break;

    const available = Number(lot.remaining) || 0;
    const take = Math.min(available, rest);

    if (take > 0) {
      allocations.push({
        lotId: lot.id,
        wineId: lot.wineId,
        vintageSnapshot: lot.vintage ?? null,
        qty: take,
        purchasedAt: lot.purchasedAt,
        merchant: lot.merchant,
      });
      rest -= take;
    }
  }

  if (rest > 0) return null;
  return allocations;
}

export function applyFifo(lots, wineId, count = 1) {
  const lotsForWine = wineLots(lots, wineId);
  const plan = fifoPlan(lotsForWine, count);

  if (!plan) {
    return {
      ok: false,
      error: "재고가 부족합니다.",
      nextLots: lots,
      allocations: [],
    };
  }

  const deductionMap = plan.reduce((acc, item) => {
    acc[item.lotId] = (acc[item.lotId] || 0) + item.qty;
    return acc;
  }, {});

  const nextLots = lots.map((lot) => {
    if (!deductionMap[lot.id]) return lot;
    return {
      ...lot,
      remaining: Math.max(0, (Number(lot.remaining) || 0) - deductionMap[lot.id]),
    };
  });

  return {
    ok: true,
    error: null,
    nextLots,
    allocations: plan,
  };
}