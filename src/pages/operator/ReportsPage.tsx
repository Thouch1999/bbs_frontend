// O6 — revenue reports. Every money figure here is ONE currency at a time
// (the currency toggle): the API keeps KHR and USD totals separate and this
// page never adds them together. Deltas compare against the immediately
// preceding period of the same length.
import { useMemo, useState } from "react";
import { Form } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import { useCancellationSummary, useOccupancyReport, useRevenueReport } from "../../api/operator";
import type { ApiError } from "../../api/types";
import { Card, ContentHeader, SmallBox } from "../../components/layout/adminlte";
import { CurrencyToggle, ShareDonut, StackedRevenueChart } from "../../components/operator/charts";
import { DataTable, type Column } from "../../components/shared/DataTable";
import { ApiErrorAlert } from "../../components/shared/backoffice";
import { useLocale } from "../../context/LocaleContext";
import type { Currency, DateRange, RevenueGroupBy, RevenueRow } from "../../types/operator";
import { formatMoney } from "../../utils/money";
import { addDays, localDateISO } from "../../utils/time";

type Preset = "today" | "7d" | "30d" | "month";
type TableGroup = Exclude<RevenueGroupBy, "day">;

function presetRange(preset: Preset): DateRange {
  const today = localDateISO();
  switch (preset) {
    case "today":
      return { date_from: today, date_to: today };
    case "7d":
      return { date_from: addDays(today, -6), date_to: today };
    case "30d":
      return { date_from: addDays(today, -29), date_to: today };
    case "month":
      return { date_from: `${today.slice(0, 8)}01`, date_to: today };
  }
}

function daysBetween(range: DateRange): number {
  return Math.round((Date.parse(range.date_to) - Date.parse(range.date_from)) / 86_400_000) + 1;
}

function previousRange(range: DateRange): DateRange {
  const length = daysBetween(range);
  return { date_from: addDays(range.date_from, -length), date_to: addDays(range.date_from, -1) };
}

function sum(rows: RevenueRow[] | undefined, currency: Currency, field: "total_amount" | "commission_amount" | "net_amount"): number {
  return (rows ?? []).filter((r) => r.currency === currency).reduce((acc, r) => acc + Number(r[field]), 0);
}

interface TableRow {
  key: string;
  label: string;
  trips?: number;
  seatsSold?: number;
  seatsTotal?: number;
  total: number;
  commission: number;
  net: number;
  payments: number;
}

export function ReportsPage() {
  const { t } = useTranslation(["operator", "backoffice"]);
  const { language, currency: preferredCurrency } = useLocale();
  const [preset, setPreset] = useState<Preset | null>("30d");
  const [range, setRange] = useState<DateRange>(presetRange("30d"));
  const [groupBy, setGroupBy] = useState<TableGroup>("route");
  const [currency, setCurrency] = useState<Currency>(preferredCurrency);

  const grouped = useRevenueReport(range, groupBy);
  const byMethod = useRevenueReport(range, "payment_method");
  const byDay = useRevenueReport(range, "day");
  const previous = useRevenueReport(previousRange(range), "payment_method");
  const occupancy = useOccupancyReport(range);
  const cancellations = useCancellationSummary(range);
  const previousCancellations = useCancellationSummary(previousRange(range));

  const money = (value: number) => formatMoney(String(value), currency, language);
  const gross = sum(byMethod.data, currency, "total_amount");
  const commission = sum(byMethod.data, currency, "commission_amount");
  const net = sum(byMethod.data, currency, "net_amount");
  const refundKey = currency === "USD" ? "total_refund_usd" : "total_refund_khr";
  const refunds = Number(cancellations.data?.[refundKey] ?? 0);
  const prev = {
    gross: sum(previous.data, currency, "total_amount"),
    commission: sum(previous.data, currency, "commission_amount"),
    net: sum(previous.data, currency, "net_amount"),
    refunds: Number(previousCancellations.data?.[refundKey] ?? 0),
  };

  function delta(current: number, before: number) {
    if (!before) return current ? t("operator:reports.new") : t("operator:reports.no_change");
    const pct = Math.round(((current - before) / before) * 100);
    const arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : "•";
    return `${arrow} ${Math.abs(pct)}% ${t("operator:reports.vs_previous")}`;
  }

  const stacked = useMemo(() => {
    const days = new Map<string, Record<string, number | string>>();
    for (let d = range.date_from; d <= range.date_to; d = addDays(d, 1)) days.set(d, { date: d });
    const providers = new Set<string>();
    for (const row of byDay.data ?? []) {
      if (row.currency !== currency || !row.date || !row.provider) continue;
      const day = days.get(row.date);
      if (!day) continue;
      providers.add(row.provider);
      day[row.provider] = Number(day[row.provider] ?? 0) + Number(row.total_amount);
    }
    return { days: [...days.values()], providers: [...providers] };
  }, [byDay.data, currency, range]);

  const slices = (byMethod.data ?? [])
    .filter((r) => r.currency === currency && r.provider)
    .map((r) => ({ provider: r.provider!, total: Number(r.total_amount) }));

  const tableRows: TableRow[] = useMemo(() => {
    const rows = (grouped.data ?? []).filter((r) => r.currency === currency);
    const occupancyByRoute = new Map<string, { trips: number; sold: number; total: number }>();
    for (const trip of occupancy.data ?? []) {
      const entry = occupancyByRoute.get(trip.route_public_id) ?? { trips: 0, sold: 0, total: 0 };
      entry.trips += 1;
      entry.sold += trip.booked_seats;
      entry.total += trip.total_seats;
      occupancyByRoute.set(trip.route_public_id, entry);
    }
    return rows.map((r) => {
      const key = r.route_public_id ?? r.bus_public_id ?? r.provider ?? r.channel ?? "";
      const label =
        groupBy === "route"
          ? r.route_name || "—"
          : groupBy === "bus"
            ? r.plate_number || "—"
            : groupBy === "payment_method"
              ? t(`operator:payment_method.${r.provider}`)
              : t(`operator:channel.${r.channel}`);
      const occ = groupBy === "route" && r.route_public_id ? occupancyByRoute.get(r.route_public_id) : undefined;
      return {
        key,
        label,
        trips: occ?.trips,
        seatsSold: occ?.sold,
        seatsTotal: occ?.total,
        total: Number(r.total_amount),
        commission: Number(r.commission_amount),
        net: Number(r.net_amount),
        payments: r.payment_count,
      };
    });
  }, [grouped.data, occupancy.data, currency, groupBy, t]);

  const columns: Column<TableRow>[] = [
    { key: "label", header: t(`operator:reports.group.${groupBy}`), render: (r) => <strong>{r.label}</strong>, sortValue: (r) => r.label },
    ...(groupBy === "route"
      ? ([
          { key: "trips", header: t("operator:reports.trips"), render: (r: TableRow) => r.trips ?? "—", sortValue: (r: TableRow) => r.trips ?? 0 },
          { key: "sold", header: t("operator:table.seats_sold"), render: (r: TableRow) => r.seatsSold ?? "—", sortValue: (r: TableRow) => r.seatsSold ?? 0 },
          {
            key: "occ",
            header: t("operator:reports.occupancy"),
            render: (r: TableRow) => {
              if (!r.seatsTotal) return "—";
              const pct = Math.round(((r.seatsSold ?? 0) / r.seatsTotal) * 100);
              return (
                <div className="bbms-occupancy">
                  <div className="small">{pct}%</div>
                  <div className="progress"><div className="progress-bar" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            },
            sortValue: (r: TableRow) => (r.seatsTotal ? (r.seatsSold ?? 0) / r.seatsTotal : 0),
          },
        ] satisfies Column<TableRow>[])
      : [{ key: "payments", header: t("operator:reports.payments"), render: (r: TableRow) => r.payments, sortValue: (r: TableRow) => r.payments }]),
    { key: "total", header: t("operator:reports.gross"), render: (r) => money(r.total), sortValue: (r) => r.total, className: "text-end" },
    { key: "commission", header: t("operator:reports.commission"), render: (r) => money(r.commission), sortValue: (r) => r.commission, className: "text-end" },
    { key: "net", header: t("operator:reports.net"), render: (r) => money(r.net), sortValue: (r) => r.net, className: "text-end" },
  ];

  const totals = tableRows.reduce(
    (acc, r) => ({ total: acc.total + r.total, commission: acc.commission + r.commission, net: acc.net + r.net }),
    { total: 0, commission: 0, net: 0 }
  );

  function exportCsv() {
    const header = [t(`operator:reports.group.${groupBy}`), t("operator:reports.gross"), t("operator:reports.commission"), t("operator:reports.net"), "currency"];
    const lines = [header, ...tableRows.map((r) => [r.label, r.total.toFixed(2), r.commission.toFixed(2), r.net.toFixed(2), currency])];
    const csv = lines.map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `revenue-${groupBy}-${currency}-${range.date_from}_${range.date_to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const error = (grouped.error ?? byMethod.error ?? byDay.error ?? occupancy.error) as ApiError | null;

  return (
    <>
      <ContentHeader title={t("operator:reports.title")} breadcrumbs={[{ label: t("operator:nav.dashboard"), to: "/operator" }, { label: t("operator:reports.title") }]} />
      <section className="content">
        <div className="container-fluid">
          <Card>
            <div className="d-flex flex-wrap gap-3 align-items-end">
              <div>
                <div className="small text-muted mb-1">{t("operator:reports.period")}</div>
                <div className="d-flex flex-wrap gap-1 align-items-center">
                  <div className="btn-group btn-group-sm" role="group">
                    {(["today", "7d", "30d", "month"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`btn btn-outline-primary ${preset === p ? "active" : ""}`}
                        onClick={() => {
                          setPreset(p);
                          setRange(presetRange(p));
                        }}
                      >
                        {t(`operator:reports.preset.${p}`)}
                      </button>
                    ))}
                  </div>
                  <Form.Control size="sm" type="date" style={{ width: "auto" }} aria-label={t("operator:reports.from")} value={range.date_from} max={range.date_to} onChange={(e) => { setPreset(null); setRange({ ...range, date_from: e.target.value }); }} />
                  <Form.Control size="sm" type="date" style={{ width: "auto" }} aria-label={t("operator:reports.to")} value={range.date_to} min={range.date_from} onChange={(e) => { setPreset(null); setRange({ ...range, date_to: e.target.value }); }} />
                </div>
              </div>
              <div>
                <div className="small text-muted mb-1">{t("operator:reports.group_by")}</div>
                <div className="btn-group btn-group-sm" role="group">
                  {(["route", "bus", "payment_method", "channel"] as const).map((g) => (
                    <button key={g} type="button" className={`btn btn-outline-primary ${groupBy === g ? "active" : ""}`} onClick={() => setGroupBy(g)}>
                      {t(`operator:reports.by.${g}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="small text-muted mb-1">{t("operator:charts.currency")}</div>
                <CurrencyToggle value={currency} onChange={setCurrency} />
              </div>
              <button type="button" className="btn btn-sm btn-secondary ms-auto" onClick={exportCsv} disabled={tableRows.length === 0}>
                <i className="fas fa-file-csv me-1" aria-hidden="true" />
                {t("operator:reports.export_csv")}
              </button>
            </div>
          </Card>
          <ApiErrorAlert error={error} />

          <div className="row">
            <div className="col-lg-3 col-sm-6">
              <SmallBox variant="teal" icon="fas fa-coins" value={money(gross)} detail={delta(gross, prev.gross)} label={t("operator:reports.gross")} />
            </div>
            <div className="col-lg-3 col-sm-6">
              <SmallBox variant="gold" icon="fas fa-percent" value={money(commission)} detail={delta(commission, prev.commission)} label={t("operator:reports.commission")} />
            </div>
            <div className="col-lg-3 col-sm-6">
              <SmallBox variant="success" icon="fas fa-wallet" value={money(net)} detail={delta(net, prev.net)} label={t("operator:reports.net")} />
            </div>
            <div className="col-lg-3 col-sm-6">
              <SmallBox
                variant="danger"
                icon="fas fa-undo"
                value={money(refunds)}
                detail={`${t("operator:reports.cancelled_count", { count: cancellations.data?.cancelled_count ?? 0 })} · ${delta(refunds, prev.refunds)}`}
                label={t("operator:reports.refunds")}
              />
            </div>
          </div>

          <div className="row">
            <div className="col-lg-8">
              <Card title={t("operator:reports.daily_by_method", { currency: currency === "USD" ? "$" : "៛" })}>
                {stacked.providers.length ? (
                  <StackedRevenueChart days={stacked.days} providers={stacked.providers} currency={currency} />
                ) : (
                  <p className="text-muted mb-0">{t("operator:reports.empty")}</p>
                )}
              </Card>
            </div>
            <div className="col-lg-4">
              <Card title={t("operator:reports.method_share")}>
                {slices.length ? <ShareDonut slices={slices} currency={currency} /> : <p className="text-muted mb-0">{t("operator:reports.empty")}</p>}
              </Card>
            </div>
          </div>

          <Card title={t("operator:reports.table_title", { group: t(`operator:reports.by.${groupBy}`) })}>
            {groupBy === "route" && <p className="small text-muted">{t("operator:reports.occupancy_note")}</p>}
            <DataTable
              rows={tableRows}
              columns={columns}
              rowKey={(r) => r.key}
              isLoading={grouped.isLoading}
              toolbar={false}
              initialPageSize={100}
              empty={
                <>
                  <i className="fas fa-chart-bar d-block fs-3 mb-2 text-black-50" aria-hidden="true" />
                  {t("operator:reports.empty")}
                </>
              }
              footer={
                tableRows.length > 0 ? (
                  <tr>
                    <td colSpan={columns.length - 3}>{t("operator:reports.totals")}</td>
                    <td className="text-end">{money(totals.total)}</td>
                    <td className="text-end">{money(totals.commission)}</td>
                    <td className="text-end">{money(totals.net)}</td>
                  </tr>
                ) : undefined
              }
            />
          </Card>
        </div>
      </section>
    </>
  );
}
