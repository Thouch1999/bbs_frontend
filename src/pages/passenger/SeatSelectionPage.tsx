import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { usePublicConfig } from "../../api/operator";
import { useHoldSeats, useTrip, useTripSeats } from "../../api/trips";
import { AMENITY_ICONS } from "../../components/booking/TripCard";
import { BookingStepper } from "../../components/booking/BookingStepper";
import { SeatLegend } from "../../components/booking/SeatLegend";
import { SeatMap } from "../../components/booking/SeatMap";
import { TripSummaryCard } from "../../components/booking/TripSummaryCard";
import { useBooking } from "../../context/BookingContext";
import { useLocale } from "../../context/LocaleContext";
import { formatMoney } from "../../utils/money";
import { formatDate, formatTime } from "../../utils/time";

export function SeatSelectionPage() {
  const { t } = useTranslation(["booking", "common"]);
  const { tripId } = useParams<{ tripId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setBooking } = useBooking();
  const { language, currency } = useLocale();
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);

  const maxSeats = Number(searchParams.get("passengers") ?? 1) || 1;

  const { data: trip, isLoading: isTripLoading } = useTrip(tripId);
  const { data: seats, isLoading: isSeatsLoading, isError } = useTripSeats(tripId);
  const holdSeats = useHoldSeats(tripId);
  const config = usePublicConfig();

  if (isTripLoading || isSeatsLoading) {
    return <p className="container py-4 text-muted">{t("common.loading")}</p>;
  }
  if (isError || !trip || !seats) {
    return <p className="container py-4 text-danger">{t("common.error")}</p>;
  }

  const seatFare = Number(currency === "KHR" ? trip.base_fare_khr : trip.base_fare_usd);
  const subtotal = seatFare * selectedSeatIds.length;
  const bookingFee = config.data ? Number(currency === "KHR" ? config.data.booking_fee_khr : config.data.booking_fee_usd) : 0;
  const total = subtotal + bookingFee;
  const seatNumberById = new Map(seats.map((s) => [s.seat.public_id, s.seat.seat_number]));

  function removeSeat(seatId: string) {
    setSelectedSeatIds((current) => current.filter((id) => id !== seatId));
  }

  function handleContinue() {
    if (!tripId || selectedSeatIds.length === 0) return;
    holdSeats.mutate(selectedSeatIds, {
      onSuccess: (hold) => {
        setBooking({
          tripId,
          holdToken: hold.hold_token,
          holdExpiresAt: hold.held_until,
          seatIds: hold.seat_ids,
          passengers: [],
          promoCode: null,
          boardingStopId: null,
          dropStopId: null,
        });
        navigate("/boarding-stops");
      },
    });
  }

  const originName = language === "km" ? trip.route.origin_city.name_km : trip.route.origin_city.name_en;
  const destinationName = language === "km" ? trip.route.destination_city.name_km : trip.route.destination_city.name_en;

  return (
    <div className="container py-4">
      <BookingStepper current={2} />

      <TripSummaryCard trip={trip} />

      <div className="row g-4">
        <div className="col-12 col-lg-8">
          <div className="border rounded-3 p-3 mb-3">
            <h3 className="h5 fw-bold">{t("seat_map.title")}</h3>
            <SeatMap seats={seats} selectedSeatIds={selectedSeatIds} onChangeSelection={setSelectedSeatIds} maxSeats={maxSeats} />
            {selectedSeatIds.length >= maxSeats && (
              <p className="small text-primary fw-semibold mt-2 mb-0">
                <i className="fas fa-circle-info me-1" aria-hidden="true" />
                {t("seat_map.max_seats_reached", { count: maxSeats })}
              </p>
            )}
            <div className="mt-3 pt-3 border-top">
              <SeatLegend />
            </div>
          </div>

          {trip.amenities.length > 0 && (
            <div className="row g-2">
              {trip.amenities.map((amenity) => (
                <div key={amenity} className="col-6 col-md-3">
                  <div className="border rounded-3 p-2 d-flex align-items-center gap-2 h-100">
                    <i className={`${AMENITY_ICONS[amenity] ?? "fas fa-circle-check"} text-primary`} aria-hidden="true" />
                    <span className="small fw-semibold">{t(`amenities.${amenity}`, { defaultValue: amenity })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col-12 col-lg-4">
          <div className="border rounded-3 p-3" style={{ position: "sticky", top: "1rem" }}>
            <div className="d-flex align-items-center justify-content-between pb-2 mb-3 border-bottom">
              <h3 className="h5 fw-bold mb-0">{t("seat_map.summary_title")}</h3>
              <span className="badge rounded-pill bg-bbms-tint text-primary">
                {t("seat_map.seats_badge", { count: selectedSeatIds.length })}
              </span>
            </div>

            <div className="bg-light rounded-3 p-2 mb-3 small">
              <div className="d-flex justify-content-between fw-semibold">
                <span>
                  {originName} <i className="fas fa-arrow-right mx-1" aria-hidden="true" /> {destinationName}
                </span>
                <span className="text-primary">{formatDate(trip.departure_at, language)}</span>
              </div>
              <div className="d-flex justify-content-between text-muted">
                <span>{formatTime(trip.departure_at, language)}</span>
                <span>{trip.operator_name}</span>
              </div>
            </div>

            {selectedSeatIds.length > 0 && (
              <div className="mb-3">
                <div className="d-flex justify-content-between small fw-semibold mb-1">
                  <span>{t("seat_map.seats_selected_of", { selected: selectedSeatIds.length, max: maxSeats })}</span>
                </div>
                <div className="d-flex flex-column gap-2">
                  {selectedSeatIds.map((seatId, index) => (
                    <div key={seatId} className="d-flex align-items-center justify-content-between border rounded-2 p-2">
                      <div className="d-flex align-items-center gap-2">
                        <span className="badge bbms-cta">{seatNumberById.get(seatId) ?? "?"}</span>
                        <span className="small">{t("seat_map.passenger_label", { number: index + 1 })}</span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="small fw-semibold">{formatMoney(String(seatFare), currency, language)}</span>
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-danger p-0"
                          title={t("seat_map.remove_seat")}
                          onClick={() => removeSeat(seatId)}
                        >
                          <i className="fas fa-xmark" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="d-flex flex-column gap-1 small pt-2 border-top">
              <div className="d-flex justify-content-between">
                <span className="text-muted">{t("seat_map.subtotal", { count: selectedSeatIds.length })}</span>
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

            {holdSeats.isError && <p className="text-danger small mt-2">{holdSeats.error.message}</p>}

            <button
              type="button"
              className="btn bbms-cta w-100 mt-3"
              disabled={selectedSeatIds.length === 0 || holdSeats.isPending}
              onClick={handleContinue}
            >
              {selectedSeatIds.length > 0
                ? t("seat_map.continue", { count: selectedSeatIds.length })
                : t("seat_map.no_seats_selected")}
            </button>

            <div className="bg-light rounded-3 p-2 mt-3 d-flex gap-2">
              <i className="fas fa-shield-halved text-primary mt-1" aria-hidden="true" />
              <p className="small text-muted mb-0">
                <strong>{t("seat_map.cancellation_title")}</strong> {t("seat_map.cancellation_body")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
