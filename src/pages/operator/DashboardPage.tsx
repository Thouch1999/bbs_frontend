// O1 — operator home: today's KPIs, today's trips, attention list, charts.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useAllOperatorTrips, useOperatorDashboard } from "../../api/operator";
import { Callout, Card, ContentHeader, SmallBox } from "../../components/layout/adminlte";
import { CurrencyToggle, RankedProgressList, RevenueLineChart } from "../../components/operator/charts";
import { TripStatusModal } from "../../components/operator/TripStatusModal";
import { DataTable, type Column } from "../../components/shared/DataTable";
import {
  ApiErrorAlert,
  DualMoney,
  LoadingBlock,
  OccupancyBar,
  StatusBadge,
  useLocalizedName,
  useRouteLabel,
} from "../../components/shared/backoffice";
import { useLocale } from "../../context/LocaleContext";
import type { TripStatus } from "../../types";
import type { Currency, OperatorTrip } from "../../types/operator";
import { formatMoney } from "../../utils/money";
import { addDays, formatTime, localDateISO } from "../../utils/time";

const STATUS_ICON: Record<TripStatus, string> = {
  scheduled: "fas fa-hourglass-half text-muted",
  delayed: "fas fa-clock text-warning",
  departed: "fas fa-check-circle text-muted",
  completed: "fas fa-check-double text-success",
  cancelled: "fas fa-ban text-danger",
};

export function DashboardPage() {
  const { t } = useTranslation(["operator", "backoffice"]);
  const { language, currency: preferredCurrency } = useLocale();
  const localizedName = useLocalizedName();
  const [chartCurrency, setChartCurrency] = useState<Currency>(preferredCurrency);
  const [statusTrip, setStatusTrip] = useState<OperatorTrip | null>(null);
  const [destinationFilter, setDestinationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const routeLabel = useRouteLabel();
  const today = localDateISO();
  const dashboard = useOperatorDashboard();
  const trips = useAllOperatorTrips({ date_from: today, date_to: today });

  const destinationOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const trip of trips.data ?? []) {
      const name = localizedName(trip.route.destination_city);
      if (name) seen.set(name, name);
    }
    return [...seen.values()].sort();
  }, [trips.data, localizedName]);

  const filteredTrips = useMemo(() => {
    return (trips.data ?? []).filter((trip) => {
      if (destinationFilter && localizedName(trip.route.destination_city) !== destinationFilter) return false;
      if (statusFilter && trip.status !== statusFilter) return false;
      return true;
    });
  }, [trips.data, destinationFilter, statusFilter, localizedName]);

  const series = useMemo(() => {
    const byDate = new Map<string, number>();
    for (let i = 13; i >= 0; i -= 1) byDate.set(addDays(today, -i), 0);
    for (const point of dashboard.data?.revenue_series ?? []) {
      if (point.currency === chartCurrency && byDate.has(point.date)) {
        byDate.set(point.date, (byDate.get(point.date) ?? 0) + Number(point.total_amount));
      }
    }
    return [...byDate.entries()].map(([date, total]) => ({ date, total }));
  }, [dashboard.data, chartCurrency, today]);

  const columns: Column<OperatorTrip>[] = [
    {
      key: "time",
      header: t("operator:table.time"),
      render: (trip) => (
        <span className="d-flex align-items-center gap-2">
          <i className={STATUS_ICON[trip.status]} aria-hidden="true" />
          <strong>{formatTime(trip.departure_at, language)}</strong>
        </span>
      ),
      sortValue: (trip) => trip.departure_at,
    },
    { key: "route", header: t("operator:table.route"), render: (trip) => routeLabel(trip.route), sortValue: (trip) => routeLabel(trip.route) },
    { key: "bus", header: t("operator:table.bus"), render: (trip) => trip.bus_plate_number, sortValue: (trip) => trip.bus_plate_number },
    {
      key: "seats",
      header: t("operator:table.seats_sold"),
      render: (trip) => <OccupancyBar sold={trip.seats_sold} total={trip.seats_total} />,
      sortValue: (trip) => trip.seats_sold,
    },
    {
      key: "revenue",
      header: t("operator:table.revenue"),
      render: (trip) => <DualMoney usd={trip.revenue_usd} khr={trip.revenue_khr} />,
    },
    { key: "status", header: t("operator:table.status"), render: (trip) => <StatusBadge status={trip.status} />, sortValue: (t2) => t2.status },
    {
      key: "actions",
      header: t("operator:table.actions"),
      render: (trip) => (
        <div className="d-flex gap-1">
          <Link to={`/operator/trips/${trip.public_id}/manifest`} className="btn btn-sm btn-outline-primary" title={t("operator:actions.manifest")}>
            <i className="fas fa-list" aria-hidden="true" />
            <span className="visually-hidden">{t("operator:actions.manifest")}</span>
          </Link>
          {(trip.status === "scheduled" || trip.status === "delayed") && (
            <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => setStatusTrip(trip)} title={t("operator:actions.update_status")}>
              <i className="fas fa-exclamation-triangle" aria-hidden="true" />
              <span className="visually-hidden">{t("operator:actions.update_status")}</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  const data = dashboard.data;
  const attentionRows = data
    ? [
        { key: "pending_counter_payments", count: data.attention.pending_counter_payments, to: "/operator/bookings?pending_counter=1", icon: "fas fa-cash-register" },
        { key: "refunds_to_process", count: data.attention.refunds_to_process, to: "/operator/bookings?status=cancelled", icon: "fas fa-undo" },
        { key: "unassigned_trips", count: data.attention.unassigned_trips, to: "/operator/schedule?unassigned=1", icon: "fas fa-user-slash" },
        { key: "expiring_bus_documents", count: data.attention.expiring_bus_documents, to: "/operator/fleet", icon: "fas fa-file-contract" },
      ]
    : [];

  return (
    <>
      <ContentHeader title={t("operator:dashboard.title")} breadcrumbs={[{ label: t("operator:nav.dashboard") }]} />
      <section className="content">
        <div className="container-fluid">
          <ApiErrorAlert error={dashboard.error as never} />
          {data?.delayed_trips.map((trip) => (
            <Callout key={trip.public_id} variant="warning" title={t("operator:dashboard.delayed_title")}>
              {t("operator:dashboard.delayed_body", {
                route: trip.route_name,
                time: formatTime(trip.departure_at, language),
                plate: trip.plate_number,
                minutes: trip.delay_minutes ?? 0,
              })}
            </Callout>
          ))}

          {!data && dashboard.isLoading && <LoadingBlock />}
          {data && (
            <div className="row">
              <div className="col-lg-3 col-sm-6">
                <SmallBox
                  variant="teal"
                  icon="fas fa-ticket-alt"
                  value={data.bookings_today}
                  label={t("operator:dashboard.bookings_today")}
                  to="/operator/bookings"
                  footerLabel={t("backoffice:more_info")}
                />
              </div>
              <div className="col-lg-3 col-sm-6">
                <SmallBox
                  variant="orange"
                  icon="fas fa-coins"
                  value={formatMoney(data.revenue_today.usd, "USD", language)}
                  detail={formatMoney(data.revenue_today.khr, "KHR", language)}
                  label={t("operator:dashboard.revenue_today")}
                  to="/operator/reports"
                  footerLabel={t("backoffice:more_info")}
                />
              </div>
              <div className="col-lg-3 col-sm-6">
                <SmallBox
                  variant="success"
                  icon="fas fa-chair"
                  value={`${Math.round(Number(data.occupancy_rate_today))}%`}
                  detail={t("operator:dashboard.seats_detail", { sold: data.seats_sold_today, total: data.seats_total_today })}
                  label={t("operator:dashboard.occupancy_today")}
                  to="/operator/reports"
                  footerLabel={t("backoffice:more_info")}
                />
              </div>
              <div className="col-lg-3 col-sm-6">
                <SmallBox
                  variant="danger"
                  icon="fas fa-bus"
                  value={data.trips_today}
                  detail={t("operator:dashboard.remaining_detail", { count: data.trips_remaining_today })}
                  label={t("operator:dashboard.trips_today")}
                  to="/operator/schedule"
                  footerLabel={t("backoffice:more_info")}
                />
              </div>
            </div>
          )}

          <div className="row">
            <div className="col-xl-9">
              <Card
                title={
                  <>
                    {t("operator:dashboard.todays_trips")}{" "}
                    <span className="badge rounded-pill bg-bbms-teal fw-semibold ms-1">
                      {(trips.data ?? []).length}
                    </span>
                  </>
                }
                tools={
                  <Link to="/operator/schedule" className="btn btn-sm btn-outline-secondary">
                    <i className="fas fa-calendar-alt me-1" aria-hidden="true" />
                    {t("operator:nav.schedule")}
                  </Link>
                }
              >
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <select
                    className="form-select form-select-sm w-auto"
                    value={destinationFilter}
                    onChange={(event) => setDestinationFilter(event.target.value)}
                    aria-label={t("operator:dashboard.all_destinations")}
                  >
                    <option value="">{t("operator:dashboard.all_destinations")}</option>
                    {destinationOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="form-select form-select-sm w-auto"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    aria-label={t("operator:schedule.all_statuses")}
                  >
                    <option value="">{t("operator:schedule.all_statuses")}</option>
                    {(["scheduled", "delayed", "departed", "completed", "cancelled"] as const).map((status) => (
                      <option key={status} value={status}>
                        {t(`backoffice:status.${status}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <DataTable
                  rows={filteredTrips}
                  columns={columns}
                  rowKey={(trip) => trip.public_id}
                  isLoading={trips.isLoading}
                  initialPageSize={10}
                  empty={t("operator:dashboard.no_trips_today")}
                />
              </Card>
            </div>
            <div className="col-xl-3">
              <Card title={t("operator:dashboard.attention_title")} bodyClassName="p-0">
                <ul className="list-group list-group-flush">
                  {attentionRows.map((row) => (
                    <li key={row.key} className="list-group-item d-flex align-items-center gap-2">
                      <i className={`${row.icon} text-muted`} style={{ width: 20 }} aria-hidden="true" />
                      <span className="flex-grow-1">{t(`operator:dashboard.attention.${row.key}`)}</span>
                      {row.count > 0 ? (
                        <Link
                          to={row.to}
                          className="badge rounded-pill bg-bbms-orange text-decoration-none d-inline-flex align-items-center gap-1"
                        >
                          {row.count} <i className="fas fa-angle-right" aria-hidden="true" />
                        </Link>
                      ) : (
                        <span className="text-success">
                          <i className="fas fa-check" aria-hidden="true" />
                          <span className="visually-hidden">0</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
              {data && data.departing_soon.length > 0 && (
                <Card title={t("operator:dashboard.departing_soon")} bodyClassName="p-0">
                  <ul className="list-group list-group-flush">
                    {data.departing_soon.map((trip) => (
                      <li key={trip.public_id} className="list-group-item d-flex justify-content-between gap-2">
                        <span>
                          <strong>{formatTime(trip.departure_at, language)}</strong> {trip.route_name}
                        </span>
                        <Link to={`/operator/trips/${trip.public_id}/manifest`}>{t("operator:actions.manifest")}</Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </div>

          {data && (
            <div className="row">
              <div className="col-lg-7">
                <Card
                  title={t("operator:dashboard.revenue_14_days", { currency: chartCurrency === "USD" ? "$" : "៛" })}
                  tools={<CurrencyToggle value={chartCurrency} onChange={setChartCurrency} />}
                >
                  <RevenueLineChart points={series} currency={chartCurrency} />
                </Card>
              </div>
              <div className="col-lg-5">
                <Card
                  title={t("operator:dashboard.top_routes")}
                  footer={<span className="small text-muted">{t("operator:dashboard.top_routes_note")}</span>}
                >
                  {data.top_routes.length === 0 ? (
                    <p className="text-muted mb-0">{t("operator:dashboard.no_sales_yet")}</p>
                  ) : (
                    <RankedProgressList
                      rows={data.top_routes.map((route) => ({
                        key: route.public_id,
                        name: route.name,
                        value: route.seats_sold,
                      }))}
                      valueLabel={(value) => {
                        const total = data.top_routes.reduce((sum, r) => sum + r.seats_sold, 0);
                        const pct = total ? Math.round((value / total) * 100) : 0;
                        return `${pct}% (${value})`;
                      }}
                    />
                  )}
                </Card>
              </div>
            </div>
          )}
        </div>
      </section>
      <TripStatusModal trip={statusTrip} onClose={() => setStatusTrip(null)} />
    </>
  );
}
