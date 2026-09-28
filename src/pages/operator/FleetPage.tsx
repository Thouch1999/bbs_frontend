// O3 — fleet: bus table, add/edit bus modal (layout, amenities, photo,
// document expiry), and the seat layout builder for the selected layout.
import { useEffect, useState, type DragEvent } from "react";
import { Alert, Form, Modal } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import { useBuses, useDeleteBus, useSaveBus, useSeatLayouts, useUploadBusPhoto } from "../../api/operator";
import { Card, ContentHeader } from "../../components/layout/adminlte";
import { SeatLayoutBuilder } from "../../components/operator/SeatLayoutBuilder";
import { DataTable, type Column } from "../../components/shared/DataTable";
import { ApiErrorAlert, StatusBadge } from "../../components/shared/backoffice";
import { useLocale } from "../../context/LocaleContext";
import type { Amenity, Bus, BusStatus, BusWrite, SeatLayout } from "../../types/operator";
import { addDays, formatDate, localDateISO } from "../../utils/time";

const AMENITIES: { key: Amenity; icon: string }[] = [
  { key: "ac", icon: "fas fa-snowflake" },
  { key: "wifi", icon: "fas fa-wifi" },
  { key: "usb", icon: "fas fa-plug" },
  { key: "toilet", icon: "fas fa-restroom" },
  { key: "blanket", icon: "fas fa-bed" },
  { key: "water", icon: "fas fa-tint" },
];

function expiryClass(date: string | null): string {
  if (!date) return "";
  const today = localDateISO();
  if (date < today) return "text-danger fw-semibold";
  if (date <= addDays(today, 30)) return "text-warning fw-semibold";
  return "";
}

export function FleetPage() {
  const { t } = useTranslation(["operator", "backoffice"]);
  const { language } = useLocale();
  const buses = useBuses();
  const layouts = useSeatLayouts();
  const deleteBus = useDeleteBus();
  const [editing, setEditing] = useState<Bus | null | undefined>(undefined); // undefined = closed, null = new
  const [deleting, setDeleting] = useState<Bus | null>(null);
  const [layoutId, setLayoutId] = useState<string | "new" | null>(null);
  const [flash, setFlash] = useState("");

  const selectedLayout = layoutId && layoutId !== "new" ? (layouts.data?.find((l) => l.public_id === layoutId) ?? null) : null;

  const columns: Column<Bus>[] = [
    {
      key: "plate",
      header: t("operator:fleet.plate"),
      render: (bus) => (
        <div className="d-flex align-items-center gap-2">
          {bus.photo ? (
            <img src={bus.photo} alt="" width={48} height={32} style={{ objectFit: "cover", borderRadius: 4 }} />
          ) : (
            <i className="fas fa-bus text-muted" style={{ width: 48, textAlign: "center" }} aria-hidden="true" />
          )}
          <strong>{bus.plate_number}</strong>
        </div>
      ),
      sortValue: (bus) => bus.plate_number,
    },
    {
      key: "type",
      header: t("operator:fleet.bus_type"),
      render: (bus) => t(`operator:bus_type.${bus.seat_layout.bus_type}`),
      sortValue: (bus) => bus.seat_layout.bus_type,
    },
    {
      key: "layout",
      header: t("operator:fleet.layout"),
      render: (bus) => (
        <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setLayoutId(bus.seat_layout.public_id)}>
          {bus.seat_layout.name}
        </button>
      ),
      sortValue: (bus) => bus.seat_layout.name,
    },
    { key: "seats", header: t("operator:fleet.seats"), render: (bus) => bus.seat_layout.seats.length, sortValue: (bus) => bus.seat_layout.seats.length },
    {
      key: "amenities",
      header: t("operator:fleet.amenities"),
      render: (bus) => (
        <span className="d-inline-flex gap-2 text-muted">
          {AMENITIES.filter((a) => bus.amenities.includes(a.key)).map((a) => (
            <i key={a.key} className={a.icon} title={t(`operator:amenity.${a.key}`)} aria-label={t(`operator:amenity.${a.key}`)} />
          ))}
        </span>
      ),
    },
    {
      key: "documents",
      header: t("operator:fleet.documents"),
      render: (bus) => (
        <span className="small">
          <span className={expiryClass(bus.registration_expires_on)}>
            {t("operator:fleet.registration_short")}: {bus.registration_expires_on ? formatDate(bus.registration_expires_on, language) : "—"}
          </span>
          <br />
          <span className={expiryClass(bus.insurance_expires_on)}>
            {t("operator:fleet.insurance_short")}: {bus.insurance_expires_on ? formatDate(bus.insurance_expires_on, language) : "—"}
          </span>
        </span>
      ),
    },
    { key: "status", header: t("operator:table.status"), render: (bus) => <StatusBadge status={bus.status} />, sortValue: (bus) => bus.status },
    {
      key: "actions",
      header: t("operator:table.actions"),
      render: (bus) => (
        <div className="d-flex gap-1">
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditing(bus)} title={t("operator:actions.edit")}>
            <i className="fas fa-pen" aria-hidden="true" />
            <span className="visually-hidden">{t("operator:actions.edit")}</span>
          </button>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setDeleting(bus)} title={t("operator:actions.delete")}>
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
        title={t("operator:fleet.title")}
        breadcrumbs={[{ label: t("operator:nav.dashboard"), to: "/operator" }, { label: t("operator:fleet.title") }]}
      />
      <section className="content">
        <div className="container-fluid">
          {flash && (
            <Alert variant="success" dismissible onClose={() => setFlash("")} className="py-2">
              {flash}
            </Alert>
          )}
          <Card
            title={t("operator:fleet.buses")}
            tools={
              <button type="button" className="btn btn-sm bbms-cta" onClick={() => setEditing(null)} disabled={!layouts.data?.length}>
                <i className="fas fa-plus me-1" aria-hidden="true" />
                {t("operator:fleet.add_bus")}
              </button>
            }
          >
            {layouts.data && layouts.data.length === 0 && <Alert variant="info" className="py-2">{t("operator:fleet.need_layout_first")}</Alert>}
            <DataTable
              rows={buses.data ?? []}
              columns={columns}
              rowKey={(bus) => bus.public_id}
              isLoading={buses.isLoading}
              onRowClick={(bus) => setLayoutId(bus.seat_layout.public_id)}
              rowClassName={(bus) => (bus.seat_layout.public_id === layoutId ? "is-selected" : "")}
              empty={t("operator:fleet.no_buses")}
            />
          </Card>

          <Card
            title={t("operator:fleet.layouts")}
            tools={
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setLayoutId("new")}>
                <i className="fas fa-plus me-1" aria-hidden="true" />
                {t("operator:fleet.new_layout")}
              </button>
            }
          >
            <div className="d-flex flex-wrap gap-2">
              {(layouts.data ?? []).map((layout) => (
                <button
                  key={layout.public_id}
                  type="button"
                  className={`btn btn-sm ${layoutId === layout.public_id ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setLayoutId(layout.public_id)}
                >
                  {layout.name} · {layout.seats.length}
                  {layout.in_use && <i className="fas fa-lock ms-1" title={t("operator:fleet.in_use_badge")} aria-label={t("operator:fleet.in_use_badge")} />}
                </button>
              ))}
              {layouts.data?.length === 0 && <span className="text-muted small">{t("operator:fleet.no_layouts")}</span>}
            </div>
          </Card>

          {layoutId && (
            <SeatLayoutBuilder
              layout={selectedLayout}
              onSaved={(layout, message) => {
                setLayoutId(layout.public_id);
                setFlash(message);
              }}
            />
          )}
        </div>
      </section>

      <BusModal
        bus={editing}
        layouts={layouts.data ?? []}
        onClose={() => setEditing(undefined)}
        onSaved={(message) => {
          setEditing(undefined);
          setFlash(message);
        }}
      />
      <Modal show={Boolean(deleting)} onHide={() => setDeleting(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title as="h5">{t("operator:fleet.delete_title", { plate: deleting?.plate_number })}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>{t("operator:fleet.delete_body")}</p>
          <ApiErrorAlert error={deleteBus.error} />
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-secondary" onClick={() => setDeleting(null)}>
            {t("backoffice:actions.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={deleteBus.isPending}
            onClick={() => deleting && deleteBus.mutate(deleting.public_id, { onSuccess: () => setDeleting(null) })}
          >
            {t("backoffice:actions.delete")}
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

function LayoutThumbnail({ layout }: { layout: SeatLayout }) {
  const cols = Math.max(1, ...layout.seats.map((s) => s.col_position));
  const lower = layout.seats.filter((s) => s.deck === 1);
  return (
    <div
      aria-hidden="true"
      style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 8px)`, gap: 2, padding: 6, background: "#F5F7F9", borderRadius: 6, width: "fit-content" }}
    >
      {lower.map((seat) => (
        <span
          key={seat.public_id}
          style={{
            gridRow: seat.row_position,
            gridColumn: seat.col_position,
            width: 8,
            height: 8,
            borderRadius: 2,
            background: seat.seat_type === "vip" ? "#F2B233" : "#9AA7B2",
          }}
        />
      ))}
    </div>
  );
}

function BusModal({
  bus,
  layouts,
  onClose,
  onSaved,
}: {
  bus: Bus | null | undefined;
  layouts: SeatLayout[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { t } = useTranslation(["operator", "backoffice"]);
  const saveBus = useSaveBus();
  const uploadPhoto = useUploadBusPhoto();
  const [form, setForm] = useState<BusWrite>({
    plate_number: "",
    seat_layout_id: "",
    amenities: [],
    status: "active",
    registration_expires_on: null,
    insurance_expires_on: null,
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (bus === undefined) return;
    setForm({
      plate_number: bus?.plate_number ?? "",
      seat_layout_id: bus?.seat_layout.public_id ?? layouts[0]?.public_id ?? "",
      amenities: bus?.amenities ?? ["ac"],
      status: bus?.status ?? "active",
      registration_expires_on: bus?.registration_expires_on ?? null,
      insurance_expires_on: bus?.insurance_expires_on ?? null,
    });
    setPhoto(null);
    saveBus.reset();
    uploadPhoto.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when (re)opened
  }, [bus]);

  const layout = layouts.find((l) => l.public_id === form.seat_layout_id);

  function toggleAmenity(key: Amenity) {
    setForm((f) => ({ ...f, amenities: f.amenities.includes(key) ? f.amenities.filter((a) => a !== key) : [...f.amenities, key] }));
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) setPhoto(file);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const saved = await saveBus.mutateAsync({ publicId: bus?.public_id, body: form });
    if (photo) await uploadPhoto.mutateAsync({ publicId: saved.public_id, file: photo });
    onSaved(bus ? t("operator:fleet.bus_saved") : t("operator:fleet.bus_added"));
  }

  const busy = saveBus.isPending || uploadPhoto.isPending;

  return (
    <Modal show={bus !== undefined} onHide={onClose} size="lg" centered>
      <Form onSubmit={(event) => void submit(event).catch(() => undefined)}>
        <Modal.Header closeButton>
          <Modal.Title as="h5">{bus ? t("operator:fleet.edit_bus") : t("operator:fleet.add_bus")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="row g-3">
            <Form.Group className="col-md-6" controlId="bus-plate">
              <Form.Label>{t("operator:fleet.plate")}</Form.Label>
              <Form.Control
                value={form.plate_number}
                maxLength={20}
                required
                onChange={(e) => setForm({ ...form, plate_number: e.target.value.toUpperCase() })}
                placeholder="2A-1234"
              />
            </Form.Group>
            <Form.Group className="col-md-6" controlId="bus-status">
              <Form.Label>{t("operator:table.status")}</Form.Label>
              <Form.Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as BusStatus })}>
                {(["active", "maintenance", "retired"] as const).map((status) => (
                  <option key={status} value={status}>
                    {t(`backoffice:status.${status}`)}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="col-md-6" controlId="bus-layout">
              <Form.Label>{t("operator:fleet.layout")}</Form.Label>
              <Form.Select value={form.seat_layout_id} required onChange={(e) => setForm({ ...form, seat_layout_id: e.target.value })}>
                {layouts.map((l) => (
                  <option key={l.public_id} value={l.public_id}>
                    {l.name} ({l.seats.length})
                  </option>
                ))}
              </Form.Select>
              {bus && <Form.Text>{t("operator:fleet.layout_change_hint")}</Form.Text>}
            </Form.Group>
            <div className="col-md-6">{layout && <LayoutThumbnail layout={layout} />}</div>
            <fieldset className="col-12">
              <legend className="form-label fs-6">{t("operator:fleet.amenities")}</legend>
              <div className="d-flex flex-wrap gap-3">
                {AMENITIES.map((a) => (
                  <Form.Check
                    key={a.key}
                    id={`amenity-${a.key}`}
                    label={
                      <>
                        <i className={`${a.icon} me-1 text-muted`} aria-hidden="true" />
                        {t(`operator:amenity.${a.key}`)}
                      </>
                    }
                    checked={form.amenities.includes(a.key)}
                    onChange={() => toggleAmenity(a.key)}
                  />
                ))}
              </div>
            </fieldset>
            <div className="col-12">
              <label
                htmlFor="bus-photo"
                className={`d-block text-center p-3 rounded border border-2 border-dashed ${dragging ? "border-primary bg-light" : ""}`}
                style={{ borderStyle: "dashed", cursor: "pointer" }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <i className="fas fa-cloud-upload-alt fs-3 text-muted d-block mb-1" aria-hidden="true" />
                {photo ? photo.name : bus?.photo ? t("operator:fleet.photo_replace") : t("operator:fleet.photo_drop")}
              </label>
              <input
                id="bus-photo"
                type="file"
                accept="image/*"
                className="visually-hidden"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
            </div>
            <Form.Group className="col-md-6" controlId="bus-registration">
              <Form.Label>{t("operator:fleet.registration_expiry")}</Form.Label>
              <Form.Control
                type="date"
                value={form.registration_expires_on ?? ""}
                onChange={(e) => setForm({ ...form, registration_expires_on: e.target.value || null })}
              />
            </Form.Group>
            <Form.Group className="col-md-6" controlId="bus-insurance">
              <Form.Label>{t("operator:fleet.insurance_expiry")}</Form.Label>
              <Form.Control
                type="date"
                value={form.insurance_expires_on ?? ""}
                onChange={(e) => setForm({ ...form, insurance_expires_on: e.target.value || null })}
              />
            </Form.Group>
          </div>
          <ApiErrorAlert error={saveBus.error ?? uploadPhoto.error} className="py-2 mt-3 mb-0" />
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t("backoffice:actions.cancel")}
          </button>
          <button type="submit" className="btn bbms-cta" disabled={busy || !form.plate_number || !form.seat_layout_id}>
            {busy && <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />}
            {t("backoffice:actions.save")}
          </button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
