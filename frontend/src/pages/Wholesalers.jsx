import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import StatusBadge from "@/components/app/StatusBadge";
import { Phone, Plus, Pencil, Trash2, X } from "lucide-react";

const emptyForm = { name: "", phone: "", items: "", payment_terms: "Cash", credit_period_days: 0, notes: "" };

export default function Wholesalers() {
  const { t } = useI18n();
  const [list, setList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const { data } = await api.get("/wholesalers");
    setList(data);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (w) => {
    setEditing(w.id);
    setForm({ ...w, items: (w.items || []).join(", ") });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      items: form.items.split(",").map((s) => s.trim()).filter(Boolean),
      payment_terms: form.payment_terms,
      credit_period_days: Number(form.credit_period_days) || 0,
      notes: form.notes,
    };
    if (editing) await api.put(`/wholesalers/${editing}`, payload);
    else await api.post("/wholesalers", payload);
    setShowForm(false);
    load();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this wholesaler?")) return;
    await api.delete(`/wholesalers/${id}`);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("wholesalers")}</h1>
        <button
          data-testid="add-wholesaler-btn"
          onClick={openAdd}
          className="inline-flex h-11 items-center gap-1 rounded-lg bg-[#0F172A] px-4 text-sm font-bold text-white"
        >
          <Plus size={16} /> {t("addWholesaler")}
        </button>
      </div>

      <ul data-testid="wholesaler-list" className="space-y-2">
        {list.length === 0 && <li className="rounded-xl border border-[#E5E1D8] bg-white p-6 text-center text-sm text-stone-500">{t("noData")}</li>}
        {list.map((w) => (
          <li key={w.id} data-testid={`wholesaler-item-${w.id}`} className="rounded-xl border border-[#E5E1D8] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-bold">{w.name}</div>
                {w.phone && (
                  <a href={`tel:${w.phone}`} className="mt-0.5 inline-flex items-center gap-1 text-xs text-stone-600">
                    <Phone size={12} /> {w.phone}
                  </a>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {(w.items || []).map((it, i) => (
                    <span key={i} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-700">{it}</span>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge tone={w.payment_terms === "Credit" ? "yellow" : w.payment_terms === "Cash" ? "green" : "neutral"}>
                    {t(w.payment_terms.toLowerCase())}
                  </StatusBadge>
                  {w.payment_terms === "Credit" && (
                    <span className="text-xs text-stone-500 tabular-nums">{w.credit_period_days} {t("creditDays")}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button data-testid={`edit-wholesaler-${w.id}`} onClick={() => openEdit(w)} className="rounded-md border border-[#E5E1D8] p-2"><Pencil size={14} /></button>
                <button data-testid={`delete-wholesaler-${w.id}`} onClick={() => remove(w.id)} className="rounded-md border border-[#F87171] p-2 text-[#991B1B]"><Trash2 size={14} /></button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setShowForm(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{editing ? t("edit") : t("addWholesaler")}</h2>
              <button data-testid="close-form-btn" onClick={() => setShowForm(false)} className="p-1"><X size={20} /></button>
            </div>
            <form onSubmit={save} className="space-y-3">
              <input data-testid="form-name" required placeholder={t("name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3" />
              <input data-testid="form-phone" placeholder={t("phone")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3" />
              <input data-testid="form-items" placeholder={`${t("itemsSupplied")} (comma separated)`} value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3" />
              <select data-testid="form-terms" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3">
                <option value="Cash">{t("cash")}</option>
                <option value="Credit">{t("credit")}</option>
                <option value="Depends">{t("depends")}</option>
              </select>
              {form.payment_terms !== "Cash" && (
                <input data-testid="form-credit-days" type="number" min="0" placeholder={t("creditDays")} value={form.credit_period_days} onChange={(e) => setForm({ ...form, credit_period_days: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3" />
              )}
              <textarea data-testid="form-notes" placeholder={t("note")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-[64px] w-full rounded-lg border border-[#E5E1D8] p-3" />
              <button data-testid="save-wholesaler-btn" type="submit" className="h-14 w-full rounded-lg bg-[#0F172A] font-bold text-white">{t("save")}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
