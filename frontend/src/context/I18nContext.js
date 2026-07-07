import React, { createContext, useContext, useEffect, useState } from "react";
import { translations } from "@/i18n/translations";

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("kirana_lang") || "en");

  useEffect(() => {
    localStorage.setItem("kirana_lang", lang);
  }, [lang]);

  const t = (key) => translations[lang]?.[key] ?? translations.en[key] ?? key;
  const toggle = () => setLang((l) => (l === "en" ? "hi" : "en"));

  return (
    <I18nContext.Provider value={{ lang, setLang, toggle, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be inside I18nProvider");
  return ctx;
}
