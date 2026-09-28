// Staff: create counter-agent / conductor logins and toggle their
// permissions inline. Owner/manager rows (and your own row) are read-only —
// the API refuses those changes too (protected_staff_member).
import { useState } from "react";
import { Alert, Form, Modal } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import { useCreateStaff, useStaff, useUpdateStaff } from "../../api/operator";
import { useProfile } from "../../api/profile";
import { Card, ContentHeader } from "../../components/layout/adminlte";
import { DataTable, type Column } from "../../components/shared/DataTable";
import { ApiErrorAlert } from "../../components/shared/backoffice";
import { useLocale } from "../../context/LocaleContext";
import type { StaffCreate, StaffMember, StaffUpdate } from "../../types/operator";
import { formatDateTime } from "../../utils/time";

const EDITABLE_ROLES = ["counter_agent", "conductor"];

export function StaffPage() {
  const { t } = useTranslation(["operator", "backoffice"]);
  const { language } = useLocale();
  const staff = useStaff();
  const profile = useProfile();
  const updateStaff = useUpdateStaff();
  const [creating, setCreating] = useState(false);
  const [flash, setFlash] = useState("");

  const editable = (member: StaffMember) => EDITABLE_ROLES.includes(member.staff_role) && member.email !== profile.data?.email;

  function toggle(member: StaffMember, body: StaffUpdate) {
    updateStaff.mutate({ publicId: member.public_id, body });
  }

  const columns: Column<StaffMember>[] = [
    {
      key: "name",
      header: t("operator:staff.name"),
      render: (m) => (
        <>
          <strong>{m.full_name || "—"}</strong>
          <br />
          <small className="text-muted">{m.email}</small>
        </>
      ),
      sortValue: (m) => m.full_name,
    },
    { key: "role", header: t("operator:staff.role"), render: (m) => t(`backoffice:staff_role.${m.staff_role}`), sortValue: (m) => m.staff_role },
    ...(["can_create_bookings", "can_validate_tickets", "is_active"] as const).map(
      (field): Column<StaffMember> => ({
        key: field,
        header: t(`operator:staff.${field}`),
        render: (m) => (
          <Form.Check
            type="switch"
            id={`${field}-${m.public_id}`}
            aria-label={`${t(`operator:staff.${field}`)} — ${m.full_name || m.email}`}
            checked={m[field]}
            disabled={!editable(m) || updateStaff.isPending}
            onChange={(e) => toggle(m, { [field]: e.target.checked })}
          />
        ),
      })
    ),
    { key: "login", header: t("operator:staff.last_login"), render: (m) => (m.last_login ? formatDateTime(m.last_login, language) : t("operator:staff.never")) },
  ];

  return (
    <>
      <ContentHeader title={t("operator:staff.title")} breadcrumbs={[{ label: t("operator:nav.dashboard"), to: "/operator" }, { label: t("operator:staff.title") }]} />
      <section className="content">
        <div className="container-fluid">
          {flash && (
            <Alert variant="success" dismissible onClose={() => setFlash("")} className="py-2">
              {flash}
            </Alert>
          )}
          <Card
            title={t("operator:staff.card_title")}
            tools={
              <button type="button" className="btn btn-sm bbms-cta" onClick={() => setCreating(true)}>
                <i className="fas fa-user-plus me-1" aria-hidden="true" />
                {t("operator:staff.add")}
              </button>
            }
          >
            <ApiErrorAlert error={updateStaff.error} />
            <DataTable rows={staff.data ?? []} columns={columns} rowKey={(m) => m.public_id} isLoading={staff.isLoading} rowClassName={(m) => (m.is_active ? "" : "text-muted")} />
          </Card>
        </div>
      </section>
      <CreateStaffModal
        show={creating}
        onClose={() => setCreating(false)}
        onCreated={(member) => {
          setCreating(false);
          setFlash(t("operator:staff.created", { name: member.full_name, email: member.email }));
        }}
      />
    </>
  );
}

function CreateStaffModal({ show, onClose, onCreated }: { show: boolean; onClose: () => void; onCreated: (member: StaffMember) => void }) {
  const { t } = useTranslation(["operator", "backoffice"]);
  const createStaff = useCreateStaff();
  const initial: StaffCreate = { email: "", full_name: "", password: "", staff_role: "counter_agent", can_create_bookings: true, can_validate_tickets: false };
  const [form, setForm] = useState<StaffCreate>(initial);

  function setRole(role: StaffCreate["staff_role"]) {
    setForm({ ...form, staff_role: role, can_create_bookings: role === "counter_agent", can_validate_tickets: role === "conductor" });
  }

  return (
    <Modal show={show} onHide={onClose} onExited={() => { setForm(initial); createStaff.reset(); }} centered>
      <Form onSubmit={(e) => { e.preventDefault(); createStaff.mutate(form, { onSuccess: onCreated }); }}>
        <Modal.Header closeButton>
          <Modal.Title as="h5">{t("operator:staff.add")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-2" controlId="staff-name">
            <Form.Label>{t("operator:staff.name")}</Form.Label>
            <Form.Control required maxLength={150} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Form.Group>
          <Form.Group className="mb-2" controlId="staff-email">
            <Form.Label>{t("operator:staff.email")}</Form.Label>
            <Form.Control required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" />
          </Form.Group>
          <Form.Group className="mb-2" controlId="staff-password">
            <Form.Label>{t("operator:staff.password")}</Form.Label>
            <Form.Control required type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <Form.Text>{t("operator:staff.password_hint")}</Form.Text>
          </Form.Group>
          <Form.Group className="mb-2" controlId="staff-role">
            <Form.Label>{t("operator:staff.role")}</Form.Label>
            <Form.Select value={form.staff_role} onChange={(e) => setRole(e.target.value as StaffCreate["staff_role"])}>
              <option value="counter_agent">{t("backoffice:staff_role.counter_agent")}</option>
              <option value="conductor">{t("backoffice:staff_role.conductor")}</option>
            </Form.Select>
          </Form.Group>
          <Form.Check type="switch" id="staff-can-book" label={t("operator:staff.can_create_bookings")} checked={Boolean(form.can_create_bookings)} onChange={(e) => setForm({ ...form, can_create_bookings: e.target.checked })} />
          <Form.Check type="switch" id="staff-can-validate" label={t("operator:staff.can_validate_tickets")} checked={Boolean(form.can_validate_tickets)} onChange={(e) => setForm({ ...form, can_validate_tickets: e.target.checked })} />
          <ApiErrorAlert error={createStaff.error} className="py-2 mt-3 mb-0" />
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t("backoffice:actions.cancel")}</button>
          <button type="submit" className="btn bbms-cta" disabled={createStaff.isPending}>{t("backoffice:actions.save")}</button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
