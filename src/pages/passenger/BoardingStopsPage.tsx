import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { usePublicConfig } from "../../api/operator";
import { useTripStops } from "../../api/routes";
import { useReleaseSeats, useTrip, useTripSeats } from "../../api/trips";
import { BookingStepper } from "../../components/booking/BookingStepper";
import { HoldTimer } from "../../components/booking/HoldTimer";
import { TripSummaryCard } from "../../components/booking/TripSummaryCard";
import { useBooking } from "../../context/BookingContext";
import { useLocale } from "../../context/LocaleContext";
import type { RouteStopEntry } from "../../types";
import { formatMoney } from "../../utils/money";
import { formatTime } from "../../utils/time";

function estimatedTime(departureAt: string, offsetMinutes: number): string {
  return new Date(new Date(departureAt).getTime() + offsetMinutes * 60_000).toISOString();
}

function StopList({
  stops,
  name,
  selectedId,
  onSelect,
  departureAt,
  language,
}: {
  stops: RouteStopEntry[];
  name: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  departureAt: string;
  language: "km" | "en";
}) {
  const { t } = useTranslation("booking");
  if (stops.length === 0) {
    return <p className="text-muted small mb-0">{t("stops.no_stops")}</p>;
  }
  return (
    <div className="d-flex flex-column gap-2">
      {stops.map((entry) => {
        const isSelected = selectedId === entry.public_id;
        const stopName = language === "km" ? entry.stop.name_km : entry.stop.name_en;
        return (
          <label
            key={entry.public_id}
            className={`d-flex align-items-start justify-content-between gap-3 border rounded-3 p-3 ${
              isSelected ? "border-primary border-2 bg-bbms-tint" : ""
            }`}
            style={{ cursor: "pointer" }}
          >
            <div className="d-flex align-items-start gap-2">
              <input
                type="radio"
                className="form-check-input mt-1"
                name={name}
                checked={isSelected}
                onChange={() => onSelect(entry.public_id)}
              />
              <div>
                <div className="fw-bold">{stopName}</div>
                <div className="small text-muted">{entry.stop.address}</div>
              </div>
            </div>
            <span className="badge bg-light text-dark border flex-shrink-0">
              {t("stops.estimated_time", { time: formatTime(estimatedTime(departureAt, entry.offset_minutes), language) })}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function BoardingStopsPage() {
  const { t } = useTranslation(["booking", "common"]);
  const navigate = useNavigate();
  const { booking, setBooking, resetBooking } = useBooking();
  const { language, currency } = useLocale();

  const { tripId, holdToken, holdExpiresAt, seatIds } = booking;
  const isHoldValid = Boolean(tripId && holdToken && holdExpiresAt && new Date(holdExpiresAt) > new Date());

  const { data: trip } = useTrip(tripId ?? undefined);
  const { data: seats } = useTripSeats(tripId ?? undefined);
  const { data: stops } = useTripStops(tripId);
  const releaseSeats = useReleaseSeats(tripId ?? undefined);
  const config = usePublicConfig();

  const [boardingStopId, setBoardingStopId] = useState<string | null>(booking.boardingStopId);
  const [dropStopId, setDropStopId] = useState<string | null>(booking.dropStopId);

  useEffect(() => {
    if (!isHoldValid) {
      navigate("/", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-check on mount / hold change
  }, [isHoldValid]);

  if (!isHoldValid || !trip) {
    return null;
  }

  function handleExpire() {
    if (tripId && seatIds.length > 0) {
      releaseSeats.mutate(seatIds);
    }
    resetBooking();
    navigate("/", { replace: true, state: { message: t("hold_timer.expired") } });
  }

  function handleContinue() {
    setBooking({ boardingStopId, dropStopId });
    navigate("/checkout");
  }

  const seatFare = Number(currency === "KHR" ? trip.base_fare_khr : trip.base_fare_usd);
  const subtotal = seatFare * seatIds.length;
  const bookingFee = config.data ? Number(currency === "KHR" ? config.data.booking_fee_khr : config.data.booking_fee_usd) : 0;
  const total = subtotal + bookingFee;
  const seatNumbers = seatIds.map((id) => seats?.find((s) => s.seat.public_id === id)?.seat.seat_number ?? "?");
  const stopsList = stops ?? [];
  const boardingStopName = stopsList.find((s) => s.public_id === boardingStopId);
  const dropStopName = stopsList.find((s) => s.public_id === dropStopId);

  return (
    <div className="container py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <BookingStepper current={3} />
      </div>
      <div className="bbms-no-print mb-3">
        <HoldTimer expiresAt={holdExpiresAt!} onExpire={handleExpire} />
      </div>

      <TripSummaryCard trip={trip} />

      <div className="alert bg-bbms-tint border-0 d-flex gap-3 mb-3">
        <i className="fas fa-circle-info text-primary mt-1" aria-hidden="true" />
        <div>
          <div className="fw-bold text-primary">{t("stops.advisory_title")}</div>
          <div className="small text-muted">{t("stops.advisory_body")}</div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-8">
          <div className="border rounded-3 p-3 mb-3">
            <h2 className="h5 fw-bold mb-1">{t("stops.boarding_title")}</h2>
            <p className="small text-muted">{t("stops.boarding_subtitle")}</p>
            <StopList
              stops={stopsList}
              name="boarding_point"
              selectedId={boardingStopId}
              onSelect={setBoardingStopId}
              departureAt={trip.departure_at}
              language={language}
            />
          </div>

          <div className="border rounded-3 p-3">
            <h2 className="h5 fw-bold mb-1">{t("stops.dropoff_title")}</h2>
            <p className="small text-muted">{t("stops.dropoff_subtitle")}</p>
            <StopList
              stops={stopsList}
              name="dropoff_point"
              selectedId={dropStopId}
              onSelect={setDropStopId}
              departureAt={trip.departure_at}
              language={language}
            />
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <div className="border rounded-3 p-3" style={{ position: "sticky", top: "1rem" }}>
            <div className="d-flex align-items-center justify-content-between pb-2 mb-3 border-bottom">
              <h3 className="h5 fw-bold mb-0">{t("seat_map.summary_title")}</h3>
              <span className="badge rounded-pill bg-bbms-tint text-primary">
                {t("seat_map.seats_badge", { count: seatIds.length })}
              </span>
            </div>

            <div className="d-flex flex-wrap gap-2 mb-3">
              {seatNumbers.map((number, index) => (
                <span key={seatIds[index]} className="badge bbms-cta">
                  {number}
                </span>
              ))}
              <span className="small text-muted ms-auto align-self-center">
                {formatMoney(String(seatFare), currency, language)} × {seatIds.length}
              </span>
            </div>

            {(boardingStopName || dropStopName) && (
              <div className="d-flex flex-column gap-2 pt-2 mb-3 border-top small">
                {boardingStopName && (
                  <div className="d-flex align-items-start gap-2">
                    <i className="fas fa-circle-check text-primary mt-1" aria-hidden="true" />
                    <div>
                      <div className="text-muted">{t("stops.review_boarding")}</div>
                      <div className="fw-semibold">
                        {language === "km" ? boardingStopName.stop.name_km : boardingStopName.stop.name_en}
                      </div>
                    </div>
                  </div>
                )}
                {dropStopName && (
                  <div className="d-flex align-items-start gap-2">
                    <i className="fas fa-location-dot text-primary mt-1" aria-hidden="true" />
                    <div>
                      <div className="text-muted">{t("stops.review_dropoff")}</div>
                      <div className="fw-semibold">
                        {language === "km" ? dropStopName.stop.name_km : dropStopName.stop.name_en}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="d-flex flex-column gap-1 small pt-2 border-top">
              <div className="d-flex justify-content-between">
                <span className="text-muted">{t("seat_map.subtotal", { count: seatIds.length })}</span>
                <span className="fw-semibold">{formatMoney(String(subtotal), currency, language)}</span>
              </div>
              {bookingFee > 0 && (
                <div className="d-flex justify-content-between">
                  <span className="text-muted">{t("seat_map.booking_fee")}</span>
                  <span className="fw-semibold">{formatMoney(String(bookingFee), currency, language)}</span>
                </div>
              )}
            </div>
            <div className="d-flex justify-content-between align-items-end mt-2 pt-2 border-top">
              <span className="fw-bold">{t("fare_summary.total")}</span>
              <span className="fs-4 fw-bold text-primary">{formatMoney(String(total), currency, language)}</span>
            </div>

            <button type="button" className="btn bbms-cta w-100 mt-3" onClick={handleContinue}>
              {t("stops.continue")}
            </button>
            <button
              type="button"
              className="btn btn-link w-100 text-primary"
              onClick={() => navigate(`/trips/${tripId}/seats`)}
            >
              <i className="fas fa-arrow-left me-1" aria-hidden="true" />
              {t("stops.back_to_seats")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
