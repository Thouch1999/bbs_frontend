import { useTranslation } from "react-i18next";

import { useLocale } from "../../context/LocaleContext";
import type { Trip } from "../../types";
import { formatDate, formatTime } from "../../utils/time";

const BUS_TYPE_ICON: Record<string, string> = {
  seated: "fas fa-chair",
  sleeper: "fas fa-bed",
  mixed: "fas fa-bus",
};

function formatDuration(departure: string, arrival: string): string {
  const minutes = Math.round((new Date(arrival).getTime() - new Date(departure).getTime()) / 60000);
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h${remaining.toString().padStart(2, "0")}`;
}

// Reused across the seat-selection, boarding/drop-off, and checkout steps —
// the same real trip fields (operator/bus/timeline), just restated at each
// step so the passenger never loses context of what they're booking.
export function TripSummaryCard({ trip }: { trip: Trip }) {
  const { t } = useTranslation("booking");
  const { language } = useLocale();
  const originName = language === "km" ? trip.route.origin_city.name_km : trip.route.origin_city.name_en;
  const destinationName = language === "km" ? trip.route.destination_city.name_km : trip.route.destination_city.name_en;

  return (
    <div className="border rounded-3 p-3 mb-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pb-2 mb-3 border-bottom">
        <div className="d-flex align-items-center gap-2">
          <span
            className="bg-bbms-tint text-primary rounded-3 d-inline-flex align-items-center justify-content-center flex-shrink-0"
            style={{ width: "2.5rem", height: "2.5rem" }}
            aria-hidden="true"
          >
            <i className={`${BUS_TYPE_ICON[trip.bus_type] ?? "fas fa-bus"} fs-5`} />
          </span>
          <div>
            <div className="d-flex align-items-center gap-2">
              <h2 className="h5 fw-bold mb-0">{trip.operator_name}</h2>
              <span className="badge bg-bbms-tint text-primary">{t(`bus_type.${trip.bus_type}`)}</span>
            </div>
            <div className="small text-muted">{trip.bus_plate_number}</div>
          </div>
        </div>
        <div className="d-flex align-items-center gap-1 text-muted small">
          <i className="fas fa-calendar-days text-primary" aria-hidden="true" />
          {formatDate(trip.departure_at, language)}
        </div>
      </div>

      <div className="row align-items-center">
        <div className="col-4">
          <div className="small text-muted">{originName}</div>
          <div className="fs-5 fw-bold text-primary">{formatTime(trip.departure_at, language)}</div>
        </div>
        <div className="col-4 d-flex flex-column align-items-center">
          <span className="small text-primary fw-semibold">{formatDuration(trip.departure_at, trip.arrival_at)}</span>
          <div className="w-100 d-flex align-items-center gap-1">
            <span className="rounded-circle border border-primary" style={{ width: "0.5rem", height: "0.5rem" }} />
            <span className="flex-fill border-top border-dashed" />
            <i className="fas fa-bus text-primary small" aria-hidden="true" />
            <span className="flex-fill border-top border-dashed" />
            <span className="rounded-circle bg-primary" style={{ width: "0.5rem", height: "0.5rem" }} />
          </div>
        </div>
        <div className="col-4 text-end">
          <div className="small text-muted">{destinationName}</div>
          <div className="fs-5 fw-bold text-primary">{formatTime(trip.arrival_at, language)}</div>
        </div>
      </div>
    </div>
  );
}
