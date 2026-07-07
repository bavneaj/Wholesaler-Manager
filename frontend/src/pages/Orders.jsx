import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { inr, ddmmyyyy, todayIso } from "@/lib/format";
import StatusBadge from "@/components/app/StatusBadge";
import { Plus, X, Trash2, AlertCircle } from "lucide-react";

const statusTone = (s) => ({ Delivered: "green", Pending: "yellow", Delayed: "red", "Partially Delivered": "yellow" }[s] || "neutral");

const emptyOrder = () => ({
  wholesaler_id: "",
  date_ordered: todayIso(),
  expected_delivery: "",
  actual_delivery: "",
  status: "Pending",
  items: [{ item: "", qty: 1, unit: "kg", price: 0 }],
  discrepancy: "",
  discrepancy_note: "",
});

export default function Orders() {
  const { t } = useI18n();
  const [orders, setOrders] = useState([]);
  const [wholesalers, setWholesalers] = useState([]);
  const [filter, setFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyOrder());

  const load = async () => {
    const [o, w] = await Promise.all([api.get("/orders"), api.get("/wholesalers")]);
    setOrders(o.data);
    setWholesalers(w.data);
  };
  useEffect(() => { load(); }, []);

  const wNameById = useMemo(() => Object.fromEntries(wholesalers.map((w) => [w.id, w.name])), [wholesalers]);
  const shown = filter ? orders.filter((o) => o.wholesaler_id === filter) : orders;

  const openAdd = () => {
    const f = emptyOrder();
    if (wholesalers[0]) f.wholesaler_id = wholesalers[0].id;
    setForm(f);
    setShowForm(true);
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { item: "", qty: 1, unit: "kg", price: 0 }] });
  const rmItem = (i) => setForm({ ...form, items: form.items.filter((_, j) => j !== i) });
  const updItem = (i, patch) => {
    const copy = form.items.slice();
    copy[i] = { ...copy[i], ...patch };
    setForm({ ...form, items: copy });
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = {
      wholesaler_id: form.wholesaler_id,
      date_ordered: form.date_ordered,
      expected_delivery: form.expected_delivery || null,
      actual_delivery: form.actual_delivery || null,
      status: form.status,
      items: form.items
        .filter((i) => i.item.trim())
        .map((i) => ({ item: i.item.trim(), qty: Number(i.qty) || 0, unit: i.unit || "pcs", price: Number(i.price) || 0 })),
      discrepancy: form.discrepancy || null,
      discrepancy_note: form.discrepancy_note,
    };
    if (payload.items.length === 0) { alert("Add at least one item"); return; }
    await api.post("/orders", payload);
    setShowForm(false);
    load();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete order?")) return;
    await api.delete(`/orders/${id}`);
    load();
  };

  const total = form.items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("orders")}</h1>
        <button data-testid="add-order-btn" onClick={openAdd} className="inline-flex h-11 items-center gap-1 rounded-lg bg-[#0F172A] px-4 text-sm font-bold text-white">
          <Plus size={16} /> {t("addOrder")}
        </button>
      </div>

      <select
        data-testid="orders-filter"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm"
      >
        <option value="">All wholesalers</option>
        {wholesalers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <ul data-testid="orders-list" className="space-y-2">
        {shown.length === 0 && <li className="rounded-xl border border-[#E5E1D8] bg-white p-6 text-center text-sm text-stone-500">{t("noData")}</li>}
        {shown.map((o) => (
          <li key={o.id} data-testid={`order-item-${o.id}`} className="rounded-xl border border-[#E5E1D8] bg-white p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{wNameById[o.wholesaler_id] || "—"}</div>
                <div className="mt-0.5 text-xs text-stone-500 tabular-nums">
                  {t("ordered")}: {ddmmyyyy(o.date_ordered)} · {t("expected")}: {ddmmyyyy(o.expected_delivery)}
                </div>
                <ul className="mt-2 space-y-0.5 text-sm">
                  {o.items.map((it, i) => (
                    <li key={i} className="flex justify-between tabular-nums">
                      <span className="truncate">{it.item} · {it.qty} {it.unit}</span>
                      <span>{inr(it.price)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge tone={statusTone(o.status)}>{t(o.status === "Partially Delivered" ? "partiallyDelivered" : o.status.toLowerCase())}</StatusBadge>
                  {o.discrepancy && (
                    <StatusBadge tone="red"><AlertCircle size={10} /> {t(o.discrepancy)}</StatusBadge>
                  )}
                </div>
                {o.discrepancy && o.discrepancy_note && (
                  <div className="mt-1 text-xs text-[#991B1B]">{o.discrepancy_note}</div>
                )}
              </div>
              <div className="ml-2 text-right">
                <div className="text-xs uppercase text-stone-500">{t("total")}</div>
                <div className="text-lg font-bold tabular-nums">{inr(o.total)}</div>
                <button data-testid={`delete-order-${o.id}`} onClick={() => remove(o.id)} className="mt-1 rounded-md border border-[#F87171] p-1.5 text-[#991B1B]"><Trash2 size={14} /></button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setShowForm(false)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{t("addOrder")}</h2>
              <button data-testid="order-close-btn" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={save} className="space-y-3">
              <select data-testid="order-wholesaler" required value={form.wholesaler_id} onChange={(e) => setForm({ ...form, wholesaler_id: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3">
                <option value="">{t("selectWholesaler")}</option>
                {wholesalers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold uppercase text-stone-500">{t("ordered")}</label>
                  <input data-testid="order-date" type="date" required value={form.date_ordered} onChange={(e) => setForm({ ...form, date_ordered: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-stone-500">{t("expected")}</label>
                  <input data-testid="order-expected" type="date" value={form.expected_delivery} onChange={(e) => setForm({ ...form, expected_delivery: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3" />
                </div>
              </div>

              <div className="rounded-lg border border-[#E5E1D8] p-2">
                <div className="mb-2 text-xs font-bold uppercase text-stone-500">Items</div>
                {form.items.map((it, i) => (
                  <div key={i} className="mb-2 grid grid-cols-12 gap-1">
                    <input data-testid={`order-item-name-${i}`} placeholder={t("itemName")} value={it.item} onChange={(e) => updItem(i, { item: e.target.value })} className="col-span-5 h-10 rounded-md border border-[#E5E1D8] px-2 text-sm" />
                    <input data-testid={`order-item-qty-${i}`} type="number" step="0.01" placeholder={t("qty")} value={it.qty} onChange={(e) => updItem(i, { qty: e.target.value })} className="col-span-2 h-10 rounded-md border border-[#E5E1D8] px-2 text-sm tabular-nums" />
                    <input data-testid={`order-item-unit-${i}`} placeholder="kg" value={it.unit} onChange={(e) => updItem(i, { unit: e.target.value })} className="col-span-2 h-10 rounded-md border border-[#E5E1D8] px-2 text-sm" />
                    <input data-testid={`order-item-price-${i}`} type="number" step="0.01" placeholder={t("price")} value={it.price} onChange={(e) => updItem(i, { price: e.target.value })} className="col-span-2 h-10 rounded-md border border-[#E5E1D8] px-2 text-sm tabular-nums" />
                    <button type="button" data-testid={`order-item-remove-${i}`} onClick={() => rmItem(i)} className="col-span-1 grid place-items-center rounded-md border border-[#E5E1D8]"><X size={14} /></button>
                  </div>
                ))}
                <button data-testid="order-add-item-btn" type="button" onClick={addItem} className="mt-1 w-full rounded-md border border-dashed border-stone-400 py-2 text-xs font-bold text-stone-600">{t("addItem")}</button>
                <div className="mt-2 flex justify-between text-sm font-bold tabular-nums">
                  <span>{t("total")}</span><span>{inr(total)}</span>
                </div>
              </div>

              <select data-testid="order-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3">
                <option value="Pending">{t("pending")}</option>
                <option value="Delivered">{t("delivered")}</option>
                <option value="Delayed">{t("delayed")}</option>
                <option value="Partially Delivered">{t("partiallyDelivered")}</option>
              </select>

              {(form.status === "Delivered" || form.status === "Partially Delivered") && (
                <input data-testid="order-actual" type="date" value={form.actual_delivery} onChange={(e) => setForm({ ...form, actual_delivery: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3" />
              )}

              <select data-testid="order-discrepancy" value={form.discrepancy} onChange={(e) => setForm({ ...form, discrepancy: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3">
                <option value="">No issue</option>
                <option value="damaged">{t("damaged")}</option>
                <option value="short">{t("short")}</option>
                <option value="wrong">{t("wrong")}</option>
              </select>
              {form.discrepancy && (
                <textarea data-testid="order-discrepancy-note" placeholder={t("note")} value={form.discrepancy_note} onChange={(e) => setForm({ ...form, discrepancy_note: e.target.value })} className="min-h-[64px] w-full rounded-lg border border-[#E5E1D8] p-3" />
              )}

              <button data-testid="save-order-btn" type="submit" className="h-14 w-full rounded-lg bg-[#0F172A] font-bold text-white">{t("save")}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
