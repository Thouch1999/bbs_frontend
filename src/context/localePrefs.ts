// Plain store mirroring LocaleContext's state for api/client.ts to read
// without importing React context — same rationale as api/tokenStore.ts.
export type Language = "km" | "en";
export type Currency = "KHR" | "USD";

const LANGUAGE_KEY = "bbms.language";
const CURRENCY_KEY = "bbms.currency";

export function getStoredLanguage(): Language {
  const stored = localStorage.getItem(LANGUAGE_KEY);
  return stored === "en" ? "en" : "km";
}

export function getStoredCurrency(): Currency {
  const stored = localStorage.getItem(CURRENCY_KEY);
  return stored === "USD" ? "USD" : "KHR";
}

export function storeLanguage(language: Language): void {
  localStorage.setItem(LANGUAGE_KEY, language);
}

export function storeCurrency(currency: Currency): void {
  localStorage.setItem(CURRENCY_KEY, currency);
}
