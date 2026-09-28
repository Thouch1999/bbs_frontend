// O2 — "create trip" right slide-over (480px): single trip or a recurring
// pattern (daily / chosen weekdays), fares in both currencies with a
// server-rate auto-conversion hint, optional peak pricing, crew assignment.
// Bus conflicts are checked server-side (409 bus_conflict), all-or-nothing.
import { useEffect, useMemo, useState } from "react";
import { Form, Offcanvas } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import {
  useBuses,
  useCreateRecurringTrips,
  useCreateTrip,
  useOperatorRoutes,
  usePublicConfig,
  useStaff,
  useUpdateTrip,
} from "../../api/operator";
import type { ApiError } from "../../api/types";
import { useLocale } from "../../context/LocaleContext";
import type { OperatorTrip } from "../../types/operator";
import { formatMoney } from "../../utils/money";
import {
  addDays,
  addMinutesToLocalInput,
  formatWeekday,
  fromLocalInputValue,
  localDateISO,
  startOfWeek,
  toLocalInputValue,
} from "../../utils/time";
import { ApiErrorAlert, useRouteLabel } from "../shared/backoffice";

type Repeat = "once" | "daily" | "weekdays";

interface TripFormOffcanvasProps {
  show: boolean;
  trip?: OperatorTrip | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface FormState {
  routeId: string;
  busId: string;
  departure: string; // datetime-local, Cambodia time
  arrival: string;
  repeat: Repeat;
  endDate: string;
  weekdays: number[];
  fareUsd: string;
  fareKhr: string;
  peak: boolean;
  peakStart: string;
  peakEnd: string;
  peakMultiplier: string;
  driverName: string;
  driverPhone: string;
  conductorId: string;
}

function emptyState(): FormState {
  const tomorrow = addDays(localDateISO(), 1);
  return {
    routeId: "",
    busId: "",
    departure: `${tomorrow}T07:00`,
    arrival: `${tomorrow}T12:00`,
    repeat: "once",
    endDate: addDays(tomorrow, 13),
    weekdays: [],
    fareUsd: "",
    fareKhr: "",
    peak: false,
    peakStart: tomorrow,
    peakEnd: addDays(tomorrow, 2),
    peakMultiplier: "1.20",
    driverName: "",
    driverPhone: "",
    conductorId: "",
  };
}

function stateFromTrip(trip: OperatorTrip): FormState {
  return {
    ...emptyState(),
    routeId: trip.route.public_id,
    busId: trip.bus_public_id,
    departure: toLocalInputValue(trip.departure_at),
    arrival: toLocalInputValue(trip.arrival_at),
    fareUsd: trip.base_fare_usd,
    fareKhr: String(Math.round(Number(trip.base_fare_khr))),
    driverName: trip.driver_name,
    driverPhone: trip.driver_phone,
    conductorId: trip.conductor_id ?? "",
  };
}

function minutesBetween(fromLocal: string, toLocal: string): number {
  return Math.round(
    (new Date(fromLocalInputValue(toLocal)).getTime() - new Date(fromLocalInputValue(fromLocal)).getTime()) / 60_000
  );
}

export function TripFormOffcanvas({ show, trip, onClose, onSaved }: TripFormOffcanvasProps) {
  const { t } = useTranslation(["operator", "backoffice"]);
  const { language } = useLocale();
  const routeLabel = useRouteLabel();
  const routes = useOperatorRoutes();
  const buses = useBuses();
  const staff = useStaff();
  const config = usePublicConfig();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const createRecurring = useCreateRecurringTrips();
  const [form, setForm] = useState<FormState>(emptyState);
  const editing = Boolean(trip);

  useEffect(() => {
    if (!show) return;
    setForm(trip ? stateFromTrip(trip) : emptyState());
    createTrip.reset();
    updateTrip.reset();
    createRecurring.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when (re)opened
  }, [show, trip?.public_id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const activeRoutes = (routes.data ?? []).filter((r) => r.is_active || r.public_id === form.routeId);
  const activeBuses = (buses.data ?? []).filter((b) => b.status === "active" || b.public_id === form.busId);
  const conductors = (staff.data ?? []).filter((s) => s.can_validate_tickets && s.is_active);
  const selectedRoute = routes.data?.find((r) => r.public_id === form.routeId);
  const rate = Number(config.data?.khr_per_usd ?? 0);
  const suggestedKhr = rate && Number(form.fareUsd) > 0 ? String(Math.round(Number(form.fareUsd) * rate)) : "";

  function chooseRoute(routeId: string) {
    const route = routes.data?.find((r) => r.public_id === routeId);
    setForm((f) => ({
      ...f,
      routeId,
      arrival: route?.estimated_duration_minutes
        ? addMinutesToLocalInput(f.departure, route.estimated_duration_minutes)
        : f.arrival,
    }));
  }

  function changeDeparture(value: string) {
    setForm((f) => {
      const duration = Math.max(minutesBetween(f.departure, f.arrival), selectedRoute?.estimated_duration_minutes ?? 0);
      return { ...f, departure: value, arrival: duration > 0 ? addMinutesToLocalInput(value, duration) : f.arrival };
    });
  }

  function toggleWeekday(day: number) {
    set("weekdays", form.weekdays.includes(day) ? form.weekdays.filter((d) => d !== day) : [...form.weekdays, day].sort());
  }

  const weekdayLabels = useMemo(() => {
    const monday = startOfWeek(localDateISO());
    return Array.from({ length: 7 }, (_, i) => formatWeekday(addDays(monday, i), language));
  }, [language]);

  const crew = {
    driver_name: form.driverName.trim(),
    driver_phone: form.driverPhone.trim(),
    conductor_id: form.conductorId || null,
  };
  const pending = createTrip.isPending || updateTrip.isPending || createRecurring.isPending;
  const error = (createTrip.error ?? updateTrip.error ?? createRecurring.error) as ApiError | null;
  const duration = minutesBetween(form.departure, form.arrival);
  const valid =
    form.routeId &&
    form.busId &&
    Number(form.fareUsd) > 0 &&
    Number(form.fareKhr) > 0 &&
    duration > 0 &&
    (form.repeat !== "weekdays" || form.weekdays.length > 0);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    const fares = { base_fare_usd: Number(form.fareUsd).toFixed(2), base_fare_khr: String(Math.round(Number(form.fareKhr))) };
    if (editing && trip) {
      updateTrip.mutate(
        {
          publicId: trip.public_id,
          body: {
            route_id: form.routeId,
            bus_id: form.busId,
            departure_at: fromLocalInputValue(form.departure),
            arrival_at: fromLocalInputValue(form.arrival),
            ...fares,
            ...crew,
          },
        },
        { onSuccess: () => onSaved(t("operator:trip_form.saved")) }
      );
      return;
    }
    if (form.repeat === "once") {
      createTrip.mutate(
        {
          route_id: form.routeId,
          bus_id: form.busId,
          departure_at: fromLocalInputValue(form.departure),
          arrival_at: fromLocalInputValue(form.arrival),
          ...fares,
          ...crew,
        },
        { onSuccess: () => onSaved(t("operator:trip_form.created", { count: 1 })) }
      );
      return;
    }
    createRecurring.mutate(
      {
        route_id: form.routeId,
        bus_id: form.busId,
        start_date: form.departure.slice(0, 10),
        end_date: form.endDate,
        weekdays: form.repeat === "daily" ? [] : form.weekdays,
        departure_time: form.departure.slice(11, 16),
        duration_minutes: duration,
        ...fares,
        ...(form.peak
          ? { peak_start_date: form.peakStart, peak_end_date: form.peakEnd, peak_multiplier: Number(form.peakMultiplier).toFixed(2) }
          : {}),
        ...crew,
      },
      { onSuccess: (trips) => onSaved(t("operator:trip_form.created", { count: trips.length })) }
    );
  }

  return (
    <Offcanvas show={show} onHide={onClose} placement="end" style={{ width: 480, maxWidth: "100vw" }}>
      <Offcanvas.Header closeButton>
        <Offcanvas.Title as="h5">{editing ? t("operator:trip_form.edit_title") : t("operator:trip_form.title")}</Offcanvas.Title>
      </Offcanvas.Header>
      <Form onSubmit={submit} className="d-flex flex-column flex-grow-1" style={{ minHeight: 0 }}>
        <Offcanvas.Body className="flex-grow-1">
          <Form.Group className="mb-3" controlId="trip-route">
            <Form.Label>{t("operator:trip_form.route")}</Form.Label>
            <Form.Select value={form.routeId} onChange={(e) => chooseRoute(e.target.value)} required>
              <option value="">{t("backoffice:actions.choose")}</option>
              {activeRoutes.map((route) => (
                <option key={route.public_id} value={route.public_id}>
                  {routeLabel(route)}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3" controlId="trip-bus">
            <Form.Label>{t("operator:trip_form.bus")}</Form.Label>
            <Form.Select value={form.busId} onChange={(e) => set("busId", e.target.value)} required>
              <option value="">{t("backoffice:actions.choose")}</option>
              {activeBuses.map((bus) => (
                <option key={bus.public_id} value={bus.public_id}>
                  {bus.plate_number} · {t(`operator:bus_type.${bus.seat_layout.bus_type}`)} · {bus.seat_layout.seats.length}
                </option>
              ))}
            </Form.Select>
            {editing && <Form.Text>{t("operator:trip_form.bus_change_hint")}</Form.Text>}
          </Form.Group>

          <div className="row g-2 mb-3">
            <Form.Group className="col-sm-6" controlId="trip-departure">
              <Form.Label>{t("operator:trip_form.departure")}</Form.Label>
              <Form.Control type="datetime-local" value={form.departure} onChange={(e) => changeDeparture(e.target.value)} required />
            </Form.Group>
            <Form.Group className="col-sm-6" controlId="trip-arrival">
              <Form.Label>{t("operator:trip_form.arrival")}</Form.Label>
              <Form.Control
                type="datetime-local"
                value={form.arrival}
                min={form.departure}
                onChange={(e) => set("arrival", e.target.value)}
                isInvalid={duration <= 0}
                required
              />
              <Form.Control.Feedback type="invalid">{t("operator:trip_form.arrival_after")}</Form.Control.Feedback>
            </Form.Group>
            <Form.Text className="col-12 mt-1">{t("operator:trip_form.timezone_hint")}</Form.Text>
          </div>

          {!editing && (
            <fieldset className="mb-3">
              <legend className="form-label fs-6">{t("operator:trip_form.repeat")}</legend>
              <div className="btn-group w-100 mb-2" role="group">
                {(["once", "daily", "weekdays"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`btn btn-outline-primary ${form.repeat === option ? "active" : ""}`}
                    onClick={() => set("repeat", option)}
                  >
                    {t(`operator:trip_form.repeat_${option}`)}
                  </button>
                ))}
              </div>
              {form.repeat === "weekdays" && (
                <div className="bbms-weekday-chips mb-2" role="group" aria-label={t("operator:trip_form.repeat_weekdays")}>
                  {weekdayLabels.map((label, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`btn btn-sm ${form.weekdays.includes(index) ? "btn-primary" : "btn-outline-secondary"}`}
                      aria-pressed={form.weekdays.includes(index)}
                      onClick={() => toggleWeekday(index)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {form.repeat !== "once" && (
                <Form.Group controlId="trip-end-date">
                  <Form.Label>{t("operator:trip_form.repeat_until")}</Form.Label>
                  <Form.Control
                    type="date"
                    value={form.endDate}
                    min={form.departure.slice(0, 10)}
                    onChange={(e) => set("endDate", e.target.value)}
                  />
                </Form.Group>
              )}
            </fieldset>
          )}

          <div className="row g-2 mb-1">
            <Form.Group className="col-6" controlId="trip-fare-usd">
              <Form.Label>{t("operator:trip_form.fare_usd")}</Form.Label>
              <Form.Control type="number" min="0.01" step="0.01" inputMode="decimal" value={form.fareUsd} onChange={(e) => set("fareUsd", e.target.value)} required />
            </Form.Group>
            <Form.Group className="col-6" controlId="trip-fare-khr">
              <Form.Label>{t("operator:trip_form.fare_khr")}</Form.Label>
              <Form.Control type="number" min="1" step="100" inputMode="numeric" value={form.fareKhr} onChange={(e) => set("fareKhr", e.target.value)} required />
            </Form.Group>
          </div>
          {suggestedKhr && suggestedKhr !== form.fareKhr && (
            <button type="button" className="btn btn-link btn-sm px-0 mb-3" onClick={() => set("fareKhr", suggestedKhr)}>
              {t("operator:trip_form.conversion_hint", {
                amount: formatMoney(suggestedKhr, "KHR", language),
                rate: rate.toLocaleString(),
              })}
            </button>
          )}

          {!editing && form.repeat !== "once" && (
            <div className="mb-3">
              <Form.Check
                type="switch"
                id="trip-peak"
                label={t("operator:trip_form.peak")}
                checked={form.peak}
                onChange={(e) => set("peak", e.target.checked)}
              />
              {form.peak && (
                <div className="row g-2 mt-1">
                  <Form.Group className="col-sm-4" controlId="trip-peak-start">
                    <Form.Label className="small">{t("operator:trip_form.peak_from")}</Form.Label>
                    <Form.Control type="date" value={form.peakStart} onChange={(e) => set("peakStart", e.target.value)} />
                  </Form.Group>
                  <Form.Group className="col-sm-4" controlId="trip-peak-end">
                    <Form.Label className="small">{t("operator:trip_form.peak_to")}</Form.Label>
                    <Form.Control type="date" value={form.peakEnd} min={form.peakStart} onChange={(e) => set("peakEnd", e.target.value)} />
                  </Form.Group>
                  <Form.Group className="col-sm-4" controlId="trip-peak-multiplier">
                    <Form.Label className="small">{t("operator:trip_form.peak_multiplier")}</Form.Label>
                    <Form.Control type="number" min="1" max="5" step="0.05" value={form.peakMultiplier} onChange={(e) => set("peakMultiplier", e.target.value)} />
                  </Form.Group>
                </div>
              )}
            </div>
          )}

          <div className="row g-2 mb-3">
            <Form.Group className="col-sm-7" controlId="trip-driver">
              <Form.Label>{t("operator:trip_form.driver")}</Form.Label>
              <Form.Control value={form.driverName} maxLength={150} onChange={(e) => set("driverName", e.target.value)} />
            </Form.Group>
            <Form.Group className="col-sm-5" controlId="trip-driver-phone">
              <Form.Label>{t("operator:trip_form.driver_phone")}</Form.Label>
              <Form.Control type="tel" value={form.driverPhone} maxLength={16} onChange={(e) => set("driverPhone", e.target.value)} />
            </Form.Group>
          </div>
          <Form.Group className="mb-3" controlId="trip-conductor">
            <Form.Label>{t("operator:trip_form.conductor")}</Form.Label>
            <Form.Select value={form.conductorId} onChange={(e) => set("conductorId", e.target.value)}>
              <option value="">{t("operator:trip_form.unassigned")}</option>
              {conductors.map((member) => (
                <option key={member.public_id} value={member.public_id}>
                  {member.full_name || member.email}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <ApiErrorAlert error={error} />
        </Offcanvas.Body>
        <div className="border-top p-3 d-flex justify-content-end gap-2 bg-white" style={{ position: "sticky", bottom: 0 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t("backoffice:actions.cancel")}
          </button>
          <button type="submit" className="btn bbms-cta" disabled={!valid || pending}>
            {pending && <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />}
            {t("backoffice:actions.save")}
          </button>
        </div>
      </Form>
    </Offcanvas>
  );
}
