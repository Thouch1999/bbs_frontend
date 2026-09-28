import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useMyBookings } from "../../api/bookings";
import { useAuth } from "../../context/AuthContext";
import type { Booking, BookingStatus } from "../../types";
import { GuestBookingLookupCard } from "../../components/booking/GuestBookingLookupCard";
import { BannerStrip } from "../../components/shared/SiteContent";

type Tab = "upcoming" | "past" | "cancelled";

const STATUS_BADGE: Record<BookingStatus, string> = {
  pending_payment: "bg-warning-subtle text-warning-emphasis",
  confirmed: "bg-success-subtle text-success-emphasis",
  cancelled: "bg-secondary-subtle text-secondary-emphasis",
  completed: "bg-secondary-subtle text-secondary-emphasis",
};

function BookingCard({ booking }: { booking: Booking }) {
  const { t } = useTranslation("account");
  return (
    <div className="card mb-3">
      <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <div className="fw-semibold">{new Date(booking.departure_at).toLocaleString()}</div>
          <div className="text-muted small font-monospace">{booking.pnr}</div>
        </div>
        <span className={`badge ${STATUS_BADGE[booking.status]}`}>
          {t(`my_bookings.status_${booking.status}`)}
        </span>
        <div className="d-flex gap-2">
          <Link
            to={`/ticket?pnr=${booking.pnr}&phone=${encodeURIComponent(booking.contact_phone)}`}
            className="btn btn-sm btn-outline-primary"
          >
            {t("my_bookings.view_ticket")}
          </Link>
          <Link to={`/bookings/${booking.public_id}`} className="btn btn-sm btn-outline-secondary">
            {t("detail.title")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function MyBookingsPage() {
  const { t } = useTranslation(["account", "common"]);
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<Tab>("upcoming");

  // A guest hasn't logged in — these would just 401 (they use the PNR+phone
  // lookup below instead), so don't fire them at all.
  const upcoming = useMyBookings("upcoming", { enabled: isAuthenticated });
  const past = useMyBookings("past", { enabled: isAuthenticated });

  const bookingsForTab = useMemo(() => {
    const upcomingList = upcoming.data ?? [];
    const pastList = past.data ?? [];
    if (tab === "upcoming") return upcomingList.filter((b) => b.status !== "cancelled");
    if (tab === "past") return pastList.filter((b) => b.status !== "cancelled");
    return [...upcomingList, ...pastList].filter((b) => b.status === "cancelled");
  }, [tab, upcoming.data, past.data]);

  if (!isAuthenticated) {
    return (
      <div className="container py-4">
        <GuestBookingLookupCard />
      </div>
    );
  }

  const isLoading = upcoming.isLoading || past.isLoading;

  return (
    <div className="container py-4">
      <h1 className="h4">{t("my_bookings.title")}</h1>
      <BannerStrip placement="my_bookings" />
      <ul className="nav nav-tabs my-3">
        {(["upcoming", "past", "cancelled"] as Tab[]).map((value) => (
          <li className="nav-item" key={value}>
            <button
              type="button"
              className={`nav-link ${tab === value ? "active" : ""}`}
              onClick={() => setTab(value)}
            >
              {t(`my_bookings.tab_${value}`)}
            </button>
          </li>
        ))}
      </ul>

      {isLoading && <p className="text-muted">{t("common.loading")}</p>}
      {!isLoading && bookingsForTab.length === 0 && <p className="text-muted">{t("my_bookings.empty")}</p>}
      {bookingsForTab.map((booking) => (
        <BookingCard key={booking.public_id} booking={booking} />
      ))}
    </div>
  );
}
