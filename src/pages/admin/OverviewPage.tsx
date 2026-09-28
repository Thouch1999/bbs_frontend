// A1 — platform admin overview: 30-day KPIs, pending operator applications,
// daily charts (bookings and revenue as two single-axis charts — they have
// different scales), top platform routes and honest system status.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useAdminOverview } from "../../api/admin";
import { Card, ContentHeader, SmallBox } from "../../components/layout/adminlte";
import { CountLineChart, CurrencyToggle, RevenueLineChart } from "../../components/operator/charts";
import { DataTable, type Column } from "../../components/shared/DataTable";
import { ApiErrorAlert, DualMoney, LoadingBlock } from "../../components/shared/backoffice";
import { useLocale } from "../../context/LocaleContext";
import type { PlatformTopRoute, SystemStatusRow } from "../../types/admin";
import type { Currency } from "../../types/operator";
import { formatMoney } from "../../utils/money";
import { addDays, formatDate, formatDateTime, localDateISO } from "../../utils/time";

export function OverviewPage() {
  const { t } = useTranslation(["admin", "backoffice"]);
  const { language, currency: preferred } = useLocale();
  const [currency, setCurrency] = useState<Currency>(preferred);
  const overview = useAdminOverview();
  const data = overview.data;
  const today = localDateISO();

  const days = useMemo(() => Array.from({ length: 30 }, (_, i) => addDays(today, i - 29)), [today]);
  const byDay = useMemo(() => new Map((data?.series ?? []).map((point) => [point.date, point])), [data]);
  const bookingPoints = days.map((date) => ({ date, value: byDay.get(date)?.bookings ?? 0 }));
  const revenuePoints = days.map((date) => ({
    date,
    total: Number(currency === "USD" ? (byDay.get(date)?.revenue_usd ?? 0) : (byDay.get(date)?.revenue_khr ?? 0)),
  }));

  const cityName = (en: string, km: string) => (language === "km" ? km || en : en || km);
  const routeColumns: Column<PlatformTopRoute>[] = [
    {
      key: "route",
      header: t("admin:overview.route"),
      render: (r) => `${cityName(r.origin_city_name, r.origin_city_name_km)} → ${cityName(r.destination_city_name, r.destination_city_name_km)}`,
      sortValue: (r) => r.origin_city_name,
    },
    { key: "operators", header: t("admin:overview.operators_count"), render: (r) => r.operators_count, sortValue: (r) => r.operators_count },
    { key: "bookings", header: t("admin:overview.bookings"), render: (r) => r.bookings_count, sortValue: (r) => r.bookings_count },
    { key: "revenue", header: t("admin:overview.revenue"), render: (r) => <DualMoney usd={r.revenue_usd} khr={r.revenue_khr} /> },
  ];

  return (
    <>
      <ContentHeader title={t("admin:overview.title")} breadcrumbs={[{ label: t("admin:nav.overview") }]} />
      <section className="content">
        <div className="container-fluid">
          <ApiErrorAlert error={overview.error as never} />
          {!data && overview.isLoading && <LoadingBlock />}
          {data && (
            <>
              <p className="small text-muted">{t("admin:overview.period_note")}</p>
              <div className="row">
                <div className="col-xl-2 col-md-4 col-sm-6">
                  <SmallBox variant="teal" icon="fas fa-ticket-alt" value={data.totals.total_bookings} label={t("admin:overview.total_bookings")} />
                </div>
                <div className="col-xl-2 col-md-4 col-sm-6">
                  <SmallBox
                    variant="orange"
                    icon="fas fa-coins"
                    value={formatMoney(data.totals.revenue.usd, "USD", language)}
                    detail={formatMoney(data.totals.revenue.khr, "KHR", language)}
                    label={t("admin:overview.total_revenue")}
                  />
                </div>
                <div className="col-xl-2 col-md-4 col-sm-6">
                  <SmallBox
                    variant="gold"
                    icon="fas fa-percent"
                    value={formatMoney(data.totals.commission.usd, "USD", language)}
                    detail={formatMoney(data.totals.commission.khr, "KHR", language)}
                    label={t("admin:overview.commission")}
                  />
                </div>
                <div className="col-xl-2 col-md-4 col-sm-6">
                  <SmallBox variant="success" icon="fas fa-building" value={data.totals.active_operators} label={t("admin:overview.active_operators")} to="/admin/operators" footerLabel={t("backoffice:more_info")} />
                </div>
                <div className="col-xl-2 col-md-4 col-sm-6">
                  <SmallBox variant="teal" icon="fas fa-chair" value={`${Math.round(Number(data.totals.average_occupancy))}%`} label={t("admin:overview.occupancy")} />
                </div>
                <div className="col-xl-2 col-md-4 col-sm-6">
                  <SmallBox variant="danger" icon="fas fa-undo" value={`${Number(data.totals.cancellation_rate).toFixed(1)}%`} label={t("admin:overview.cancellation_rate")} />
                </div>
              </div>

              <div className="row">
                <div className="col-xl-8">
                  <div className="row">
                    <div className="col-lg-6">
                      <Card title={t("admin:overview.bookings_chart")}>
                        <CountLineChart points={bookingPoints} label={t("admin:overview.bookings")} />
                      </Card>
                    </div>
                    <div className="col-lg-6">
                      <Card
                        title={t("admin:overview.revenue_chart", { currency: currency === "USD" ? "$" : "៛" })}
                        tools={<CurrencyToggle value={currency} onChange={setCurrency} />}
                      >
                        <RevenueLineChart points={revenuePoints} currency={currency} />
                      </Card>
                    </div>
                  </div>
                  <Card title={t("admin:overview.top_routes")}>
                    <DataTable rows={data.top_routes} columns={routeColumns} rowKey={(r) => `${r.origin_city_name}-${r.destination_city_name}`} toolbar={false} empty={t("admin:overview.no_bookings")} />
                  </Card>
                </div>
                <div className="col-xl-4">
                  <Card
                    title={t("admin:overview.pending_title", { count: data.pending_operators_count })}
                    bodyClassName="p-0"
                    tools={<Link to="/admin/operators" className="small">{t("admin:overview.all")}</Link>}
                  >
                    <ul className="list-group list-group-flush">
                      {data.pending_operators.length === 0 && <li className="list-group-item text-muted">{t("admin:overview.no_pending")}</li>}
                      {data.pending_operators.map((operator) => (
                        <li key={operator.public_id} className="list-group-item d-flex align-items-center gap-2">
                          <div className="flex-grow-1">
                            <strong>{language === "km" ? operator.name_km || operator.name : operator.name}</strong>
                            <div className="small text-muted">
                              {operator.licence_document ? (
                                <span className="text-success">
                                  <i className="fas fa-file-circle-check me-1" aria-hidden="true" />
                                  {t("admin:overview.document_uploaded")}
                                </span>
                              ) : (
                                <span className="text-warning">{t("admin:overview.document_missing")}</span>
                              )}{" "}
                              · {formatDate(operator.created_at, language)}
                            </div>
                          </div>
                          <Link to={`/admin/operators/${operator.public_id}`} className="fw-semibold" style={{ color: "#D96D12" }}>
                            {t("admin:overview.review")}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Card>
                  <Card title={t("admin:overview.system_status")}>
                    <SystemStatus rows={data.system_status} />
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}

function SystemStatus({ rows }: { rows: SystemStatusRow[] }) {
  const { t } = useTranslation("admin");
  const { language } = useLocale();
  return (
    <ul className="list-unstyled mb-0">
      {rows.map((row) => (
        <li key={row.key} className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <span className={`bbms-status-pill is-${row.health}`}>
            <i className={`fas ${row.health === "ok" ? "fa-check" : row.health === "degraded" ? "fa-triangle-exclamation" : "fa-circle-xmark"}`} aria-hidden="true" />
            {row.label}
          </span>
          <span className="small text-muted text-end">
            {t(`admin:status_mode.${row.mode}`)}
            {row.failures_24h > 0 && <> · {t("admin:overview.failures", { count: row.failures_24h })}</>}
            {row.pending > 0 && <> · {t("admin:overview.stuck", { count: row.pending })}</>}
            <br />
            {row.last_success_at ? t("admin:overview.last_ok", { time: formatDateTime(row.last_success_at, language) }) : t("admin:overview.never_used")}
          </span>
        </li>
      ))}
    </ul>
  );
}
