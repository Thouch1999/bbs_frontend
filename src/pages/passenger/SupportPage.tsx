// Passenger help: open a support request (optionally about one booking) and
// follow the conversation. Replies from BBMS also arrive by SMS.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

import { useMyBookings } from "../../api/bookings";
import { useMyTicket, useMyTickets, useOpenTicket, useReplyMyTicket } from "../../api/content";
import { useAuth } from "../../context/AuthContext";
import { useLocale } from "../../context/LocaleContext";
import type { TicketCategory } from "../../types/admin";

const CATEGORIES: TicketCategory[] = ["refund_dispute", "payment_failed", "trip_complaint", "account", "other"];

function formatWhen(iso: string, language: "km" | "en") {
  return new Intl.DateTimeFormat(language === "km" ? "km-KH" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function SupportPage() {
  const { t } = useTranslation("account");
  const { language } = useLocale();
  const { isAuthenticated } = useAuth();
  const [params] = useSearchParams();
  const tickets = useMyTickets();
  const upcoming = useMyBookings("upcoming");
  const past = useMyBookings("past");
  const openTicket = useOpenTicket();
  const [selected, setSelected] = useState<string | null>(null);
  const [category, setCategory] = useState<TicketCategory>("trip_complaint");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [bookingId, setBookingId] = useState(params.get("booking") ?? "");
  const [reply, setReply] = useState("");
  const ticket = useMyTicket(selected);
  const sendReply = useReplyMyTicket(selected);
  const bookings = [...(upcoming.data ?? []), ...(past.data ?? [])];

  useEffect(() => {
    if (params.get("booking")) setCategory("refund_dispute");
  }, [params]);

  if (!isAuthenticated) {
    return (
      <div className="container py-4" style={{ maxWidth: 720 }}>
        <h1 className="h4">{t("support.title")}</h1>
        <p>{t("support.login_needed")}</p>
        <Link to="/login" className="btn btn-primary">{t("support.login")}</Link>
      </div>
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    openTicket.mutate(
      { category, subject: subject.trim(), body: body.trim(), booking_id: bookingId || null },
      {
        onSuccess: (created) => {
          setSubject("");
          setBody("");
          setSelected(created.public_id);
        },
      }
    );
  }

  return (
    <div className="container py-4" style={{ maxWidth: 900 }}>
      <h1 className="h4">{t("support.title")}</h1>
      <div className="row g-4 mt-1">
        <div className="col-md-5">
          <h2 className="h6">{t("support.new")}</h2>
          <form onSubmit={submit} className="card card-body">
            <label className="form-label" htmlFor="support-category">{t("support.category")}</label>
            <select id="support-category" className="form-select mb-2" value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{t(`support.categories.${c}`)}</option>)}
            </select>
            <label className="form-label" htmlFor="support-booking">{t("support.booking")}</label>
            <select id="support-booking" className="form-select mb-2" value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
              <option value="">{t("support.no_booking")}</option>
              {bookings.map((b) => <option key={b.public_id} value={b.public_id}>{b.pnr}</option>)}
            </select>
            <label className="form-label" htmlFor="support-subject">{t("support.subject")}</label>
            <input id="support-subject" className="form-control mb-2" required maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
            <label className="form-label" htmlFor="support-body">{t("support.message")}</label>
            <textarea id="support-body" className="form-control mb-2" required rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
            {openTicket.error && <p className="text-danger small">{openTicket.error.message}</p>}
            <button type="submit" className="btn btn-primary" disabled={openTicket.isPending || !subject.trim() || !body.trim()}>
              {t("support.send")}
            </button>
          </form>
        </div>
        <div className="col-md-7">
          <h2 className="h6">{t("support.mine")}</h2>
          {tickets.data?.length === 0 && <p className="text-muted">{t("support.none")}</p>}
          <div className="list-group mb-3">
            {(tickets.data ?? []).map((row) => (
              <button key={row.public_id} type="button" className={`list-group-item list-group-item-action ${row.public_id === selected ? "active" : ""}`} onClick={() => setSelected(row.public_id)}>
                <div className="d-flex justify-content-between">
                  <strong>{row.subject}</strong>
                  <span className="small">{t(`support.status.${row.status}`)}</span>
                </div>
                <div className="small">{t(`support.categories.${row.category}`)}{row.pnr && ` · ${row.pnr}`}</div>
              </button>
            ))}
          </div>
          {ticket.data && (
            <div className="card">
              <div className="card-body" style={{ maxHeight: 400, overflowY: "auto" }}>
                {ticket.data.messages.map((m) => (
                  <div key={m.public_id} className={`d-flex mb-2 ${m.sender === "customer" ? "justify-content-end" : ""}`}>
                    <div className={`p-2 rounded-3 ${m.sender === "customer" ? "bg-primary-subtle" : "bg-light border"}`} style={{ maxWidth: "85%", whiteSpace: "pre-wrap" }}>
                      {m.body}
                      <div className="small text-muted mt-1">{m.sender === "staff" ? t("support.from_bbms") : t("support.from_you")} · {formatWhen(m.created_at, language)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <form
                className="card-footer d-flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendReply.mutate(reply.trim(), { onSuccess: () => setReply("") });
                }}
              >
                <input className="form-control" aria-label={t("support.reply")} placeholder={t("support.reply")} value={reply} onChange={(e) => setReply(e.target.value)} />
                <button type="submit" className="btn btn-primary" disabled={!reply.trim() || sendReply.isPending}>{t("support.send")}</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
