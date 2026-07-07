import React from "react";
import { NavLink, useNavigate, Outlet } from "react-router-dom";
import { Home, Users, ClipboardList, Wallet, MoreHorizontal, LogOut, Languages } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { useAuth } from "@/context/AuthContext";

function TabLink({ to, icon: Icon, label, testId }) {
  return (
    <NavLink
      to={to}
      end
      data-testid={testId}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
          isActive ? "text-[#0F172A]" : "text-stone-500"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function Layout() {
  const { t, lang, toggle } = useI18n();
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-[#F5F3EC] text-[#111827]">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b border-[#E5E1D8] bg-[#F5F3EC]/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#0F172A] text-white font-bold">क</div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight">{t("appName")}</div>
              <div className="text-[11px] text-stone-500 truncate max-w-[180px]">{user?.name || ""}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              data-testid="lang-toggle-btn"
              onClick={toggle}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E1D8] bg-white px-3 py-2 text-xs font-semibold hover:bg-stone-50"
            >
              <Languages size={16} />
              {lang === "en" ? "हिं" : "EN"}
            </button>
            <button
              data-testid="logout-btn"
              onClick={async () => { await logout(); nav("/login"); }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E1D8] bg-white px-3 py-2 text-xs font-semibold hover:bg-stone-50"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-4">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav
        data-testid="bottom-nav"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E1D8] bg-white shadow-sm"
      >
        <div className="mx-auto flex max-w-2xl">
          <TabLink to="/" icon={Home} label={t("home")} testId="nav-home" />
          <TabLink to="/wholesalers" icon={Users} label={t("wholesalers")} testId="nav-wholesalers" />
          <TabLink to="/orders" icon={ClipboardList} label={t("orders")} testId="nav-orders" />
          <TabLink to="/payments" icon={Wallet} label={t("payments")} testId="nav-payments" />
          <TabLink to="/more" icon={MoreHorizontal} label={t("more")} testId="nav-more" />
        </div>
      </nav>
    </div>
  );
}
