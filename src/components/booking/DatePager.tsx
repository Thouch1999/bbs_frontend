import { useTranslation } from "react-i18next";

import { useDatePagerFares } from "../../api/trips";
import { useLocale } from "../../context/LocaleContext";
import { addDays, formatDate, formatWeekday } from "../../utils/time";
import { formatMoney } from "../../utils/money";

interface DatePagerProps {
  origin?: string;
  destination?: string;
  date: string;
  onSelect: (date: string) => void;
}

const OFFSETS = [-2, -1, 0, 1, 2];

export function DatePager({ origin, destination, date, onSelect }: DatePagerProps) {
  const { t } = useTranslation("booking");
  const { language } = useLocale();
  const dates = OFFSETS.map((offset) => addDays(date, offset));
  const results = useDatePagerFares(origin, destination, dates);

  return (
    <div className="d-flex align-items-center gap-2 pt-2 mt-2 border-top border-white border-opacity-25">
      <button
        type="button"
        className="btn btn-sm btn-outline-light flex-shrink-0"
        onClick={() => onSelect(addDays(date, -1))}
        aria-label={t("results.previous_page")}
      >
        <i className="fas fa-chevron-left" aria-hidden="true" />
      </button>
      <div className="flex-fill row row-cols-5 g-1">
        {dates.map((day, index) => {
          const isActive = day === date;
          const fares = results[index]?.data;
          return (
            <div key={day} className="col">
              <button
                type="button"
                onClick={() => onSelect(day)}
                className={`w-100 h-100 border-0 rounded-2 py-1 px-1 text-center small ${
                  isActive ? "bg-white text-primary fw-bold" : "bg-transparent text-white text-opacity-75"
                }`}
              >
                <div className="text-truncate">
                  {formatWeekday(day, language)}, {formatDate(day, language)}
                </div>
                {fares && fares.count > 0 && (
                  <div className={`fw-semibold ${isActive ? "text-bbms-orange" : ""}`}>
                    {t("results.price_from_short")} {formatMoney(String(fares.minFareUsd), "USD", language)}
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="btn btn-sm btn-outline-light flex-shrink-0"
        onClick={() => onSelect(addDays(date, 1))}
        aria-label={t("results.next_page")}
      >
        <i className="fas fa-chevron-right" aria-hidden="true" />
      </button>
    </div>
  );
}
