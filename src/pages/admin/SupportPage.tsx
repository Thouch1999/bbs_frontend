// A5 — support & disputes. Left: queue with category pills, priority dot and
// SLA countdown (unread rows bold with a teal bar). Centre: AdminLTE
// direct-chat thread + reply composer (written in the customer's language,
// sent by SMS). Right: linked booking, refund actions, audit timeline.
import { useEffect, useMemo, useState } from "react";
import { Form } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import { useAdminPayment, useAdminPayments, useAdminTicket, useAdminTickets, useAuditLog, useIssueRefund, useReplyTicket, useUpdateTicket } from "../../api/admin";
import { Card, ContentHeader, Timeline } from "../../components/layout/adminlte";
import { ApiErrorAlert, LoadingBlock, StatusBadge } from "../../components/shared/backoffice";
import { useLocale } from "../../context/LocaleContext";
import type { SupportTicket, TicketCategory } from "../../types/admin";
import { formatMoney } from "../../utils/money";
import { formatDateTime } from "../../utils/time";

const CATEGORIES: (TicketCategory | "all")[] = ["all", "refund_dispute", "payment_failed", "trip_complaint", "account", "other"];
const CANNED = ["received", "refund_processing", "refund_done", "payment_check", "trip_sorry", "closing"];
const CHANNEL_ICON: Record<string, string> = { web: "fas fa-globe", sms: "fas fa-comment-sms", telegram: "fab fa-telegram", email: "fas fa-envelope" };

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function slaLabel(ticket: SupportTicket, now: number, t: (key: string, options?: Record<string, unknown>) => string) {
  if (ticket.status === "resolved") return { text: t("support.resolved"), overdue: false };
  const minutes = Math.round((Date.parse(ticket.sla_due_at) - now) / 60_000);
  if (minutes < 0) return { text: t("support.overdue", { hours: Math.ceil(-minutes / 60) }), overdue: true };
  return { text: minutes < 60 ? t("support.due_minutes", { minutes }) : t("support.due_hours", { hours: Math.floor(minutes / 60) }), overdue: false };
}

export function SupportPage() {
  const { t, i18n } = useTranslation(["admin", "backoffice"]);
  const { language } = useLocale();
  const now = useNow();

  // Canned replies are written in the customer's language, which may not be
  // the one the admin UI loaded — make both available.
  useEffect(() => {
    void i18n.loadLanguages(["km", "en"]);
  }, [i18n]);
  const [category, setCategory] = useState<TicketCategory | "all">("all");
  const [status, setStatus] = useState("open");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tickets = useAdminTickets({ category: category === "all" ? undefined : category, status: status || undefined, search: search.trim() || undefined });
  const ticket = useAdminTicket(selectedId);
  const reply = useReplyTicket();
  const update = useUpdateTicket();
  const [body, setBody] = useState("");
  const [resolve, setResolve] = useState(false);

  const data = ticket.data;
  useEffect(() => {
    setBody("");
    setResolve(false);
    reply.reset();
    if (data?.unread_by_staff) update.mutate({ publicId: data.public_id, body: { mark_read: true } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opened ticket
  }, [data?.public_id]);

  function applyCanned(key: string) {
    if (!data) return;
    // Canned replies are inserted in the customer's language, not the admin's.
    setBody(t(`admin:support.canned.${key}`, { lng: data.language, name: data.contact_name || "" }));
  }

  return (
    <>
      <ContentHeader title={t("admin:support.title")} breadcrumbs={[{ label: t("admin:nav.overview"), to: "/admin" }, { label: t("admin:support.title") }]} />
      <section className="content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-xl-3 col-lg-4">
              <Card title={t("admin:support.queue")} bodyClassName="p-0">
                <div className="p-2 border-bottom">
                  <div className="d-flex flex-wrap gap-1 mb-2">
                    {CATEGORIES.map((c) => (
                      <button key={c} type="button" className={`btn btn-sm ${category === c ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setCategory(c)}>
                        {t(`admin:support.category.${c}`)}
                      </button>
                    ))}
                  </div>
                  <div className="d-flex gap-1">
                    <Form.Select size="sm" aria-label={t("admin:support.status_label")} value={status} onChange={(e) => setStatus(e.target.value)}>
                      <option value="">{t("admin:support.all_statuses")}</option>
                      {["open", "waiting_customer", "resolved"].map((s) => <option key={s} value={s}>{t(`admin:support.status.${s}`)}</option>)}
                    </Form.Select>
                    <Form.Control size="sm" type="search" placeholder={t("admin:support.search")} aria-label={t("admin:support.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                </div>
                <div style={{ maxHeight: "65vh", overflowY: "auto" }}>
                  {tickets.isLoading && <LoadingBlock />}
                  {tickets.data?.length === 0 && <p className="text-muted p-3 mb-0">{t("admin:support.empty")}</p>}
                  {(tickets.data ?? []).map((row) => {
                    const sla = slaLabel(row, now, t);
                    return (
                      <button key={row.public_id} type="button" className={`bbms-ticket-row${row.unread_by_staff ? " is-unread" : ""}${row.public_id === selectedId ? " active" : ""}`} onClick={() => setSelectedId(row.public_id)}>
                        <div className="d-flex align-items-center gap-2">
                          <span className={`bbms-priority-dot is-${row.priority}`} aria-label={t(`admin:support.priority.${row.priority}`)} />
                          <span className="flex-grow-1 text-truncate">{row.contact_name || row.contact_phone}</span>
                          <small className={sla.overdue ? "text-danger fw-bold" : "text-muted"}>{sla.text}</small>
                        </div>
                        <div className="small d-flex gap-1 align-items-center">
                          <span className="badge bg-light text-dark border">{t(`admin:support.category.${row.category}`)}</span>
                          {row.pnr && <code>{row.pnr}</code>}
                        </div>
                        <div className="small text-muted text-truncate fw-normal">{row.last_message_preview}</div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            </div>

            <div className="col-xl-6 col-lg-8">
              {!selectedId && <Card><p className="text-muted mb-0">{t("admin:support.pick")}</p></Card>}
              {selectedId && !data && <LoadingBlock />}
              {data && (
                <Card
                  title={
                    <>
                      {data.subject}
                      <div className="small text-muted fw-normal">{data.contact_name} · {data.contact_phone}</div>
                    </>
                  }
                  tools={
                    <Form.Select size="sm" aria-label={t("admin:support.priority_label")} value={data.priority} style={{ width: "auto" }} onChange={(e) => update.mutate({ publicId: data.public_id, body: { priority: e.target.value } })}>
                      {["high", "normal", "low"].map((p) => <option key={p} value={p}>{t(`admin:support.priority.${p}`)}</option>)}
                    </Form.Select>
                  }
                  footer={
                    <>
                      <div className="d-flex flex-wrap gap-2 mb-2 align-items-center">
                        <Form.Select size="sm" style={{ maxWidth: 260 }} aria-label={t("admin:support.canned_label")} value="" onChange={(e) => e.target.value && applyCanned(e.target.value)}>
                          <option value="">{t("admin:support.canned_label")}</option>
                          {CANNED.map((key) => <option key={key} value={key}>{t(`admin:support.canned_title.${key}`)}</option>)}
                        </Form.Select>
                        <span className="badge bg-light text-dark border" title={t("admin:support.reply_language")}>
                          {data.language === "km" ? "🇰🇭 ខ្មែរ" : "🇬🇧 English"}
                        </span>
                        <small className="text-muted">{t("admin:support.reply_language_hint")}</small>
                      </div>
                      <Form.Control as="textarea" rows={3} aria-label={t("admin:support.reply")} value={body} onChange={(e) => setBody(e.target.value)} />
                      <div className="d-flex align-items-center gap-2 mt-2">
                        <Form.Check id="reply-resolve" label={t("admin:support.resolve_after")} checked={resolve} onChange={(e) => setResolve(e.target.checked)} />
                        <button
                          type="button"
                          className="btn bbms-cta ms-auto"
                          disabled={!body.trim() || reply.isPending}
                          onClick={() => reply.mutate({ publicId: data.public_id, body: body.trim(), resolve }, { onSuccess: () => { setBody(""); setResolve(false); } })}
                        >
                          <i className="fas fa-paper-plane me-1" aria-hidden="true" />
                          {t("admin:support.send")}
                        </button>
                      </div>
                      <ApiErrorAlert error={reply.error} className="py-2 mt-2 mb-0" />
                    </>
                  }
                >
                  <div className="direct-chat-messages">
                    {data.messages.map((m) => (
                      <div key={m.public_id} className={`direct-chat-msg${m.sender === "staff" ? " right" : ""}`}>
                        <div className="direct-chat-text">
                          {m.body}
                          <span className="direct-chat-meta">
                            <i className={`${CHANNEL_ICON[m.channel] ?? "fas fa-comment"} me-1`} aria-label={m.channel} />
                            {m.sender === "staff" ? m.author_name || t("admin:support.staff") : data.contact_name || t("admin:support.customer")} · {formatDateTime(m.created_at, language)}
                            {m.sender === "staff" && <i className="fas fa-check-double ms-1" aria-label={t("admin:support.sent")} />}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="d-flex gap-2 mt-2">
                    <span className="small text-muted">{t(`admin:support.status.${data.status}`)}</span>
                    {data.status !== "resolved" ? (
                      <button type="button" className="btn btn-sm btn-link p-0" onClick={() => update.mutate({ publicId: data.public_id, body: { status: "resolved" } })}>{t("admin:support.mark_resolved")}</button>
                    ) : (
                      <button type="button" className="btn btn-sm btn-link p-0" onClick={() => update.mutate({ publicId: data.public_id, body: { status: "open" } })}>{t("admin:support.reopen")}</button>
                    )}
                  </div>
                </Card>
              )}
            </div>

            <div className="col-xl-3">{data?.pnr && data.booking_public_id && <BookingSide pnr={data.pnr} bookingId={data.booking_public_id} />}</div>
          </div>
        </div>
      </section>
    </>
  );
}

function BookingSide({ pnr, bookingId }: { pnr: string; bookingId: string }) {
  const { t } = useTranslation(["admin", "operator", "backoffice"]);
  const { language } = useLocale();
  const payments = useAdminPayments({ search: pnr });
  const paid = useMemo(() => (payments.data?.results ?? []).find((p) => p.status === "succeeded"), [payments.data]);
  const detail = useAdminPayment(paid?.public_id ?? null);
  const audit = useAuditLog({ booking: bookingId });
  const refund = useIssueRefund();
  const [amount, setAmount] = useState("");
  const refundable = detail.data?.refundable ?? "0";
  const currency = paid?.currency ?? "USD";

  return (
    <>
      <Card title={t("admin:support.booking_title")}>
        {!paid && payments.isLoading && <LoadingBlock />}
        <dl className="small mb-0">
          <dt>PNR</dt>
          <dd><code>{pnr}</code></dd>
          {paid && (
            <>
              <dt>{t("admin:reports.operator")}</dt>
              <dd>{paid.operator_name}</dd>
              <dt>{t("admin:recon.amount")}</dt>
              <dd>{formatMoney(paid.amount, paid.currency, language)} · {t(`operator:payment_method.${paid.provider}`, { defaultValue: paid.provider })}</dd>
              <dt>{t("admin:recon.status")}</dt>
              <dd><StatusBadge status={paid.booking_status} /></dd>
            </>
          )}
          {!paid && !payments.isLoading && <dd className="text-muted">{t("admin:support.no_payment")}</dd>}
        </dl>
      </Card>
      {paid && Number(refundable) > 0 && (
        <Card title={t("admin:support.refund_title")}>
          <p className="small">{t("admin:recon.refundable", { amount: formatMoney(refundable, currency, language) })}</p>
          <button
            type="button"
            className="btn bbms-cta w-100 mb-2"
            disabled={refund.isPending}
            onClick={() => window.confirm(t("admin:support.confirm_full_refund")) && refund.mutate({ paymentId: paid.public_id, amount: refundable, reason: t("admin:support.refund_reason_full") })}
          >
            {t("admin:support.full_refund")}
          </button>
          <div className="input-group input-group-sm">
            <span className="input-group-text">{currency === "USD" ? "$" : "៛"}</span>
            <Form.Control type="number" min="0.01" step="0.01" max={refundable} aria-label={t("admin:support.partial_refund")} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button
              type="button"
              className="btn btn-outline-primary"
              disabled={!amount || Number(amount) <= 0 || Number(amount) > Number(refundable) || refund.isPending}
              onClick={() => refund.mutate({ paymentId: paid.public_id, amount: Number(amount).toFixed(2), reason: t("admin:support.refund_reason_partial") }, { onSuccess: () => setAmount("") })}
            >
              {t("admin:support.partial_refund")}
            </button>
          </div>
          <ApiErrorAlert error={refund.error} className="py-2 mt-2 mb-0" />
        </Card>
      )}
      <Card title={t("admin:support.audit_title")}>
        {(audit.data?.results ?? []).length === 0 ? (
          <p className="small text-muted mb-0">{t("admin:support.no_audit")}</p>
        ) : (
          <Timeline
            items={(audit.data?.results ?? []).map((entry) => ({
              id: entry.public_id,
              timestamp: formatDateTime(entry.created_at, language),
              content: (
                <span className="small">
                  <strong>{t(`admin:audit_action.${entry.action}`, { defaultValue: entry.action })}</strong> — {entry.actor_name || t("admin:audit.system")}
                </span>
              ),
            }))}
          />
        )}
      </Card>
    </>
  );
}
