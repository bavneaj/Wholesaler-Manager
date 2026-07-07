import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { inr, ddmmyyyy, todayIso } from "@/lib/format";
import StatusBadge from "@/components/app/StatusBadge";
import { Plus, X, Trash2 } from "lucide-react";

export default function Payments() {
  const { t } = useI18n();
  const [payments, setPayments] = useState([]);
  const [wholesalers, setWholesalers] = useState([]);
  const [dash, setDash] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ wholesaler_id: "", date: todayIso(), amount: "", kind: "Partial", note: "" });

  const load = async () => {
    const [p, w, d] = await Promise.all([
      api.get("/payments"),
      api.get("/wholesalers"),
      api.get("/analytics/dashboard"),
    ]);
    setPayments(p.data);
    setWholesalers(w.data);
    setDash(d.data);
  };
  useEffect(() => { load(); }, []);

  const wNameById = useMemo(() => Object.fromEntries(wholesalers.map((w) => [w.id, w.name])), [wholesalers]);

  const openAdd = () => {
    setForm({ wholesaler_id: wholesalers[0]?.id || "", date: todayIso(), amount: "", kind: "Partial", note: "" });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    await api.post("/payments", { ...form, amount: Number(form.amount) || 0 });
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
        <button data-testid="add-payment-btn" onClick={openAdd} className="inline-flex h-11 items-center gap-1 rounded-lg bg-[#0F172A] px-4 text-sm font-bold text-white">
          <Plus size={16} /> {t("addPayment")}
        </button>
      </div>

      {dash && (
        <div data-testid="payments-summary" className="rounded-xl border border-[#E5E1D8] bg-white p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-stone-500">{t("totalOwed")}</div>
          <div className="mt-1 text-3xl font-extrabold tabular-nums">{inr(dash.total_owed)}</div>
          <ul className="mt-4 space-y-2">
            {dash.per_wholesaler.map((w) => (
              <li key={w.wholesaler_id} className="flex items-center justify-between border-t border-[#E5E1D8] pt-2 first:border-0 first:pt-0">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{w.name}</div>
                  <div className="mt-1">
                    <StatusBadge tone={w.status}>
                      {w.status === "red" ? `${t("overdue")} ${w.days_overdue}d` : w.status === "yellow" ? t("dueSoon") : t("onTime")}
                    </StatusBadge>
                    {w.due_date && <span className="ml-2 text-[11px] text-stone-500">{t("dueDate")} {ddmmyyyy(w.due_date)}</span>}
                  </div>
                </div>
                <div className="text-right text-lg font-bold tabular-nums">{inr(w.owed)}</div>
              </li>
            ))}
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
              <select data-testid="payment-wholesaler" required value={form.wholesaler_id} onChange={(e) => setForm({ ...form, wholesaler_id: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3">
                <option value="">{t("selectWholesaler")}</option>
                {wholesalers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
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
