import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "react-bootstrap";

import { useCancelBooking, useCancellationPreview } from "../../api/bookings";
import { useLocale } from "../../context/LocaleContext";
import type { Booking } from "../../types";
import { formatMoney } from "../../utils/money";

interface CancelBookingDialogProps {
  booking: Booking;
  show: boolean;
  onClose: () => void;
  onCancelled: (booking: Booking) => void;
}

export function CancelBookingDialog({ booking, show, onClose, onCancelled }: CancelBookingDialogProps) {
  const { t } = useTranslation("account");
  const { language } = useLocale();
  const [reason, setReason] = useState("");
  const preview = useCancellationPreview(booking.public_id, show);
  const cancelBooking = useCancelBooking();

  function handleConfirm() {
    cancelBooking.mutate(
      { publicId: booking.public_id, reason },
      { onSuccess: (updated) => onCancelled(updated) }
    );
  }

  const fee =
    preview.data && Number(booking.total_amount) - Number(preview.data.refund_amount);

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>{t("cancel_dialog.title")}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {preview.isLoading && <p className="text-muted">{t("cancel_dialog.loading_preview")}</p>}
        {preview.data && (
          <div className="mb-3">
            <div className="d-flex justify-content-between">
              <span>{t("cancel_dialog.amount_paid")}</span>
              <span>{formatMoney(booking.total_amount, booking.currency, language)}</span>
            </div>
            <div className="d-flex justify-content-between text-danger">
              <span>{t("cancel_dialog.cancellation_fee")}</span>
              <span>-{formatMoney(String(fee ?? 0), booking.currency, language)}</span>
            </div>
            <hr />
            <div className="d-flex justify-content-between fw-bold fs-5 text-success">
              <span>{t("cancel_dialog.refund_amount")}</span>
              <span>{formatMoney(preview.data.refund_amount, booking.currency, language)}</span>
            </div>
          </div>
        )}
        <label className="form-label">{t("cancel_dialog.reason_optional")}</label>
        <textarea className="form-control" value={reason} onChange={(event) => setReason(event.target.value)} />
        {cancelBooking.isError && <p className="text-danger small mt-2">{cancelBooking.error.message}</p>}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-link text-primary" onClick={onClose}>
          {t("cancel_dialog.keep_booking")}
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={handleConfirm}
          disabled={cancelBooking.isPending || preview.isLoading}
        >
          {t("cancel_dialog.confirm_cancel")}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
