import i18n from "i18next";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

import { getStoredLanguage } from "../context/localePrefs";

void i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    lng: getStoredLanguage(),
    // CLAUDE.md: "km default, en fallback" — km is what's shown by default,
    // en is the fallback for any key not yet translated into km.
    fallbackLng: "en",
    supportedLngs: ["km", "en"],
    ns: ["common", "booking", "account"],
    defaultNS: "common",
    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
