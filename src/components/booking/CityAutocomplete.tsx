import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCities } from "../../api/routes";
import { useLocale } from "../../context/LocaleContext";
import type { City } from "../../types";

interface CityAutocompleteProps {
  label: string;
  placeholder: string;
  value: City | null;
  onChange: (city: City | null) => void;
  icon?: string;
}

export function CityAutocomplete({ label, placeholder, value, onChange, icon }: CityAutocompleteProps) {
  const { language } = useLocale();
  const { t } = useTranslation();
  const [query, setQuery] = useState(value ? cityLabel(value, language) : "");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: cities, isLoading } = useCities(debouncedQuery);

  function cityLabelLocal(city: City): string {
    return cityLabel(city, language);
  }

  return (
    <div className="position-relative">
      <label className="form-label d-flex align-items-center gap-1">
        {icon && <i className={`${icon} text-primary`} aria-hidden="true" />}
        {label}
      </label>
      <input
        type="text"
        className="form-control"
        placeholder={placeholder}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
          if (value) onChange(null);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
      />
      {isOpen && debouncedQuery.length > 0 && (
        <ul className="list-group position-absolute w-100 shadow-sm" style={{ zIndex: 20 }}>
          {isLoading && <li className="list-group-item text-muted">{t("common.loading")}</li>}
          {!isLoading && cities?.length === 0 && (
            <li className="list-group-item text-muted">{t("common.error")}</li>
          )}
          {cities?.map((city) => (
            <li key={city.public_id}>
              <button
                type="button"
                className="list-group-item list-group-item-action"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(city);
                  setQuery(cityLabelLocal(city));
                  setIsOpen(false);
                }}
              >
                {cityLabelLocal(city)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function cityLabel(city: City, language: "km" | "en"): string {
  return language === "km" ? city.name_km : city.name_en;
}
