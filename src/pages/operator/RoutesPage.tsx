// Routes: route CRUD + an ordered, drag-reorderable stop list (with up/down
// buttons too — HTML5 drag-and-drop doesn't fire on touch screens, and the
// back office must work on a tablet). The whole list saves in one PUT.
import { useEffect, useMemo, useState } from "react";
import { Alert, Form, Modal } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import {
  useAllCities,
  useCreateStop,
  useDeleteRoute,
  useOperatorRoutes,
  useRouteStops,
  useSaveRoute,
  useSaveRouteStops,
  useStopsInCities,
} from "../../api/operator";
import { Card, ContentHeader } from "../../components/layout/adminlte";
import { DataTable, type Column } from "../../components/shared/DataTable";
import { ApiErrorAlert, LoadingBlock, useLocalizedName, useRouteLabel } from "../../components/shared/backoffice";
import type { Stop } from "../../types";
import type { OperatorRoute, RouteWrite } from "../../types/operator";

interface StopDraft {
  key: string;
  routeStopId: string | null;
  stop: Stop;
  offset: number;
}

export function RoutesPage() {
  const { t } = useTranslation(["operator", "backoffice"]);
  const routeLabel = useRouteLabel();
  const routes = useOperatorRoutes();
  const deleteRoute = useDeleteRoute();
  const [editing, setEditing] = useState<OperatorRoute | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<OperatorRoute | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const selected = routes.data?.find((r) => r.public_id === selectedId) ?? null;

  const columns: Column<OperatorRoute>[] = [
    { key: "name", header: t("operator:routes.name"), render: (r) => <strong>{routeLabel(r)}</strong>, sortValue: (r) => routeLabel(r) },
    { key: "distance", header: t("operator:routes.distance"), render: (r) => (r.distance_km ? `${Number(r.distance_km)} km` : "—"), sortValue: (r) => Number(r.distance_km ?? 0) },
    {
      key: "duration",
      header: t("operator:routes.duration"),
      render: (r) => (r.estimated_duration_minutes ? t("operator:routes.duration_value", { hours: Math.floor(r.estimated_duration_minutes / 60), minutes: r.estimated_duration_minutes % 60 }) : "—"),
      sortValue: (r) => r.estimated_duration_minutes ?? 0,
    },
    { key: "stops", header: t("operator:routes.stops"), render: (r) => r.stops_count, sortValue: (r) => r.stops_count },
    {
      key: "active",
      header: t("operator:table.status"),
      render: (r) => (
        <span className={`badge ${r.is_active ? "bg-success" : "bg-secondary"}`}>
          {r.is_active ? t("operator:routes.active") : t("operator:routes.inactive")}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("operator:table.actions"),
      render: (r) => (
        <div className="d-flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setSelectedId(r.public_id)} title={t("operator:routes.edit_stops")}>
            <i className="fas fa-map-marker-alt" aria-hidden="true" />
            <span className="visually-hidden">{t("operator:routes.edit_stops")}</span>
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditing(r)} title={t("operator:actions.edit")}>
            <i className="fas fa-pen" aria-hidden="true" />
            <span className="visually-hidden">{t("operator:actions.edit")}</span>
          </button>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setDeleting(r)} title={t("operator:actions.delete")}>
            <i className="fas fa-trash" aria-hidden="true" />
            <span className="visually-hidden">{t("operator:actions.delete")}</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <ContentHeader
        title={t("operator:routes.title")}
        breadcrumbs={[{ label: t("operator:nav.dashboard"), to: "/operator" }, { label: t("operator:routes.title") }]}
      />
      <section className="content">
        <div className="container-fluid">
          {flash && (
            <Alert variant="success" dismissible onClose={() => setFlash("")} className="py-2">
              {flash}
            </Alert>
          )}
          <div className="row">
            <div className={selected ? "col-xl-7" : "col-12"}>
              <Card
                title={t("operator:routes.card_title")}
                tools={
                  <button type="button" className="btn btn-sm bbms-cta" onClick={() => setEditing(null)}>
                    <i className="fas fa-plus me-1" aria-hidden="true" />
                    {t("operator:routes.add")}
                  </button>
                }
              >
                <DataTable
                  rows={routes.data ?? []}
                  columns={columns}
                  rowKey={(r) => r.public_id}
                  isLoading={routes.isLoading}
                  onRowClick={(r) => setSelectedId(r.public_id)}
                  rowClassName={(r) => (r.public_id === selectedId ? "is-selected" : "")}
                  empty={t("operator:routes.empty")}
                />
              </Card>
            </div>
            {selected && (
              <div className="col-xl-5">
                <RouteStopsEditor route={selected} onClose={() => setSelectedId(null)} onSaved={() => setFlash(t("operator:routes.stops_saved"))} />
              </div>
            )}
          </div>
        </div>
      </section>

      <RouteModal
        route={editing}
        onClose={() => setEditing(undefined)}
        onSaved={(route, created) => {
          setEditing(undefined);
          setFlash(created ? t("operator:routes.created") : t("operator:routes.saved"));
          if (created) setSelectedId(route.public_id);
        }}
      />
      <Modal show={Boolean(deleting)} onHide={() => setDeleting(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title as="h5">{t("operator:routes.delete_title")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>{t("operator:routes.delete_body")}</p>
          <ApiErrorAlert error={deleteRoute.error} />
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-secondary" onClick={() => setDeleting(null)}>
            {t("backoffice:actions.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={deleteRoute.isPending}
            onClick={() =>
              deleting &&
              deleteRoute.mutate(deleting.public_id, {
                onSuccess: () => {
                  if (selectedId === deleting.public_id) setSelectedId(null);
                  setDeleting(null);
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

function RouteModal({
  route,
  onClose,
  onSaved,
}: {
  route: OperatorRoute | null | undefined;
  onClose: () => void;
  onSaved: (route: OperatorRoute, created: boolean) => void;
}) {
  const { t } = useTranslation(["operator", "backoffice"]);
  const localizedName = useLocalizedName();
  const cities = useAllCities();
  const saveRoute = useSaveRoute();
  const [form, setForm] = useState<RouteWrite>({
    name: "",
    origin_city_id: "",
    destination_city_id: "",
    distance_km: null,
    estimated_duration_minutes: null,
    is_active: true,
  });

  useEffect(() => {
    if (route === undefined) return;
    setForm({
      name: route?.name ?? "",
      origin_city_id: route?.origin_city.public_id ?? "",
      destination_city_id: route?.destination_city.public_id ?? "",
      distance_km: route?.distance_km ?? null,
      estimated_duration_minutes: route?.estimated_duration_minutes ?? null,
      is_active: route?.is_active ?? true,
    });
    saveRoute.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when (re)opened
  }, [route]);

  const hours = form.estimated_duration_minutes ? Math.floor(form.estimated_duration_minutes / 60) : "";
  const minutes = form.estimated_duration_minutes ? form.estimated_duration_minutes % 60 : "";

  function setDuration(h: number, m: number) {
    const total = h * 60 + m;
    setForm({ ...form, estimated_duration_minutes: total > 0 ? total : null });
  }

  return (
    <Modal show={route !== undefined} onHide={onClose} centered>
      <Form
        onSubmit={(event) => {
          event.preventDefault();
          saveRoute.mutate({ publicId: route?.public_id, body: form }, { onSuccess: (saved) => onSaved(saved, !route) });
        }}
      >
        <Modal.Header closeButton>
          <Modal.Title as="h5">{route ? t("operator:routes.edit") : t("operator:routes.add")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="row g-3">
            <Form.Group className="col-sm-6" controlId="route-origin">
              <Form.Label>{t("operator:routes.origin")}</Form.Label>
              <Form.Select required value={form.origin_city_id} onChange={(e) => setForm({ ...form, origin_city_id: e.target.value })}>
                <option value="">{t("backoffice:actions.choose")}</option>
                {(cities.data ?? []).map((city) => (
                  <option key={city.public_id} value={city.public_id}>
                    {localizedName(city)}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="col-sm-6" controlId="route-destination">
              <Form.Label>{t("operator:routes.destination")}</Form.Label>
              <Form.Select
                required
                value={form.destination_city_id}
                isInvalid={Boolean(form.destination_city_id) && form.destination_city_id === form.origin_city_id}
                onChange={(e) => setForm({ ...form, destination_city_id: e.target.value })}
              >
                <option value="">{t("backoffice:actions.choose")}</option>
                {(cities.data ?? []).map((city) => (
                  <option key={city.public_id} value={city.public_id}>
                    {localizedName(city)}
                  </option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">{t("operator:routes.same_city")}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="col-12" controlId="route-name">
              <Form.Label>{t("operator:routes.name_optional")}</Form.Label>
              <Form.Control value={form.name} maxLength={150} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Form.Group>
            <Form.Group className="col-sm-4" controlId="route-distance">
              <Form.Label>{t("operator:routes.distance")}</Form.Label>
              <Form.Control
                type="number"
                min={0}
                step="0.1"
                value={form.distance_km ?? ""}
                onChange={(e) => setForm({ ...form, distance_km: e.target.value || null })}
              />
            </Form.Group>
            <Form.Group className="col-sm-4" controlId="route-hours">
              <Form.Label>{t("operator:routes.hours")}</Form.Label>
              <Form.Control type="number" min={0} max={48} value={hours} onChange={(e) => setDuration(Number(e.target.value) || 0, Number(minutes) || 0)} />
            </Form.Group>
            <Form.Group className="col-sm-4" controlId="route-minutes">
              <Form.Label>{t("operator:routes.minutes")}</Form.Label>
              <Form.Control type="number" min={0} max={59} value={minutes} onChange={(e) => setDuration(Number(hours) || 0, Number(e.target.value) || 0)} />
            </Form.Group>
            <div className="col-12">
              <Form.Check
                type="switch"
                id="route-active"
                label={t("operator:routes.active_label")}
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
            </div>
          </div>
          <ApiErrorAlert error={saveRoute.error} className="py-2 mt-3 mb-0" />
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t("backoffice:actions.cancel")}
          </button>
          <button type="submit" className="btn bbms-cta" disabled={saveRoute.isPending || form.origin_city_id === form.destination_city_id}>
            {t("backoffice:actions.save")}
          </button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function RouteStopsEditor({ route, onClose, onSaved }: { route: OperatorRoute; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(["operator", "backoffice"]);
  const localizedName = useLocalizedName();
  const routeLabel = useRouteLabel();
  const stops = useRouteStops(route.public_id);
  const saveStops = useSaveRouteStops(route.public_id);
  const createStop = useCreateStop();
  const cityIds = useMemo(() => [route.origin_city.public_id, route.destination_city.public_id], [route]);
  const candidates = useStopsInCities(cityIds);
  const [draft, setDraft] = useState<StopDraft[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [addStopId, setAddStopId] = useState("");
  const [newStop, setNewStop] = useState<{ city_id: string; name_en: string; name_km: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!stops.data) return;
    setDraft(stops.data.map((rs) => ({ key: rs.public_id, routeStopId: rs.public_id, stop: rs.stop, offset: rs.offset_minutes })));
    setDirty(false);
  }, [stops.data]);

  function update(next: StopDraft[]) {
    setDraft(next);
    setDirty(true);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= draft.length || from === to) return;
    const next = [...draft];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    update(next);
  }

  function addStop(stop: Stop) {
    const last = draft[draft.length - 1];
    update([...draft, { key: `new-${stop.public_id}`, routeStopId: null, stop, offset: last ? last.offset + 30 : 0 }]);
    setAddStopId("");
  }

  const used = new Set(draft.map((d) => d.stop.public_id));
  const available = (candidates.data ?? []).filter((s) => !used.has(s.public_id));
  const offsetsOk = draft.every((d, i) => i === 0 || d.offset >= draft[i - 1].offset);

  return (
    <Card
      title={t("operator:routes.stops_for", { route: routeLabel(route) })}
      tools={
        <button type="button" className="btn btn-sm btn-tool" onClick={onClose} aria-label={t("backoffice:actions.close")}>
          <i className="fas fa-times" aria-hidden="true" />
        </button>
      }
      footer={
        <div className="d-flex justify-content-between align-items-center">
          <span className="small text-muted">{dirty ? t("operator:routes.unsaved") : ""}</span>
          <button
            type="button"
            className="btn bbms-cta"
            disabled={!dirty || !offsetsOk || draft.length === 0 || saveStops.isPending}
            onClick={() =>
              saveStops.mutate(
                draft.map((d) => ({ route_stop_id: d.routeStopId, stop_id: d.stop.public_id, offset_minutes: d.offset })),
                { onSuccess: onSaved }
              )
            }
          >
            {t("backoffice:actions.save")}
          </button>
        </div>
      }
    >
      {stops.isLoading && <LoadingBlock />}
      <p className="small text-muted">{t("operator:routes.stops_help")}</p>
      {draft.map((item, index) => (
        <div
          key={item.key}
          className={`bbms-stop-row${overIndex === index ? " is-drag-over" : ""}`}
          draggable
          onDragStart={() => setDragIndex(index)}
          onDragOver={(e) => {
            e.preventDefault();
            setOverIndex(index);
          }}
          onDragLeave={() => setOverIndex(null)}
          onDrop={(e) => {
            e.preventDefault();
            if (dragIndex !== null) move(dragIndex, index);
            setDragIndex(null);
            setOverIndex(null);
          }}
        >
          <span className="bbms-drag-handle" aria-hidden="true">
            <i className="fas fa-grip-vertical" />
          </span>
          <span className="badge bg-bbms-tint text-dark">{index + 1}</span>
          <span className="flex-grow-1">
            {localizedName(item.stop)}
            <br />
            <small className="text-muted">{localizedName(item.stop.city)}</small>
          </span>
          <Form.Control
            type="number"
            min={0}
            step={5}
            size="sm"
            style={{ width: 84 }}
            aria-label={t("operator:routes.offset")}
            title={t("operator:routes.offset")}
            value={item.offset}
            isInvalid={index > 0 && item.offset < draft[index - 1].offset}
            onChange={(e) => update(draft.map((d, i) => (i === index ? { ...d, offset: Math.max(0, Number(e.target.value) || 0) } : d)))}
          />
          <div className="btn-group-vertical btn-group-sm">
            <button type="button" className="btn btn-outline-secondary" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={t("operator:routes.move_up")}>
              <i className="fas fa-chevron-up" aria-hidden="true" />
            </button>
            <button type="button" className="btn btn-outline-secondary" disabled={index === draft.length - 1} onClick={() => move(index, index + 1)} aria-label={t("operator:routes.move_down")}>
              <i className="fas fa-chevron-down" aria-hidden="true" />
            </button>
          </div>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => update(draft.filter((_, i) => i !== index))} aria-label={t("backoffice:actions.remove")}>
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </div>
      ))}
      {!offsetsOk && <p className="text-danger small">{t("operator:routes.offsets_order")}</p>}

      <div className="d-flex gap-2 mt-3">
        <Form.Select size="sm" aria-label={t("operator:routes.add_stop")} value={addStopId} onChange={(e) => setAddStopId(e.target.value)}>
          <option value="">{t("operator:routes.add_stop")}</option>
          {available.map((stop) => (
            <option key={stop.public_id} value={stop.public_id}>
              {localizedName(stop)} ({localizedName(stop.city)})
            </option>
          ))}
        </Form.Select>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary text-nowrap"
          disabled={!addStopId}
          onClick={() => {
            const stop = available.find((s) => s.public_id === addStopId);
            if (stop) addStop(stop);
          }}
        >
          {t("backoffice:actions.add")}
        </button>
      </div>
      {newStop ? (
        <div className="border rounded p-2 mt-2">
          <div className="row g-2">
            <div className="col-12">
              <Form.Select size="sm" aria-label={t("operator:routes.city")} value={newStop.city_id} onChange={(e) => setNewStop({ ...newStop, city_id: e.target.value })}>
                <option value={route.origin_city.public_id}>{localizedName(route.origin_city)}</option>
                <option value={route.destination_city.public_id}>{localizedName(route.destination_city)}</option>
              </Form.Select>
            </div>
            <div className="col-sm-6">
              <Form.Control size="sm" placeholder={t("operator:routes.stop_name_km")} aria-label={t("operator:routes.stop_name_km")} value={newStop.name_km} onChange={(e) => setNewStop({ ...newStop, name_km: e.target.value })} />
            </div>
            <div className="col-sm-6">
              <Form.Control size="sm" placeholder={t("operator:routes.stop_name_en")} aria-label={t("operator:routes.stop_name_en")} value={newStop.name_en} onChange={(e) => setNewStop({ ...newStop, name_en: e.target.value })} />
            </div>
          </div>
          <ApiErrorAlert error={createStop.error} className="py-1 mt-2 mb-0 small" />
          <div className="d-flex justify-content-end gap-2 mt-2">
            <button type="button" className="btn btn-sm btn-link" onClick={() => setNewStop(null)}>
              {t("backoffice:actions.cancel")}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={!newStop.name_en.trim() || !newStop.name_km.trim() || createStop.isPending}
              onClick={() =>
                createStop.mutate(newStop, {
                  onSuccess: (stop) => {
                    addStop(stop);
                    setNewStop(null);
                  },
                })
              }
            >
              {t("operator:routes.create_stop")}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-link btn-sm px-0 mt-1" onClick={() => setNewStop({ city_id: route.origin_city.public_id, name_en: "", name_km: "" })}>
          <i className="fas fa-plus me-1" aria-hidden="true" />
          {t("operator:routes.new_stop")}
        </button>
      )}
      <ApiErrorAlert error={saveStops.error} className="py-2 mt-3 mb-0" />
    </Card>
  );
}
