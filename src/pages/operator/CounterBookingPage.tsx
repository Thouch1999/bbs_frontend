// S1 — agent-assisted (counter) booking, one screen, keyboard-first:
// F2 focuses the trip search, F4 confirms. Flow on confirm: hold the seats
// (same SRS 6.3 lock as the passenger site) -> POST /bookings/agent/
// (booking_channel=counter, booked_by_staff=me) -> pay-at-counter payment,
// immediately marked paid for cash, or left pending until the counter
// deadline for "pay later".
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Form } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import {
  useAgentCreateBooking,
  useAllOperatorTrips,
  useCustomerLookup,
  useMarkCounterPaid,
  useOperatorBookings,
  useOperatorRoutes,
  usePublicConfig,
  useTripSeatMap,
} from "../../api/operator";
import { useInitiatePayment } from "../../api/payments";
import { useTripStops } from "../../api/routes";
import { useHoldSeats, useReleaseSeats } from "../../api/trips";
import type { ApiError } from "../../api/types";
import { SeatLegend } from "../../components/booking/SeatLegend";
import { SeatMap } from "../../components/booking/SeatMap";
import { Card, ContentHeader } from "../../components/layout/adminlte";
import { ApiErrorAlert, LoadingBlock, StatusBadge, useLocalizedName, useRouteLabel } from "../../components/shared/backoffice";
import { useLocale } from "../../context/LocaleContext";
import type { Booking, Gender } from "../../types";
import type { Currency, OperatorTrip } from "../../types/operator";
import { formatMoney } from "../../utils/money";
import { formatTime, localDateISO } from "../../utils/time";

interface PassengerDraft {
  full_name: string;
  age: string;
  gender: Gender;
}

type PaymentMode = "cash" | "later";

const EMPTY_PASSENGER: PassengerDraft = { full_name: "", age: "", gender: "" };

export function CounterBookingPage() {
  const { t } = useTranslation(["operator", "backoffice", "booking"]);
  const { language, currency: preferredCurrency } = useLocale();
  const localizedName = useLocalizedName();
  const routeLabel = useRouteLabel();
  const searchRef = useRef<HTMLSelectElement>(null);
  const today = localDateISO();

  const [originId, setOriginId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [date, setDate] = useState(today);
  const [paxCount, setPaxCount] = useState(1);
  const [trip, setTrip] = useState<OperatorTrip | null>(null);
  const [seatIds, setSeatIds] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [passengers, setPassengers] = useState<PassengerDraft[]>([EMPTY_PASSENGER]);
  const [boardingId, setBoardingId] = useState("");
  const [dropId, setDropId] = useState("");
  const [currency, setCurrency] = useState<Currency>(preferredCurrency);
  const [payment, setPayment] = useState<PaymentMode>("cash");
  const [received, setReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<{ booking: Booking; paid: boolean } | null>(null);

  const routes = useOperatorRoutes();
  const config = usePublicConfig();
  const trips = useAllOperatorTrips({ date_from: date, date_to: date, status: "scheduled,delayed" });
  const seatMap = useTripSeatMap(trip?.public_id);
  const stops = useTripStops(trip?.public_id ?? null);
  const lookup = useCustomerLookup(phone);
  const todaysCounter = useOperatorBookings({ channel: "counter", date_from: today, date_to: today, page_size: 1 });
  const holdSeats = useHoldSeats(trip?.public_id);
  const releaseSeats = useReleaseSeats(trip?.public_id);
  const createBooking = useAgentCreateBooking();
  const initiatePayment = useInitiatePayment();
  const markPaid = useMarkCounterPaid();

  const cities = useMemo(() => {
    const byId = new Map<string, { public_id: string; name_en: string; name_km: string }>();
    (routes.data ?? []).forEach((r) => {
      byId.set(r.origin_city.public_id, r.origin_city);
      byId.set(r.destination_city.public_id, r.destination_city);
    });
    return [...byId.values()].sort((a, b) => localizedName(a).localeCompare(localizedName(b)));
  }, [routes.data, localizedName]);

  const now = new Date().toISOString();
  const matchingTrips = (trips.data ?? []).filter(
    (candidate) =>
      candidate.departure_at > now &&
      candidate.seats_available >= paxCount &&
      (!originId || candidate.route.origin_city.public_id === originId) &&
      (!destinationId || candidate.route.destination_city.public_id === destinationId)
  );

  // Keep one passenger form per requested seat.
  useEffect(() => {
    setPassengers((current) => Array.from({ length: paxCount }, (_, i) => current[i] ?? EMPTY_PASSENGER));
    setSeatIds((current) => current.slice(0, paxCount));
  }, [paxCount]);

  // Default boarding/drop to the route's first/last stop.
  useEffect(() => {
    setBoardingId(stops.data?.[0]?.public_id ?? "");
    setDropId(stops.data?.[stops.data.length - 1]?.public_id ?? "");
  }, [stops.data]);

  const clearForm = () => {
    setTrip(null);
    setSeatIds([]);
    setPhone("");
    setEmail("");
    setPassengers(Array.from({ length: paxCount }, () => EMPTY_PASSENGER));
    setReceived("");
    setError(null);
    setDone(null);
    searchRef.current?.focus();
  };

  const farePerSeat = trip ? Number(currency === "USD" ? trip.base_fare_usd : trip.base_fare_khr) : 0;
  const fee = Number(currency === "USD" ? (config.data?.booking_fee_usd ?? 0) : (config.data?.booking_fee_khr ?? 0));
  const total = trip ? farePerSeat * seatIds.length + fee : 0;
  const change = received ? Number(received) - total : 0;
  const ready =
    Boolean(trip) &&
    seatIds.length === paxCount &&
    passengers.every((p) => p.full_name.trim()) &&
    phone.replace(/\D/g, "").length >= 8 &&
    (payment === "later" || (received !== "" && change >= 0));

  async function confirm() {
    if (!trip || !ready || submitting) return;
    setSubmitting(true);
    setError(null);
    let holdToken: string | null = null;
    try {
      const hold = await holdSeats.mutateAsync(seatIds);
      holdToken = hold.hold_token;
      const booking = await createBooking.mutateAsync({
        trip_id: trip.public_id,
        hold_token: hold.hold_token,
        passengers: passengers.map((p) => ({
          full_name: p.full_name.trim(),
          ...(p.age ? { age: Number(p.age) } : {}),
          ...(p.gender ? { gender: p.gender } : {}),
        })),
        contact_phone: phone,
        contact_email: email.trim() || null,
        currency,
        boarding_stop_id: boardingId || null,
        drop_stop_id: dropId || null,
      });
      holdToken = null; // the booking owns the seats now
      const started = await initiatePayment.mutateAsync({ booking_id: booking.public_id, provider: "counter" });
      if (payment === "cash") await markPaid.mutateAsync(started.payment.public_id);
      setDone({ booking, paid: payment === "cash" });
    } catch (e) {
      setError(e as ApiError);
      if (holdToken) releaseSeats.mutate(seatIds);
    } finally {
      setSubmitting(false);
    }
  }

  // F2 = search, F4 = confirm (counter staff work from the keyboard).
  const confirmRef = useRef(confirm);
  confirmRef.current = confirm;
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "F2") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "F4") {
        event.preventDefault();
        void confirmRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function applyPreviousPassengers() {
    if (!lookup.data) return;
    const previous = lookup.data.passengers;
    setPassengers((current) =>
      current.map((p, i) =>
        previous[i]
          ? { full_name: previous[i].full_name, age: previous[i].age ? String(previous[i].age) : "", gender: (previous[i].gender || "") as Gender }
          : p
      )
    );
    if (lookup.data.contact_email) setEmail(lookup.data.contact_email);
  }

  const kbd = (key: string) => <kbd className="bbms-kbd">{key}</kbd>;

  return (
    <>
      <ContentHeader
        title={t("operator:counter.title")}
        breadcrumbs={[{ label: t("operator:nav.bookings"), to: "/operator/bookings" }, { label: t("operator:counter.title") }]}
        actions={
          <span className="badge rounded-pill bg-bbms-tint text-dark border">
            {t("operator:counter.today_count", { count: todaysCounter.data?.count ?? 0 })}
          </span>
        }
      />
      <section className="content">
        <div className="container-fluid">
          <div className="d-flex flex-wrap gap-3 small text-muted mb-2">
            <span>{kbd("F2")} {t("operator:counter.shortcut_search")}</span>
            <span>{kbd("F4")} {t("operator:counter.shortcut_confirm")}</span>
            <button type="button" className="btn btn-link btn-sm p-0" onClick={clearForm}>
              {t("operator:counter.clear")}
            </button>
          </div>

          {done ? (
            <Card title={t("operator:counter.success_title")}>
              <div className="text-center py-3">
                <i className="fas fa-check-circle text-success" style={{ fontSize: 48 }} aria-hidden="true" />
                <p className="mt-2 mb-1">{t("operator:counter.pnr")}</p>
                <p className="display-6 fw-bold mb-2">
                  <code>{done.booking.pnr}</code>
                </p>
                <p>
                  <StatusBadge status={done.paid ? "confirmed" : "pending_payment"} />{" "}
                  {formatMoney(done.booking.total_amount, done.booking.currency, language)}
                </p>
                {done.paid ? (
                  <p className="text-muted small">{t("operator:counter.sms_sent", { phone: done.booking.contact_phone })}</p>
                ) : (
                  <Alert variant="warning" className="d-inline-block py-2 small">
                    {t("operator:counter.pay_later_note", { minutes: config.data?.counter_payment_deadline_minutes ?? 120 })}
                  </Alert>
                )}
                <div className="d-flex flex-wrap justify-content-center gap-2 mt-2">
                  {done.paid && (
                    <a
                      className="btn btn-primary"
                      href={`/ticket?pnr=${encodeURIComponent(done.booking.pnr)}&phone=${encodeURIComponent(done.booking.contact_phone)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <i className="fas fa-print me-1" aria-hidden="true" />
                      {t("operator:counter.print_ticket")}
                    </a>
                  )}
                  <Link to="/operator/bookings" className="btn btn-outline-secondary">
                    {t("operator:nav.bookings")}
                  </Link>
                  <button type="button" className="btn bbms-cta" onClick={clearForm}>
                    {t("operator:counter.new_booking")}
                  </button>
                </div>
              </div>
            </Card>
          ) : (
            <div className="row">
              <div className="col-lg-3">
                <Card title={t("operator:counter.search_title")}>
                  <Form.Group className="mb-2" controlId="counter-origin">
                    <Form.Label className="small mb-0">{t("common:search.origin")}</Form.Label>
                    <Form.Select ref={searchRef} size="sm" value={originId} onChange={(e) => setOriginId(e.target.value)}>
                      <option value="">{t("operator:counter.any")}</option>
                      {cities.map((c) => (
                        <option key={c.public_id} value={c.public_id}>{localizedName(c)}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <Form.Group className="mb-2" controlId="counter-destination">
                    <Form.Label className="small mb-0">{t("common:search.destination")}</Form.Label>
                    <Form.Select size="sm" value={destinationId} onChange={(e) => setDestinationId(e.target.value)}>
                      <option value="">{t("operator:counter.any")}</option>
                      {cities.map((c) => (
                        <option key={c.public_id} value={c.public_id}>{localizedName(c)}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <div className="row g-2 mb-2">
                    <Form.Group className="col-7" controlId="counter-date">
                      <Form.Label className="small mb-0">{t("common:search.date")}</Form.Label>
                      <Form.Control size="sm" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
                    </Form.Group>
                    <Form.Group className="col-5" controlId="counter-pax">
                      <Form.Label className="small mb-0">{t("common:search.passengers")}</Form.Label>
                      <Form.Control size="sm" type="number" min={1} max={10} value={paxCount} onChange={(e) => setPaxCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))} />
                    </Form.Group>
                  </div>
                  <hr />
                  {trips.isLoading && <LoadingBlock />}
                  {!trips.isLoading && matchingTrips.length === 0 && <p className="small text-muted mb-0">{t("operator:counter.no_trips")}</p>}
                  {matchingTrips.map((candidate) => (
                    <button
                      key={candidate.public_id}
                      type="button"
                      className={`bbms-trip-option${trip?.public_id === candidate.public_id ? " active" : ""}`}
                      onClick={() => {
                        setTrip(candidate);
                        setSeatIds([]);
                      }}
                    >
                      <div className="d-flex justify-content-between">
                        <strong>{formatTime(candidate.departure_at, language)}</strong>
                        <span>{formatMoney(currency === "USD" ? candidate.base_fare_usd : candidate.base_fare_khr, currency, language)}</span>
                      </div>
                      <div className="small">{routeLabel(candidate.route)}</div>
                      <div className="small text-muted d-flex justify-content-between">
                        <span>{t(`operator:bus_type.${candidate.bus_type}`)}</span>
                        <span>{t("booking:results.seats_left", { count: candidate.seats_available })}</span>
                      </div>
                      {candidate.status === "delayed" && <StatusBadge status="delayed" />}
                    </button>
                  ))}
                </Card>
              </div>

              <div className="col-lg-5">
                <Card title={t("operator:counter.seats_title")} tools={trip ? <span className="small text-muted">{seatIds.length}/{paxCount}</span> : undefined}>
                  {!trip && <p className="text-muted mb-0">{t("operator:counter.pick_trip")}</p>}
                  {trip && seatMap.isLoading && <LoadingBlock />}
                  {trip && seatMap.data && (
                    <>
                      <SeatMap
                        seats={seatMap.data}
                        selectedSeatIds={seatIds}
                        onChangeSelection={(ids) => setSeatIds(ids.length > paxCount ? ids.slice(ids.length - paxCount) : ids)}
                      />
                      <div className="mt-3"><SeatLegend /></div>
                    </>
                  )}
                </Card>
              </div>

              <div className="col-lg-4">
                <div className="bbms-sticky-card">
                  <Card title={t("operator:counter.details_title")}>
                    <Form.Group className="mb-2" controlId="counter-phone">
                      <Form.Label className="small mb-0">{t("operator:counter.customer_phone")}</Form.Label>
                      <Form.Control size="sm" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="012 345 678" />
                      {lookup.data && (
                        <button type="button" className="btn btn-link btn-sm px-0" onClick={applyPreviousPassengers}>
                          <i className="fas fa-user-clock me-1" aria-hidden="true" />
                          {t("operator:counter.returning", { count: lookup.data.bookings_count, name: lookup.data.passengers[0]?.full_name ?? "" })}
                        </button>
                      )}
                    </Form.Group>
                    {passengers.map((p, index) => {
                      const seat = seatMap.data?.find((s) => s.seat.public_id === seatIds[index]);
                      return (
                        <div key={index} className="border rounded p-2 mb-2">
                          <div className="small fw-semibold mb-1">
                            {t("operator:counter.passenger_n", { n: index + 1 })} {seat && <span className="badge bg-primary ms-1">{seat.seat.seat_number}</span>}
                          </div>
                          <div className="row g-1">
                            <div className="col-12">
                              <Form.Control
                                size="sm"
                                placeholder={t("booking:checkout.full_name")}
                                aria-label={t("booking:checkout.full_name")}
                                value={p.full_name}
                                onChange={(e) => setPassengers(passengers.map((x, i) => (i === index ? { ...x, full_name: e.target.value } : x)))}
                              />
                            </div>
                            <div className="col-5">
                              <Form.Control
                                size="sm"
                                type="number"
                                min={0}
                                max={120}
                                placeholder={t("booking:checkout.age")}
                                aria-label={t("booking:checkout.age")}
                                value={p.age}
                                onChange={(e) => setPassengers(passengers.map((x, i) => (i === index ? { ...x, age: e.target.value } : x)))}
                              />
                            </div>
                            <div className="col-7">
                              <Form.Select
                                size="sm"
                                aria-label={t("booking:checkout.gender")}
                                value={p.gender}
                                onChange={(e) => setPassengers(passengers.map((x, i) => (i === index ? { ...x, gender: e.target.value as Gender } : x)))}
                              >
                                <option value="">{t("booking:checkout.gender")}</option>
                                <option value="male">{t("booking:checkout.gender_male")}</option>
                                <option value="female">{t("booking:checkout.gender_female")}</option>
                                <option value="other">{t("booking:checkout.gender_other")}</option>
                              </Form.Select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <Form.Control size="sm" type="email" className="mb-2" placeholder={t("operator:counter.email_optional")} aria-label={t("operator:counter.email_optional")} value={email} onChange={(e) => setEmail(e.target.value)} />
                    {stops.data && stops.data.length > 0 && (
                      <div className="row g-1 mb-2">
                        <div className="col-6">
                          <Form.Select size="sm" aria-label={t("booking:checkout.boarding_point")} value={boardingId} onChange={(e) => setBoardingId(e.target.value)}>
                            {stops.data.map((s) => <option key={s.public_id} value={s.public_id}>{localizedName(s.stop)}</option>)}
                          </Form.Select>
                        </div>
                        <div className="col-6">
                          <Form.Select size="sm" aria-label={t("booking:checkout.drop_point")} value={dropId} onChange={(e) => setDropId(e.target.value)}>
                            {stops.data.map((s) => <option key={s.public_id} value={s.public_id}>{localizedName(s.stop)}</option>)}
                          </Form.Select>
                        </div>
                      </div>
                    )}
                    <div className="d-flex gap-2 mb-2">
                      <div className="btn-group btn-group-sm" role="group" aria-label={t("operator:charts.currency")}>
                        {(["KHR", "USD"] as const).map((c) => (
                          <button key={c} type="button" className={`btn btn-outline-secondary ${currency === c ? "active" : ""}`} onClick={() => setCurrency(c)}>
                            {c === "KHR" ? "៛" : "$"}
                          </button>
                        ))}
                      </div>
                      <Form.Check inline type="radio" id="pay-cash" name="pay" label={t("operator:counter.cash")} checked={payment === "cash"} onChange={() => setPayment("cash")} />
                      <Form.Check inline type="radio" id="pay-later" name="pay" label={t("operator:counter.pay_later")} checked={payment === "later"} onChange={() => setPayment("later")} />
                    </div>
                    {payment === "cash" && (
                      <div className="row g-1 mb-2 align-items-end">
                        <Form.Group className="col-6" controlId="counter-received">
                          <Form.Label className="small mb-0">{t("operator:counter.received")}</Form.Label>
                          <Form.Control size="sm" type="number" min={0} step={currency === "USD" ? "0.01" : "100"} value={received} onChange={(e) => setReceived(e.target.value)} />
                        </Form.Group>
                        <div className="col-6 small">
                          {t("operator:counter.change")}:{" "}
                          <strong className={change < 0 ? "text-danger" : ""}>{received ? formatMoney(String(change), currency, language) : "—"}</strong>
                        </div>
                      </div>
                    )}
                    <div className="d-flex justify-content-between align-items-baseline border-top pt-2 mb-2">
                      <span>{t("operator:counter.total")}</span>
                      <strong className="fs-5">{formatMoney(String(total), currency, language)}</strong>
                    </div>
                    <ApiErrorAlert error={error} />
                    <button type="button" className="btn bbms-cta btn-lg w-100" disabled={!ready || submitting} onClick={() => void confirm()}>
                      {submitting && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
                      {t("operator:counter.confirm")} {kbd("F4")}
                    </button>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
