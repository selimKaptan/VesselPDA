import { createContext, useContext, useState } from "react";
import en from "../locales/en.json";
import tr from "../locales/tr.json";

export type Lang = "en" | "tr";

const translations: Record<Lang, Record<string, string>> = { en, tr };

export interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatDate: (date: string | Date | null | undefined) => string;
}

export const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
  formatDate: (d) => d ? String(d) : "",
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem("vpda-lang");
      return (stored === "tr" || stored === "en") ? stored : "en";
    } catch { return "en"; }
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("vpda-lang", l); } catch {}
  };

  const t = (key: string, vars?: Record<string, string | number>): string => {
    let text: string = translations[lang][key] ?? translations.en[key] ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      });
    }
    return text;
  };

  const formatDate = (date: string | Date | null | undefined): string => {
    if (!date) return "";
    try {
      const d = typeof date === "string" ? new Date(date) : date;
      if (isNaN(d.getTime())) return String(date);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return lang === "tr" ? `${day}.${month}.${year}` : `${month}/${day}/${year}`;
    } catch { return String(date); }
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, formatDate }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
