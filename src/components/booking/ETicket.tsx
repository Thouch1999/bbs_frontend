import { useTranslation } from "react-i18next";

import { useLocale } from "../../context/LocaleContext";
import type { Booking } from "../../types";
import { formatMoney } from "../../utils/money";
import { QrCodeDisplay } from "./QrCodeDisplay";

export function ETicket({ booking }: { booking: Booking }) {
  const { t } = useTranslation("booking");
  const { language } = useLocale();

  return (
    <div className="card">
      <div className="card-body row">
        <div className="col-8 bbms-ticket-stub">
          <h2 className="h5">{booking.pnr}</h2>
          <p className="text-muted mb-1">
            {new Date(booking.departure_at).toLocaleString(language === "km" ? "km-KH" : "en-US")}
          </p>
          <p className="mb-1">
            {booking.passengers.map((p) => `${p.full_name} (${t("ticket.seat_label")} ${p.seat_number})`).join(", ")}
          </p>
          <p className="fw-bold">{formatMoney(booking.total_amount, booking.currency, language)}</p>
        </div>
        <div className="col-4 text-center">
          {booking.qr_token ? (
            <>
              <QrCodeDisplay value={booking.qr_token} />
              <p className="small text-muted mt-2">{t("ticket.show_qr")}</p>
            </>
          ) : (
            <p className="text-muted small">{t("payment.waiting_title")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
