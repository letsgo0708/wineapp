import React, { useMemo, useState } from "react";
import {
  safeId,
  calcPricePaid,
  wineLots,
  computeSummary,
  fifoPlan,
  applyFifo,
} from "./domain";

const seedWines = [
  { id: "wine_1", type: "red", name: "Domaine A Pinot Noir" },
  { id: "wine_2", type: "white", name: "Cloudy Bay Sauvignon Blanc" },
  { id: "wine_3", type: "champagne", name: "Billecart-Salmon Brut Réserve" },
];

const seedLots = [
  {
    id: "lot_1",
    wineId: "wine_1",
    vintage: 2018,
    merchant: "코스트코",
    purchasedAt: "2024-10-12",
    qty: 2,
    remaining: 1,
    priceInput: 52000,
    onnuriUsed: true,
    discountRate: 0.9,
    pricePaid: 46800,
    memo: "온누리 적용",
  },
  {
    id: "lot_2",
    wineId: "wine_1",
    vintage: 2016,
    merchant: "동네 와인샵",
    purchasedAt: "2025-01-25",
    qty: 1,
    remaining: 1,
    priceInput: 61000,
    onnuriUsed: false,
    discountRate: 0.9,
    pricePaid: 61000,
    memo: "",
  },
  {
    id: "lot_3",
    wineId: "wine_2",
    vintage: 2023,
    merchant: "와인앤모어",
    purchasedAt: "2025-02-03",
    qty: 2,
    remaining: 2,
    priceInput: 31000,
    onnuriUsed: false,
    discountRate: 0.9,
    pricePaid: 31000,
    memo: "",
  },
  {
    id: "lot_4",
    wineId: "wine_3",
    vintage: null,
    merchant: "신세계백화점",
    purchasedAt: "2024-12-20",
    qty: 1,
    remaining: 1,
    priceInput: 89000,
    onnuriUsed: true,
    discountRate: 0.9,
    pricePaid: 80100,
    memo: "연말용",
  },
  {
    id: "lot_5",
    wineId: "wine_2",
    vintage: 2022,
    merchant: "코스트코",
    purchasedAt: "2024-11-02",
    qty: 1,
    remaining: 0,
    priceInput: 29000,
    onnuriUsed: true,
    discountRate: 0.9,
    pricePaid: 26100,
    memo: "이미 마심",
  },
];

const seedDrinkLogs = [
  {
    id: "drink_1",
    wineId: "wine_1",
    drankAt: "2024-12-24T19:30",
    place: "집",
    pairing: "스테이크",
    rating: 4,
    repurchase: "yes",
    memo: "밸런스 좋고 향이 깨끗함.",
    lotId: "lot_1",
    vintageSnapshot: 2018,
  },
];

const seedMerchants = [
  { id: "merchant_1", name: "코스트코" },
  { id: "merchant_2", name: "새마을구판장" },
  { id: "merchant_3", name: "동탄1 세븐일레븐" },
  { id: "merchant_4", name: "신세계백화점" },
];

const typeLabels = {
  red: "레드",
  white: "화이트",
  champagne: "샴페인",
};

function normalizeWineKey(name, type) {
  return `${String(name).trim().toLowerCase()}__${String(type).trim().toLowerCase()}`;
}

function formatCurrency(value) {
  if (!value) return "—";
  return `₩${Number(value).toLocaleString("ko-KR")}`;
}

function formatVintage(vintage) {
  if (vintage === null || vintage === "" || typeof vintage === "undefined") return "—";
  return String(vintage);
}

function formatDate(dateString) {
  if (!dateString) return "—";
  return dateString;
}

function formatDateTime(dateTimeString) {
  if (!dateTimeString) return "—";
  return dateTimeString.replace("T", " ");
}

function App() {
  const [wines, setWines] = useState(seedWines);
  const [lots, setLots] = useState(seedLots);
  const [drinkLogs, setDrinkLogs] = useState(seedDrinkLogs);
  const [merchants, setMerchants] = useState(seedMerchants);

  const [activeType, setActiveType] = useState("red");
  const [selectedWineId, setSelectedWineId] = useState(null);
  const [modal, setModal] = useState(null);

  const selectedWine = useMemo(
    () => wines.find((wine) => wine.id === selectedWineId) || null,
    [wines, selectedWineId]
  );

  const visibleWines = useMemo(() => {
    return wines
      .map((wine) => {
        const summary = computeSummary(lots, wine.id);
        return { ...wine, summary };
      })
      .filter((wine) => wine.type === activeType)
      .sort((a, b) => {
        if (a.summary.avgCost !== b.summary.avgCost) {
          return a.summary.avgCost - b.summary.avgCost;
        }
        return a.name.localeCompare(b.name);
      });
  }, [wines, lots, activeType]);

  const selectedWineLots = useMemo(() => {
    if (!selectedWineId) return [];
    return wineLots(lots, selectedWineId)
      .slice()
      .sort((a, b) => {
        if (a.purchasedAt < b.purchasedAt) return -1;
        if (a.purchasedAt > b.purchasedAt) return 1;
        return String(a.id).localeCompare(String(b.id));
      });
  }, [lots, selectedWineId]);

  const selectedWineDrinkLogs = useMemo(() => {
    if (!selectedWineId) return [];
    return drinkLogs
      .filter((log) => log.wineId === selectedWineId)
      .slice()
      .sort((a, b) => String(b.drankAt).localeCompare(String(a.drankAt)));
  }, [drinkLogs, selectedWineId]);

  const selectedSummary = useMemo(() => {
    if (!selectedWineId) return { totalQty: 0, avgCost: 0, vintages: [] };
    return computeSummary(lots, selectedWineId);
  }, [lots, selectedWineId]);

  const openModal = (name) => setModal(name);
  const closeModal = () => setModal(null);

  function addWine(form) {
    const normalized = normalizeWineKey(form.name, form.type);
    const exists = wines.some(
      (wine) => normalizeWineKey(wine.name, wine.type) === normalized
    );

    if (exists) {
      return {
        ok: false,
        error: "이미 등록된 와인입니다. 기존 와인 상세에서 '구입 추가'를 이용해주세요.",
      };
    }

    const newWine = {
      id: safeId("wine"),
      type: form.type,
      name: form.name.trim(),
    };

    setWines((prev) => [...prev, newWine]);
    setSelectedWineId(newWine.id);
    setActiveType(newWine.type);
    closeModal();

    return { ok: true, error: null };
  }

  function addLot(form) {
    if (!selectedWineId) {
      return { ok: false, error: "선택된 와인이 없습니다." };
    }

    const qty = Number(form.qty);
    const priceInput = Number(form.priceInput);
    const vintage =
      form.vintage === "" || form.vintage === null ? null : Number(form.vintage);
    const pricePaid = calcPricePaid(priceInput, form.onnuriUsed);

    const newLot = {
      id: safeId("lot"),
      wineId: selectedWineId,
      vintage,
      merchant: form.merchant,
      purchasedAt: form.purchasedAt,
      qty,
      remaining: qty,
      priceInput,
      onnuriUsed: form.onnuriUsed,
      discountRate: 0.9,
      pricePaid,
      memo: form.memo.trim(),
    };

    setLots((prev) => [...prev, newLot]);
    closeModal();

    return { ok: true, error: null };
  }

  function drinkOneBottle(form) {
    if (!selectedWineId) {
      return { ok: false, error: "선택된 와인이 없습니다." };
    }

    const result = applyFifo(lots, selectedWineId, 1);

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    const picked = result.allocations[0];
    if (!picked) {
      return { ok: false, error: "차감할 로트를 찾을 수 없습니다." };
    }

    const newLog = {
      id: safeId("drink"),
      wineId: selectedWineId,
      drankAt: form.drankAt,
      place: form.place.trim(),
      pairing: form.pairing.trim(),
      rating: Number(form.rating),
      repurchase: form.repurchase,
      memo: form.memo.trim(),
      lotId: picked.lotId,
      vintageSnapshot: picked.vintageSnapshot ?? null,
    };

    setLots(result.nextLots);
    setDrinkLogs((prev) => [newLog, ...prev]);
    closeModal();

    return { ok: true, error: null };
  }

  function addMerchant(form) {
    const name = form.name.trim();
    const exists = merchants.some(
      (merchant) => merchant.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      return { ok: false, error: "이미 등록된 구입처입니다." };
    }

    const newMerchant = {
      id: safeId("merchant"),
      name,
    };

    setMerchants((prev) => [...prev, newMerchant]);

    return { ok: true, error: null };
  }

  function updateMerchant(id, form) {
    const name = form.name.trim();

    if (!name) {
      return { ok: false, error: "구입처 이름을 입력해주세요." };
    }

    const exists = merchants.some(
      (merchant) =>
        merchant.id !== id &&
        merchant.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      return { ok: false, error: "이미 등록된 구입처입니다." };
    }

    setMerchants((prev) =>
      prev.map((merchant) =>
        merchant.id === id ? { ...merchant, name } : merchant
      )
    );

    return { ok: true, error: null };
  }

  function deleteMerchant(id) {
    setMerchants((prev) => prev.filter((merchant) => merchant.id !== id));
    return { ok: true, error: null };
  }



  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto min-h-screen max-w-md bg-zinc-950">
        {!selectedWine ? (
          <WineListScreen
            activeType={activeType}
            setActiveType={setActiveType}
            wines={visibleWines}
            onSelectWine={setSelectedWineId}
            onOpenWineModal={() => openModal("wine")}
            onOpenMerchantModal={() => openModal("merchant")}
          />
        ) : (
          <WineDetailScreen
            wine={selectedWine}
            lots={selectedWineLots}
            drinkLogs={selectedWineDrinkLogs}
            summary={selectedSummary}
            onBack={() => setSelectedWineId(null)}
            onOpenLotModal={() => openModal("lot")}
            onOpenDrinkModal={() => openModal("drink")}
            onOpenMerchantModal={() => openModal("merchant")}
          />
        )}

        {modal === "wine" && (
          <WineModal onClose={closeModal} onSubmit={addWine} />
        )}

        {modal === "lot" && selectedWine && (
          <LotModal
            wine={selectedWine}
            merchants={merchants}
            onClose={closeModal}
            onSubmit={addLot}
          />
        )}

        {modal === "drink" && selectedWine && (
          <DrinkModal
            wine={selectedWine}
            lots={selectedWineLots}
            onClose={closeModal}
            onSubmit={drinkOneBottle}
          />
        )}

         {modal === "merchant" && (
          <MerchantModal
            merchants={merchants}
            onClose={closeModal}
            onAdd={addMerchant}
            onUpdate={updateMerchant}
            onDelete={deleteMerchant}
          />
        )}
      </div>
    </div>
  );
}





function WineListScreen({
  activeType,
  setActiveType,
  wines,
  onSelectWine,
  onOpenWineModal,
  onOpenMerchantModal,
}) {
  return (
    <div className="pb-24">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="px-4 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Wine Inventory
              </p>
              <h1 className="mt-1 text-xl font-semibold">1인용 와인 재고정리</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onOpenMerchantModal}
                className="rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-100"
              >
                구입처
              </button>
              <button
                onClick={onOpenWineModal}
                className="rounded-xl bg-rose-500 px-3 py-2 text-sm font-medium text-white"
              >
                + 와인 추가
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {["red", "white", "champagne"].map((type) => {
              const active = activeType === type;
              return (
                <button
                  key={type}
                  onClick={() => setActiveType(type)}
                  className={`rounded-2xl px-3 py-3 text-sm font-medium ${
                    active
                      ? "bg-zinc-100 text-zinc-950"
                      : "bg-zinc-900 text-zinc-300"
                  }`}
                >
                  {typeLabels[type]}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="space-y-3 px-4 pt-4">
        {wines.length === 0 ? (
          <EmptyState
            title="이 타입의 와인이 없어요."
            description="새 와인을 추가해 재고 관리를 시작해보세요."
          />
        ) : (
          wines.map((wine) => {
  const isOutOfStock = wine.summary.totalQty === 0;

  return (
    <button
      key={wine.id}
      onClick={() => onSelectWine(wine.id)}
      className={`w-full rounded-3xl border p-4 text-left shadow-sm transition ${
        isOutOfStock
          ? "border-zinc-800 bg-zinc-900/60 text-zinc-300"
          : "border-zinc-800 bg-zinc-900"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-tight">{wine.name}</p>
          <p className="mt-1 text-sm text-zinc-400">{typeLabels[wine.type]}</p>
        </div>

        <div
          className={`rounded-full px-3 py-1 text-xs ${
            isOutOfStock
              ? "bg-zinc-800 text-zinc-400"
              : "bg-zinc-800 text-zinc-300"
          }`}
        >
          {isOutOfStock ? "재고 없음" : `${wine.summary.totalQty}병`}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <InfoTile
          label="빈티지"
          value={
            wine.summary.vintages.length
              ? wine.summary.vintages.join(" · ")
              : "—"
          }
        />
        <InfoTile
          label="평균 보유원가"
          value={formatCurrency(wine.summary.avgCost)}
        />
      </div>
    </button>
  );
})
        )}
      </main>
    </div>
  );
}

function WineDetailScreen({
  wine,
  lots,
  drinkLogs,
  summary,
  onBack,
  onOpenLotModal,
  onOpenDrinkModal,
  onOpenMerchantModal,
}) {
  const hasStock = summary.totalQty > 0;

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="px-4 pb-4 pt-5">
          <button
            onClick={onBack}
            className="mb-4 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-100"
          >
            ← 뒤로가기
          </button>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              {typeLabels[wine.type]}
            </p>
            <h1 className="mt-1 text-xl font-semibold">{wine.name}</h1>
            <p className="mt-2 text-sm text-zinc-400">
              보유 빈티지: {summary.vintages.length ? summary.vintages.join(" · ") : "—"}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <SummaryCard label="총 보유수량" value={`${summary.totalQty}병`} />
            <SummaryCard label="평균 보유원가" value={formatCurrency(summary.avgCost)} />
            <SummaryCard label="차감 방식" value="FIFO" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={onOpenLotModal}
              className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-medium text-white"
            >
              + 구입 추가
            </button>
            <button
              onClick={onOpenDrinkModal}
              disabled={!hasStock}
              className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                hasStock
                  ? "bg-rose-500 text-white"
                  : "bg-zinc-800 text-zinc-500"
              }`}
            >
              🍷 마심 처리
            </button>
          </div>
        </div>
      </header>

      <main className="space-y-6 px-4 pt-4">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">구입 로트</h2>
            <span className="text-xs text-zinc-500">오래된 순</span>
          </div>

          <div className="space-y-3">
            {lots.length === 0 ? (
              <EmptyState
                title="아직 등록된 구입 기록이 없어요."
                description="구입 추가로 첫 로트를 등록해보세요."
              />
            ) : (
              lots.map((lot) => (
                <div
                  key={lot.id}
                  className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-zinc-400">빈티지</p>
                      <p className="mt-1 font-medium">{formatVintage(lot.vintage)}</p>
                    </div>
                    <div className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                      {lot.remaining} / {lot.qty}병
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <InfoTile label="구입처" value={lot.merchant || "—"} />
                    <InfoTile label="구입일" value={formatDate(lot.purchasedAt)} />
                    <InfoTile label="실지불가" value={formatCurrency(lot.pricePaid)} />
                    <InfoTile label="온누리" value={lot.onnuriUsed ? "적용" : "미적용"} />
                  </div>

                  <div className="mt-3">
                    <p className="text-xs text-zinc-500">메모</p>
                    <p className="mt-1 text-sm text-zinc-300">{lot.memo || "—"}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">마신 기록</h2>
            <span className="text-xs text-zinc-500">최신순</span>
          </div>

          <div className="space-y-3">
            {drinkLogs.length === 0 ? (
              <EmptyState
                title="아직 마신 기록이 없어요."
                description="마심 처리 후 기록이 여기에 쌓여요."
              />
            ) : (
              drinkLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-zinc-500">빈티지 snapshot</p>
                      <p className="mt-1 font-medium">{formatVintage(log.vintageSnapshot)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-500">마신 시각</p>
                      <p className="mt-1 text-sm">{formatDateTime(log.drankAt)}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <InfoTile label="장소" value={log.place || "—"} />
                    <InfoTile label="페어링" value={log.pairing || "—"} />
                    <InfoTile label="평점" value={`${log.rating} / 5`} />
                    <InfoTile
                      label="재구매 의사"
                      value={
                        log.repurchase === "yes"
                          ? "예"
                          : log.repurchase === "no"
                          ? "아니오"
                          : "미정"
                      }
                    />
                  </div>

                  <div className="mt-3">
                    <p className="text-xs text-zinc-500">메모</p>
                    <p className="mt-1 text-sm text-zinc-300">{log.memo || "—"}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

      </main>
    </div>
  );
}

function WineModal({ onClose, onSubmit }) {
  const [type, setType] = useState("red");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function handleSave(event) {
    event.preventDefault();

    if (!name.trim()) {
      setError("와인 이름을 입력해주세요.");
      return;
    }

    const result = onSubmit({ type, name });
    if (!result.ok) {
      setError(result.error);
    }
  }

  return (
    <ModalShell title="와인 추가" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm text-zinc-300">타입</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base"
          >
            <option value="red">레드</option>
            <option value="white">화이트</option>
            <option value="champagne">샴페인</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">이름</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: Domaine A Pinot Noir"
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base"
          />
        </div>

        {error ? <ErrorText text={error} /> : null}

        <ModalActions onClose={onClose} submitLabel="저장" />
      </form>
    </ModalShell>
  );
}

function LotModal({ wine, merchants, onClose, onSubmit }) {
  const today = new Date().toISOString().slice(0, 10);

  const [merchant, setMerchant] = useState(merchants[0]?.name || "");
  const [purchasedAt, setPurchasedAt] = useState(today);
  const [vintage, setVintage] = useState("");
  const [qty, setQty] = useState(1);
  const [priceInput, setPriceInput] = useState("");
  const [onnuriUsed, setOnnuriUsed] = useState(false);
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");

  const pricePreview = calcPricePaid(priceInput, onnuriUsed);

  function handleSave(event) {
    event.preventDefault();

    if (!merchant.trim()) {
      setError("구입처를 선택하거나 입력해주세요.");
      return;
    }
    if (!purchasedAt) {
      setError("구입일을 입력해주세요.");
      return;
    }
    if (!Number.isInteger(Number(qty)) || Number(qty) < 1) {
      setError("수량은 1 이상의 정수여야 합니다.");
      return;
    }
    if (priceInput === "" || Number(priceInput) < 0) {
      setError("가격은 0 이상의 숫자여야 합니다.");
      return;
    }
    if (vintage !== "" && !Number.isInteger(Number(vintage))) {
      setError("빈티지는 비워두거나 정수로 입력해주세요.");
      return;
    }

    const result = onSubmit({
      merchant: merchant.trim(),
      purchasedAt,
      vintage,
      qty: Number(qty),
      priceInput: Number(priceInput),
      onnuriUsed,
      memo,
    });

    if (!result.ok) {
      setError(result.error);
    }
  }

  return (
    <ModalShell title={`구입 추가 · ${wine.name}`} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-300">
          로트 = 같은 조건으로 한 번에 산 구입 묶음
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">구입처</label>
          <select
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base"
          >
            {merchants.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">구입일</label>
          <input
            type="date"
            value={purchasedAt}
            onChange={(e) => setPurchasedAt(e.target.value)}
            className="block w-full appearance-none rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">빈티지 (선택)</label>
          <input
            inputMode="numeric"
            value={vintage}
            onChange={(e) => setVintage(e.target.value)}
            placeholder="예: 2018"
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 block text-sm text-zinc-300">수량(병)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">가격(병당)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="예: 52000"
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base"
            />
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <input
            type="checkbox"
            checked={onnuriUsed}
            onChange={(e) => setOnnuriUsed(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm">온누리상품권 10% 할인 적용</span>
        </label>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">실지불가 미리보기</p>
          <p className="mt-1 text-lg font-semibold">{formatCurrency(pricePreview)}</p>
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">메모</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base"
          />
        </div>

        {error ? <ErrorText text={error} /> : null}

        <ModalActions onClose={onClose} submitLabel="저장" />
      </form>
    </ModalShell>
  );
}

function DrinkModal({ wine, lots, onClose, onSubmit }) {
  const now = new Date();
  const initialDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const [drankAt, setDrankAt] = useState(initialDateTime);
  const [place, setPlace] = useState("");
  const [pairing, setPairing] = useState("");
  const [rating, setRating] = useState("");
  const [repurchase, setRepurchase] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");

  const plan = fifoPlan(lots, 1);
  const preview = plan?.[0] || null;

  function handleSave(event) {
    event.preventDefault();

    if (!drankAt) {
      setError("마신 시각을 입력해주세요.");
      return;
    }
    if (!place.trim()) {
      setError("장소를 입력해주세요.");
      return;
    }
    if (!pairing.trim()) {
      setError("페어링을 입력해주세요.");
      return;
    }
    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      setError("평점은 1~5 사이여야 합니다.");
      return;
    }
    if (!repurchase) {
      setError("재구매 의사를 선택해주세요.");
      return;
    }

    const result = onSubmit({
      drankAt,
      place,
      pairing,
      rating,
      repurchase,
      memo,
    });

    if (!result.ok) {
      setError(result.error);
    }
  }

  return (
    <ModalShell title={`마심 처리 · ${wine.name}`} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">FIFO 차감 미리보기</p>
          {preview ? (
            <div className="mt-2 text-sm text-zinc-200">
              <p>차감 로트: {preview.merchant}</p>
              <p>구입일: {preview.purchasedAt}</p>
              <p>빈티지: {formatVintage(preview.vintageSnapshot)}</p>
              <p className="mt-1 text-zinc-400">1병 차감 예정</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-rose-300">
              남은 재고가 없어 처리할 수 없어요.
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">마신 시각</label>
          <input
            type="datetime-local"
            value={drankAt}
            onChange={(e) => setDrankAt(e.target.value)}
            className="block w-full appearance-none rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">장소</label>
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="예: 집"
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">페어링</label>
          <input
            value={pairing}
            onChange={(e) => setPairing(e.target.value)}
            placeholder="예: 스테이크"
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">평점</label>
          <select
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base"
          >
            <option value="">선택</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">재구매 의사</label>
          <select
            value={repurchase}
            onChange={(e) => setRepurchase(e.target.value)}
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base"
          >
            <option value="">선택</option>
            <option value="yes">yes</option>
            <option value="no">no</option>
            <option value="unknown">unknown</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">메모</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base"
          />
        </div>

        {error ? <ErrorText text={error} /> : null}

        <ModalActions
          onClose={onClose}
          submitLabel="저장"
          submitDisabled={!preview}
        />
      </form>
    </ModalShell>
  );
}

function MerchantModal({ merchants, onClose, onAdd, onUpdate, onDelete }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const [editingMerchantId, setEditingMerchantId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingError, setEditingError] = useState("");

  function handleAdd(event) {
    event.preventDefault();

    if (!name.trim()) {
      setError("구입처 이름을 입력해주세요.");
      return;
    }

    const result = onAdd({ name });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setName("");
    setError("");
  }

  function startEdit(merchant) {
    setEditingMerchantId(merchant.id);
    setEditingName(merchant.name);
    setEditingError("");
  }

  function cancelEdit() {
    setEditingMerchantId(null);
    setEditingName("");
    setEditingError("");
  }

  function handleUpdate(event) {
    event.preventDefault();

    if (!editingMerchantId) return;

    const result = onUpdate(editingMerchantId, { name: editingName });

    if (!result.ok) {
      setEditingError(result.error);
      return;
    }

    cancelEdit();
  }

  function handleDelete(merchant) {
    const confirmed = window.confirm(
      `'${merchant.name}' 프리셋을 삭제할까요?\n기존 구입 로트 기록에는 영향이 없습니다.`
    );

    if (!confirmed) return;

    onDelete(merchant.id);

    if (editingMerchantId === merchant.id) {
      cancelEdit();
    }
  }

  return (
    <ModalShell title="구입처 프리셋 관리" onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-2 text-sm font-medium">현재 프리셋</p>
          <p className="mb-4 text-xs text-zinc-500">
            프리셋 수정/삭제는 입력 목록에만 반영되며, 기존 구입 기록은 바뀌지 않습니다.
          </p>

          <div className="space-y-3">
            {merchants.length === 0 ? (
              <p className="text-sm text-zinc-500">등록된 구입처 프리셋이 없어요.</p>
            ) : (
              merchants.map((merchant) => {
                const isEditing = editingMerchantId === merchant.id;

                return (
                  <div
                    key={merchant.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3"
                  >
                    {isEditing ? (
                      <form onSubmit={handleUpdate} className="space-y-3">
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base"
                        />

                        {editingError ? <ErrorText text={editingError} /> : null}

                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-2xl border border-zinc-700 px-4 py-3 text-sm"
                          >
                            취소
                          </button>
                          <button
                            type="submit"
                            className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-medium text-white"
                          >
                            저장
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-100">
                            {merchant.name}
                          </p>
                        </div>

                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(merchant)}
                            className="rounded-xl border border-zinc-700 px-3 py-2 text-xs text-zinc-100"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(merchant)}
                            className="rounded-xl border border-rose-900 bg-rose-950/40 px-3 py-2 text-xs text-rose-300"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <form onSubmit={handleAdd} className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
          <div>
            <label className="mb-2 block text-sm text-zinc-300">새 구입처 이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 현대백화점"
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-base"
            />
          </div>

          {error ? <ErrorText text={error} /> : null}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-zinc-700 px-4 py-3 text-sm"
            >
              닫기
            </button>
            <button
              type="submit"
              className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-medium text-white"
            >
              추가
            </button>
          </div>
        </form>
      </div>
    </ModalShell>
  );
}



function ModalShell({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70">
      <div className="mx-auto flex h-screen max-w-md flex-col bg-zinc-950">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-700 px-3 py-2 text-sm"
          >
            닫기
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onClose, submitLabel, submitDisabled = false }) {
  return (
    <div
      className="grid grid-cols-2 gap-3 pt-2"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 30px)" }}
    >
      <button
        type="button"
        onClick={onClose}
        className="rounded-2xl border border-zinc-700 px-4 py-3 text-sm"
      >
        취소
      </button>
      <button
        type="submit"
        disabled={submitDisabled}
        className={`rounded-2xl px-4 py-3 text-sm font-medium ${
          submitDisabled
            ? "bg-zinc-800 text-zinc-500"
            : "bg-rose-500 text-white"
        }`}
      >
        {submitLabel}
      </button>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-zinc-900 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-2xl bg-zinc-800/60 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-zinc-100">{value}</p>
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/50 px-5 py-8 text-center">
      <p className="text-base font-medium text-zinc-200">{title}</p>
      <p className="mt-2 text-sm text-zinc-500">{description}</p>
    </div>
  );
}

function ErrorText({ text }) {
  return <p className="text-sm text-rose-400">{text}</p>;
}

export default App;