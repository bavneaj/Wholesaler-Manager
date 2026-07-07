import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Store } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await register(name.trim(), email.trim().toLowerCase(), password);
    setBusy(false);
    if (res.ok) nav("/");
    else setError(res.error);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-4 flex items-center gap-2">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#0F172A] text-white"><Store size={20} /></div>
        <div>
          <div className="text-lg font-extrabold tracking-tight">{t("appName")}</div>
        </div>
      </div>
      <div className="rounded-xl border border-[#E5E1D8] bg-white p-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("signup")}</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-stone-600">{t("name")}</label>
            <input data-testid="signup-name-input" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 h-14 w-full rounded-lg border border-[#E5E1D8] px-4" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-stone-600">{t("email")}</label>
            <input data-testid="signup-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 h-14 w-full rounded-lg border border-[#E5E1D8] px-4" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-stone-600">{t("password")}</label>
            <input data-testid="signup-password-input" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 h-14 w-full rounded-lg border border-[#E5E1D8] px-4" />
          </div>
          {error && <div data-testid="signup-error" className="rounded-lg border border-[#F87171] bg-[#FEE2E2] px-4 py-3 text-sm text-[#991B1B]">{error}</div>}
          <button data-testid="signup-submit-btn" disabled={busy} className="h-14 w-full rounded-lg bg-[#0F172A] font-bold text-white disabled:opacity-60">{busy ? "…" : t("signup")}</button>
        </form>
        <div className="mt-4 text-center text-sm text-stone-600">
          {t("haveAccount")} · <Link data-testid="goto-login-link" to="/login" className="font-bold text-[#0F172A] underline">{t("login")}</Link>
        </div>
      </div>
    </div>
  );
}
