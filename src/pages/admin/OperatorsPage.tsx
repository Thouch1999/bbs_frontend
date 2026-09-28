// Operator queue: status tabs (pending first) + search; each row opens A2.
import { useEffect, useState } from "react";
import { Form } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAdminOperators } from "../../api/admin";
import { Card, ContentHeader } from "../../components/layout/adminlte";
import { DataTable, type Column } from "../../components/shared/DataTable";
import { ApiErrorAlert } from "../../components/shared/backoffice";
import { useLocale } from "../../context/LocaleContext";
import type { AdminOperator, OperatorStatus } from "../../types/admin";
import { formatDate } from "../../utils/time";

const STATUSES: OperatorStatus[] = ["pending", "approved", "suspended", "rejected"];
const STATUS_BADGE: Record<OperatorStatus, string> = {
  pending: "bg-warning text-dark",
  approved: "bg-success",
  suspended: "bg-danger",
  rejected: "bg-secondary",
};

export function OperatorStatusBadge({ status }: { status: OperatorStatus }) {
  const { t } = useTranslation("admin");
  return <span className={`badge ${STATUS_BADGE[status]}`}>{t(`operator_status.${status}`)}</span>;
}

export function OperatorsPage() {
  const { t } = useTranslation(["admin", "backoffice"]);
  const { language } = useLocale();
  const navigate = useNavigate();
  const [status, setStatus] = useState<OperatorStatus>("pending");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);
  useEffect(() => setPage(1), [status, debounced]);

  const operators = useAdminOperators({ status, search: debounced || undefined, page });

  const columns: Column<AdminOperator>[] = [
    {
      key: "name",
      header: t("admin:operators.name"),
      render: (op) => (
        <>
          <strong>{language === "km" ? op.name_km || op.name : op.name}</strong>
          <div className="small text-muted">{op.owner_name || op.owner_email}</div>
        </>
      ),
    },
    { key: "phone", header: t("admin:operators.phone"), render: (op) => op.contact_phone },
    { key: "licence", header: t("admin:operators.licence"), render: (op) => op.licence_number || "—" },
    {
      key: "document",
      header: t("admin:operators.document"),
      render: (op) =>
        op.licence_document ? (
          <i className="fas fa-file-circle-check text-success" aria-label={t("admin:overview.document_uploaded")} />
        ) : (
          <i className="fas fa-file-circle-exclamation text-warning" aria-label={t("admin:overview.document_missing")} />
        ),
    },
    { key: "fleet", header: t("admin:operators.fleet"), render: (op) => t("admin:operators.fleet_value", { routes: op.routes_count, buses: op.buses_count, trips: op.trips_count }) },
    { key: "commission", header: t("admin:operators.commission"), render: (op) => `${Number(op.commission_rate)}%` },
    { key: "status", header: t("admin:operators.status"), render: (op) => <OperatorStatusBadge status={op.status} /> },
    { key: "submitted", header: t("admin:operators.submitted"), render: (op) => formatDate(op.created_at, language) },
  ];

  return (
    <>
      <ContentHeader title={t("admin:operators.title")} breadcrumbs={[{ label: t("admin:nav.overview"), to: "/admin" }, { label: t("admin:operators.title") }]} />
      <section className="content">
        <div className="container-fluid">
          <Card
            title={
              <ul className="nav nav-pills">
                {STATUSES.map((s) => (
                  <li className="nav-item" key={s}>
                    <button type="button" className={`nav-link ${status === s ? "active" : ""}`} onClick={() => setStatus(s)}>
                      {t(`admin:operator_status.${s}`)}
                    </button>
                  </li>
                ))}
              </ul>
            }
            tools={
              <Form.Control
                size="sm"
                type="search"
                placeholder={t("admin:operators.search")}
                aria-label={t("admin:operators.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 260 }}
              />
            }
          >
            <ApiErrorAlert error={operators.error as never} />
            <DataTable
              rows={operators.data?.results ?? []}
              columns={columns}
              rowKey={(op) => op.public_id}
              isLoading={operators.isLoading}
              onRowClick={(op) => navigate(`/admin/operators/${op.public_id}`)}
              serverPagination={{ page, pageSize: 20, count: operators.data?.count ?? 0, onPageChange: setPage }}
              empty={t("admin:operators.empty")}
            />
          </Card>
        </div>
      </section>
    </>
  );
}
