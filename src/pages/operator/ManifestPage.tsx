// O4 — passenger manifest for one trip: KPIs, filterable passenger table
// with bulk boarded / no-show marking, CSV/PDF export, print layout, and a
// read-only seat map (same five seat states as the passenger site).
import { useMemo, useState } from "react";
import { Dropdown, Form, SplitButton } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

import { downloadManifest, useMarkBoarding, useOperatorTrip, useTripManifest, useTripSeatMap } from "../../api/operator";
import type { ApiError } from "../../api/types";
import { SeatLegend } from "../../components/booking/SeatLegend";
import { SeatMap } from "../../components/booking/SeatMap";
import { Card, ContentHeader, InfoBox } from "../../components/layout/adminlte";
import { DataTable, type Column } from "../../components/shared/DataTable";
import { ApiErrorAlert, DualMoney, LoadingBlock, StatusBadge, useRouteLabel } from "../../components/shared/backoffice";
import { useLocale } from "../../context/LocaleContext";
import type { ManifestRow } from "../../types/operator";
import { formatDate, formatTime } from "../../utils/time";

export function ManifestPage() {
  const { tripId } = useParams();
  const { t } = useTranslation(["operator", "backoffice"]);
  const { language } = useLocale();
  const routeLabel = useRouteLabel();
  const trip = useOperatorTrip(tripId);
  const manifest = useTripManifest(tripId);
  const seats = useTripSeatMap(tripId);
  const markBoarding = useMarkBoarding(tripId);
  const [selected, setSelected] = useState<string[]>([]);
  const [boardingPoint, setBoardingPoint] = useState("");
  const [exportError, setExportError] = useState<ApiError | null>(null);

  const rows = useMemo(() => manifest.data ?? [], [manifest.data]);
  const pointName = (row: ManifestRow) =>
    (language === "km" ? row.boarding_stop_name_km || row.boarding_stop_name_en : row.boarding_stop_name_en || row.boarding_stop_name_km) ||
    t("operator:manifest.no_boarding_point");
  const points = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => counts.set(pointName(row), (counts.get(pointName(row)) ?? 0) + 1));
    return [...counts.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pointName depends on language only
  }, [rows, language]);
  const visible = boardingPoint ? rows.filter((row) => pointName(row) === boardingPoint) : rows;
  const boarded = rows.filter((r) => r.boarding_status === "boarded").length;
  const noShow = rows.filter((r) => r.boarding_status === "no_show").length;

  function mark(status: "boarded" | "no_show") {
    markBoarding.mutate({ passengerIds: selected, status }, { onSuccess: () => setSelected([]) });
  }

  async function exportAs(format: "csv" | "pdf") {
    if (!tripId) return;
    setExportError(null);
    try {
      await downloadManifest(tripId, format);
    } catch (error) {
      setExportError(error as ApiError);
    }
  }

  const columns: Column<ManifestRow>[] = [
    { key: "seat", header: t("operator:manifest.seat"), render: (r) => <strong>{r.seat_number}</strong>, sortValue: (r) => r.seat_number },
    { key: "name", header: t("operator:manifest.passenger"), render: (r) => r.full_name, sortValue: (r) => r.full_name },
    {
      key: "agegender",
      header: t("operator:manifest.age_gender"),
      render: (r) => [r.age ?? "—", r.gender ? t(`operator:gender.${r.gender}`) : ""].filter(Boolean).join(" / "),
    },
    { key: "phone", header: t("operator:manifest.phone"), render: (r) => r.phone, sortValue: (r) => r.phone },
    { key: "point", header: t("operator:manifest.boarding_point"), render: pointName, sortValue: pointName },
    { key: "pnr", header: "PNR", render: (r) => <code>{r.pnr}</code>, sortValue: (r) => r.pnr },
    { key: "payment", header: t("operator:manifest.payment"), render: (r) => <StatusBadge status={r.payment_status} /> },
    {
      key: "channel",
      header: t("operator:manifest.channel"),
      render: (r) => <span className="badge bg-light text-dark border">{t(`operator:channel.${r.booking_channel}`)}</span>,
      sortValue: (r) => r.booking_channel,
    },
    {
      key: "boarding",
      header: t("operator:manifest.boarding"),
      render: (r) => (r.boarding_status ? <StatusBadge status={r.boarding_status} /> : <span className="text-muted">—</span>),
      sortValue: (r) => r.boarding_status,
    },
  ];

  if (trip.isLoading) return <LoadingBlock />;
  const data = trip.data;

  return (
    <>
      <ContentHeader
        title={t("operator:manifest.title")}
        breadcrumbs={[
          { label: t("operator:nav.dashboard"), to: "/operator" },
          { label: t("operator:nav.schedule"), to: "/operator/schedule" },
          { label: t("operator:manifest.title") },
        ]}
      />
      <section className="content">
        <div className="container-fluid">
          <ApiErrorAlert error={(trip.error ?? manifest.error) as ApiError | null} />
          {data && (
            <>
              <div className="row">
                <div className="col-lg-3 col-sm-6">
                  <InfoBox variant="teal" icon="fas fa-chair" label={t("operator:manifest.seats_sold")} value={`${data.seats_sold}/${data.seats_total}`} />
                </div>
                <div className="col-lg-3 col-sm-6">
                  <InfoBox variant="orange" icon="fas fa-coins" label={t("operator:table.revenue")} value={<DualMoney usd={data.revenue_usd} khr={data.revenue_khr} />} />
                </div>
                <div className="col-lg-3 col-sm-6">
                  <InfoBox variant="success" icon="fas fa-user-check" label={t("operator:manifest.boarded")} value={boarded} />
                </div>
                <div className="col-lg-3 col-sm-6">
                  <InfoBox variant="danger" icon="fas fa-user-times" label={t("operator:manifest.no_show")} value={noShow} />
                </div>
              </div>

              <div className="row">
                <div className="col-xl-9">
                  <Card
                    outline
                    variant="primary"
                    title={
                      <span>
                        {routeLabel(data.route)} · {formatDate(data.departure_at, language)} {formatTime(data.departure_at, language)}{" "}
                        <StatusBadge status={data.status} />
                        <br />
                        <small className="text-muted fw-normal">
                          {data.bus_plate_number} · {t("operator:trip_form.driver")}: {data.driver_name || "—"} · {t("operator:trip_form.conductor")}:{" "}
                          {data.conductor_name || "—"}
                        </small>
                      </span>
                    }
                    tools={
                      <>
                        <SplitButton
                          size="sm"
                          id="manifest-export"
                          variant="warning"
                          className="bbms-cta"
                          title={
                            <>
                              <i className="fas fa-file-export me-1" aria-hidden="true" />
                              {t("operator:manifest.export")}
                            </>
                          }
                          onClick={() => void exportAs("pdf")}
                        >
                          <Dropdown.Item onClick={() => void exportAs("pdf")}>PDF</Dropdown.Item>
                          <Dropdown.Item onClick={() => void exportAs("csv")}>{t("operator:manifest.csv_excel")}</Dropdown.Item>
                        </SplitButton>
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => window.print()}>
                          <i className="fas fa-print me-1" aria-hidden="true" />
                          {t("operator:manifest.print")}
                        </button>
                      </>
                    }
                  >
                    <ApiErrorAlert error={exportError} />
                    <div className="d-flex flex-wrap gap-2 mb-2 bbms-no-print">
                      <Form.Select size="sm" style={{ maxWidth: 260 }} aria-label={t("operator:manifest.boarding_point")} value={boardingPoint} onChange={(e) => setBoardingPoint(e.target.value)}>
                        <option value="">{t("operator:manifest.all_points")}</option>
                        {points.map(([name]) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </Form.Select>
                    </div>
                    {selected.length > 0 && (
                      <div className="bbms-bulk-bar">
                        <strong>{t("backoffice:table.selected", { count: selected.length })}</strong>
                        <button type="button" className="btn btn-sm btn-success" disabled={markBoarding.isPending} onClick={() => mark("boarded")}>
                          <i className="fas fa-user-check me-1" aria-hidden="true" />
                          {t("operator:manifest.mark_boarded")}
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-danger" disabled={markBoarding.isPending} onClick={() => mark("no_show")}>
                          {t("operator:manifest.mark_no_show")}
                        </button>
                      </div>
                    )}
                    <ApiErrorAlert error={markBoarding.error} />
                    <DataTable
                      rows={visible}
                      columns={columns}
                      rowKey={(r) => r.passenger_public_id}
                      isLoading={manifest.isLoading}
                      initialPageSize={100}
                      selectable
                      selectedKeys={selected}
                      onSelectionChange={setSelected}
                      isRowSelectable={(r) => r.booking_status === "confirmed"}
                      empty={t("operator:manifest.empty")}
                    />
                  </Card>
                </div>
                <div className="col-xl-3 bbms-no-print">
                  <Card title={t("operator:manifest.seat_map")}>
                    {seats.data ? (
                      <>
                        <SeatMap seats={seats.data} selectedSeatIds={[]} onChangeSelection={() => undefined} />
                        <div className="mt-3">
                          <SeatLegend />
                        </div>
                      </>
                    ) : (
                      <LoadingBlock />
                    )}
                  </Card>
                  <Card title={t("operator:manifest.per_point")} bodyClassName="p-0">
                    <ul className="list-group list-group-flush">
                      {points.map(([name, count]) => (
                        <li key={name} className="list-group-item d-flex justify-content-between">
                          <span>{name}</span>
                          <strong>{count}</strong>
                        </li>
                      ))}
                      {points.length === 0 && <li className="list-group-item text-muted">—</li>}
                    </ul>
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
