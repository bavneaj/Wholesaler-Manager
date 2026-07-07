import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { inr, ddmmyyyy } from "@/lib/format";
import StatusBadge from "@/components/app/StatusBadge";
import { AlertTriangle, PackageMinus, ClockAlert, IndianRupee, ClipboardList, Users, ArrowRight } from "lucide-react";

function StatCard({ testId, icon: Icon, label, value, tone = "neutral" }) {
  const toneMap = {
    neutral: "border-[#E5E1D8] bg-white",
    red: "border-[#F87171] bg-[#FEE2E2]",
    yellow: "border-[#FBBF24] bg-[#FEF3C7]",
    green: "border-[#34D399] bg-[#D1FAE5]",
  };
  return (
    <div data-testid={testId} className={`rounded-xl border p-4 ${toneMap[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-stone-600">
        <Icon size={16} /> {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight">{value}</div>
    </div>
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

      <section className="grid grid-cols-2 gap-3">
        <StatCard
          testId="stat-total-owed"
          icon={IndianRupee}
          label={t("totalOwed")}
          value={inr(data.total_owed)}
          tone={data.total_owed > 0 ? "yellow" : "green"}
        />
        <StatCard
          testId="stat-overdue"
          icon={ClockAlert}
          label={t("overduePayments")}
          value={data.overdue_count}
          tone={data.overdue_count > 0 ? "red" : "green"}
        />
        <StatCard
          testId="stat-pending-orders"
          icon={ClipboardList}
          label={t("pendingOrders")}
          value={data.pending_orders}
          tone={data.pending_orders > 0 ? "yellow" : "green"}
        />
        <StatCard
          testId="stat-low-stock"
          icon={PackageMinus}
          label={t("lowStock")}
          value={data.low_stock_count}
          tone={data.low_stock_count > 0 ? "red" : "green"}
        />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-stone-600">{t("perWholesaler")}</h2>
          <Link data-testid="home-goto-wholesalers" to="/wholesalers" className="inline-flex items-center gap-1 text-xs font-bold text-[#0F172A] underline">
            <Users size={14} /> {t("wholesalers")}
          </Link>
        </div>
        <ul data-testid="home-owed-list" className="divide-y divide-[#E5E1D8] rounded-xl border border-[#E5E1D8] bg-white">
          {data.per_wholesaler.length === 0 && <li className="p-4 text-sm text-stone-500">{t("noData")}</li>}
          {data.per_wholesaler.map((w) => (
            <li key={w.wholesaler_id} className="flex items-center justify-between p-4">
              <div className="min-w-0">
                <div className="truncate font-semibold">{w.name}</div>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge tone={w.status}>
                    {w.status === "red" ? `${t("overdue")} ${w.days_overdue}d` : w.status === "yellow" ? t("dueSoon") : t("onTime")}
                  </StatusBadge>
                  {w.due_date && <span className="text-[11px] text-stone-500">{t("dueDate")} {ddmmyyyy(w.due_date)}</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase text-stone-500">{t("totalOwed")}</div>
                <div className="text-lg font-bold tabular-nums">{inr(w.owed)}</div>
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
