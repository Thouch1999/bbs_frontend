import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useBookingDetail } from "../../api/bookings";
import { CancelBookingDialog } from "../../components/booking/CancelBookingDialog";
import { ETicket } from "../../components/booking/ETicket";
import { RescheduleBookingDialog } from "../../components/booking/RescheduleBookingDialog";
import type { Booking } from "../../types";

export function BookingDetailPage() {
  const { t } = useTranslation(["account", "common"]);
  const { publicId } = useParams<{ publicId: string }>();
  const navigate = useNavigate();
  const { data: booking, isLoading, isError } = useBookingDetail(publicId);
  const [showCancel, setShowCancel] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);

  if (isLoading) return <p className="container py-4 text-muted">{t("common.loading")}</p>;
  if (isError || !booking) return <p className="container py-4 text-danger">{t("common.error")}</p>;

  const canModify = booking.status === "confirmed" || booking.status === "pending_payment";

  function handleCancelled(updated: Booking) {
    setShowCancel(false);
    navigate(`/bookings/${updated.public_id}`, { replace: true });
  }

  function handleRescheduled(updated: Booking) {
    setShowReschedule(false);
    navigate(`/bookings/${updated.public_id}`, { replace: true });
  }

  return (
    <div className="container py-4" style={{ maxWidth: "760px" }}>
      <Link to="/my-bookings" className="d-inline-block mb-3">
        {t("detail.back")}
      </Link>
      <h1 className="h4">{t("detail.title")}</h1>

      <ETicket booking={booking} />

      {canModify && (
        <div className="d-flex gap-2 mt-3">
          {booking.status === "confirmed" && (
            <button type="button" className="btn btn-outline-primary" onClick={() => setShowReschedule(true)}>
              {t("my_bookings.reschedule")}
            </button>
          )}
          <button type="button" className="btn btn-outline-danger" onClick={() => setShowCancel(true)}>
            {t("my_bookings.cancel")}
          </button>
        </div>
      )}

      <Link to={`/support?booking=${booking.public_id}`} className="d-inline-block mt-3">
        {t("support.help_with_booking")}
      </Link>

      <CancelBookingDialog
        booking={booking}
        show={showCancel}
        onClose={() => setShowCancel(false)}
        onCancelled={handleCancelled}
      />
      <RescheduleBookingDialog
        booking={booking}
        show={showReschedule}
        onClose={() => setShowReschedule(false)}
        onRescheduled={handleRescheduled}
      />
    </div>
  );
}
