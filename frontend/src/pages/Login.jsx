import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Languages, Store } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const { t, lang, toggle } = useI18n();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@kirana.shop");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await login(email.trim().toLowerCase(), password);
    setBusy(false);
    if (res.ok) nav("/");
    else setError(res.error);
  };

  return (
    <div className="relative min-h-screen">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-25"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1670684684445-a4504dca0bbc?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njl8MHwxfHNlYXJjaHwxfHxncm9jZXJ5JTIwc3RvcmUlMjBzaGVsdmVzJTIwYmx1ciUyMGJhY2tncm91bmR8ZW58MHx8fHwxNzgzNDMzODY5fDA&ixlib=rb-4.1.0&q=85')" }}
      />
      <div className="absolute inset-0 bg-[#F5F3EC]/70" />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#0F172A] text-white"><Store size={20} /></div>
            <div>
              <div className="text-lg font-extrabold tracking-tight">{t("appName")}</div>
              <div className="text-xs text-stone-500">Kirana · Bahi Khata</div>
            </div>
          </div>
          <button
            data-testid="auth-lang-toggle"
            onClick={toggle}
            className="inline-flex items-center gap-1 rounded-full border border-[#E5E1D8] bg-white px-3 py-2 text-xs font-semibold"
          >
            <Languages size={16} /> {lang === "en" ? "हिं" : "EN"}
          </button>
        </div>

        <div className="rounded-xl border border-[#E5E1D8] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight">{t("login")}</h1>
          <p className="mt-1 text-sm text-stone-500">{t("tagline")}</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-stone-600">{t("email")}</label>
              <input
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 h-14 w-full rounded-lg border border-[#E5E1D8] bg-white px-4 text-base focus:border-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/20"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-stone-600">{t("password")}</label>
              <input
                data-testid="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 h-14 w-full rounded-lg border border-[#E5E1D8] bg-white px-4 text-base focus:border-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/20"
              />
            </div>
            {error && <div data-testid="login-error" className="rounded-lg border border-[#F87171] bg-[#FEE2E2] px-4 py-3 text-sm text-[#991B1B]">{error}</div>}
            <button
              data-testid="login-submit-btn"
              type="submit"
              disabled={busy}
              className="h-14 w-full rounded-lg bg-[#0F172A] text-base font-bold text-white transition-colors hover:bg-[#1E293B] disabled:opacity-60"
            >
              {busy ? "…" : t("login")}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-stone-600">
            {t("newAccount")} · <Link data-testid="goto-signup-link" to="/register" className="font-bold text-[#0F172A] underline">{t("signup")}</Link>
          </div>
          <div className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-[11px] text-stone-500">
            Demo: admin@kirana.shop / admin123
          </div>
        </div>
      </div>
    </div>
  );
}
