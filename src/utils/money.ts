import type { Currency, Language } from "../context/localePrefs";

const LOCALE_TAG: Record<Language, string> = { km: "km-KH", en: "en-US" };
const RIEL_SIGN = String.fromCharCode(0x17db);

/** amount is a decimal-as-string from the API (e.g. "12.50", "41000") — never a float. */
export function formatMoney(amount: string, currency: Currency, language: Language = "en"): string {
  const value = Number(amount);
  if (currency === "KHR") {
    // KHR has no minor unit in everyday use - whole riel, grouped.
    const grouped = new Intl.NumberFormat(LOCALE_TAG[language], { maximumFractionDigits: 0 }).format(value);
    return `${grouped} ${RIEL_SIGN}`;
  }
  return new Intl.NumberFormat(LOCALE_TAG[language], {
    style: "currency",
    currency: "USD",
  }).format(value);
}
