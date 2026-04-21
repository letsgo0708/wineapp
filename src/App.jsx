import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import {
  safeId,
  calcPricePaid,
  wineLots,
  computeSummary,
} from "./domain";


const typeLabels = {
  red: "레드",
  white: "화이트",
  champagne: "샴페인",
  etc: "기타",
};

function normalizeWineKey(name, type) {
  return `${String(name).trim().toLowerCase()}__${String(type)
    .trim()
    .toLowerCase()}`;
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("ko-KR")}`;
}

function formatVintage(vintage) {
  if (vintage === null || vintage === "" || typeof vintage === "undefined") {
    return "—";
  }
  return String(vintage);
}

function formatDate(dateString) {
  if (!dateString) return "—";

  const [year, month, day] = dateString.split("-");

  return `${year.slice(2)}.${month}.${day}`;
}

function formatDateTime(dateTimeString) {
  if (!dateTimeString) return "—";
  return dateTimeString.replace("T", " ");
}

function formatDateMMDD(dateString) {
  if (!dateString) return "—";

  const normalized = String(dateString).slice(0, 10);
  const [, month, day] = normalized.split("-");

  if (!month || !day) return "—";
  return `${month}.${day}`;
}

function App() {
  const [wines, setWines] = useState([]);
  const [lots, setLots] = useState([]);
  const [drinkLogs, setDrinkLogs] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeType, setActiveType] = useState("red");
  const [selectedWineId, setSelectedWineId] = useState(null);
  const [selectedLotId, setSelectedLotId] = useState(null);
  const [modal, setModal] = useState(null);
  const [showAllWines, setShowAllWines] = useState(false);
  const [showAllLots, setShowAllLots] = useState(false);  
  const [isSortMode, setIsSortMode] = useState(false);
  const [showDrinkHistoryScreen, setShowDrinkHistoryScreen] = useState(false);

  useEffect(() => {
    async function loadAll() {
      try {
        setLoading(true);

        const [winesRes, lotsRes, logsRes, merchantsRes] = await Promise.all([
          supabase.from("wines").select("*").order("name"),
          supabase.from("lots").select("*").order("purchased_at"),
          supabase.from("drink_logs").select("*").order("drank_at", { ascending: false }),
          supabase.from("merchants").select("*").order("name"),
        ]);

        if (winesRes.error) console.error("wines load error", winesRes.error);
        if (lotsRes.error) console.error("lots load error", lotsRes.error);
        if (logsRes.error) console.error("drink_logs load error", logsRes.error);
        if (merchantsRes.error) console.error("merchants load error", merchantsRes.error);

        setWines(winesRes.data ?? []);

        setLots(
          (lotsRes.data ?? []).map((lot) => ({
            ...lot,
            wineId: lot.wine_id,
            purchasedAt: lot.purchased_at,
            priceInput: lot.price_input,
            onnuriUsed: lot.onnuri_used,
            discountRate: Number(lot.discount_rate),
            pricePaid: lot.price_paid,
          }))
        );

        setDrinkLogs(
          (logsRes.data ?? []).map((log) => ({
            ...log,
            wineId: log.wine_id,
            lotId: log.lot_id,
            vintageSnapshot: log.vintage_snapshot,
            drankAt: log.drank_at,
          }))
        );

        setMerchants(merchantsRes.data ?? []);
      } catch (err) {
        console.error("loadAll unexpected error", err);
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, []);

  const selectedWine = useMemo(
    () => wines.find((wine) => wine.id === selectedWineId) || null,
    [wines, selectedWineId]
  );

  const selectedLot = useMemo(
    () => lots.find((lot) => lot.id === selectedLotId) || null,
    [lots, selectedLotId]
  );

  const visibleWines = useMemo(() => {
    return wines
      .map((wine) => {
        const summary = computeSummary(lots, wine.id);
        return { ...wine, summary };
      })
      .filter((wine) => !wine.hidden)
      .filter((wine) => wine.type === activeType)
      .filter((wine) => (isSortMode ? true : showAllWines ? true : wine.summary.totalQty > 0))
      .sort((a, b) => {
        const aOrder = typeof a.sort_order === "number" ? a.sort_order : Number.MAX_SAFE_INTEGER;
        const bOrder = typeof b.sort_order === "number" ? b.sort_order : Number.MAX_SAFE_INTEGER;

        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }

        if (a.summary.avgCost !== b.summary.avgCost) {
          return a.summary.avgCost - b.summary.avgCost;
        }

        return a.name.localeCompare(b.name);
      });
  }, [wines, lots, activeType, showAllWines, isSortMode]);

  const selectedWineLots = useMemo(() => {
    if (!selectedWineId) return [];

    return wineLots(lots, selectedWineId)
      .filter((lot) => (showAllLots ? true : lot.remaining > 0))
      .slice()
      .sort((a, b) => {
        if (a.purchasedAt < b.purchasedAt) return -1;
        if (a.purchasedAt > b.purchasedAt) return 1;
        return String(a.id).localeCompare(String(b.id));
      });
  }, [lots, selectedWineId, showAllLots]);
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

  const hiddenWines = useMemo(() => {
    return wines
      .filter((wine) => wine.hidden)
      .map((wine) => ({
        ...wine,
        summary: computeSummary(lots, wine.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [wines, lots]);

  const allDrinkHistory = useMemo(() => {
    return drinkLogs
      .map((log) => {
        const wine = wines.find((item) => item.id === log.wineId);

        return {
          ...log,
          wineName: wine?.name || "알 수 없는 와인",
          wineType: wine?.type || "etc",
        };
      })
      .sort((a, b) => String(b.drankAt).localeCompare(String(a.drankAt)));
  }, [drinkLogs, wines]);

  function openModal(name, lotId = null) {
    setSelectedLotId(lotId);
    setModal(name);
  }

  function closeModal() {
    setModal(null);
    setSelectedLotId(null);
  }

  async function addWine(form) {
    const normalized = normalizeWineKey(form.name, form.type);
    const exists = wines.some(
      (wine) => normalizeWineKey(wine.name, wine.type) === normalized
    );

    if (exists) {
      return {
        ok: false,
        error:
          "이미 등록된 와인입니다. 기존 와인 상세에서 '구입 추가'를 이용해주세요.",
      };
    }

    const maxSortOrder = wines.reduce((max, wine) => {
      return typeof wine.sort_order === "number" && wine.sort_order > max
        ? wine.sort_order
        : max;
    }, 0);

    const payload = {
      id: safeId("wine"),
      type: form.type,
      name: form.name.trim(),
      sort_order: maxSortOrder + 1,
    };

    const { data, error } = await supabase
      .from("wines")
      .insert(payload)
      .select()
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    setWines((prev) => [...prev, data]);
    setSelectedWineId(data.id);
    setActiveType(data.type);
    closeModal();

    return { ok: true, error: null };
  }

  async function addLot(form) {
    if (!selectedWineId) {
      return { ok: false, error: "선택된 와인이 없습니다." };
    }

    const qty = Number(form.qty);
    const priceInput = Number(form.priceInput);
    const vintage =
      form.vintage === "" || form.vintage === null ? null : Number(form.vintage);
    const pricePaid = calcPricePaid(priceInput, form.onnuriUsed);

    const payload = {
      id: safeId("lot"),
      wine_id: selectedWineId,
      vintage,
      merchant: form.merchant,
      purchased_at: form.purchasedAt,
      qty,
      remaining: qty,
      price_input: priceInput,
      onnuri_used: form.onnuriUsed,
      discount_rate: 0.9,
      price_paid: pricePaid,
      memo: form.memo.trim(),
    };

    const { data, error } = await supabase
      .from("lots")
      .insert(payload)
      .select()
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    setLots((prev) => [
      ...prev,
      {
        ...data,
        wineId: data.wine_id,
        purchasedAt: data.purchased_at,
        priceInput: data.price_input,
        onnuriUsed: data.onnuri_used,
        discountRate: Number(data.discount_rate),
        pricePaid: data.price_paid,
      },
    ]);

    closeModal();

    return { ok: true, error: null };
  }

  async function updateLot(lotId, form) {
    const targetLot = lots.find((lot) => lot.id === lotId);

    if (!targetLot) {
      return { ok: false, error: "수정할 로트를 찾을 수 없습니다." };
    }

    const canEditQty = targetLot.qty === targetLot.remaining;
    const nextQty = Number(form.qty);
    const priceInput = Number(form.priceInput);
    const vintage =
      form.vintage === "" || form.vintage === null ? null : Number(form.vintage);

    if (!form.merchant.trim()) {
      return { ok: false, error: "구입처를 입력해주세요." };
    }
    if (!form.purchasedAt) {
      return { ok: false, error: "구입일을 입력해주세요." };
    }
    if (priceInput < 0 || Number.isNaN(priceInput)) {
      return { ok: false, error: "가격은 0 이상의 숫자여야 합니다." };
    }
    if (form.vintage !== "" && !Number.isInteger(Number(form.vintage))) {
      return { ok: false, error: "빈티지는 비워두거나 정수로 입력해주세요." };
    }

    if (canEditQty) {
      if (!Number.isInteger(nextQty) || nextQty < 1) {
        return { ok: false, error: "수량은 1 이상의 정수여야 합니다." };
      }
    }

    const pricePaid = calcPricePaid(priceInput, form.onnuriUsed);

    const updatePayload = {
      merchant: form.merchant.trim(),
      purchased_at: form.purchasedAt,
      vintage,
      qty: canEditQty ? nextQty : targetLot.qty,
      remaining: canEditQty ? nextQty : targetLot.remaining,
      price_input: priceInput,
      onnuri_used: form.onnuriUsed,
      discount_rate: 0.9,
      price_paid: pricePaid,
      memo: form.memo.trim(),
    };

    const { data, error } = await supabase
      .from("lots")
      .update(updatePayload)
      .eq("id", lotId)
      .select()
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    setLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId
          ? {
              ...data,
              wineId: data.wine_id,
              purchasedAt: data.purchased_at,
              priceInput: data.price_input,
              onnuriUsed: data.onnuri_used,
              discountRate: Number(data.discount_rate),
              pricePaid: data.price_paid,
            }
          : lot
      )
    );

    closeModal();

    return { ok: true, error: null };
  }

  async function deleteLot(lotId) {
    const targetLot = lots.find((lot) => lot.id === lotId);

    if (!targetLot) {
      return { ok: false, error: "삭제할 로트를 찾을 수 없습니다." };
    }

    if (targetLot.qty !== targetLot.remaining) {
      return {
        ok: false,
        error: "이미 마신 로트는 삭제할 수 없습니다.",
      };
    }

    const confirmed = window.confirm(
      "이 로트를 삭제할까요?\n아직 마시지 않은 로트만 삭제할 수 있습니다."
    );
    if (!confirmed) {
      return { ok: false, error: "삭제가 취소되었습니다." };
    }

    const { error } = await supabase
      .from("lots")
      .delete()
      .eq("id", lotId);

    if (error) {
      return { ok: false, error: error.message };
    }

    setLots((prev) => prev.filter((lot) => lot.id !== lotId));
    return { ok: true, error: null };
  }

  async function drinkOneBottleFromLot(lotId, form) {
    const targetLot = lots.find((lot) => lot.id === lotId);

    if (!targetLot) {
      return { ok: false, error: "차감할 로트를 찾을 수 없습니다." };
    }

    if (targetLot.remaining <= 0) {
      return { ok: false, error: "남은 재고가 없어 처리할 수 없어요." };
    }

    const nextRemaining = Math.max(0, targetLot.remaining - 1);

    const { error: updateError } = await supabase
      .from("lots")
      .update({ remaining: nextRemaining })
      .eq("id", lotId);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    const logPayload = {
      id: safeId("drink"),
      wine_id: targetLot.wineId,
      lot_id: targetLot.id,
      vintage_snapshot: targetLot.vintage ?? null,
      drank_at: form.drankAt,
      place: form.place.trim(),
      pairing: form.pairing.trim(),
      rating: Number(form.rating),
      repurchase: form.repurchase,
      memo: form.memo.trim(),
    };

    const { data, error: insertError } = await supabase
      .from("drink_logs")
      .insert(logPayload)
      .select()
      .single();

    if (insertError) {
      await supabase
        .from("lots")
        .update({ remaining: targetLot.remaining })
        .eq("id", lotId);

      return { ok: false, error: insertError.message };
    }

    setLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId ? { ...lot, remaining: nextRemaining } : lot
      )
    );

    setDrinkLogs((prev) => [
      {
        ...data,
        wineId: data.wine_id,
        lotId: data.lot_id,
        vintageSnapshot: data.vintage_snapshot,
        drankAt: data.drank_at,
      },
      ...prev,
    ]);

    closeModal();

    return { ok: true, error: null };
  }

  async function updateWineName(wineId, form) {
    const name = form.name.trim();

    if (!name) {
      return { ok: false, error: "와인 이름을 입력해주세요." };
    }

    const targetWine = wines.find((wine) => wine.id === wineId);

    if (!targetWine) {
      return { ok: false, error: "수정할 와인을 찾을 수 없습니다." };
    }

    const normalized = normalizeWineKey(name, targetWine.type);
    const exists = wines.some(
      (wine) =>
        wine.id !== wineId &&
        normalizeWineKey(wine.name, wine.type) === normalized
    );

    if (exists) {
      return { ok: false, error: "같은 타입에 동일한 이름의 와인이 이미 있습니다." };
    }

    const { data, error } = await supabase
      .from("wines")
      .update({ name })
      .eq("id", wineId)
      .select()
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    setWines((prev) =>
      prev.map((wine) => (wine.id === wineId ? data : wine))
    );

    closeModal();

    return { ok: true, error: null };
  }

  async function setWineHidden(wineId, hidden) {
    const { data, error } = await supabase
      .from("wines")
      .update({ hidden })
      .eq("id", wineId)
      .select()
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    setWines((prev) =>
      prev.map((wine) => (wine.id === wineId ? data : wine))
    );

    if (hidden && selectedWineId === wineId) {
      setSelectedWineId(null);
    }

    closeModal();

    return { ok: true, error: null };
  }

  async function swapWineSortOrder(firstWine, secondWine) {
    const firstOrder =
      typeof firstWine.sort_order === "number" ? firstWine.sort_order : 0;
    const secondOrder =
      typeof secondWine.sort_order === "number" ? secondWine.sort_order : 0;

    const { error: error1 } = await supabase
      .from("wines")
      .update({ sort_order: secondOrder })
      .eq("id", firstWine.id);

    if (error1) {
      return { ok: false, error: error1.message };
    }

    const { error: error2 } = await supabase
      .from("wines")
      .update({ sort_order: firstOrder })
      .eq("id", secondWine.id);

    if (error2) {
      return { ok: false, error: error2.message };
    }

    setWines((prev) =>
      prev.map((wine) => {
        if (wine.id === firstWine.id) {
          return { ...wine, sort_order: secondOrder };
        }
        if (wine.id === secondWine.id) {
          return { ...wine, sort_order: firstOrder };
        }
        return wine;
      })
    );

    return { ok: true, error: null };
  }


  async function moveWineUp(wineId) {
    const currentIndex = visibleWines.findIndex((wine) => wine.id === wineId);

    if (currentIndex <= 0) {
      return { ok: false, error: "이미 맨 위입니다." };
    }

    const currentWine = visibleWines[currentIndex];
    const prevWine = visibleWines[currentIndex - 1];

    return await swapWineSortOrder(currentWine, prevWine);
  }

  async function moveWineDown(wineId) {
    const currentIndex = visibleWines.findIndex((wine) => wine.id === wineId);

    if (currentIndex === -1 || currentIndex >= visibleWines.length - 1) {
      return { ok: false, error: "이미 맨 아래입니다." };
    }

    const currentWine = visibleWines[currentIndex];
    const nextWine = visibleWines[currentIndex + 1];

    return await swapWineSortOrder(currentWine, nextWine);
  }

  async function addMerchant(form) {
    const name = form.name.trim();
    const exists = merchants.some(
      (merchant) => merchant.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      return { ok: false, error: "이미 등록된 구입처입니다." };
    }

    const payload = {
      id: safeId("merchant"),
      name,
    };

    const { data, error } = await supabase
      .from("merchants")
      .insert(payload)
      .select()
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    setMerchants((prev) => [...prev, data]);
    return { ok: true, error: null };
  }

  async function updateMerchant(id, form) {
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

    const { data, error } = await supabase
      .from("merchants")
      .update({ name })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    setMerchants((prev) =>
      prev.map((merchant) => (merchant.id === id ? data : merchant))
    );

    return { ok: true, error: null };
  }

  async function deleteMerchant(id) {
    const { error } = await supabase
      .from("merchants")
      .delete()
      .eq("id", id);

    if (error) {
      return { ok: false, error: error.message };
    }

    setMerchants((prev) => prev.filter((merchant) => merchant.id !== id));
    return { ok: true, error: null };
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto min-h-screen max-w-md bg-zinc-950">
        {showDrinkHistoryScreen ? (
          <DrinkHistoryScreen
            logs={allDrinkHistory}
            onBack={() => setShowDrinkHistoryScreen(false)}
          />
        ) : !selectedWine ? (
          <WineListScreen
            activeType={activeType}
            setActiveType={setActiveType}
            wines={visibleWines}
            showAllWines={showAllWines}
            onToggleShowAllWines={() => setShowAllWines((prev) => !prev)}
            onSelectWine={setSelectedWineId}
            onOpenWineModal={() => openModal("wine")}
            onOpenManageMenu={() => openModal("manageMenu")}
            isSortMode={isSortMode}
            onToggleSortMode={() => setIsSortMode((prev) => !prev)}
            onMoveWineUp={moveWineUp}
            onMoveWineDown={moveWineDown}
            onOpenDrinkHistory={() => setShowDrinkHistoryScreen(true)}
          />
        ) : (
          <WineDetailScreen
            wine={selectedWine}
            lots={selectedWineLots}
            allLots={wineLots(lots, selectedWineId)}
            drinkLogs={selectedWineDrinkLogs}
            summary={selectedSummary}
            showAllLots={showAllLots}
            onToggleShowAllLots={() => setShowAllLots((prev) => !prev)}
            onBack={() => setSelectedWineId(null)}
            onOpenLotModal={() => openModal("lot")}
            onOpenLotEditModal={(lotId) => openModal("lotEdit", lotId)}
            onOpenLotDrinkModal={(lotId) => openModal("lotDrink", lotId)}
            onDeleteLot={deleteLot}
            onOpenWineManageModal={() => openModal("wineManage")}
          />
        )}

        {modal === "wine" && (
          <WineModal onClose={closeModal} onSubmit={addWine} />
        )}

        {modal === "lot" && selectedWine && (
          <LotModal
            mode="create"
            wine={selectedWine}
            merchants={merchants}
            onClose={closeModal}
            onSubmit={addLot}
          />
        )}

        {modal === "lotEdit" && selectedWine && selectedLot && (
          <LotModal
            mode="edit"
            wine={selectedWine}
            merchants={merchants}
            initialLot={selectedLot}
            onClose={closeModal}
            onSubmit={(form) => updateLot(selectedLot.id, form)}
          />
        )}

        {modal === "lotDrink" && selectedWine && selectedLot && (
          <DrinkModal
            wine={selectedWine}
            lot={selectedLot}
            onClose={closeModal}
            onSubmit={(form) => drinkOneBottleFromLot(selectedLot.id, form)}
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

        {modal === "manageMenu" && (
          <ManageMenuModal
            onClose={closeModal}
            onOpenMerchant={() => openModal("merchant")}
            onOpenHiddenWines={() => openModal("hiddenWines")}
          />
        )}

        {modal === "hiddenWines" && (
          <HiddenWinesModal
            wines={hiddenWines}
            onClose={closeModal}
            onUnhideWine={(wineId) => setWineHidden(wineId, false)}
          />
        )}

        {modal === "wineManage" && selectedWine && (
          <WineManageModal
            wine={selectedWine}
            onClose={closeModal}
            onRename={(form) => updateWineName(selectedWine.id, form)}
            onHide={() => setWineHidden(selectedWine.id, true)}
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
  showAllWines,
  onToggleShowAllWines,
  onSelectWine,
  onOpenWineModal,
  onOpenManageMenu,
  isSortMode,
  onToggleSortMode,
  onMoveWineUp,
  onMoveWineDown,
  onOpenDrinkHistory,
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
              <h1 className="mt-1 text-xl font-semibold">댕댕이네 와인창고</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onOpenManageMenu}
                title="관리 메뉴"
                aria-label="관리 메뉴"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 text-lg text-zinc-100 active:opacity-80"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.4 15a1.7 1.7 0 0 0 .34 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.82-.34 1.7 1.7 0 0 0-1 1.54V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1-1.54 1.7 1.7 0 0 0-1.82.34l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.54-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.82l-.06-.06A2 2 0 0 1 7.03 4.3l.06.06A1.7 1.7 0 0 0 9 4.02 1.7 1.7 0 0 0 10 2.48V2a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.54 1.7 1.7 0 0 0 1.82-.34l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.46.18.98.27 1.54.27H21a2 2 0 0 1 0 4h-.09c-.56 0-1.08.09-1.54.27Z"
                  />
                </svg>
              </button>


              <button
                onClick={onOpenWineModal}
                title="와인 추가"
                aria-label="와인 추가"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 text-lg font-semibold text-zinc-100 active:opacity-80"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {["red", "white", "champagne", "etc"].map((type) => {
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
        {/* 🔥 여기 추가 */}
        
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-500">
            와인 {wines.length}종
          </span>

          <div className="flex items-center gap-2">
            {isSortMode ? (
              <p className="text-xs text-zinc-500">
                순서 편집 중에는 모든 와인이 표시됩니다
              </p>
            ) : null}
            
            <button
              onClick={onToggleSortMode}
              className={`rounded-xl border px-3 py-2 text-xs active:opacity-80 ${
                isSortMode
                  ? "border-emerald-600 bg-emerald-500 text-white"
                  : "border-zinc-700 text-zinc-300"
              }`}
            >
              {isSortMode ? "완료" : "순서 편집"}
            </button>

            {!isSortMode ? (
              <button
                onClick={onToggleShowAllWines}
                disabled={isSortMode}
                className={`rounded-xl border px-3 py-2 text-xs ${
                  isSortMode
                    ? "border-zinc-800 text-zinc-600"
                    : "border-zinc-700 text-zinc-300 active:opacity-80"
                }`}
              >
                {showAllWines ? "남은 것만" : "전체 보기"}
              </button>
            ) : null}
          </div>
        </div>


        {wines.length === 0 ? (
          <EmptyState
            title="이 타입의 와인이 없어요."
            description="새 와인을 추가해 재고 관리를 시작해보세요."
          />
        ) : (
          
          wines.map((wine, index) => {
            const isOutOfStock = wine.summary.totalQty === 0;
            const isFirst = index === 0;
            const isLast = index === wines.length - 1;

            return (
              <div
                key={wine.id}
                className={`rounded-3xl border px-4 py-3 shadow-sm transition ${
                  isOutOfStock
                    ? "border-zinc-800 bg-zinc-900/60 text-zinc-300"
                    : "border-zinc-800 bg-zinc-900"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isSortMode) {
                        onSelectWine(wine.id);
                      }
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight">
                          {wine.name}
                        </p>
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
                  </button>

                  {isSortMode ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => onMoveWineUp(wine.id)}
                        className={`rounded-xl border px-3 py-2 text-xs ${
                          isFirst
                            ? "border-zinc-800 text-zinc-600"
                            : "border-zinc-700 text-zinc-100 active:opacity-80"
                        }`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => onMoveWineDown(wine.id)}
                        className={`rounded-xl border px-3 py-2 text-xs ${
                          isLast
                            ? "border-zinc-800 text-zinc-600"
                            : "border-zinc-700 text-zinc-100 active:opacity-80"
                        }`}
                      >
                        ↓
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })


        )}

        <button
          type="button"
          onClick={onOpenDrinkHistory}
          className="w-full py-3 text-sm font-medium text-zinc-200 text-center active:opacity-80 active:scale-[0.98]"
        >
          마신 기록 보기 →
        </button>

      </main>
    </div>
  );
}

function WineDetailScreen({
  wine,
  lots,
  allLots,
  drinkLogs,
  summary,
  showAllLots,
  onToggleShowAllLots,
  onBack,
  onOpenLotModal,
  onOpenLotEditModal,
  onOpenLotDrinkModal,
  onDeleteLot,
  onOpenWineManageModal,
}) {
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

            <div className="mt-1 flex items-center justify-between gap-3">
              <h1 className="text-xl font-semibold leading-tight">
                {wine.name}
              </h1>

              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenWineManageModal}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 text-zinc-100 active:opacity-80"
                  title="와인 관리"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.4 15a1.7 1.7 0 0 0 .34 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.82-.34 1.7 1.7 0 0 0-1 1.54V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1-1.54 1.7 1.7 0 0 0-1.82.34l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.54-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.82l-.06-.06A2 2 0 0 1 7.03 4.3l.06.06A1.7 1.7 0 0 0 9 4.02 1.7 1.7 0 0 0 10 2.48V2a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.54 1.7 1.7 0 0 0 1.82-.34l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.46.18.98.27 1.54.27H21a2 2 0 0 1 0 4h-.09c-.56 0-1.08.09-1.54.27Z"
                    />
                  </svg>
                </button>

                <button
                  onClick={onOpenLotModal}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-xl font-semibold text-white active:opacity-80"
                  title="구입 추가"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>
            </div>

            <p className="mt-2 text-sm text-zinc-400">
              보유 빈티지:{" "}
              {summary.vintages.length ? summary.vintages.join(" · ") : "—"}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <SummaryCard label="수량" value={`${summary.totalQty}병`} />
            <SummaryCard label="평균 가격" value={formatCurrency(summary.avgCost)} />
          </div>

          
        </div>
      </header>

      <main className="space-y-6 px-4 pt-4">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">구입 로트</h2>
              <span className="text-xs text-zinc-500">오래된 순</span>
            </div>

            <button
              onClick={onToggleShowAllLots}
              className="rounded-xl border border-zinc-700 px-3 py-2 text-xs text-zinc-300 active:opacity-80"
            >
              {showAllLots ? "남은 것만" : "전체 보기"}
            </button>
          </div>

          <div className="space-y-3">
            {allLots.length === 0 ? (
              <EmptyState
                title="아직 등록된 구입 기록이 없어요."
                description="구입 추가로 첫 로트를 등록해보세요."
              />
            ) : lots.length === 0 ? (
              <EmptyState
                title="남아있는 로트가 없어요."
                description="전체 보기를 눌러 과거 기록을 확인하세요."
              />
            ) : (
              lots.map((lot) => {
                const canDrink = lot.remaining > 0;
                const canDelete = lot.qty === lot.remaining;
                const canEditQty = lot.qty === lot.remaining;

                return (
                  <div
                    key={lot.id}
                    className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4"
                  >
                    <div className="flex items-end justify-between gap-4">
                      <div className="flex items-baseline gap-2">
                      <span className="text-sm text-zinc-500">빈티지</span>
                      <span className="text-base font-semibold">
                        {formatVintage(lot.vintage)}
                      </span>
                    </div>

                      <div className="text-right">
                        <p className="text-base font-semibold tracking-tight">
                          {lot.remaining} / {lot.qty}병
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                      <InfoTileCompact label="구입처" value={lot.merchant || "—"} />
                      <InfoTileCompact label="구입일" value={formatDate(lot.purchasedAt)} />
                      <InfoTileCompact label="지불가" value={formatCurrency(lot.pricePaid)} />
                    </div>

                    <div className="mt-2">
                      <p className="text-xs text-zinc-500">메모</p>
                      <p className="mt-1 text-sm text-zinc-300">{lot.memo || "—"}</p>
                    </div>
{/* 
                    {!canEditQty ? (
                      <p className="mt-3 text-xs text-zinc-500">
                        이미 마신 로트는 총 수량을 변경하거나 삭제할 수 없어요.
                      </p>
                    ) : null} */}

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          onClick={() => onOpenLotEditModal(lot.id)}
                          className="px-2 py-1 text-zinc-300 active:opacity-70"
                        >
                          수정
                        </button>

                        <span className="text-zinc-600">|</span>

                        <button
                          onClick={() => onDeleteLot(lot.id)}
                          disabled={!canDelete}
                          className={`px-2 py-1 ${
                            canDelete ? "text-rose-400 active:opacity-70" : "text-zinc-600"
                          }`}
                        >
                          삭제
                        </button>
                      </div>

                      <button
                        onClick={() => onOpenLotDrinkModal(lot.id)}
                        disabled={!canDrink}
                        className={`rounded-full px-4 py-2 text-sm font-medium ${
                          canDrink
                            ? "bg-rose-500 text-white"
                            : "bg-zinc-800 text-zinc-500"
                        }`}
                      >
                        🍷 마심
                      </button>
                    </div>

                    
                  </div>
                );
              })
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
                description="로트 카드에서 마심 처리 후 기록이 여기에 쌓여요."
              />
            ) : (
              drinkLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-zinc-500">빈티지</p>
                      <p className="mt-1 font-medium">
                        {formatVintage(log.vintageSnapshot)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-500">마신 시각</p>
                      <p className="mt-1 text-sm">{formatDateTime(log.drankAt.slice(0, 10))}</p>
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

function DrinkHistoryScreen({ logs, onBack }) {
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
              Wine Inventory
            </p>
            <h1 className="mt-1 text-xl font-semibold">마신 기록 모아보기</h1>
            <p className="mt-2 text-sm text-zinc-400">최신순</p>
          </div>
        </div>
      </header>

      <main className="space-y-3 px-4 pt-4">
        {logs.length === 0 ? (
          <EmptyState
            title="아직 마신 기록이 없어요."
            description="와인을 마신 뒤 기록하면 여기에 전체 목록으로 쌓여요."
          />
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="rounded-3xl border border-zinc-800 bg-zinc-900 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="shrink-0 text-sm font-medium text-zinc-300">
                  {formatDateMMDD(log.drankAt)}
                </span>

                <span className="shrink-0 text-xs text-zinc-500">
                  {typeLabels[log.wineType] || "기타"}
                </span>

                <span className="min-w-0 truncate text-sm font-semibold text-zinc-100">
                  {log.wineName}
                </span>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}

function WineModal({ onClose, onSubmit }) {
  const [type, setType] = useState("red");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function handleSave(event) {
    event.preventDefault();

    if (!name.trim()) {
      setError("와인 이름을 입력해주세요.");
      return;
    }

    const result = await onSubmit({ type, name });
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
            <option value="etc">기타</option>

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

function LotModal({
  mode = "create",
  wine,
  merchants,
  initialLot = null,
  onClose,
  onSubmit,
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [merchant, setMerchant] = useState(
    initialLot?.merchant || merchants[0]?.name || ""
  );
  const [purchasedAt, setPurchasedAt] = useState(
    initialLot?.purchasedAt || today
  );
  const [vintage, setVintage] = useState(
    initialLot?.vintage === null || typeof initialLot?.vintage === "undefined"
      ? ""
      : String(initialLot.vintage)
  );
  const [qty, setQty] = useState(initialLot?.qty ?? 1);
  const [priceInput, setPriceInput] = useState(initialLot?.priceInput ?? "");
  const [onnuriUsed, setOnnuriUsed] = useState(initialLot?.onnuriUsed ?? false);
  const [memo, setMemo] = useState(initialLot?.memo || "");
  const [error, setError] = useState("");

  const isEdit = mode === "edit";
  const canEditQty = initialLot ? initialLot.qty === initialLot.remaining : true;
  const pricePreview = calcPricePaid(priceInput, onnuriUsed);

  async function handleSave(event) {
    event.preventDefault();

    if (!merchant.trim()) {
      setError("구입처를 선택하거나 입력해주세요.");
      return;
    }
    if (!purchasedAt) {
      setError("구입일을 입력해주세요.");
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
    if (canEditQty) {
      if (!Number.isInteger(Number(qty)) || Number(qty) < 1) {
        setError("수량은 1 이상의 정수여야 합니다.");
        return;
      }
    }

    const result = await onSubmit({
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
    <ModalShell
      title={isEdit ? `로트 수정 · ${wine.name}` : `구입 추가 · ${wine.name}`}
      onClose={onClose}
    >
      <form onSubmit={handleSave} className="space-y-4">
        {!isEdit ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-300">
            로트 = 같은 조건으로 한 번에 산 구입 묶음
          </div>
        ) : null}

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
          <label className="mb-2 block text-sm text-zinc-300">
            빈티지 (선택)
          </label>
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
              disabled={!canEditQty}
              onChange={(e) => setQty(e.target.value)}
              className={`w-full rounded-2xl border px-4 py-3 text-base ${
                canEditQty
                  ? "border-zinc-700 bg-zinc-900"
                  : "border-zinc-800 bg-zinc-800 text-zinc-500"
              }`}
            />
            {!canEditQty ? (
              <p className="mt-2 text-xs text-zinc-500">
                이미 마신 로트는 총 수량을 변경할 수 없어요.
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">가격(병당)</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={priceInput}
              onChange={(e) => {
                const onlyNumbers = e.target.value.replace(/[^0-9]/g, "");
                setPriceInput(onlyNumbers);
              }}
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

        <ModalActions onClose={onClose} submitLabel={isEdit ? "저장" : "추가"} />
      </form>
    </ModalShell>
  );
}

function DrinkModal({ wine, lot, onClose, onSubmit }) {
  const now = new Date();
  const initialDateTime = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 16);

  const [drankAt, setDrankAt] = useState(initialDateTime);
  const [place, setPlace] = useState("");
  const [pairing, setPairing] = useState("");
  const [rating, setRating] = useState("");
  const [repurchase, setRepurchase] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");

  async function handleSave(event) {
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

    const result = await onSubmit({
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
          <p className="text-xs text-zinc-500">선택된 로트</p>
          <div className="mt-2 text-sm text-zinc-200">
            <p>구입처: {lot.merchant}</p>
            <p>구입일: {lot.purchasedAt}</p>
            <p>빈티지: {formatVintage(lot.vintage)}</p>
            <p>남은 수량: {lot.remaining}병</p>
            <p className="mt-1 text-zinc-400">이 로트에서 1병 차감 예정</p>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">마신 시각</label>
          <input
            type="date"
            value={drankAt}
            onChange={(e) => setDrankAt(e.target.value)}
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base"
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
            <option value="yes">예</option>
            <option value="no">아니오</option>
            <option value="unknown">잘 모르겠다</option>
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

        <ModalActions onClose={onClose} submitLabel="저장" />
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

  async function handleAdd(event) {
    event.preventDefault();

    if (!name.trim()) {
      setError("구입처 이름을 입력해주세요.");
      return;
    }

    const result = await onAdd({ name });
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

  async function handleUpdate(event) {
    event.preventDefault();

    if (!editingMerchantId) return;

    const result = await onUpdate(editingMerchantId, { name: editingName });

    if (!result.ok) {
      setEditingError(result.error);
      return;
    }

    cancelEdit();
  }

  async function handleDelete(merchant) {
    const confirmed = window.confirm(
      `'${merchant.name}' 프리셋을 삭제할까요?\n기존 구입 로트 기록에는 영향이 없습니다.`
    );

    if (!confirmed) return;

    const result = await onDelete(merchant.id);

    if (!result.ok) {
      setError(result.error);
      return;
    }

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
              <p className="text-sm text-zinc-500">
                등록된 구입처 프리셋이 없어요.
              </p>
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

        <form
          onSubmit={handleAdd}
          className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-4"
        >
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              새 구입처 이름
            </label>
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

function ManageMenuModal({ onClose, onOpenMerchant, onOpenHiddenWines }) {
  return (
    <ModalShell title="관리 메뉴" onClose={onClose}>
      <div className="space-y-3">
        <button
          type="button"
          onClick={onOpenMerchant}
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4 text-left"
        >
          <p className="text-sm font-medium text-zinc-100">구입처 프리셋 관리</p>
          <p className="mt-1 text-xs text-zinc-500">
            로트 입력에 사용하는 구입처 목록을 관리해요.
          </p>
        </button>

        <button
          type="button"
          onClick={onOpenHiddenWines}
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4 text-left"
        >
          <p className="text-sm font-medium text-zinc-100">숨김 와인 관리</p>
          <p className="mt-1 text-xs text-zinc-500">
            목록에서 숨긴 와인을 보고 다시 복구할 수 있어요.
          </p>
        </button>
      </div>
    </ModalShell>
  );
}

function WineManageModal({ wine, onClose, onRename, onHide }) {
  const [name, setName] = useState(wine.name);
  const [error, setError] = useState("");

  async function handleSave(event) {
    event.preventDefault();

    if (!name.trim()) {
      setError("와인 이름을 입력해주세요.");
      return;
    }

    const result = await onRename({ name });

    if (!result.ok) {
      setError(result.error);
    }
  }

  async function handleHide() {
    const confirmed = window.confirm(
      `'${wine.name}' 와인을 목록에서 숨길까요?\n숨김 처리하면 메인 화면의 전체 보기/남은 것만 어디에도 나타나지 않습니다.`
    );

    if (!confirmed) return;

    const result = await onHide();

    if (!result.ok) {
      setError(result.error);
    }
  }

  return (
    <ModalShell title="와인 관리" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-5">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-3 text-sm font-medium">이름 수정</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-base"
          />
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-2 text-sm font-medium">숨김 처리</p>
          <p className="text-xs text-zinc-500">
            숨김 처리한 와인은 메인 화면의 일반 목록에서 보이지 않아요.
          </p>

          <button
            type="button"
            onClick={handleHide}
            className="mt-4 w-full rounded-2xl border border-amber-900 bg-amber-950/40 px-4 py-3 text-sm font-medium text-amber-200"
          >
            이 와인 숨기기
          </button>
        </div>

        {error ? <ErrorText text={error} /> : null}

        <ModalActions onClose={onClose} submitLabel="이름 저장" />
      </form>
    </ModalShell>
  );
}

function HiddenWinesModal({ wines, onClose, onUnhideWine }) {
  const [error, setError] = useState("");

  async function handleUnhide(wineId) {
    const result = await onUnhideWine(wineId);

    if (!result.ok) {
      setError(result.error);
    }
  }

  return (
    <ModalShell title="숨김 와인 관리" onClose={onClose}>
      <div className="space-y-4">
        {error ? <ErrorText text={error} /> : null}

        {wines.length === 0 ? (
          <EmptyState
            title="숨김 처리된 와인이 없어요."
            description="숨긴 와인이 있으면 여기서 다시 복구할 수 있어요."
          />
        ) : (
          wines.map((wine) => (
            <div
              key={wine.id}
              className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-100">{wine.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {typeLabels[wine.type]} · 남은 수량 {wine.summary.totalQty}병
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleUnhide(wine.id)}
                  className="shrink-0 rounded-xl border border-zinc-700 px-3 py-2 text-xs text-zinc-100"
                >
                  숨김 해제
                </button>
              </div>
            </div>
          ))
        )}
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}

function ModalActions({ onClose, submitLabel, submitDisabled = false }) {
  return (
    <div
      className="grid grid-cols-2 gap-3 pt-2"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
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
    <div className="rounded-2xl bg-zinc-900 px-3 py-3 flex items-center justify-between">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-base font-semibold">{value}</span>
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

function InfoTileCompact({ label, value }) {
  return (
    <div className="rounded-2xl bg-zinc-800/50 px-3 py-2">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-zinc-100 truncate">{value}</p>
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