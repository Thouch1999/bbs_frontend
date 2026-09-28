// Users: search, filters, detail slide-over with lock/unlock and the one role
// change the API allows here (passenger <-> admin; operator staff roles are
// managed by their operator). Locking logs the user out everywhere.
import { useEffect, useState } from "react";
import { Alert, Form, Offcanvas } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import { useAdminUsers, useUpdateAdminUser } from "../../api/admin";
import { useProfile } from "../../api/profile";
import { Card, ContentHeader } from "../../components/layout/adminlte";
import { DataTable, type Column } from "../../components/shared/DataTable";
import { ApiErrorAlert } from "../../components/shared/backoffice";
import { useLocale } from "../../context/LocaleContext";
import type { AdminUser } from "../../types/admin";
import { formatDate, formatDateTime } from "../../utils/time";

export function UsersPage() {
  const { t } = useTranslation(["admin", "backoffice"]);
  const { language } = useLocale();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [role, setRole] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminUser | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);
  useEffect(() => setPage(1), [debounced, role, active]);

  const users = useAdminUsers({
    search: debounced || undefined,
    role: role || undefined,
    is_active: active === "" ? undefined : active === "active",
    page,
  });

  const columns: Column<AdminUser>[] = [
    {
      key: "name",
      header: t("admin:users.name"),
      render: (u) => (
        <>
          <strong>{u.full_name || "—"}</strong>
          <div className="small text-muted">{u.email}{u.phone ? ` · ${u.phone}` : ""}</div>
        </>
      ),
    },
    {
      key: "role",
      header: t("admin:users.role"),
      render: (u) => (
        <>
          {t(`admin:role.${u.role}`)}
          {u.operator_name && <div className="small text-muted">{u.operator_name} · {t(`backoffice:staff_role.${u.staff_role}`, { defaultValue: u.staff_role })}</div>}
        </>
      ),
    },
    { key: "bookings", header: t("admin:users.bookings"), render: (u) => u.bookings_count },
    { key: "joined", header: t("admin:users.joined"), render: (u) => formatDate(u.created_at, language) },
    { key: "login", header: t("admin:users.last_login"), render: (u) => (u.last_login ? formatDateTime(u.last_login, language) : "—") },
    {
      key: "status",
      header: t("admin:users.status"),
      render: (u) => <span className={`badge ${u.is_active ? "bg-success" : "bg-danger"}`}>{u.is_active ? t("admin:users.active") : t("admin:users.locked")}</span>,
    },
  ];

  return (
    <>
      <ContentHeader title={t("admin:users.title")} breadcrumbs={[{ label: t("admin:nav.overview"), to: "/admin" }, { label: t("admin:users.title") }]} />
      <section className="content">
        <div className="container-fluid">
          <Card>
            <div className="row g-2 mb-3">
              <div className="col-md-5">
                <Form.Control size="sm" type="search" placeholder={t("admin:users.search")} aria-label={t("admin:users.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="col-md-3 col-6">
                <Form.Select size="sm" aria-label={t("admin:users.role")} value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="">{t("admin:users.all_roles")}</option>
                  {["passenger", "operator_staff", "admin"].map((r) => (
                    <option key={r} value={r}>{t(`admin:role.${r}`)}</option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-3 col-6">
                <Form.Select size="sm" aria-label={t("admin:users.status")} value={active} onChange={(e) => setActive(e.target.value)}>
                  <option value="">{t("admin:users.all_statuses")}</option>
                  <option value="active">{t("admin:users.active")}</option>
                  <option value="locked">{t("admin:users.locked")}</option>
                </Form.Select>
              </div>
            </div>
            <ApiErrorAlert error={users.error as never} />
            <DataTable
              rows={users.data?.results ?? []}
              columns={columns}
              rowKey={(u) => u.public_id}
              isLoading={users.isLoading}
              onRowClick={setSelected}
              serverPagination={{ page, pageSize: 20, count: users.data?.count ?? 0, onPageChange: setPage }}
            />
          </Card>
        </div>
      </section>
      <UserDetail user={selected} onClose={() => setSelected(null)} onChanged={setSelected} />
    </>
  );
}

function UserDetail({ user, onClose, onChanged }: { user: AdminUser | null; onClose: () => void; onChanged: (u: AdminUser) => void }) {
  const { t } = useTranslation(["admin", "backoffice"]);
  const { language } = useLocale();
  const me = useProfile();
  const update = useUpdateAdminUser();
  const [message, setMessage] = useState("");
  useEffect(() => {
    setMessage("");
    update.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset per user
  }, [user?.public_id]);

  const isSelf = user?.public_id === me.data?.public_id;

  function apply(body: { is_active?: boolean; role?: string }, done: string) {
    if (!user) return;
    update.mutate({ publicId: user.public_id, body }, { onSuccess: (updated) => { onChanged(updated); setMessage(done); } });
  }

  return (
    <Offcanvas show={Boolean(user)} onHide={onClose} placement="end" style={{ width: 420, maxWidth: "100vw" }}>
      <Offcanvas.Header closeButton>
        <Offcanvas.Title as="h5">{user?.full_name || user?.email}</Offcanvas.Title>
      </Offcanvas.Header>
      {user && (
        <Offcanvas.Body>
          {message && <Alert variant="success" className="py-2">{message}</Alert>}
          <dl className="row small">
            <dt className="col-5">{t("admin:users.email")}</dt>
            <dd className="col-7">{user.email}</dd>
            <dt className="col-5">{t("admin:users.phone")}</dt>
            <dd className="col-7">{user.phone || "—"}</dd>
            <dt className="col-5">{t("admin:users.role")}</dt>
            <dd className="col-7">{t(`admin:role.${user.role}`)}</dd>
            <dt className="col-5">{t("admin:users.language")}</dt>
            <dd className="col-7">{user.preferred_language === "km" ? "ខ្មែរ" : "English"}</dd>
            <dt className="col-5">{t("admin:users.bookings")}</dt>
            <dd className="col-7">{user.bookings_count}</dd>
            <dt className="col-5">{t("admin:users.joined")}</dt>
            <dd className="col-7">{formatDate(user.created_at, language)}</dd>
          </dl>
          {isSelf ? (
            <Alert variant="info" className="py-2 small">{t("admin:users.self_note")}</Alert>
          ) : (
            <div className="d-grid gap-2">
              {user.is_active ? (
                <button type="button" className="btn btn-danger" disabled={update.isPending} onClick={() => apply({ is_active: false }, t("admin:users.locked_done"))}>
                  <i className="fas fa-lock me-1" aria-hidden="true" />
                  {t("admin:users.lock")}
                </button>
              ) : (
                <button type="button" className="btn btn-success" disabled={update.isPending} onClick={() => apply({ is_active: true }, t("admin:users.unlocked_done"))}>
                  <i className="fas fa-lock-open me-1" aria-hidden="true" />
                  {t("admin:users.unlock")}
                </button>
              )}
              {user.role === "passenger" && (
                <button type="button" className="btn btn-outline-primary" disabled={update.isPending} onClick={() => apply({ role: "admin" }, t("admin:users.role_done"))}>
                  {t("admin:users.make_admin")}
                </button>
              )}
              {user.role === "admin" && (
                <button type="button" className="btn btn-outline-secondary" disabled={update.isPending} onClick={() => apply({ role: "passenger" }, t("admin:users.role_done"))}>
                  {t("admin:users.remove_admin")}
                </button>
              )}
              {user.role === "operator_staff" && <p className="small text-muted mb-0">{t("admin:users.staff_note")}</p>}
              <p className="small text-muted mb-0">{t("admin:users.lock_hint")}</p>
            </div>
          )}
          <ApiErrorAlert error={update.error} className="py-2 mt-3" />
        </Offcanvas.Body>
      )}
    </Offcanvas>
  );
}
