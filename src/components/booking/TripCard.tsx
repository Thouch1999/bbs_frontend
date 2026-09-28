import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useLocale } from "../../context/LocaleContext";
import type { Trip } from "../../types";
import { formatMoney } from "../../utils/money";
import { formatTime } from "../../utils/time";

export const AMENITY_ICONS: Record<string, string> = {
  ac: "fas fa-snowflake",
  wifi: "fas fa-wifi",
  usb: "fas fa-plug",
  toilet: "fas fa-restroom",
  blanket: "fas fa-bed",
  water: "fas fa-droplet",
};

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

export function TripCard({ trip, passengers = 1 }: { trip: Trip; passengers?: number }) {
  const { t } = useTranslation(["booking", "common"]);
  const { language, currency } = useLocale();
  const fare = currency === "KHR" ? trip.base_fare_khr : trip.base_fare_usd;
  const isLowSeats = trip.seats_available <= 5;
  const seatsHref = `/trips/${trip.public_id}/seats?passengers=${passengers}`;

  return (
    <article className="card mb-3 border">
      <div className="card-body">
        <div className="row g-3 align-items-center">
          <div className="col-12 col-md-4 d-flex align-items-start gap-3">
            <span
              className="bg-bbms-tint text-primary rounded-3 d-inline-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: "3rem", height: "3rem" }}
              aria-hidden="true"
            >
              <i className={`${BUS_TYPE_ICON[trip.bus_type] ?? "fas fa-bus"} fs-4`} />
            </span>
            <div>
              <div className="fw-bold">{trip.operator_name}</div>
              <div className="d-flex align-items-center gap-2 mt-1">
                <span className="badge bg-bbms-tint text-primary">{t(`bus_type.${trip.bus_type}`, { ns: "booking" })}</span>
                <span className="text-muted small">{trip.bus_plate_number}</span>
              </div>
            </div>
          </div>

          <div className="col-12 col-md-5">
            <div className="d-flex align-items-center justify-content-between gap-2">
              <div className="text-start">
                <div className="fs-5 fw-bold">{formatTime(trip.departure_at, language)}</div>
              </div>
              <div className="flex-fill d-flex flex-column align-items-center px-2">
                <span className="small text-primary fw-semibold">{formatDuration(trip.departure_at, trip.arrival_at)}</span>
                <div className="w-100 d-flex align-items-center gap-1">
                  <span className="rounded-circle border border-primary" style={{ width: "0.5rem", height: "0.5rem" }} />
                  <span className="flex-fill border-top border-dashed" />
                  <i className="fas fa-bus text-primary small" aria-hidden="true" />
                  <span className="flex-fill border-top border-dashed" />
                  <span className="rounded-circle bg-primary" style={{ width: "0.5rem", height: "0.5rem" }} />
                </div>
              </div>
              <div className="text-end">
                <div className="fs-5 fw-bold">{formatTime(trip.arrival_at, language)}</div>
              </div>
            </div>
            <div className="d-flex gap-3 mt-2 pt-2 border-top border-dashed text-muted">
              {trip.amenities.map((amenity) => (
                <i
                  key={amenity}
                  className={AMENITY_ICONS[amenity] ?? "fas fa-circle-check"}
                  title={t(`amenities.${amenity}`, { ns: "booking", defaultValue: amenity })}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>

          <div className="col-12 col-md-3 bbms-card-divider ps-md-3 d-flex flex-column align-items-md-end gap-2">
            <div className="text-md-end">
              <div className="fs-5 fw-bold text-primary">{formatMoney(fare, currency, language)}</div>
              <div className={`small fw-semibold d-flex align-items-center gap-1 justify-content-md-end ${isLowSeats ? "text-danger" : "text-muted"}`}>
                {isLowSeats && <span className="rounded-circle bg-danger" style={{ width: "0.4rem", height: "0.4rem" }} />}
                {t("results.seats_left", { ns: "booking", count: trip.seats_available })}
              </div>
            </div>
            <Link to={seatsHref} className="btn bbms-cta w-100">
              {t("results.select_seats", { ns: "booking" })}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
