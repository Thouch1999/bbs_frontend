// System audit log (SRS 3.3/7.18): who did what, before/after.
import { useState } from "react";
import { Form } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import { useAuditLog } from "../../api/admin";
import { Card, ContentHeader } from "../../components/layout/adminlte";
import { DataTable, type Column } from "../../components/shared/DataTable";
import { ApiErrorAlert } from "../../components/shared/backoffice";
import { useLocale } from "../../context/LocaleContext";
import type { AuditLogEntry } from "../../types/admin";
import { formatDateTime } from "../../utils/time";

const AUDIT_ACTIONS = [
  "operator_approved",
  "operator_rejected",
  "operator_suspended",
  "operator_reinstated",
  "booking_cancelled",
  "refund_issued",
  "role_changed",
  "user_locked",
  "user_unlocked",
  "trip_status_changed",
  "payout_recorded",
];

function diff(entry: AuditLogEntry): string {
  const keys = new Set([...Object.keys(entry.before ?? {}), ...Object.keys(entry.after ?? {})]);
  return [...keys]
    .map((key) => {
      const before = entry.before?.[key];
      const after = entry.after?.[key];
      return before === undefined ? `${key}: ${String(after)}` : `${key}: ${String(before)} → ${String(after)}`;
    })
    .join(" · ");
}

export function AuditLogPage() {
  const { t } = useTranslation(["admin", "backoffice"]);
  const { language } = useLocale();
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const log = useAuditLog({ action: action || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined, page });

  const columns: Column<AuditLogEntry>[] = [
    { key: "when", header: t("admin:audit.when"), render: (e) => formatDateTime(e.created_at, language) },
    { key: "actor", header: t("admin:audit.actor"), render: (e) => e.actor_name || e.actor_email || t("admin:audit.system") },
    { key: "action", header: t("admin:audit.action"), render: (e) => <span className="badge bg-light text-dark border">{t(`admin:audit_action.${e.action}`, { defaultValue: e.action })}</span> },
    { key: "target", header: t("admin:audit.target"), render: (e) => <span className="small">{e.target_model} <code>{e.target_id.slice(0, 8)}</code></span> },
    { key: "change", header: t("admin:audit.change"), render: (e) => <span className="small" style={{ wordBreak: "break-word" }}>{diff(e)}</span> },
  ];

  return (
    <>
      <ContentHeader title={t("admin:audit.title")} breadcrumbs={[{ label: t("admin:nav.overview"), to: "/admin" }, { label: t("admin:audit.title") }]} />
      <section className="content">
        <div className="container-fluid">
          <Card>
            <div className="row g-2 mb-3">
              <div className="col-md-4">
                <Form.Select size="sm" aria-label={t("admin:audit.action")} value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
                  <option value="">{t("admin:audit.all_actions")}</option>
                  {AUDIT_ACTIONS.map((a) => (
                    <option key={a} value={a}>{t(`admin:audit_action.${a}`)}</option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-5 d-flex gap-1 align-items-center">
                <Form.Control size="sm" type="date" aria-label={t("admin:reports.from")} value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
                <span aria-hidden="true">–</span>
                <Form.Control size="sm" type="date" aria-label={t("admin:reports.to")} value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
              </div>
            </div>
            <ApiErrorAlert error={log.error as never} />
            <DataTable
              rows={log.data?.results ?? []}
              columns={columns}
              rowKey={(e) => e.public_id}
              isLoading={log.isLoading}
              serverPagination={{ page, pageSize: 20, count: log.data?.count ?? 0, onPageChange: setPage }}
            />
          </Card>
        </div>
      </section>
    </>
  );
}
