import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { inr, ddmmyyyy, todayIso } from "@/lib/format";
import StatusBadge from "@/components/app/StatusBadge";
import { Plus, X, Trash2, Download, IndianRupee, ClockAlert } from "lucide-react";
import { exportPaymentsCsv } from "@/lib/csv";

export default function Payments() {
  const { t } = useI18n();
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [wholesalers, setWholesalers] = useState([]);
  const [dash, setDash] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ wholesaler_id: "", order_id: "", date: todayIso(), amount: "", kind: "Partial", note: "" });

  const load = async () => {
    const [p, w, d, o] = await Promise.all([
      api.get("/payments"),
      api.get("/wholesalers"),
      api.get("/analytics/dashboard"),
      api.get("/orders"),
    ]);
    setPayments(p.data);
    setWholesalers(w.data);
    setDash(d.data);
    setOrders(o.data);
  };
  useEffect(() => { load(); }, []);

  const wNameById = useMemo(() => Object.fromEntries(wholesalers.map((w) => [w.id, w.name])), [wholesalers]);
  const orderById = useMemo(() => Object.fromEntries(orders.map((o) => [o.id, o])), [orders]);
  const wholesalerOrders = useMemo(
    () => (form.wholesaler_id ? orders.filter((o) => o.wholesaler_id === form.wholesaler_id) : []),
    [orders, form.wholesaler_id]
  );

  const openAdd = () => {
    setForm({ wholesaler_id: wholesalers[0]?.id || "", order_id: "", date: todayIso(), amount: "", kind: "Partial", note: "" });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = {
      wholesaler_id: form.wholesaler_id,
      order_id: form.order_id || null,
      date: form.date,
      amount: Number(form.amount) || 0,
      kind: form.kind,
      note: form.note,
    };
    await api.post("/payments", payload);
    setShowForm(false);
    load();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete payment?")) return;
    await api.delete(`/payments/${id}`);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("payments")}</h1>
        <div className="flex gap-2">
          <button data-testid="export-payments-btn" onClick={() => exportPaymentsCsv(payments, wNameById, orderById)} className="inline-flex h-11 items-center gap-1 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs font-bold text-stone-700">
            <Download size={14} /> {t("exportCsv")}
          </button>
          <button data-testid="add-payment-btn" onClick={openAdd} className="inline-flex h-11 items-center gap-1 rounded-lg bg-[#0F172A] px-4 text-sm font-bold text-white">
            <Plus size={16} /> {t("addPayment")}
          </button>
        </div>
      </div>

      {dash && (
        <div className="grid grid-cols-2 gap-3">
          <div data-testid="stat-total-owed" className={`rounded-xl border p-4 ${dash.total_owed > 0 ? "border-[#FBBF24] bg-[#FEF3C7]" : "border-[#34D399] bg-[#D1FAE5]"}`}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-stone-700"><IndianRupee size={16} /> {t("totalOwed")}</div>
            <div className="mt-2 text-2xl font-extrabold tabular-nums">{inr(dash.total_owed)}</div>
          </div>
          <div data-testid="stat-overdue" className={`rounded-xl border p-4 ${dash.overdue_count > 0 ? "border-[#F87171] bg-[#FEE2E2]" : "border-[#34D399] bg-[#D1FAE5]"}`}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-stone-700"><ClockAlert size={16} /> {t("overduePayments")}</div>
            <div className="mt-2 text-2xl font-extrabold tabular-nums">{dash.overdue_count}</div>
          </div>
        </div>
      )}

      {dash && (
        <div data-testid="payments-summary" className="rounded-xl border border-[#E5E1D8] bg-white p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-stone-500">{t("perWholesaler")}</div>
          <ul className="mt-2 space-y-2">
            {dash.per_wholesaler.map((w) => {
              const wholesaler = wholesalers.find((x) => x.id === w.wholesaler_id);
              const phone = wholesaler?.phone;
              const msg = `Namaste ${w.name}, ₹${w.owed} pending${w.due_date ? ` (due ${w.due_date})` : ""}. Kripya settle karein. Dhanyavaad.`;
              return (
                <li key={w.wholesaler_id} className="flex items-center justify-between border-t border-[#E5E1D8] pt-2 first:border-0 first:pt-0">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{w.name}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge tone={w.status}>
                        {w.status === "red" ? `${t("overdue")} ${w.days_overdue}d` : w.status === "yellow" ? t("dueSoon") : t("onTime")}
                      </StatusBadge>
                      {w.due_date && <span className="text-[11px] text-stone-500">{t("dueDate")} {ddmmyyyy(w.due_date)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {w.status === "red" && phone && (
                      <a
                        data-testid={`whatsapp-remind-${w.wholesaler_id}`}
                        href={waLink(phone, msg)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1 rounded-full bg-[#25D366] px-3 text-xs font-bold text-white"
                      >
                        <MessageCircle size={14} /> Remind
                      </a>
                    )}
                    <div className="text-right text-lg font-bold tabular-nums">{inr(w.owed)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Recent</h2>
        <ul data-testid="payments-list" className="space-y-2">
          {payments.length === 0 && <li className="rounded-xl border border-[#E5E1D8] bg-white p-6 text-center text-sm text-stone-500">{t("noData")}</li>}
          {payments.map((p) => (
            <li key={p.id} data-testid={`payment-item-${p.id}`} className="flex items-center justify-between rounded-xl border border-[#E5E1D8] bg-white p-4">
              <div>
                <div className="font-semibold">{wNameById[p.wholesaler_id] || "—"}</div>
                <div className="mt-0.5 text-xs text-stone-500 tabular-nums">{ddmmyyyy(p.date)}</div>
                {p.order_id && orderById[p.order_id] && (
                  <div className="mt-0.5 text-[11px] text-stone-500">
                    {t("linkedOrder")}: {ddmmyyyy(orderById[p.order_id].date_ordered)} · {inr(orderById[p.order_id].total)}
                  </div>
                )}
                <div className="mt-1"><StatusBadge tone="green">{t(p.kind === "Full" ? "fullPayment" : "partial")}</StatusBadge></div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold tabular-nums text-[#065F46]">{inr(p.amount)}</div>
                <button data-testid={`delete-payment-${p.id}`} onClick={() => remove(p.id)} className="mt-1 rounded-md border border-[#F87171] p-1.5 text-[#991B1B]"><Trash2 size={14} /></button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setShowForm(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{t("addPayment")}</h2>
              <button data-testid="payment-close-btn" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={save} className="space-y-3">
              <select data-testid="payment-wholesaler" required value={form.wholesaler_id} onChange={(e) => setForm({ ...form, wholesaler_id: e.target.value, order_id: "" })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3">
                <option value="">{t("selectWholesaler")}</option>
                {wholesalers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              {form.wholesaler_id && wholesalerOrders.length > 0 && (
                <select data-testid="payment-order" value={form.order_id} onChange={(e) => setForm({ ...form, order_id: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3">
                  <option value="">{t("noOrder")}</option>
                  {wholesalerOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {ddmmyyyy(o.date_ordered)} · ₹{o.total} · {o.status}
                    </option>
                  ))}
                </select>
              )}
              <input data-testid="payment-date" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3" />
              <input data-testid="payment-amount" type="number" step="0.01" min="0" required placeholder={t("amount")} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3 tabular-nums" />
              <select data-testid="payment-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3">
                <option value="Partial">{t("partial")}</option>
                <option value="Full">{t("fullPayment")}</option>
              </select>
              <textarea data-testid="payment-note" placeholder={t("note")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="min-h-[64px] w-full rounded-lg border border-[#E5E1D8] p-3" />
              <button data-testid="save-payment-btn" type="submit" className="h-14 w-full rounded-lg bg-[#0F172A] font-bold text-white">{t("save")}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
