// O5 — trip status update. The passenger count, per-channel message counts
// and the exact message text all come from the server's status-preview
// endpoint (the same code path that sends them), never a client-side guess.
import { useEffect, useState } from "react";
import { Form, Modal } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import { useSetTripStatus, useTripStatusPreview } from "../../api/operator";
import { useLocale } from "../../context/LocaleContext";
import type { OperatorTrip, TripStatusChange, TripStatusUpdate } from "../../types/operator";
import { formatDateTime, formatTime } from "../../utils/time";
import { ApiErrorAlert } from "../shared/backoffice";

const CANCEL_REASONS = ["mechanical", "weather", "low_demand", "operational", "other"] as const;

interface TripStatusModalProps {
  trip: OperatorTrip | null;
  onClose: () => void;
}

const OPTIONS: { status: TripStatusChange; icon: string; tone: string }[] = [
  { status: "scheduled", icon: "fas fa-check-circle", tone: "success" },
  { status: "delayed", icon: "fas fa-clock", tone: "warning" },
  { status: "cancelled", icon: "fas fa-ban", tone: "danger" },
];

export function TripStatusModal({ trip, onClose }: TripStatusModalProps) {
  const { t } = useTranslation(["operator", "backoffice"]);
  const { language } = useLocale();
  const [status, setStatus] = useState<TripStatusChange>("delayed");
  const [delayMinutes, setDelayMinutes] = useState(30);
  const [reasonKey, setReasonKey] = useState<(typeof CANCEL_REASONS)[number]>("mechanical");
  const [note, setNote] = useState("");
  const [previewLanguage, setPreviewLanguage] = useState(language);
  const setTripStatus = useSetTripStatus();

  useEffect(() => {
    if (!trip) return;
    setStatus(trip.status === "delayed" ? "scheduled" : "delayed");
    setDelayMinutes(trip.delay_minutes ?? 30);
    setNote("");
    setPreviewLanguage(language);
    setTripStatus.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when a different trip opens
  }, [trip?.public_id]);

  // Sent verbatim inside the passenger message, so it's the operator's own
  // note when given, otherwise the chosen reason in the current UI language.
  const cancellationReason = note.trim() || t(`operator:status_modal.cancel_reason.${reasonKey}`);
  const update: TripStatusUpdate | null = trip
    ? status === "delayed"
      ? { status, delay_minutes: delayMinutes }
      : status === "cancelled"
        ? { status, cancellation_reason: cancellationReason }
        : { status }
    : null;
  const preview = useTripStatusPreview(trip?.public_id, update);

  const canBackOnTime = trip?.status === "delayed";
  const unchanged = status === "scheduled" && !canBackOnTime;
  const newDeparture =
    trip && status === "delayed"
      ? new Date(new Date(trip.departure_at).getTime() + delayMinutes * 60_000).toISOString()
      : null;

  function submit() {
    if (!trip || !update) return;
    setTripStatus.mutate({ publicId: trip.public_id, body: update }, { onSuccess: onClose });
  }

  const passengers = preview.data?.passengers_count ?? 0;
  const message = preview.data?.messages[previewLanguage];

  return (
    <Modal show={Boolean(trip)} onHide={onClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title as="h5">{t("operator:status_modal.title")}</Modal.Title>
      </Modal.Header>
      {trip && (
        <Modal.Body>
          <p className="text-muted small mb-3">
            {trip.route.name} · {formatDateTime(trip.departure_at, language)} · {trip.bus_plate_number}
          </p>

          <div className="row g-2 mb-3" role="radiogroup" aria-label={t("operator:status_modal.title")}>
            {OPTIONS.map((option) => {
              const disabled = option.status === "scheduled" && !canBackOnTime;
              const selected = status === option.status;
              return (
                <div className="col-sm-4" key={option.status}>
                  <label
                    className={`card h-100 mb-0 p-3 border-2 ${selected ? `border-${option.tone}` : ""} ${disabled ? "opacity-50" : ""}`}
                    style={{ cursor: disabled ? "not-allowed" : "pointer" }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <Form.Check
                        type="radio"
                        name="trip-status"
                        checked={selected}
                        disabled={disabled}
                        onChange={() => setStatus(option.status)}
                        aria-label={t(`operator:status_modal.option.${option.status}`)}
                      />
                      <i className={`${option.icon} text-${option.tone} fs-4`} aria-hidden="true" />
                      <span className="fw-semibold">{t(`operator:status_modal.option.${option.status}`)}</span>
                    </div>
                    <small className="text-muted mt-1">{t(`operator:status_modal.hint.${option.status}`)}</small>
                  </label>
                </div>
              );
            })}
          </div>

          {status === "delayed" && (
            <div className="row g-2 align-items-end mb-3">
              <div className="col-sm-4">
                <Form.Label htmlFor="delay-minutes">{t("operator:status_modal.delay_minutes")}</Form.Label>
                <Form.Control
                  id="delay-minutes"
                  type="number"
                  min={1}
                  step={5}
                  value={delayMinutes}
                  onChange={(event) => setDelayMinutes(Math.max(1, Number(event.target.value) || 0))}
                />
              </div>
              <div className="col-sm-8">
                {newDeparture && (
                  <p className="mb-2">
                    {t("operator:status_modal.new_departure")}:{" "}
                    <strong>{formatTime(newDeparture, language)}</strong>{" "}
                    <span className="text-muted">
                      ({t("operator:status_modal.was", { time: formatTime(trip.departure_at, language) })})
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}

          {status === "cancelled" && (
            <div className="row g-2 mb-3">
              <div className="col-sm-5">
                <Form.Label htmlFor="cancel-reason">{t("operator:status_modal.reason")}</Form.Label>
                <Form.Select
                  id="cancel-reason"
                  value={reasonKey}
                  onChange={(event) => setReasonKey(event.target.value as (typeof CANCEL_REASONS)[number])}
                >
                  {CANCEL_REASONS.map((key) => (
                    <option key={key} value={key}>
                      {t(`operator:status_modal.cancel_reason.${key}`)}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-sm-7">
                <Form.Label htmlFor="cancel-note">{t("operator:status_modal.note")}</Form.Label>
                <Form.Control
                  id="cancel-note"
                  as="textarea"
                  rows={2}
                  maxLength={255}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
              <div className="col-12">
                <div className="alert alert-info py-2 small mb-0">{t("operator:status_modal.refund_note")}</div>
              </div>
            </div>
          )}

          {status !== "scheduled" && (
            <div className="p-3 rounded" style={{ background: "#F5F7F9" }}>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                <strong>{t("operator:status_modal.preview_title")}</strong>
                <div className="btn-group btn-group-sm" role="group" aria-label={t("operator:status_modal.preview_language")}>
                  {(["km", "en"] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      className={`btn btn-outline-primary ${previewLanguage === lang ? "active" : ""}`}
                      onClick={() => setPreviewLanguage(lang)}
                    >
                      {lang === "km" ? "ខ្មែរ" : "English"}
                    </button>
                  ))}
                </div>
              </div>
              {preview.isFetching && !preview.data && <p className="text-muted small mb-0">…</p>}
              {preview.data && (
                <>
                  {message ? (
                    <pre className="bg-white border rounded p-2 small mb-2" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                      {message}
                    </pre>
                  ) : (
                    <p className="text-muted small">{t("operator:status_modal.no_recipients")}</p>
                  )}
                  <ul className="list-inline small mb-2">
                    {Object.entries(preview.data.channels).map(([channel, count]) => (
                      <li className="list-inline-item me-3" key={channel}>
                        <i className="fas fa-check text-success me-1" aria-hidden="true" />
                        {t(`operator:status_modal.channel.${channel}`)}: {count}
                      </li>
                    ))}
                  </ul>
                  <p className={`mb-0 fw-semibold ${passengers ? "text-danger" : ""}`}>
                    {t("operator:status_modal.will_notify", { count: passengers })}
                  </p>
                </>
              )}
              <ApiErrorAlert error={preview.error as never} className="py-2 mt-2 mb-0" />
            </div>
          )}

          <ApiErrorAlert error={setTripStatus.error} className="py-2 mt-3 mb-0" />
        </Modal.Body>
      )}
      <Modal.Footer className="justify-content-between">
        <small className="text-muted">
          <i className="fas fa-history me-1" aria-hidden="true" />
          {t("operator:status_modal.audit_caption")}
        </small>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t("backoffice:actions.cancel")}
          </button>
          <button
            type="button"
            className="btn bbms-cta"
            onClick={submit}
            disabled={unchanged || setTripStatus.isPending || (status !== "scheduled" && !preview.data)}
          >
            {status === "scheduled" ? t("operator:status_modal.submit_on_time") : t("operator:status_modal.submit")}
          </button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
