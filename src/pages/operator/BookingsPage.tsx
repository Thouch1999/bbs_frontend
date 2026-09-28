// Bookings: server-paginated list with filters; detail slide-over with
// "mark counter payment received" and cancellation (refund shown from the
// server's cancellation-preview — never a client-side guess at the tiers).
import { useEffect, useState } from "react";
import { Alert, Form, Modal, Offcanvas } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

import { useMarkCounterPaid, useOperatorBookings, useOperatorCancelBooking, useOperatorCancellationPreview } from "../../api/operator";
import { Card, ContentHeader } from "../../components/layout/adminlte";
import { DataTable, type Column } from "../../components/shared/DataTable";
import { ApiErrorAlert, StatusBadge } from "../../components/shared/backoffice";
import { useLocale } from "../../context/LocaleContext";
import type { OperatorBooking } from "../../types/operator";
import { formatMoney } from "../../utils/money";
import { formatDateTime } from "../../utils/time";

const PAGE_SIZE = 25;

export function BookingsPage() {
  const { t } = useTranslation(["operator", "backoffice"]);
  const { language } = useLocale();
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [channel, setChannel] = useState("");
  const [pendingCounter, setPendingCounter] = useState(params.get("pending_counter") === "1");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<OperatorBooking | null>(null);
  const trip = params.get("trip") ?? undefined;

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);
  useEffect(() => setPage(1), [debounced, status, channel, pendingCounter, dateFrom, dateTo]);

  const bookings = useOperatorBookings({
    trip,
    search: debounced || undefined,
    status: status || undefined,
    channel: channel || undefined,
    pending_counter: pendingCounter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    page,
    page_size: PAGE_SIZE,
  });

  const columns: Column<OperatorBooking>[] = [
    { key: "pnr", header: "PNR", render: (b) => <code className="fw-bold">{b.pnr}</code> },
    { key: "departure", header: t("operator:bookings.departure"), render: (b) => formatDateTime(b.departure_at, language) },
    {
      key: "route",
      header: t("operator:table.route"),
      render: (b) => (
        <>
          {b.route_name}
          <br />
          <small className="text-muted">{b.bus_plate_number}</small>
        </>
      ),
    },
    {
      key: "passengers",
      header: t("operator:bookings.passengers"),
      render: (b) => (
        <>
          {b.passengers[0]?.full_name}
          {b.passengers.length > 1 && <span className="text-muted"> +{b.passengers.length - 1}</span>}
          <br />
          <small className="text-muted">{b.contact_phone}</small>
        </>
      ),
    },
    { key: "seats", header: t("operator:manifest.seat"), render: (b) => b.passengers.map((p) => p.seat_number).join(", ") },
    { key: "total", header: t("operator:bookings.total"), render: (b) => formatMoney(b.total_amount, b.currency, language) },
    {
      key: "channel",
      header: t("operator:manifest.channel"),
      render: (b) => <span className="badge bg-light text-dark border">{t(`operator:channel.${b.booking_channel}`)}</span>,
    },
    {
      key: "status",
      header: t("operator:table.status"),
      render: (b) => (
        <>
          <StatusBadge status={b.status} />
          {b.pending_counter_payment_id && (
            <span className="d-block small text-warning">{t("operator:bookings.awaiting_counter")}</span>
          )}
        </>
      ),
    },
  ];

  return (
    <>
      <ContentHeader
        title={t("operator:bookings.title")}
        breadcrumbs={[{ label: t("operator:nav.dashboard"), to: "/operator" }, { label: t("operator:bookings.title") }]}
      />
      <section className="content">
        <div className="container-fluid">
          <Card
            title={trip ? t("operator:bookings.for_trip") : t("operator:bookings.card_title")}
            tools={
              <Link to="/operator/counter" className="btn btn-sm bbms-cta">
                <i className="fas fa-plus me-1" aria-hidden="true" />
                {t("operator:bookings.new_counter")}
              </Link>
            }
          >
            <div className="row g-2 mb-3">
              <div className="col-md-3">
                <Form.Control
                  size="sm"
                  type="search"
                  placeholder={t("operator:bookings.search")}
                  aria-label={t("operator:bookings.search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="col-md-2 col-6">
                <Form.Select size="sm" aria-label={t("operator:table.status")} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">{t("operator:schedule.all_statuses")}</option>
                  {["pending_payment", "confirmed", "cancelled", "completed"].map((s) => (
                    <option key={s} value={s}>
                      {t(`backoffice:status.${s}`)}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-2 col-6">
                <Form.Select size="sm" aria-label={t("operator:manifest.channel")} value={channel} onChange={(e) => setChannel(e.target.value)}>
                  <option value="">{t("operator:bookings.all_channels")}</option>
                  {["web", "counter", "telegram"].map((c) => (
                    <option key={c} value={c}>
                      {t(`operator:channel.${c}`)}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-3 d-flex gap-1 align-items-center">
                <Form.Control size="sm" type="date" aria-label={t("operator:reports.from")} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <span aria-hidden="true">–</span>
                <Form.Control size="sm" type="date" aria-label={t("operator:reports.to")} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div className="col-md-2 d-flex align-items-center">
                <Form.Check id="pending-counter" className="small mb-0" label={t("operator:bookings.pending_counter")} checked={pendingCounter} onChange={(e) => setPendingCounter(e.target.checked)} />
              </div>
            </div>
            <ApiErrorAlert error={bookings.error as never} />
            <DataTable
              rows={bookings.data?.results ?? []}
              columns={columns}
              rowKey={(b) => b.public_id}
              isLoading={bookings.isLoading}
              onRowClick={setDetail}
              serverPagination={{ page, pageSize: PAGE_SIZE, count: bookings.data?.count ?? 0, onPageChange: setPage }}
              empty={t("operator:bookings.empty")}
            />
          </Card>
        </div>
      </section>
      <BookingDetail booking={detail} onClose={() => setDetail(null)} onChanged={setDetail} />
    </>
  );
}

function BookingDetail({
  booking,
  onClose,
  onChanged,
}: {
  booking: OperatorBooking | null;
  onClose: () => void;
  onChanged: (booking: OperatorBooking | null) => void;
}) {
  const { t } = useTranslation(["operator", "backoffice"]);
  const { language } = useLocale();
  const markPaid = useMarkCounterPaid();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMessage("");
    markPaid.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset per booking
  }, [booking?.public_id]);

  const boarding = booking ? (language === "km" ? booking.boarding_stop_name_km || booking.boarding_stop_name_en : booking.boarding_stop_name_en) : "";
  const drop = booking ? (language === "km" ? booking.drop_stop_name_km || booking.drop_stop_name_en : booking.drop_stop_name_en) : "";

  return (
    <>
      <Offcanvas show={Boolean(booking)} onHide={onClose} placement="end" style={{ width: 480, maxWidth: "100vw" }}>
        <Offcanvas.Header closeButton>
          <Offcanvas.Title as="h5">
            {t("operator:bookings.booking")} <code>{booking?.pnr}</code>
          </Offcanvas.Title>
        </Offcanvas.Header>
        {booking && (
          <Offcanvas.Body>
            {message && <Alert variant="success" className="py-2">{message}</Alert>}
            <dl className="row small mb-3">
              <dt className="col-5">{t("operator:table.status")}</dt>
              <dd className="col-7"><StatusBadge status={booking.status} /></dd>
              <dt className="col-5">{t("operator:table.route")}</dt>
              <dd className="col-7">{booking.route_name}</dd>
              <dt className="col-5">{t("operator:bookings.departure")}</dt>
              <dd className="col-7">{formatDateTime(booking.departure_at, language)} <StatusBadge status={booking.trip_status} /></dd>
              <dt className="col-5">{t("operator:table.bus")}</dt>
              <dd className="col-7">{booking.bus_plate_number}</dd>
              <dt className="col-5">{t("operator:manifest.boarding_point")}</dt>
              <dd className="col-7">{boarding || "—"} → {drop || "—"}</dd>
              <dt className="col-5">{t("operator:bookings.contact")}</dt>
              <dd className="col-7">{booking.contact_phone}{booking.contact_email ? <><br />{booking.contact_email}</> : null}</dd>
              <dt className="col-5">{t("operator:manifest.channel")}</dt>
              <dd className="col-7">
                {t(`operator:channel.${booking.booking_channel}`)}
                {booking.booked_by_staff_name && <> · {booking.booked_by_staff_name}</>}
              </dd>
              <dt className="col-5">{t("operator:bookings.total")}</dt>
              <dd className="col-7 fw-bold">{formatMoney(booking.total_amount, booking.currency, language)}</dd>
              {booking.payment_provider && (
                <>
                  <dt className="col-5">{t("operator:manifest.payment")}</dt>
                  <dd className="col-7">{t(`operator:payment_method.${booking.payment_provider}`)}</dd>
                </>
              )}
              {booking.status === "cancelled" && (
                <>
                  <dt className="col-5">{t("operator:bookings.refund")}</dt>
                  <dd className="col-7">
                    {booking.refund_amount ? formatMoney(booking.refund_amount, booking.currency, language) : "—"}
                    {booking.refund_percentage && <> ({Number(booking.refund_percentage)}%)</>}
                    <br />
                    <small className="text-muted">{booking.cancellation_reason}</small>
                  </dd>
                </>
              )}
            </dl>
            <h6>{t("operator:bookings.passengers")}</h6>
            <ul className="list-group mb-3">
              {booking.passengers.map((p) => (
                <li key={p.public_id} className="list-group-item d-flex justify-content-between">
                  <span>
                    {p.full_name}
                    <small className="text-muted d-block">
                      {[p.age, p.gender ? t(`operator:gender.${p.gender}`) : "", p.phone].filter(Boolean).join(" · ")}
                    </small>
                  </span>
                  <strong>{p.seat_number}</strong>
                </li>
              ))}
            </ul>
            {booking.status === "cancelled" && Number(booking.refund_amount) > 0 && (
              <Alert variant="info" className="py-2 small">{t("operator:bookings.refund_by_admin")}</Alert>
            )}
            <ApiErrorAlert error={markPaid.error} />
            <div className="d-grid gap-2">
              {booking.pending_counter_payment_id && (
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={markPaid.isPending}
                  onClick={() =>
                    markPaid.mutate(booking.pending_counter_payment_id!, {
                      onSuccess: () => {
                        setMessage(t("operator:bookings.marked_paid"));
                        onChanged({ ...booking, status: "confirmed", pending_counter_payment_id: null });
                      },
                    })
                  }
                >
                  <i className="fas fa-cash-register me-1" aria-hidden="true" />
                  {t("operator:bookings.mark_paid", { amount: formatMoney(booking.total_amount, booking.currency, language) })}
                </button>
              )}
              <Link to={`/operator/trips/${booking.trip_public_id}/manifest`} className="btn btn-outline-primary">
                {t("operator:actions.manifest")}
              </Link>
              {(booking.status === "pending_payment" || booking.status === "confirmed") && (
                <button type="button" className="btn btn-outline-danger" onClick={() => setCancelOpen(true)}>
                  {t("operator:bookings.cancel_booking")}
                </button>
              )}
            </div>
          </Offcanvas.Body>
        )}
      </Offcanvas>
      {booking && (
        <OperatorCancelDialog
          booking={booking}
          show={cancelOpen}
          onClose={() => setCancelOpen(false)}
          onCancelled={(updated) => {
            setCancelOpen(false);
            setMessage(t("operator:bookings.cancelled"));
            onChanged(updated);
          }}
        />
      )}
    </>
  );
}

function OperatorCancelDialog({
  booking,
  show,
  onClose,
  onCancelled,
}: {
  booking: OperatorBooking;
  show: boolean;
  onClose: () => void;
  onCancelled: (booking: OperatorBooking) => void;
}) {
  const { t } = useTranslation(["operator", "backoffice"]);
  const { language } = useLocale();
  const [reason, setReason] = useState("");
  const preview = useOperatorCancellationPreview(booking.public_id, show);
  const cancel = useOperatorCancelBooking();

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h5">{t("operator:bookings.cancel_title", { pnr: booking.pnr })}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {preview.data && (
          <div className="mb-3">
            <div className="d-flex justify-content-between">
              <span>{t("operator:bookings.total")}</span>
              <span>{formatMoney(booking.total_amount, booking.currency, language)}</span>
            </div>
            <div className="d-flex justify-content-between fw-bold text-success">
              <span>{t("operator:bookings.refund_due", { percent: Number(preview.data.refund_percentage) })}</span>
              <span>{formatMoney(preview.data.refund_amount, booking.currency, language)}</span>
            </div>
          </div>
        )}
        <Form.Group controlId="operator-cancel-reason">
          <Form.Label>{t("operator:bookings.cancel_reason")}</Form.Label>
          <Form.Control as="textarea" rows={2} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Form.Group>
        <ApiErrorAlert error={cancel.error} className="py-2 mt-3 mb-0" />
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          {t("operator:bookings.keep")}
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={cancel.isPending || preview.isLoading}
          onClick={() => cancel.mutate({ publicId: booking.public_id, reason }, { onSuccess: onCancelled })}
        >
          {t("operator:bookings.confirm_cancel")}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
