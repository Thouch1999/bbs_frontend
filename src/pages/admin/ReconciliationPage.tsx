// A3 — payment reconciliation. Every amount stays in its own currency. A
// "mismatch" (red left border) is a succeeded payment the platform's own
// booking record disagrees with; "investigate" compares the two records
// field by field. Batch payouts record money actually sent to operators.
import { useEffect, useState } from "react";
import { Alert, Form, Modal, Offcanvas } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import {
  useAdminOperators,
  useAdminPayment,
  useAdminPayments,
  useIssueRefund,
  useOperatorBalances,
  useReconciliationSummary,
  useRecordPayout,
  type AdminPaymentQuery,
} from "../../api/admin";
import { Card, ContentHeader, InfoBox } from "../../components/layout/adminlte";
import { DataTable, type Column } from "../../components/shared/DataTable";
import { ApiErrorAlert, DualMoney, LoadingBlock } from "../../components/shared/backoffice";
import { useLocale } from "../../context/LocaleContext";
import type { AdminPaymentRow, OperatorBalance, ReconciliationStatus } from "../../types/admin";
import { formatMoney } from "../../utils/money";
import { addDays, formatDateTime, localDateISO } from "../../utils/time";

const STATUS_BADGE: Record<ReconciliationStatus, string> = {
  paid: "bg-success",
  pending: "bg-secondary",
  failed: "bg-danger",
  mismatch: "bg-danger",
};
const PROVIDERS = ["aba_payway", "wing", "acleda", "counter", "mock"];

export function ReconciliationPage() {
  const { t } = useTranslation(["admin", "operator", "backoffice"]);
  const { language } = useLocale();
  const today = localDateISO();
  const [query, setQuery] = useState<AdminPaymentQuery>({ date_from: addDays(today, -29), date_to: today, page: 1, page_size: 25 });
  const [searchText, setSearchText] = useState("");
  const [investigate, setInvestigate] = useState<string | null>(null);
  const [payout, setPayout] = useState<OperatorBalance | null>(null);
  const [flash, setFlash] = useState("");
  const summary = useReconciliationSummary();
  const payments = useAdminPayments(query);
  const balances = useOperatorBalances();
  const operators = useAdminOperators({ status: "approved" });

  useEffect(() => {
    const id = window.setTimeout(() => setQuery((q) => ({ ...q, search: searchText.trim() || undefined, page: 1 })), 300);
    return () => window.clearTimeout(id);
  }, [searchText]);

  const set = (patch: Partial<AdminPaymentQuery>) => setQuery((q) => ({ ...q, ...patch, page: 1 }));
  const money = (row: AdminPaymentRow, value: string) => formatMoney(value, row.currency, language);

  const columns: Column<AdminPaymentRow>[] = [
    {
      key: "txn",
      header: t("admin:recon.txn"),
      render: (r) => (
        <>
          <code>{r.public_id.slice(0, 8)}</code>
          <div className="small text-muted">{r.provider_txn_id || "—"}</div>
        </>
      ),
    },
    { key: "provider", header: t("admin:recon.gateway"), render: (r) => t(`operator:payment_method.${r.provider}`, { defaultValue: r.provider }) },
    { key: "pnr", header: "PNR", render: (r) => <code>{r.pnr}</code> },
    { key: "operator", header: t("admin:reports.operator"), render: (r) => r.operator_name },
    { key: "amount", header: t("admin:recon.amount"), render: (r) => <strong>{money(r, r.amount)}</strong>, className: "text-end" },
    { key: "commission", header: t("admin:recon.commission"), render: (r) => money(r, r.commission), className: "text-end" },
    { key: "net", header: t("admin:recon.net"), render: (r) => money(r, r.net_to_operator), className: "text-end" },
    {
      key: "status",
      header: t("admin:recon.status"),
      render: (r) => (
        <>
          <span className={`badge ${STATUS_BADGE[r.reconciliation_status]}`}>{t(`admin:recon_status.${r.reconciliation_status}`)}</span>
          {r.flags.includes("refund_due") && <span className="badge bg-warning text-dark ms-1">{t("admin:recon_flag.refund_due")}</span>}
        </>
      ),
    },
    { key: "when", header: t("admin:audit.when"), render: (r) => <span className="small">{formatDateTime(r.created_at, language)}</span> },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <button type="button" className={`btn btn-sm ${r.reconciliation_status === "mismatch" ? "btn-danger" : "btn-outline-secondary"}`} onClick={() => setInvestigate(r.public_id)}>
          {t("admin:recon.investigate")}
        </button>
      ),
    },
  ];

  const s = summary.data;
  const mismatches = s?.mismatch_count ?? 0;

  return (
    <>
      <ContentHeader title={t("admin:recon.title")} breadcrumbs={[{ label: t("admin:nav.overview"), to: "/admin" }, { label: t("admin:recon.title") }]} />
      <section className="content">
        <div className="container-fluid">
          {flash && <Alert variant="success" dismissible onClose={() => setFlash("")} className="py-2">{flash}</Alert>}
          {s && (
            <div className="row">
              <div className="col-lg-3 col-sm-6"><InfoBox variant="teal" icon="fas fa-coins" label={t("admin:recon.collected_today")} value={<DualMoney usd={s.collected_today.usd} khr={s.collected_today.khr} />} /></div>
              <div className="col-lg-3 col-sm-6"><InfoBox variant="success" icon="fas fa-building-columns" label={t("admin:recon.paid_out")} value={<DualMoney usd={s.paid_out.usd} khr={s.paid_out.khr} />} /></div>
              <div className="col-lg-3 col-sm-6"><InfoBox variant="orange" icon="fas fa-hourglass-half" label={t("admin:recon.pending_payout")} value={<DualMoney usd={s.pending_payout.usd} khr={s.pending_payout.khr} />} /></div>
              <div className="col-lg-3 col-sm-6">
                <button type="button" className="btn p-0 w-100 text-start border-0 bg-transparent" onClick={() => set({ status: "mismatch" })}>
                  <InfoBox variant={mismatches > 0 ? "danger" : "success"} icon="fas fa-triangle-exclamation" label={t("admin:recon.mismatches")} value={mismatches} />
                </button>
              </div>
            </div>
          )}

          <Card>
            <div className="row g-2">
              <div className="col-md-3 d-flex gap-1 align-items-center">
                <Form.Control size="sm" type="date" aria-label={t("admin:reports.from")} value={query.date_from ?? ""} onChange={(e) => set({ date_from: e.target.value || undefined })} />
                <span aria-hidden="true">–</span>
                <Form.Control size="sm" type="date" aria-label={t("admin:reports.to")} value={query.date_to ?? ""} onChange={(e) => set({ date_to: e.target.value || undefined })} />
              </div>
              <div className="col-md-2 col-6">
                <Form.Select size="sm" aria-label={t("admin:recon.gateway")} value={query.provider ?? ""} onChange={(e) => set({ provider: e.target.value || undefined })}>
                  <option value="">{t("admin:recon.all_gateways")}</option>
                  {PROVIDERS.map((p) => <option key={p} value={p}>{t(`operator:payment_method.${p}`)}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-2 col-6">
                <Form.Select size="sm" aria-label={t("admin:reports.operator")} value={query.operator ?? ""} onChange={(e) => set({ operator: e.target.value || undefined })}>
                  <option value="">{t("admin:recon.all_operators")}</option>
                  {(operators.data?.results ?? []).map((op) => <option key={op.public_id} value={op.public_id}>{op.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-2 col-6">
                <Form.Select size="sm" aria-label={t("admin:recon.status")} value={query.status ?? ""} onChange={(e) => set({ status: e.target.value || undefined })}>
                  <option value="">{t("admin:recon.all_statuses")}</option>
                  {(["paid", "pending", "failed", "mismatch"] as const).map((st) => <option key={st} value={st}>{t(`admin:recon_status.${st}`)}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-1 col-6">
                <Form.Select size="sm" aria-label={t("operator:charts.currency")} value={query.currency ?? ""} onChange={(e) => set({ currency: e.target.value || undefined })}>
                  <option value="">៛/$</option>
                  <option value="KHR">៛</option>
                  <option value="USD">$</option>
                </Form.Select>
              </div>
              <div className="col-md-2">
                <Form.Control size="sm" type="search" placeholder={t("admin:recon.search")} aria-label={t("admin:recon.search")} value={searchText} onChange={(e) => setSearchText(e.target.value)} />
              </div>
            </div>
          </Card>

          <Card title={t("admin:recon.transactions")}>
            <ApiErrorAlert error={payments.error as never} />
            <DataTable
              rows={payments.data?.results ?? []}
              columns={columns}
              rowKey={(r) => r.public_id}
              isLoading={payments.isLoading}
              rowClassName={(r) => (r.reconciliation_status === "mismatch" ? "is-mismatch" : "")}
              serverPagination={{ page: query.page ?? 1, pageSize: 25, count: payments.data?.count ?? 0, onPageChange: (page) => setQuery((q) => ({ ...q, page })) }}
              empty={t("admin:recon.empty")}
            />
          </Card>

          <Card title={t("admin:recon.payouts_title")}>
            <p className="small text-muted">{t("admin:recon.payouts_help")}</p>
            <DataTable
              rows={balances.data ?? []}
              columns={[
                { key: "operator", header: t("admin:reports.operator"), render: (b: OperatorBalance) => <strong>{b.operator_name}</strong>, sortValue: (b) => b.operator_name },
                { key: "bookings", header: t("admin:overview.bookings"), render: (b) => b.bookings_count },
                { key: "earned", header: t("admin:recon.earned"), render: (b) => formatMoney(b.earned, b.currency, language), className: "text-end" },
                { key: "paid", header: t("admin:recon.paid_out"), render: (b) => formatMoney(b.paid_out, b.currency, language), className: "text-end" },
                { key: "outstanding", header: t("admin:recon.outstanding"), render: (b) => <strong>{formatMoney(b.outstanding, b.currency, language)}</strong>, className: "text-end", sortValue: (b) => Number(b.outstanding) },
                { key: "last", header: t("admin:recon.last_payout"), render: (b) => (b.last_paid_at ? formatDateTime(b.last_paid_at, language) : "—") },
                {
                  key: "action",
                  header: "",
                  render: (b) => (
                    <button type="button" className="btn btn-sm bbms-cta" disabled={Number(b.outstanding) <= 0} onClick={() => setPayout(b)}>
                      {t("admin:recon.mark_paid")}
                    </button>
                  ),
                },
              ]}
              rowKey={(b) => `${b.operator_public_id}-${b.currency}`}
              isLoading={balances.isLoading}
              toolbar={false}
            />
          </Card>
        </div>
      </section>
      <InvestigatePanel paymentId={investigate} onClose={() => setInvestigate(null)} onRefunded={() => setFlash(t("admin:recon.refunded"))} />
      <PayoutModal balance={payout} onClose={() => setPayout(null)} onDone={() => { setPayout(null); setFlash(t("admin:recon.payout_recorded")); }} />
    </>
  );
}

function InvestigatePanel({ paymentId, onClose, onRefunded }: { paymentId: string | null; onClose: () => void; onRefunded: () => void }) {
  const { t } = useTranslation(["admin", "operator", "backoffice"]);
  const { language } = useLocale();
  const payment = useAdminPayment(paymentId);
  const refund = useIssueRefund();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const p = payment.data;
  useEffect(() => {
    setAmount(p?.refundable && Number(p.refundable) > 0 ? p.refundable : "");
    setReason("");
    refund.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset per payment
  }, [p?.public_id]);

  const compare = p
    ? [
        { key: "amount", platform: formatMoney(p.booking_total_amount, p.booking_currency, language), gateway: formatMoney(p.amount, p.currency, language), differs: p.flags.includes("amount_mismatch") },
        { key: "currency", platform: p.booking_currency, gateway: p.currency, differs: p.flags.includes("currency_mismatch") },
        { key: "status", platform: p.booking_status, gateway: p.status, differs: p.flags.includes("paid_not_confirmed") },
        { key: "txn", platform: p.pnr, gateway: p.provider_txn_id || "—", differs: false },
      ]
    : [];

  return (
    <Offcanvas show={Boolean(paymentId)} onHide={onClose} placement="end" style={{ width: 520, maxWidth: "100vw" }}>
      <Offcanvas.Header closeButton>
        <Offcanvas.Title as="h5">{t("admin:recon.investigate_title")}</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        {!p && <LoadingBlock />}
        {p && (
          <>
            {p.flags.length > 0 && (
              <Alert variant={p.reconciliation_status === "mismatch" ? "danger" : "warning"} className="py-2">
                {p.flags.map((flag) => <div key={flag}>{t(`admin:recon_flag.${flag}`)}</div>)}
                {p.booking_rescheduled_at && <div className="small">{t("admin:recon.rescheduled_note")}</div>}
              </Alert>
            )}
            <table className="table table-sm bbms-table">
              <thead>
                <tr>
                  <th />
                  <th>{t("admin:recon.platform_record")}</th>
                  <th>{t("admin:recon.gateway_record")}</th>
                </tr>
              </thead>
              <tbody>
                {compare.map((row) => (
                  <tr key={row.key} className={row.differs ? "table-danger" : ""}>
                    <th>{t(`admin:recon.field.${row.key}`)}</th>
                    <td className={row.differs ? "text-danger fw-bold" : ""}>{row.platform}</td>
                    <td className={row.differs ? "text-danger fw-bold" : ""}>{row.gateway}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h6>{t("admin:recon.refunds")}</h6>
            {p.refunds.length === 0 ? (
              <p className="small text-muted">{t("admin:recon.no_refunds")}</p>
            ) : (
              <ul className="small">
                {p.refunds.map((r) => (
                  <li key={r.public_id}>{formatMoney(r.amount, p.currency, language)} · {r.status} · {formatDateTime(r.created_at, language)} {r.reason && `— ${r.reason}`}</li>
                ))}
              </ul>
            )}
            {p.status === "succeeded" && Number(p.refundable) > 0 && (
              <div className="border rounded p-2 mb-3">
                <div className="small mb-2">{t("admin:recon.refundable", { amount: formatMoney(p.refundable, p.currency, language) })}</div>
                <div className="d-flex gap-2">
                  <Form.Control size="sm" type="number" min="0.01" step="0.01" max={p.refundable} aria-label={t("admin:recon.amount")} value={amount} onChange={(e) => setAmount(e.target.value)} />
                  <Form.Control size="sm" placeholder={t("admin:recon.refund_reason")} aria-label={t("admin:recon.refund_reason")} value={reason} onChange={(e) => setReason(e.target.value)} />
                  <button
                    type="button"
                    className="btn btn-sm bbms-cta text-nowrap"
                    disabled={!amount || Number(amount) <= 0 || Number(amount) > Number(p.refundable) || refund.isPending}
                    onClick={() => refund.mutate({ paymentId: p.public_id, amount: Number(amount).toFixed(2), reason }, { onSuccess: onRefunded })}
                  >
                    {t("admin:recon.refund")}
                  </button>
                </div>
                <ApiErrorAlert error={refund.error} className="py-1 mt-2 mb-0 small" />
              </div>
            )}
            <h6>{t("admin:recon.webhooks")}</h6>
            {p.webhook_logs.length === 0 ? (
              <p className="small text-muted">{t("admin:recon.no_webhooks")}</p>
            ) : (
              p.webhook_logs.map((w) => (
                <details key={w.public_id} className="small mb-2">
                  <summary>
                    {formatDateTime(w.created_at, language)} · {w.signature_valid ? t("admin:recon.signature_ok") : t("admin:recon.signature_bad")} {w.note && `· ${w.note}`}
                  </summary>
                  <pre className="bg-light p-2 mb-0" style={{ whiteSpace: "pre-wrap" }}>{w.raw_body}</pre>
                </details>
              ))
            )}
            <h6>{t("admin:recon.raw_payload")}</h6>
            <pre className="bg-light p-2 small" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(p.raw_payload, null, 2)}</pre>
          </>
        )}
      </Offcanvas.Body>
    </Offcanvas>
  );
}

function PayoutModal({ balance, onClose, onDone }: { balance: OperatorBalance | null; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation(["admin", "backoffice"]);
  const { language } = useLocale();
  const record = useRecordPayout();
  const today = localDateISO();
  const [amount, setAmount] = useState("");
  const [periodStart, setPeriodStart] = useState(addDays(today, -6));
  const [periodEnd, setPeriodEnd] = useState(today);
  const [reference, setReference] = useState("");
  useEffect(() => {
    setAmount(balance?.outstanding ?? "");
    setReference("");
    record.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset per balance row
  }, [balance?.operator_public_id, balance?.currency]);

  return (
    <Modal show={Boolean(balance)} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h5">{t("admin:recon.payout_title", { operator: balance?.operator_name })}</Modal.Title>
      </Modal.Header>
      {balance && (
        <Modal.Body>
          <p>{t("admin:recon.payout_outstanding", { amount: formatMoney(balance.outstanding, balance.currency, language) })}</p>
          <div className="row g-2">
            <Form.Group className="col-6" controlId="payout-amount">
              <Form.Label>{t("admin:recon.amount")} ({balance.currency})</Form.Label>
              <Form.Control type="number" min="0.01" step="0.01" max={balance.outstanding} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Form.Group>
            <Form.Group className="col-6" controlId="payout-reference">
              <Form.Label>{t("admin:recon.reference")}</Form.Label>
              <Form.Control value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} />
            </Form.Group>
            <Form.Group className="col-6" controlId="payout-start">
              <Form.Label>{t("admin:reports.from")}</Form.Label>
              <Form.Control type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </Form.Group>
            <Form.Group className="col-6" controlId="payout-end">
              <Form.Label>{t("admin:reports.to")}</Form.Label>
              <Form.Control type="date" value={periodEnd} min={periodStart} onChange={(e) => setPeriodEnd(e.target.value)} />
            </Form.Group>
          </div>
          <p className="small text-muted mt-2 mb-0">{t("admin:recon.payout_confirm_hint")}</p>
          <ApiErrorAlert error={record.error} className="py-2 mt-2 mb-0" />
        </Modal.Body>
      )}
      <Modal.Footer>
        <button type="button" className="btn btn-secondary" onClick={onClose}>{t("backoffice:actions.cancel")}</button>
        <button
          type="button"
          className="btn bbms-cta"
          disabled={!balance || !amount || Number(amount) <= 0 || record.isPending}
          onClick={() =>
            balance &&
            record.mutate(
              { operator_id: balance.operator_public_id, currency: balance.currency, amount: Number(amount).toFixed(2), period_start: periodStart, period_end: periodEnd, reference },
              { onSuccess: onDone }
            )
          }
        >
          {t("admin:recon.mark_paid")}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
