import { useState } from "react";
import { Modal } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import {
  useReschedulePreview,
  useRescheduleBooking,
} from "../../api/bookings";
import { useHoldSeats, useTrip, useTripSearch, useTripSeats } from "../../api/trips";
import { useLocale } from "../../context/LocaleContext";
import type { Booking } from "../../types";
import { formatMoney } from "../../utils/money";
import { SeatMap } from "./SeatMap";

interface RescheduleBookingDialogProps {
  booking: Booking;
  show: boolean;
  onClose: () => void;
  onRescheduled: (booking: Booking) => void;
}

export function RescheduleBookingDialog({
  booking,
  show,
  onClose,
  onRescheduled,
}: RescheduleBookingDialogProps) {
  const { t } = useTranslation("account");
  const { language, currency } = useLocale();
  const [date, setDate] = useState("");
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);

  const { data: currentTrip } = useTrip(booking.trip_public_id);
  const search = useTripSearch({
    origin: currentTrip?.route.origin_city.public_id,
    destination: currentTrip?.route.destination_city.public_id,
    date: date || undefined,
  });
  const { data: newTripSeats } = useTripSeats(selectedTripId ?? undefined);
  const preview = useReschedulePreview(booking.public_id, selectedTripId ?? undefined);
  const holdSeats = useHoldSeats(selectedTripId ?? undefined);
  const rescheduleBooking = useRescheduleBooking();

  const numSeatsNeeded = booking.passengers.length;

  function reset() {
    setDate("");
    setSelectedTripId(null);
    setSelectedSeatIds([]);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleConfirm() {
    if (!selectedTripId) return;
    holdSeats.mutate(selectedSeatIds, {
      onSuccess: (hold) => {
        rescheduleBooking.mutate(
          { publicId: booking.public_id, newTripId: selectedTripId, newHoldToken: hold.hold_token },
          {
            onSuccess: (updated) => {
              reset();
              onRescheduled(updated);
            },
          }
        );
      },
    });
  }

  return (
    <Modal show={show} onHide={handleClose} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{t("reschedule_dialog.title")}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3">
          <label className="form-label">{t("reschedule_dialog.pick_date")}</label>
          <input
            type="date"
            className="form-control"
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(event) => {
              setDate(event.target.value);
              setSelectedTripId(null);
            }}
          />
        </div>

        {date && !selectedTripId && (
          <div>
            <h2 className="h6">{t("reschedule_dialog.pick_trip")}</h2>
            {(() => {
              const otherTrips = (search.data?.results ?? []).filter(
                (trip) => trip.public_id !== booking.trip_public_id
              );
              if (!search.isLoading && otherTrips.length === 0) {
                return <p className="text-muted small">{t("reschedule_dialog.no_trips_on_date")}</p>;
              }
              return otherTrips.map((trip) => (
                <button
                  key={trip.public_id}
                  type="button"
                  className="btn btn-outline-primary w-100 mb-2 d-flex justify-content-between"
                  onClick={() => setSelectedTripId(trip.public_id)}
                >
                  <span>
                    {trip.operator_name} — {new Date(trip.departure_at).toLocaleTimeString()}
                  </span>
                  <span>{formatMoney(currency === "KHR" ? trip.base_fare_khr : trip.base_fare_usd, currency, language)}</span>
                </button>
              ));
            })()}
          </div>
        )}

        {selectedTripId && (
          <div>
            {preview.data && (
              <div className="mb-3">
                <div className="d-flex justify-content-between">
                  <span>{t("reschedule_dialog.fare_difference")}</span>
                  <span>{formatMoney(preview.data.fare_difference_amount, booking.currency, language)}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span>{t("reschedule_dialog.reschedule_fee")}</span>
                  <span>{formatMoney(preview.data.reschedule_fee_amount, booking.currency, language)}</span>
                </div>
                <hr />
                <div className="d-flex justify-content-between fw-bold">
                  <span>{t("reschedule_dialog.total_due")}</span>
                  <span>
                    {formatMoney(
                      String(
                        Number(preview.data.fare_difference_amount) + Number(preview.data.reschedule_fee_amount)
                      ),
                      booking.currency,
                      language
                    )}
                  </span>
                </div>
              </div>
            )}
            {newTripSeats && (
              <SeatMap
                seats={newTripSeats}
                selectedSeatIds={selectedSeatIds}
                onChangeSelection={(ids) => setSelectedSeatIds(ids.slice(0, numSeatsNeeded))}
              />
            )}
            {(holdSeats.isError || rescheduleBooking.isError) && (
              <p className="text-danger small mt-2">
                {holdSeats.error?.message ?? rescheduleBooking.error?.message}
              </p>
            )}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-link" onClick={handleClose}>
          {t("cancel_dialog.keep_booking")}
        </button>
        <button
          type="button"
          className="btn bbms-cta"
          disabled={
            !selectedTripId ||
            selectedSeatIds.length !== numSeatsNeeded ||
            holdSeats.isPending ||
            rescheduleBooking.isPending
          }
          onClick={handleConfirm}
        >
          {t("reschedule_dialog.confirm_reschedule")}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
