import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatApiErrorDetail } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { inr, ddmmyyyy } from "@/lib/format";
import StatusBadge from "@/components/app/StatusBadge";
import { Plus, X, Trash2, TrendingUp, TrendingDown, Minus, Sparkles, Users2 } from "lucide-react";

const TrendIcon = ({ trend }) => trend === "up" ? <TrendingUp size={14} className="text-[#991B1B]" /> : trend === "down" ? <TrendingDown size={14} className="text-[#065F46]" /> : <Minus size={14} className="text-stone-400" />;

export default function More() {
  const { t } = useI18n();
  const [tab, setTab] = useState("prices");
  const [prices, setPrices] = useState([]);
  const [inv, setInv] = useState([]);
  const [reorder, setReorder] = useState([]);
  const [staff, setStaff] = useState([]);
  const [me, setMe] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", current_stock: 0, unit: "kg", low_threshold: 0 });
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: "", email: "", password: "" });
  const [staffError, setStaffError] = useState("");

  const load = async () => {
    const [p, i, r, s, m] = await Promise.all([
      api.get("/analytics/price-comparison"),
      api.get("/inventory"),
      api.get("/analytics/reorder-suggestions"),
      api.get("/staff").catch(() => ({ data: [] })),
      api.get("/auth/me"),
    ]);
    setPrices(p.data);
    setInv(i.data);
    setReorder(r.data);
    setStaff(s.data);
    setMe(m.data);
  };
  useEffect(() => { load(); }, []);

  const isOwner = me && (me.role === "owner" || me.role === "admin");

  const saveStaff = async (e) => {
    e.preventDefault();
    setStaffError("");
    try {
      await api.post("/staff", { name: staffForm.name.trim(), email: staffForm.email.trim().toLowerCase(), password: staffForm.password });
      setShowStaffForm(false);
      setStaffForm({ name: "", email: "", password: "" });
      load();
    } catch (err) {
      setStaffError(formatApiErrorDetail(err.response?.data?.detail) || "Failed to add staff");
    }
  };

  const removeStaff = async (id) => {
    if (!window.confirm("Remove staff member?")) return;
    await api.delete(`/staff/${id}`);
    load();
  };

  const openAdd = () => { setEditing(null); setForm({ name: "", current_stock: 0, unit: "kg", low_threshold: 0 }); setShowForm(true); };
  const openEdit = (i) => { setEditing(i.id); setForm({ name: i.name, current_stock: i.current_stock, unit: i.unit, low_threshold: i.low_threshold }); setShowForm(true); };

  const save = async (e) => {
    e.preventDefault();
    const payload = { name: form.name.trim(), current_stock: Number(form.current_stock) || 0, unit: form.unit, low_threshold: Number(form.low_threshold) || 0 };
    if (editing) await api.put(`/inventory/${editing}`, payload); else await api.post("/inventory", payload);
    setShowForm(false); load();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete item?")) return;
    await api.delete(`/inventory/${id}`); load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{t("more")}</h1>

      <div className="grid grid-cols-4 gap-1 rounded-lg border border-[#E5E1D8] bg-white p-1">
        {["prices", "inventory", "reorder", "staff"].map((key) => (
          <button
            key={key}
            data-testid={`tab-${key}`}
            onClick={() => setTab(key)}
            className={`rounded-md px-2 py-2 text-[10px] font-bold uppercase tracking-wide ${tab === key ? "bg-[#0F172A] text-white" : "text-stone-600"}`}
          >
            {key === "prices" ? t("priceComparison") : key === "inventory" ? t("inventory") : key === "reorder" ? t("reorder") : "Staff"}
          </button>
        ))}
      </div>

      {tab === "prices" && (
        <ul data-testid="prices-list" className="space-y-2">
          {prices.length === 0 && <li className="rounded-xl border border-[#E5E1D8] bg-white p-6 text-center text-sm text-stone-500">{t("noData")}</li>}
          {prices.map((row) => (
            <li key={row.item} className="rounded-xl border border-[#E5E1D8] bg-white p-4">
              <div className="mb-2 font-bold">{row.item}</div>
              <ul className="space-y-1">
                {row.wholesalers.map((w) => (
                  <li key={w.wholesaler_id} className={`flex items-center justify-between rounded-md px-3 py-2 ${w.is_lowest ? "border border-[#34D399] bg-[#D1FAE5]" : "border border-[#E5E1D8]"}`}>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{w.wholesaler_name}</div>
                      <div className="text-[11px] text-stone-500 tabular-nums">
                        {w.history.length} {t("ordered")} · {ddmmyyyy(w.history[w.history.length - 1].date)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendIcon trend={w.trend} />
                      <div className="text-right">
                        <div className="text-lg font-bold tabular-nums">{inr(w.latest_price)}</div>
                        {w.is_lowest && <div className="text-[10px] font-bold uppercase text-[#065F46]">{t("lowest")}</div>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {tab === "inventory" && (
        <>
          <button data-testid="add-inventory-btn" onClick={openAdd} className="inline-flex h-11 items-center gap-1 rounded-lg bg-[#0F172A] px-4 text-sm font-bold text-white">
            <Plus size={16} /> Add Item
          </button>
          <ul data-testid="inventory-list" className="space-y-2">
            {inv.length === 0 && <li className="rounded-xl border border-[#E5E1D8] bg-white p-6 text-center text-sm text-stone-500">{t("noData")}</li>}
            {inv.map((i) => {
              const low = Number(i.current_stock) <= Number(i.low_threshold);
              return (
                <li key={i.id} data-testid={`inv-item-${i.id}`} className={`flex items-center justify-between rounded-xl border p-4 ${low ? "border-[#F87171] bg-[#FEE2E2]" : "border-[#E5E1D8] bg-white"}`}>
                  <div>
                    <div className="font-bold">{i.name}</div>
                    <div className="mt-1 text-xs text-stone-600 tabular-nums">
                      {t("stock")}: {i.current_stock} {i.unit} · {t("threshold")}: {i.low_threshold} {i.unit}
                    </div>
                    {low && <div className="mt-1"><StatusBadge tone="red">{t("stockLow")}</StatusBadge></div>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button data-testid={`edit-inv-${i.id}`} onClick={() => openEdit(i)} className="rounded-md border border-[#E5E1D8] bg-white p-2 text-xs">Edit</button>
                    <button data-testid={`delete-inv-${i.id}`} onClick={() => remove(i.id)} className="rounded-md border border-[#F87171] bg-white p-2 text-[#991B1B]"><Trash2 size={14} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {tab === "reorder" && (
        <ul data-testid="reorder-list" className="space-y-2">
          {reorder.length === 0 && <li className="rounded-xl border border-[#34D399] bg-[#D1FAE5] p-6 text-center text-sm font-semibold text-[#065F46]">All stocks are fine 👌</li>}
          {reorder.map((r) => (
            <li key={r.item} className="rounded-xl border border-[#E5E1D8] bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold">{r.item}</div>
                  <div className="text-xs text-stone-500 tabular-nums">{r.current_stock} {r.unit} · {t("threshold")}: {r.low_threshold}</div>
                </div>
                <StatusBadge tone="red">{t("stockLow")}</StatusBadge>
              </div>
              {r.suggested_wholesaler ? (
                <div className="mt-3 rounded-lg border border-[#34D399] bg-[#D1FAE5] p-3">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-[#065F46]">
                    <Sparkles size={12} /> {t("bestFor")}
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <div className="font-bold">{r.suggested_wholesaler.wholesaler_name}</div>
                    <div className="text-lg font-bold tabular-nums text-[#065F46]">{inr(r.suggested_wholesaler.latest_price)}</div>
                  </div>
                  <div className="mt-0.5 text-[11px] text-stone-600">
                    {r.issue_count_for_best === 0 ? t("reliable") : `${r.issue_count_for_best} ${t("issues")}`}
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-dashed border-stone-300 p-3 text-xs text-stone-500">
                  No order history yet — add an order to get suggestions.
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {tab === "staff" && (
        <div className="space-y-2">
          {isOwner && (
            <button data-testid="add-staff-btn" onClick={() => setShowStaffForm(true)} className="inline-flex h-11 items-center gap-1 rounded-lg bg-[#0F172A] px-4 text-sm font-bold text-white">
              <Plus size={16} /> Add Staff
            </button>
          )}
          <ul data-testid="staff-list" className="space-y-2">
            {staff.length === 0 && <li className="rounded-xl border border-[#E5E1D8] bg-white p-6 text-center text-sm text-stone-500">{t("noData")}</li>}
            {staff.map((s) => (
              <li key={s.id} data-testid={`staff-item-${s.id}`} className="flex items-center justify-between rounded-xl border border-[#E5E1D8] bg-white p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Users2 size={16} className="text-stone-500" />
                    <div className="truncate font-bold">{s.name}</div>
                  </div>
                  <div className="mt-0.5 text-xs text-stone-500 truncate">{s.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${s.role === "owner" || s.role === "admin" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-stone-100 text-stone-700"}`}>{s.role}</span>
                  {isOwner && s.role !== "owner" && s.role !== "admin" && s.id !== me?.id && (
                    <button data-testid={`delete-staff-${s.id}`} onClick={() => removeStaff(s.id)} className="rounded-md border border-[#F87171] p-1.5 text-[#991B1B]"><Trash2 size={14} /></button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!isOwner && <p className="text-xs text-stone-500">Only the shop owner can add or remove staff.</p>}
        </div>
      )}

      {showStaffForm && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setShowStaffForm(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Add Staff</h2>
              <button data-testid="staff-close-btn" onClick={() => setShowStaffForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={saveStaff} className="space-y-3">
              <input data-testid="staff-form-name" required placeholder={t("name")} value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3" />
              <input data-testid="staff-form-email" type="email" required placeholder={t("email")} value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3" />
              <input data-testid="staff-form-password" type="password" minLength={6} required placeholder={`${t("password")} (min 6)`} value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3" />
              {staffError && <div data-testid="staff-error" className="rounded-lg border border-[#F87171] bg-[#FEE2E2] px-4 py-2 text-sm text-[#991B1B]">{staffError}</div>}
              <button data-testid="save-staff-btn" type="submit" className="h-14 w-full rounded-lg bg-[#0F172A] font-bold text-white">{t("save")}</button>
            </form>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setShowForm(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{editing ? t("edit") : "Add Item"}</h2>
              <button data-testid="inv-close-btn" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={save} className="space-y-3">
              <input data-testid="inv-form-name" required placeholder={t("itemName")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3" />
              <div className="grid grid-cols-2 gap-2">
                <input data-testid="inv-form-stock" type="number" step="0.01" placeholder={t("stock")} value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3 tabular-nums" />
                <input data-testid="inv-form-unit" placeholder={t("unit")} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3" />
              </div>
              <input data-testid="inv-form-threshold" type="number" step="0.01" placeholder={t("threshold")} value={form.low_threshold} onChange={(e) => setForm({ ...form, low_threshold: e.target.value })} className="h-12 w-full rounded-lg border border-[#E5E1D8] px-3 tabular-nums" />
              <button data-testid="save-inv-btn" type="submit" className="h-14 w-full rounded-lg bg-[#0F172A] font-bold text-white">{t("save")}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
