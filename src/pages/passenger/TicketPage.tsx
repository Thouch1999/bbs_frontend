import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

import { useBookingLookup } from "../../api/bookings";
import { ETicket } from "../../components/booking/ETicket";
import type { Booking } from "../../types";

function cacheKey(pnr: string): string {
  return `bbms.ticket.${pnr}`;
}

export function TicketPage() {
  const { t } = useTranslation(["booking", "common"]);
  const [searchParams] = useSearchParams();
  const pnr = searchParams.get("pnr");
  const phone = searchParams.get("phone");

  const { data: booking, isLoading, isError } = useBookingLookup(pnr, phone);
  const [cachedBooking, setCachedBooking] = useState<Booking | null>(null);

  useEffect(() => {
    if (booking && pnr) {
      try {
        localStorage.setItem(cacheKey(pnr), JSON.stringify(booking));
      } catch {
        // best-effort cache only — a full/blocked localStorage must not break the page
      }
    }
  }, [booking, pnr]);

  useEffect(() => {
    if (!booking && pnr) {
      try {
        const raw = localStorage.getItem(cacheKey(pnr));
        if (raw) setCachedBooking(JSON.parse(raw) as Booking);
      } catch {
        setCachedBooking(null);
      }
    }
  }, [booking, pnr]);

  const displayBooking = booking ?? cachedBooking;

  if (!pnr || !phone) {
    return <p className="container py-4 text-danger">{t("ticket.lookup_error")}</p>;
  }
  if (isLoading && !displayBooking) {
    return <p className="container py-4 text-muted">{t("common.loading")}</p>;
  }
  if (isError && !displayBooking) {
    return <p className="container py-4 text-danger">{t("ticket.lookup_error")}</p>;
  }
  if (!displayBooking) {
    return null;
  }

  return (
    <div className="container py-4" style={{ maxWidth: "760px" }}>
      <h1 className="h4 text-center bbms-no-print">{t("ticket.confirmed_title")}</h1>
      <div className="text-center bbms-no-print mb-3">
        <span className="badge bg-primary-subtle text-primary-emphasis fs-6 font-monospace">
          {displayBooking.pnr}
        </span>
      </div>

      <ETicket booking={displayBooking} />

      <div className="d-flex gap-2 justify-content-center my-3 bbms-no-print">
        <button type="button" className="btn btn-outline-primary" onClick={() => window.print()}>
          {t("ticket.download_pdf")}
        </button>
        <button type="button" className="btn btn-outline-primary" onClick={() => window.print()}>
          {t("ticket.print")}
        </button>
      </div>

      <p className="text-muted text-center small bbms-no-print">{t("ticket.sent_notice")}</p>

      <div className="text-center bbms-no-print mt-4">
        <Link to="/my-bookings" className="me-3">
          {t("ticket.my_bookings")}
        </Link>
        <Link to="/">{t("ticket.book_another")}</Link>
      </div>
    </div>
  );
}
