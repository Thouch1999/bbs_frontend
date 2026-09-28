// O2 — trips & schedules: filters, list / week-calendar views, create
// (single or recurring), edit, status changes, bulk crew assignment.
import { useMemo, useState } from "react";
import { Alert, Form, Modal } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

import { useAllOperatorTrips, useBuses, useDeleteTrip, useOperatorRoutes, useStaff, useUpdateTrip } from "../../api/operator";
import type { ApiError } from "../../api/types";
import { Card, ContentHeader, InfoBox } from "../../components/layout/adminlte";
import { TripFormOffcanvas } from "../../components/operator/TripFormOffcanvas";
import { TripStatusModal } from "../../components/operator/TripStatusModal";
import { DataTable, type Column } from "../../components/shared/DataTable";
import { ApiErrorAlert, DualMoney, OccupancyBar, StatusBadge, useRouteLabel } from "../../components/shared/backoffice";
import { useLocale } from "../../context/LocaleContext";
import type { OperatorTrip } from "../../types/operator";
import { formatMoney } from "../../utils/money";
import { addDays, formatDate, formatTime, formatWeekday, localDateISO, localDateOf, startOfWeek } from "../../utils/time";

const STATUSES = ["scheduled", "delayed", "cancelled", "departed", "completed"];

/** Trips whose bus is double-booked in an overlapping window (shown red). */
function conflictIds(trips: OperatorTrip[]): Set<string> {
  const ids = new Set<string>();
  const active = trips.filter((t) => t.status !== "cancelled");
  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const a = active[i];
      const b = active[j];
      if (a.bus_public_id === b.bus_public_id && a.departure_at < b.arrival_at && b.departure_at < a.arrival_at) {
        ids.add(a.public_id);
        ids.add(b.public_id);
      }
    }
  }
  return ids;
}

export function SchedulePage() {
  const { t } = useTranslation(["operator", "backoffice"]);
  const { language } = useLocale();
  const routeLabel = useRouteLabel();
  const [params] = useSearchParams();
  const today = localDateISO();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [routeFilter, setRouteFilter] = useState("");
  const [busFilter, setBusFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(addDays(today, 13));
  const [unassignedOnly, setUnassignedOnly] = useState(params.get("unassigned") === "1");
  const [weekStart, setWeekStart] = useState(startOfWeek(today));
  const [formTrip, setFormTrip] = useState<OperatorTrip | null | undefined>(undefined); // undefined = closed
  const [statusTrip, setStatusTrip] = useState<OperatorTrip | null>(null);
  const [deleteTrip, setDeleteTrip] = useState<OperatorTrip | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [crewOpen, setCrewOpen] = useState(false);
  const [flash, setFlash] = useState("");

  const routes = useOperatorRoutes();
  const buses = useBuses();
  const baseQuery = {
    route: routeFilter || undefined,
    bus: busFilter || undefined,
    status: statusFilter || undefined,
    unassigned: unassignedOnly || undefined,
  };
  const listTrips = useAllOperatorTrips({ ...baseQuery, date_from: dateFrom, date_to: dateTo }, view === "list");
  const weekTrips = useAllOperatorTrips({ ...baseQuery, date_from: weekStart, date_to: addDays(weekStart, 6) }, view === "calendar");
  const removeTrip = useDeleteTrip();

  const listRows = useMemo(() => listTrips.data ?? [], [listTrips.data]);
  const weekRows = useMemo(() => weekTrips.data ?? [], [weekTrips.data]);
  const viewRows = view === "list" ? listRows : weekRows;
  const conflicts = useMemo(() => conflictIds(viewRows), [viewRows]);

  const stats = useMemo(() => {
    const active = viewRows.filter((t) => t.status !== "cancelled");
    const seatsTotal = active.reduce((sum, t) => sum + t.seats_total, 0);
    const seatsSold = active.reduce((sum, t) => sum + t.seats_sold, 0);
    const delayed = viewRows.filter((t) => t.status === "delayed");
    const avgDelay = delayed.length
      ? Math.round(delayed.reduce((sum, t) => sum + (t.delay_minutes ?? 0), 0) / delayed.length)
      : 0;
    return {
      total: viewRows.length,
      inProgress: viewRows.filter((t) => t.status === "scheduled" || t.status === "delayed").length,
      loadFactor: seatsTotal ? Math.round((seatsSold / seatsTotal) * 100) : 0,
      delayedCount: delayed.length,
      avgDelay,
      conflictCount: conflicts.size,
    };
  }, [viewRows, conflicts]);

  function rowClassName(trip: OperatorTrip): string {
    if (conflicts.has(trip.public_id)) return "table-danger";
    if (trip.status === "delayed") return "table-warning";
    if (trip.status === "cancelled") return "text-muted text-decoration-line-through";
    return "";
  }

  const columns: Column<OperatorTrip>[] = [
    {
      key: "date",
      header: t("operator:table.date"),
      render: (trip) => formatDate(trip.departure_at, language),
      sortValue: (trip) => trip.departure_at,
    },
    { key: "time", header: t("operator:table.departure"), render: (trip) => <strong>{formatTime(trip.departure_at, language)}</strong> },
    { key: "route", header: t("operator:table.route"), render: (trip) => routeLabel(trip.route), sortValue: (trip) => routeLabel(trip.route) },
    {
      key: "bus",
      header: t("operator:table.bus"),
      render: (trip) => (
        <>
          {trip.bus_plate_number}
          {conflicts.has(trip.public_id) && (
            <span className="badge bg-danger ms-1" title={t("operator:schedule.conflict")}>
              <i className="fas fa-exclamation" aria-hidden="true" /> {t("operator:schedule.conflict")}
            </span>
          )}
        </>
      ),
      sortValue: (trip) => trip.bus_plate_number,
    },
    {
      key: "crew",
      header: t("operator:table.crew"),
      render: (trip) => (
        <span className="small">
          {trip.driver_name || <span className="text-warning">{t("operator:trip_form.unassigned")}</span>}
          {" / "}
          {trip.conductor_name || <span className="text-warning">{t("operator:trip_form.unassigned")}</span>}
        </span>
      ),
    },
    {
      key: "fare",
      header: t("operator:table.fare"),
      render: (trip) => formatMoney(trip.base_fare_usd, "USD", language),
      sortValue: (trip) => Number(trip.base_fare_usd),
    },
    {
      key: "sold",
      header: t("operator:table.seats_sold"),
      render: (trip) => <OccupancyBar sold={trip.seats_sold} total={trip.seats_total} />,
      sortValue: (trip) => trip.seats_sold,
    },
    { key: "revenue", header: t("operator:table.revenue"), render: (trip) => <DualMoney usd={trip.revenue_usd} khr={trip.revenue_khr} /> },
    { key: "status", header: t("operator:table.status"), render: (trip) => <StatusBadge status={trip.status} />, sortValue: (trip) => trip.status },
    {
      key: "actions",
      header: t("operator:table.actions"),
      render: (trip) => <TripActions trip={trip} onEdit={setFormTrip} onStatus={setStatusTrip} onDelete={setDeleteTrip} />,
    },
  ];

  function onSaved(message: string) {
    setFormTrip(undefined);
    setFlash(message);
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <>
      <ContentHeader
        title={t("operator:schedule.title")}
        breadcrumbs={[{ label: t("operator:nav.dashboard"), to: "/operator" }, { label: t("operator:schedule.title") }]}
      />
      <section className="content">
        <div className="container-fluid">
          {flash && (
            <Alert variant="success" dismissible onClose={() => setFlash("")} className="py-2">
              {flash}
            </Alert>
          )}
          <div className="row">
            <div className="col-lg-3 col-sm-6">
              <InfoBox
                variant="teal"
                icon="fas fa-bus"
                value={stats.total}
                label={t("operator:schedule.stat_total")}
                detail={t("operator:schedule.stat_in_progress", { count: stats.inProgress })}
              />
            </div>
            <div className="col-lg-3 col-sm-6">
              <InfoBox
                variant="orange"
                icon="fas fa-chair"
                value={`${stats.loadFactor}%`}
                label={t("operator:schedule.stat_load_factor")}
              />
            </div>
            <div className="col-lg-3 col-sm-6">
              <InfoBox
                variant="gold"
                icon="fas fa-clock"
                value={stats.delayedCount}
                label={t("operator:schedule.stat_delayed")}
                detail={stats.delayedCount > 0 ? t("operator:schedule.stat_avg_delay", { minutes: stats.avgDelay }) : undefined}
              />
            </div>
            <div className="col-lg-3 col-sm-6">
              <InfoBox
                variant="danger"
                icon="fas fa-triangle-exclamation"
                value={stats.conflictCount}
                label={t("operator:schedule.stat_conflicts")}
              />
            </div>
          </div>
          <Card
            outline
            variant="primary"
            title={
              <>
                {t("operator:schedule.card_title")}{" "}
                <span className="badge rounded-pill bg-bbms-teal fw-semibold ms-1">{viewRows.length}</span>
              </>
            }
            tools={
              <>
                <div className="btn-group btn-group-sm" role="group" aria-label={t("operator:schedule.view")}>
                  <button type="button" className={`btn btn-outline-secondary ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}>
                    <i className="fas fa-list me-1" aria-hidden="true" />
                    {t("operator:schedule.view_list")}
                  </button>
                  <button type="button" className={`btn btn-outline-secondary ${view === "calendar" ? "active" : ""}`} onClick={() => setView("calendar")}>
                    <i className="far fa-calendar me-1" aria-hidden="true" />
                    {t("operator:schedule.view_calendar")}
                  </button>
                </div>
                <button type="button" className="btn btn-sm bbms-cta" onClick={() => setFormTrip(null)}>
                  <i className="fas fa-plus me-1" aria-hidden="true" />
                  {t("operator:schedule.create")}
                </button>
              </>
            }
          >
            <div className="row g-2 mb-3">
              <div className="col-md-3 col-sm-6">
                <Form.Select size="sm" aria-label={t("operator:table.route")} value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)}>
                  <option value="">{t("operator:schedule.all_routes")}</option>
                  {(routes.data ?? []).map((route) => (
                    <option key={route.public_id} value={route.public_id}>
                      {routeLabel(route)}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-2 col-sm-6">
                <Form.Select size="sm" aria-label={t("operator:table.bus")} value={busFilter} onChange={(e) => setBusFilter(e.target.value)}>
                  <option value="">{t("operator:schedule.all_buses")}</option>
                  {(buses.data ?? []).map((bus) => (
                    <option key={bus.public_id} value={bus.public_id}>
                      {bus.plate_number}
                    </option>
                  ))}
                </Form.Select>
              </div>
              {view === "list" ? (
                <div className="col-md-4 col-sm-8 d-flex gap-1 align-items-center">
                  <Form.Control size="sm" type="date" aria-label={t("operator:reports.from")} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  <span aria-hidden="true">–</span>
                  <Form.Control size="sm" type="date" aria-label={t("operator:reports.to")} value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              ) : (
                <div className="col-md-4 col-sm-8 d-flex gap-1 align-items-center">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label={t("operator:schedule.prev_week")}>
                    <i className="fas fa-chevron-left" aria-hidden="true" />
                  </button>
                  <span className="small flex-grow-1 text-center">
                    {formatDate(weekStart, language)} – {formatDate(addDays(weekStart, 6), language)}
                  </span>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label={t("operator:schedule.next_week")}>
                    <i className="fas fa-chevron-right" aria-hidden="true" />
                  </button>
                </div>
              )}
              <div className="col-md-2 col-sm-4">
                <Form.Select size="sm" aria-label={t("operator:table.status")} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">{t("operator:schedule.all_statuses")}</option>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(`backoffice:status.${status}`)}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-1 col-sm-12 d-flex align-items-center">
                <Form.Check
                  id="unassigned-only"
                  label={t("operator:schedule.unassigned_only")}
                  className="small mb-0"
                  checked={unassignedOnly}
                  onChange={(e) => setUnassignedOnly(e.target.checked)}
                />
              </div>
            </div>

            {view === "list" ? (
              <>
                {selected.length > 0 && (
                  <div className="bbms-bulk-bar">
                    <span className="badge rounded-pill bg-bbms-teal fw-bold">{selected.length}</span>
                    <strong>{t("backoffice:table.selected", { count: selected.length })}</strong>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => setCrewOpen(true)}>
                      <i className="fas fa-user-tag me-1" aria-hidden="true" />
                      {t("operator:schedule.assign_crew")}
                    </button>
                    <button type="button" className="btn btn-sm btn-link" onClick={() => setSelected([])}>
                      {t("backoffice:table.clear_selection")}
                    </button>
                  </div>
                )}
                <DataTable
                  rows={listRows}
                  columns={columns}
                  rowKey={(trip) => trip.public_id}
                  isLoading={listTrips.isLoading}
                  selectable
                  selectedKeys={selected}
                  onSelectionChange={setSelected}
                  isRowSelectable={(trip) => trip.status === "scheduled" || trip.status === "delayed"}
                  rowClassName={rowClassName}
                  empty={t("operator:schedule.empty")}
                />
              </>
            ) : (
              <div className="bbms-week">
                <div className="d-flex flex-wrap gap-3 small mb-2">
                  <span className="d-flex align-items-center gap-1">
                    <span className="rounded-circle bg-bbms-teal" style={{ width: 10, height: 10 }} />
                    {t("backoffice:status.scheduled")}
                  </span>
                  <span className="d-flex align-items-center gap-1">
                    <span className="rounded-circle bg-warning" style={{ width: 10, height: 10 }} />
                    {t("backoffice:status.delayed")}
                  </span>
                  <span className="d-flex align-items-center gap-1">
                    <span className="rounded-circle bg-secondary" style={{ width: 10, height: 10 }} />
                    {t("backoffice:status.cancelled")}
                  </span>
                  <span className="d-flex align-items-center gap-1">
                    <span className="rounded-circle border border-danger" style={{ width: 10, height: 10 }} />
                    {t("operator:schedule.conflict")}
                  </span>
                </div>
                <div className="bbms-week-grid">
                  {weekDays.map((day) => {
                    const dayTrips = weekRows.filter((trip) => localDateOf(trip.departure_at) === day);
                    return (
                      <div key={day} className={`bbms-week-day${day === today ? " is-today" : ""}`}>
                        <div className="bbms-week-day-label">
                          {formatWeekday(day, language)} {formatDate(day, language)}
                        </div>
                        {dayTrips.map((trip) => (
                          <button
                            type="button"
                            key={trip.public_id}
                            className={[
                              "bbms-trip-block",
                              trip.status === "delayed" ? "is-delayed" : "",
                              trip.status === "cancelled" ? "is-cancelled" : "",
                              conflicts.has(trip.public_id) ? "is-conflict" : "",
                            ].join(" ")}
                            onClick={() => (trip.status === "scheduled" || trip.status === "delayed" ? setFormTrip(trip) : undefined)}
                            title={routeLabel(trip.route)}
                          >
                            <strong>{formatTime(trip.departure_at, language)}</strong> {routeLabel(trip.route)}
                            <br />
                            {trip.bus_plate_number}{" "}
                            <span className="bbms-pill">
                              {trip.seats_sold}/{trip.seats_total}
                            </span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        </div>
      </section>

      <TripFormOffcanvas show={formTrip !== undefined} trip={formTrip} onClose={() => setFormTrip(undefined)} onSaved={onSaved} />
      <TripStatusModal trip={statusTrip} onClose={() => setStatusTrip(null)} />
      <CrewModal
        show={crewOpen}
        tripIds={selected}
        onClose={() => setCrewOpen(false)}
        onDone={(count) => {
          setCrewOpen(false);
          setSelected([]);
          setFlash(t("operator:schedule.crew_saved", { count }));
        }}
      />
      <Modal show={Boolean(deleteTrip)} onHide={() => setDeleteTrip(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title as="h5">{t("operator:schedule.delete_title")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>{t("operator:schedule.delete_body")}</p>
          <ApiErrorAlert error={removeTrip.error} />
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-secondary" onClick={() => setDeleteTrip(null)}>
            {t("backoffice:actions.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={removeTrip.isPending}
            onClick={() =>
              deleteTrip &&
              removeTrip.mutate(deleteTrip.public_id, {
                onSuccess: () => {
                  setDeleteTrip(null);
                  setFlash(t("operator:schedule.deleted"));
                },
              })
            }
          >
            {t("backoffice:actions.delete")}
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

function TripActions({
  trip,
  onEdit,
  onStatus,
  onDelete,
}: {
  trip: OperatorTrip;
  onEdit: (trip: OperatorTrip) => void;
  onStatus: (trip: OperatorTrip) => void;
  onDelete: (trip: OperatorTrip) => void;
}) {
  const { t } = useTranslation("operator");
  const open = trip.status === "scheduled" || trip.status === "delayed";
  return (
    <div className="d-flex gap-1">
      <Link to={`/operator/trips/${trip.public_id}/manifest`} className="btn btn-sm btn-outline-primary" title={t("actions.manifest")}>
        <i className="fas fa-list" aria-hidden="true" />
        <span className="visually-hidden">{t("actions.manifest")}</span>
      </Link>
      {open && (
        <>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onEdit(trip)} title={t("actions.edit")}>
            <i className="fas fa-pen" aria-hidden="true" />
            <span className="visually-hidden">{t("actions.edit")}</span>
          </button>
          <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => onStatus(trip)} title={t("actions.update_status")}>
            <i className="fas fa-exclamation-triangle" aria-hidden="true" />
            <span className="visually-hidden">{t("actions.update_status")}</span>
          </button>
        </>
      )}
      {trip.bookings_count === 0 && (
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDelete(trip)} title={t("actions.delete")}>
          <i className="fas fa-trash" aria-hidden="true" />
          <span className="visually-hidden">{t("actions.delete")}</span>
        </button>
      )}
    </div>
  );
}

function CrewModal({
  show,
  tripIds,
  onClose,
  onDone,
}: {
  show: boolean;
  tripIds: string[];
  onClose: () => void;
  onDone: (count: number) => void;
}) {
  const { t } = useTranslation(["operator", "backoffice"]);
  const staff = useStaff();
  const updateTrip = useUpdateTrip();
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [conductorId, setConductorId] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    const body = {
      ...(driverName.trim() ? { driver_name: driverName.trim(), driver_phone: driverPhone.trim() } : {}),
      ...(conductorId ? { conductor_id: conductorId } : {}),
    };
    try {
      for (const publicId of tripIds) {
        await updateTrip.mutateAsync({ publicId, body });
      }
      onDone(tripIds.length);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h5">{t("operator:schedule.assign_crew")}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="small text-muted">{t("operator:schedule.assign_crew_hint", { count: tripIds.length })}</p>
        <Form.Group className="mb-2" controlId="crew-driver">
          <Form.Label>{t("operator:trip_form.driver")}</Form.Label>
          <Form.Control value={driverName} onChange={(e) => setDriverName(e.target.value)} />
        </Form.Group>
        <Form.Group className="mb-2" controlId="crew-driver-phone">
          <Form.Label>{t("operator:trip_form.driver_phone")}</Form.Label>
          <Form.Control type="tel" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
        </Form.Group>
        <Form.Group controlId="crew-conductor">
          <Form.Label>{t("operator:trip_form.conductor")}</Form.Label>
          <Form.Select value={conductorId} onChange={(e) => setConductorId(e.target.value)}>
            <option value="">{t("operator:schedule.keep_current")}</option>
            {(staff.data ?? [])
              .filter((s) => s.can_validate_tickets && s.is_active)
              .map((member) => (
                <option key={member.public_id} value={member.public_id}>
                  {member.full_name || member.email}
                </option>
              ))}
          </Form.Select>
        </Form.Group>
        <ApiErrorAlert error={error} className="py-2 mt-3 mb-0" />
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          {t("backoffice:actions.cancel")}
        </button>
        <button type="button" className="btn bbms-cta" disabled={saving || (!driverName.trim() && !conductorId)} onClick={save}>
          {t("backoffice:actions.save")}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
