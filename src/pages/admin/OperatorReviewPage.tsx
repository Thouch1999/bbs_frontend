// A2 — operator approval: applicant card, document checklist (verified /
// needs info / rejected per item), licence document viewer, approval terms
// (commission), review-notes timeline, and a sticky action bar. Approving
// writes an audit record carrying the admin's note (Step 16 Done-when).
import { useEffect, useState } from "react";
import { Alert, Form, Modal } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

import {
  useAddReviewNote,
  useAdminOperator,
  useApproveOperator,
  useReinstateOperator,
  useRejectOperator,
  useSetChecklist,
  useSuspendOperator,
} from "../../api/admin";
import type { ApiError } from "../../api/types";
import { Card, ContentHeader, Timeline } from "../../components/layout/adminlte";
import { ApiErrorAlert, LoadingBlock } from "../../components/shared/backoffice";
import { useLocale } from "../../context/LocaleContext";
import type { AdminOperator, ChecklistKey, ChecklistValue } from "../../types/admin";
import { formatDate, formatDateTime } from "../../utils/time";
import { OperatorStatusBadge } from "./OperatorsPage";

const CHECKS: ChecklistKey[] = ["licence_number", "route_licence", "bank_account", "owner_id"];
const VERDICTS: { value: ChecklistValue; tone: string; icon: string }[] = [
  { value: "verified", tone: "success", icon: "fa-check" },
  { value: "needs_info", tone: "warning", icon: "fa-question" },
  { value: "rejected", tone: "danger", icon: "fa-xmark" },
];
const REJECT_REASONS = ["invalid_licence", "incomplete_documents", "unverifiable_identity", "duplicate", "other"];

function documentKind(url: string | null): "pdf" | "image" | "other" | null {
  if (!url) return null;
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|gif|webp)$/.test(path)) return "image";
  return "other";
}

export function OperatorReviewPage() {
  const { operatorId } = useParams();
  const { t } = useTranslation(["admin", "backoffice"]);
  const { language } = useLocale();
  const operator = useAdminOperator(operatorId);
  const setChecklist = useSetChecklist();
  const addNote = useAddReviewNote();
  const approve = useApproveOperator();
  const reject = useRejectOperator();
  const suspend = useSuspendOperator();
  const reinstate = useReinstateOperator();
  const [commission, setCommission] = useState("");
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const [zoom, setZoom] = useState(1);
  const [dialog, setDialog] = useState<"approve" | "reject" | "suspend" | "reinstate" | null>(null);
  const [reasonKey, setReasonKey] = useState(REJECT_REASONS[0]);
  const [reasonText, setReasonText] = useState("");
  const [flash, setFlash] = useState("");

  const data = operator.data;
  useEffect(() => {
    if (data) setCommission(String(Number(data.commission_rate)));
  }, [data?.public_id]); // eslint-disable-line react-hooks/exhaustive-deps -- seed once per operator

  if (operator.isLoading) return <LoadingBlock />;
  if (!data) return <ApiErrorAlert error={operator.error as unknown as ApiError} className="m-3" />;

  const docKind = documentKind(data.licence_document);
  const reason = [t(`admin:review.reject_reason.${reasonKey}`), reasonText.trim()].filter(Boolean).join(" — ");
  const actionError = (approve.error ?? reject.error ?? suspend.error ?? reinstate.error) as ApiError | null;

  function done(message: string) {
    setDialog(null);
    setFlash(message);
    setNote("");
    setReasonText("");
  }

  function submitDialog() {
    if (!data) return;
    const publicId = data.public_id;
    if (dialog === "approve") {
      approve.mutate({ publicId, body: { commission_rate: commission, note } }, { onSuccess: () => done(t("admin:review.approved")) });
    } else if (dialog === "reject") {
      reject.mutate({ publicId, body: { reason } }, { onSuccess: () => done(t("admin:review.rejected")) });
    } else if (dialog === "suspend") {
      suspend.mutate({ publicId, body: { reason } }, { onSuccess: () => done(t("admin:review.suspended")) });
    } else if (dialog === "reinstate") {
      reinstate.mutate({ publicId, body: { note } }, { onSuccess: () => done(t("admin:review.reinstated")) });
    }
  }

  function postNote(kind: "note" | "info_request") {
    if (!data || !comment.trim()) return;
    addNote.mutate(
      { publicId: data.public_id, body: comment.trim(), kind },
      { onSuccess: () => { setComment(""); setFlash(kind === "info_request" ? t("admin:review.info_requested") : t("admin:review.note_added")); } }
    );
  }

  const displayName = language === "km" ? data.name_km || data.name : data.name;

  return (
    <>
      <ContentHeader
        title={displayName}
        breadcrumbs={[
          { label: t("admin:operators.title"), to: "/admin/operators" },
          { label: t(`admin:operator_status.${data.status}`) },
          { label: displayName },
        ]}
      />
      <section className="content">
        <div className="container-fluid">
          {flash && (
            <Alert variant="success" dismissible onClose={() => setFlash("")} className="py-2">
              {flash}
            </Alert>
          )}
          <div className="row">
            <div className="col-xl-3 col-lg-4">
              <Card>
                <div className="text-center mb-3">
                  <span className="brand-image d-inline-flex align-items-center justify-content-center rounded-circle bg-bbms-tint fs-3 fw-bold" style={{ width: 72, height: 72, color: "#0D5F6E" }}>
                    {data.name.slice(0, 2).toUpperCase()}
                  </span>
                  <h5 className="mt-2 mb-0">{data.name_km || data.name}</h5>
                  <div className="text-muted small">{data.name}</div>
                  <div className="mt-2">
                    <OperatorStatusBadge status={data.status} />
                  </div>
                </div>
                <dl className="small mb-0">
                  <dt>{t("admin:review.owner")}</dt>
                  <dd>{data.owner_name || "—"} · {data.owner_email || "—"}</dd>
                  <dt>{t("admin:operators.phone")}</dt>
                  <dd>{data.contact_phone}{data.contact_email ? ` · ${data.contact_email}` : ""}</dd>
                  <dt>{t("admin:review.address")}</dt>
                  <dd>{data.address || "—"}</dd>
                  <dt>{t("admin:operators.submitted")}</dt>
                  <dd>{formatDate(data.created_at, language)}</dd>
                  <dt>{t("admin:operators.fleet")}</dt>
                  <dd>{t("admin:operators.fleet_value", { routes: data.routes_count, buses: data.buses_count, trips: data.trips_count })}</dd>
                  {data.rejection_reason && (
                    <>
                      <dt>{t("admin:review.last_reason")}</dt>
                      <dd>{data.rejection_reason}</dd>
                    </>
                  )}
                </dl>
              </Card>
            </div>

            <div className="col-xl-6 col-lg-8">
              <Card title={t("admin:review.checklist_title")} bodyClassName="p-0">
                <ul className="list-group list-group-flush">
                  {CHECKS.map((key) => {
                    const value = data.review_checklist[key];
                    const submitted = key === "licence_number" ? data.licence_number : key === "owner_id" ? data.owner_name : "";
                    return (
                      <li key={key} className="list-group-item d-flex flex-wrap align-items-center gap-2">
                        <div className="flex-grow-1">
                          <strong>{t(`admin:review.check.${key}`)}</strong>
                          <div className="small text-muted">{submitted || t("admin:review.see_document")}</div>
                        </div>
                        <div className="btn-group btn-group-sm" role="group" aria-label={t(`admin:review.check.${key}`)}>
                          {VERDICTS.map((verdict) => (
                            <button
                              key={verdict.value}
                              type="button"
                              className={`btn ${value === verdict.value ? `btn-${verdict.tone}` : `btn-outline-${verdict.tone}`}`}
                              aria-pressed={value === verdict.value}
                              disabled={setChecklist.isPending}
                              onClick={() => setChecklist.mutate({ publicId: data.public_id, body: { checklist: { [key]: verdict.value } } })}
                            >
                              <i className={`fas ${verdict.icon} me-1`} aria-hidden="true" />
                              {t(`admin:review.verdict.${verdict.value}`)}
                            </button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <ApiErrorAlert error={setChecklist.error} className="m-2 py-2" />
              </Card>

              <Card
                title={t("admin:review.document_title")}
                tools={
                  docKind === "image" && (
                    <div className="btn-group btn-group-sm">
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} aria-label={t("admin:review.zoom_out")}>
                        <i className="fas fa-magnifying-glass-minus" aria-hidden="true" />
                      </button>
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setZoom(Math.min(3, zoom + 0.25))} aria-label={t("admin:review.zoom_in")}>
                        <i className="fas fa-magnifying-glass-plus" aria-hidden="true" />
                      </button>
                    </div>
                  )
                }
              >
                {!data.licence_document && <p className="text-muted mb-0">{t("admin:review.no_document")}</p>}
                {docKind === "pdf" && (
                  <iframe src={data.licence_document!} title={t("admin:review.document_title")} style={{ width: "100%", height: 520, border: 0 }} />
                )}
                {docKind === "image" && (
                  <div style={{ overflow: "auto", maxHeight: 520 }}>
                    <img src={data.licence_document!} alt={t("admin:review.document_title")} style={{ width: `${zoom * 100}%` }} />
                  </div>
                )}
                {data.licence_document && (
                  <a href={data.licence_document} target="_blank" rel="noreferrer" className="d-inline-block mt-2">
                    <i className="fas fa-up-right-from-square me-1" aria-hidden="true" />
                    {t("admin:review.open_document")}
                  </a>
                )}
              </Card>
            </div>

            <div className="col-xl-3">
              <Card title={t("admin:review.terms_title")}>
                <Form.Group controlId="commission-rate">
                  <Form.Label>{t("admin:review.commission")}</Form.Label>
                  <div className="input-group">
                    <Form.Control type="number" min={0} max={50} step="0.5" value={commission} onChange={(e) => setCommission(e.target.value)} disabled={data.status === "approved"} />
                    <span className="input-group-text">%</span>
                  </div>
                  <Form.Text>{data.status === "approved" ? t("admin:review.commission_locked") : t("admin:review.commission_hint")}</Form.Text>
                </Form.Group>
              </Card>
              <Card title={t("admin:review.notes_title")}>
                <Form.Control as="textarea" rows={2} placeholder={t("admin:review.comment_placeholder")} aria-label={t("admin:review.comment_placeholder")} value={comment} onChange={(e) => setComment(e.target.value)} />
                <div className="d-flex gap-2 mt-2">
                  <button type="button" className="btn btn-sm btn-outline-secondary" disabled={!comment.trim() || addNote.isPending} onClick={() => postNote("note")}>
                    {t("admin:review.add_note")}
                  </button>
                  {data.status === "pending" && (
                    <button type="button" className="btn btn-sm btn-warning" disabled={!comment.trim() || addNote.isPending} onClick={() => postNote("info_request")}>
                      {t("admin:review.request_info")}
                    </button>
                  )}
                </div>
                <p className="small text-muted mt-2 mb-3">{t("admin:review.request_info_hint")}</p>
                <Timeline
                  items={data.review_notes.map((n) => ({
                    id: n.public_id,
                    timestamp: formatDateTime(n.created_at, language),
                    icon: n.kind === "info_request" ? "fas fa-circle-question" : "fas fa-comment",
                    variant: n.kind === "info_request" ? "warning" : "info",
                    content: (
                      <>
                        <strong>{n.author_name || t("admin:review.admin")}</strong>
                        {n.kind === "info_request" && <span className="badge bg-warning text-dark ms-1">{t("admin:review.info_request_badge")}</span>}
                        <div style={{ whiteSpace: "pre-wrap" }}>{n.body}</div>
                      </>
                    ),
                  }))}
                />
              </Card>
            </div>
          </div>
        </div>
        <ActionBar operator={data} onAction={setDialog} />
      </section>

      <Modal show={Boolean(dialog)} onHide={() => setDialog(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title as="h5">{dialog && t(`admin:review.dialog.${dialog}_title`, { name: displayName })}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {(dialog === "reject" || dialog === "suspend") && (
            <>
              <Form.Group className="mb-2" controlId="reject-reason">
                <Form.Label>{t("admin:review.reason")}</Form.Label>
                <Form.Select value={reasonKey} onChange={(e) => setReasonKey(e.target.value)}>
                  {REJECT_REASONS.map((key) => (
                    <option key={key} value={key}>
                      {t(`admin:review.reject_reason.${key}`)}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Control as="textarea" rows={2} maxLength={200} placeholder={t("admin:review.reason_details")} aria-label={t("admin:review.reason_details")} value={reasonText} onChange={(e) => setReasonText(e.target.value)} />
            </>
          )}
          {(dialog === "approve" || dialog === "reinstate") && (
            <>
              {dialog === "approve" && <p>{t("admin:review.dialog.approve_body", { rate: commission })}</p>}
              <Form.Group controlId="approve-note">
                <Form.Label>{t("admin:review.approval_note")}</Form.Label>
                <Form.Control as="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
                <Form.Text>{t("admin:review.audit_hint")}</Form.Text>
              </Form.Group>
            </>
          )}
          <ApiErrorAlert error={actionError} className="py-2 mt-3 mb-0" />
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-secondary" onClick={() => setDialog(null)}>
            {t("backoffice:actions.cancel")}
          </button>
          <button
            type="button"
            className={`btn ${dialog === "approve" || dialog === "reinstate" ? "bbms-cta" : "btn-danger"}`}
            disabled={approve.isPending || reject.isPending || suspend.isPending || reinstate.isPending || (dialog === "approve" && !note.trim())}
            onClick={submitDialog}
          >
            {dialog && t(`admin:review.dialog.${dialog}_confirm`)}
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

function ActionBar({ operator, onAction }: { operator: AdminOperator; onAction: (action: "approve" | "reject" | "suspend" | "reinstate") => void }) {
  const { t } = useTranslation("admin");
  return (
    <div className="bbms-sticky-actions">
      {operator.status === "pending" && (
        <>
          <button type="button" className="btn btn-danger" onClick={() => onAction("reject")}>
            {t("review.reject")}
          </button>
          <button type="button" className="btn bbms-cta" onClick={() => onAction("approve")}>
            {t("review.approve")}
          </button>
        </>
      )}
      {operator.status === "rejected" && (
        <button type="button" className="btn bbms-cta" onClick={() => onAction("approve")}>
          {t("review.approve")}
        </button>
      )}
      {operator.status === "approved" && (
        <button type="button" className="btn btn-danger" onClick={() => onAction("suspend")}>
          {t("review.suspend")}
        </button>
      )}
      {operator.status === "suspended" && (
        <button type="button" className="btn bbms-cta" onClick={() => onAction("reinstate")}>
          {t("review.reinstate")}
        </button>
      )}
    </div>
  );
}
