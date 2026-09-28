// Platform reports: bookings, revenue (per currency — never summed across
// KHR and USD), popular routes and occupancy across all operators.
import { useMemo, useState } from "react";
import { Form } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import { useDailySeries, useOperatorSummary, usePlatformTopRoutes, usePlatformTotals } from "../../api/admin";
import { Card, ContentHeader, SmallBox } from "../../components/layout/adminlte";
import { CountLineChart, CurrencyToggle, RevenueLineChart } from "../../components/operator/charts";
import { DataTable, type Column } from "../../components/shared/DataTable";
import { ApiErrorAlert, DualMoney, OccupancyBar } from "../../components/shared/backoffice";
import { useLocale } from "../../context/LocaleContext";
import type { OperatorSummaryRow, PlatformTopRoute } from "../../types/admin";
import type { Currency, DateRange } from "../../types/operator";
import { formatMoney } from "../../utils/money";
import { addDays, localDateISO } from "../../utils/time";

export function PlatformReportsPage() {
  const { t } = useTranslation(["admin", "backoffice"]);
  const { language, currency: preferred } = useLocale();
  const today = localDateISO();
  const [range, setRange] = useState<DateRange>({ date_from: addDays(today, -29), date_to: today });
  const [currency, setCurrency] = useState<Currency>(preferred);
  const totals = usePlatformTotals(range);
  const operators = useOperatorSummary(range);
  const routes = usePlatformTopRoutes(range);
  const series = useDailySeries(range);

  const days = useMemo(() => {
    const list: string[] = [];
    for (let d = range.date_from; d <= range.date_to && list.length < 400; d = addDays(d, 1)) list.push(d);
    return list;
  }, [range]);
  const byDay = new Map((series.data ?? []).map((p) => [p.date, p]));

  const operatorColumns: Column<OperatorSummaryRow>[] = [
    { key: "name", header: t("admin:reports.operator"), render: (r) => <strong>{r.operator_name}</strong>, sortValue: (r) => r.operator_name },
    { key: "bookings", header: t("admin:overview.bookings"), render: (r) => r.bookings_count, sortValue: (r) => r.bookings_count },
    { key: "occupancy", header: t("admin:overview.occupancy"), render: (r) => <OccupancyBar sold={r.seats_sold} total={r.seats_total} />, sortValue: (r) => Number(r.occupancy_rate) },
    { key: "revenue", header: t("admin:overview.revenue"), render: (r) => <DualMoney usd={r.revenue_usd} khr={r.revenue_khr} />, sortValue: (r) => Number(r.revenue_usd) },
  ];
  const cityName = (en: string, km: string) => (language === "km" ? km || en : en || km);
  const routeColumns: Column<PlatformTopRoute>[] = [
    { key: "route", header: t("admin:overview.route"), render: (r) => `${cityName(r.origin_city_name, r.origin_city_name_km)} → ${cityName(r.destination_city_name, r.destination_city_name_km)}` },
    { key: "operators", header: t("admin:overview.operators_count"), render: (r) => r.operators_count },
    { key: "bookings", header: t("admin:overview.bookings"), render: (r) => r.bookings_count },
    { key: "revenue", header: t("admin:overview.revenue"), render: (r) => <DualMoney usd={r.revenue_usd} khr={r.revenue_khr} /> },
  ];

  const data = totals.data;
  return (
    <>
      <ContentHeader title={t("admin:reports.title")} breadcrumbs={[{ label: t("admin:nav.overview"), to: "/admin" }, { label: t("admin:reports.title") }]} />
      <section className="content">
        <div className="container-fluid">
          <Card>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <div className="btn-group btn-group-sm">
                {[7, 30, 90].map((n) => (
                  <button key={n} type="button" className="btn btn-outline-primary" onClick={() => setRange({ date_from: addDays(today, -(n - 1)), date_to: today })}>
                    {t("admin:reports.last_days", { count: n })}
                  </button>
                ))}
              </div>
              <Form.Control size="sm" type="date" style={{ width: "auto" }} aria-label={t("admin:reports.from")} value={range.date_from} max={range.date_to} onChange={(e) => setRange({ ...range, date_from: e.target.value })} />
              <Form.Control size="sm" type="date" style={{ width: "auto" }} aria-label={t("admin:reports.to")} value={range.date_to} min={range.date_from} onChange={(e) => setRange({ ...range, date_to: e.target.value })} />
              <div className="ms-auto"><CurrencyToggle value={currency} onChange={setCurrency} /></div>
            </div>
          </Card>
          <ApiErrorAlert error={(totals.error ?? operators.error) as never} />
          {data && (
            <div className="row">
              <div className="col-lg-3 col-sm-6"><SmallBox variant="teal" icon="fas fa-ticket-alt" value={data.total_bookings} detail={t("admin:reports.passengers", { count: data.total_passengers })} label={t("admin:overview.total_bookings")} /></div>
              <div className="col-lg-3 col-sm-6"><SmallBox variant="orange" icon="fas fa-coins" value={formatMoney(data.revenue.usd, "USD", language)} detail={formatMoney(data.revenue.khr, "KHR", language)} label={t("admin:overview.total_revenue")} /></div>
              <div className="col-lg-3 col-sm-6"><SmallBox variant="success" icon="fas fa-chair" value={`${Math.round(Number(data.average_occupancy))}%`} label={t("admin:overview.occupancy")} /></div>
              <div className="col-lg-3 col-sm-6"><SmallBox variant="danger" icon="fas fa-undo" value={`${Number(data.cancellation_rate).toFixed(1)}%`} label={t("admin:overview.cancellation_rate")} /></div>
            </div>
          )}
          <div className="row">
            <div className="col-lg-6">
              <Card title={t("admin:overview.bookings_chart")}>
                <CountLineChart points={days.map((d) => ({ date: d, value: byDay.get(d)?.bookings ?? 0 }))} label={t("admin:overview.bookings")} />
              </Card>
            </div>
            <div className="col-lg-6">
              <Card title={t("admin:overview.revenue_chart", { currency: currency === "USD" ? "$" : "៛" })}>
                <RevenueLineChart points={days.map((d) => ({ date: d, total: Number((currency === "USD" ? byDay.get(d)?.revenue_usd : byDay.get(d)?.revenue_khr) ?? 0) }))} currency={currency} />
              </Card>
            </div>
          </div>
          <Card title={t("admin:reports.by_operator")}>
            <DataTable rows={operators.data ?? []} columns={operatorColumns} rowKey={(r) => r.operator_public_id} isLoading={operators.isLoading} empty={t("admin:overview.no_bookings")} />
          </Card>
          <Card title={t("admin:overview.top_routes")}>
            <DataTable rows={routes.data ?? []} columns={routeColumns} rowKey={(r) => `${r.origin_city_name}-${r.destination_city_name}`} toolbar={false} isLoading={routes.isLoading} empty={t("admin:overview.no_bookings")} />
          </Card>
        </div>
      </section>
    </>
  );
}
