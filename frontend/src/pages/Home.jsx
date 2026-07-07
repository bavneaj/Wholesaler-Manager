import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { ddmmyyyy } from "@/lib/format";
import { AlertTriangle, PackageMinus, ClipboardList, ArrowRight, Wallet } from "lucide-react";

function BigStat({ testId, icon: Icon, label, value, tone = "neutral", to, cta }) {
  const toneMap = {
    neutral: "border-[#E5E1D8] bg-white",
    red: "border-[#F87171] bg-[#FEE2E2]",
    yellow: "border-[#FBBF24] bg-[#FEF3C7]",
    green: "border-[#34D399] bg-[#D1FAE5]",
  };
  return (
    <Link to={to} data-testid={testId} className={`block rounded-xl border p-5 ${toneMap[tone]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-stone-700">
          <Icon size={18} /> {label}
        </div>
        <ArrowRight size={16} className="text-stone-500" />
      </div>
      <div className="mt-3 text-4xl font-extrabold tabular-nums tracking-tight">{value}</div>
      {cta && <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-stone-600">{cta}</div>}
    </Link>
  );
}

export default function HomePage() {
  const { t } = useI18n();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/analytics/dashboard").then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data) {
    return <div className="py-10 text-center text-stone-500">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 data-testid="home-title" className="text-3xl font-bold tracking-tight">{t("dashboard")}</h1>
        <p className="mt-1 text-sm text-stone-500">{t("welcome")} — {t("tapToView")}</p>
      </section>

      <section className="grid grid-cols-1 gap-3">
        <BigStat
          testId="stat-pending-orders"
          icon={ClipboardList}
          label={t("pendingOrders")}
          value={data.pending_orders}
          tone={data.pending_orders > 0 ? "yellow" : "green"}
          to="/orders"
          cta={data.pending_orders > 0 ? t("todayPending") : t("onTime")}
        />
        <BigStat
          testId="stat-low-stock"
          icon={PackageMinus}
          label={t("lowStock")}
          value={data.low_stock_count}
          tone={data.low_stock_count > 0 ? "red" : "green"}
          to="/more"
          cta={data.low_stock_count > 0 ? t("reorder") : t("ok")}
        />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-stone-600">{t("quickView")}</h2>
          <Link data-testid="home-goto-payments" to="/payments" className="inline-flex items-center gap-1 text-xs font-bold text-[#0F172A] underline">
            <Wallet size={14} /> {t("payments")}
          </Link>
        </div>
        <ul data-testid="home-owed-list" className="divide-y divide-[#E5E1D8] rounded-xl border border-[#E5E1D8] bg-white">
          {data.per_wholesaler.length === 0 && <li className="p-4 text-sm text-stone-500">{t("noData")}</li>}
          {data.per_wholesaler.slice(0, 5).map((w) => (
            <li key={w.wholesaler_id} className="flex items-center justify-between p-4">
              <div className="min-w-0">
                <div className="truncate font-semibold">{w.name}</div>
                <div className="mt-0.5 text-[11px] text-stone-500 tabular-nums">
                  {w.due_date ? `${t("dueDate")} ${ddmmyyyy(w.due_date)}` : "—"}
                </div>
              </div>
              <div className={`text-sm font-bold uppercase tracking-wide ${w.status === "red" ? "text-[#991B1B]" : w.status === "yellow" ? "text-[#92400E]" : "text-[#065F46]"}`}>
                {w.status === "red" ? `${t("overdue")} ${w.days_overdue}d` : w.status === "yellow" ? t("dueSoon") : t("onTime")}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {data.low_stock_items.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-[0.06em] text-stone-600">
            <AlertTriangle size={14} /> {t("lowStock")}
          </h2>
          <ul data-testid="home-low-stock-list" className="grid grid-cols-2 gap-2">
            {data.low_stock_items.map((i) => (
              <li key={i.id} className="rounded-lg border border-[#F87171] bg-[#FEE2E2] p-3">
                <div className="font-semibold">{i.name}</div>
                <div className="text-xs tabular-nums text-[#991B1B]">
                  {i.current_stock} {i.unit} / {t("threshold")} {i.low_threshold}
                </div>
              </li>
            ))}
          </ul>
          <Link data-testid="home-goto-more" to="/more" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#0F172A] underline">
            {t("reorder")} <ArrowRight size={14} />
          </Link>
        </section>
      )}
    </div>
  );
}
