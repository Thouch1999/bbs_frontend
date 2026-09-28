import i18n from "i18next";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { getStoredCurrency, getStoredLanguage, storeCurrency, storeLanguage, type Currency, type Language } from "./localePrefs";

interface LocaleContextValue {
  language: Language;
  currency: Currency;
  setLanguage: (language: Language) => void;
  setCurrency: (currency: Currency) => void;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getStoredLanguage());
  const [currency, setCurrencyState] = useState<Currency>(getStoredCurrency());

  useEffect(() => {
    document.documentElement.lang = language;
    void i18n.changeLanguage(language);
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    storeLanguage(next);
    setLanguageState(next);
  }, []);

  const setCurrency = useCallback((next: Currency) => {
    storeCurrency(next);
    setCurrencyState(next);
  }, []);

  const value = useMemo(
    () => ({ language, currency, setLanguage, setCurrency }),
    [language, currency, setLanguage, setCurrency]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}
