// Cities are platform-wide reference data (not operator-owned) — origin/
// destination for every route across every operator. Deactivating hides a
// city from the public search/route pickers without deleting it; deleting
// is blocked server-side (409) while any stop or route still references it.
import { useState } from "react";
import { Alert, Form, Modal } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import { cityApi } from "../../api/admin";
import type { ApiError } from "../../api/types";
import { Card, ContentHeader } from "../../components/layout/adminlte";
import { DataTable, type Column } from "../../components/shared/DataTable";
import { ApiErrorAlert } from "../../components/shared/backoffice";
import type { AdminCity } from "../../types/admin";

const EMPTY_CITY: Partial<AdminCity> = { name_en: "", name_km: "", country_code: "KH", is_active: true };

export function CitiesPage() {
  const { t } = useTranslation(["admin", "backoffice"]);
  const [flash, setFlash] = useState("");
  const [editing, setEditing] = useState<Partial<AdminCity> | null>(null);

  const cities = cityApi.useList();
  const save = cityApi.useSave();
  const remove = cityApi.useDelete();

  const columns: Column<AdminCity>[] = [
    { key: "name_en", header: t("admin:cities.name_en"), render: (c) => c.name_en, sortValue: (c) => c.name_en },
    { key: "name_km", header: t("admin:cities.name_km"), render: (c) => c.name_km },
    { key: "country_code", header: t("admin:cities.country"), render: (c) => c.country_code },
    {
      key: "active",
      header: t("admin:content.active"),
      render: (c) => (
        <Form.Check
          type="switch"
          id={`city-active-${c.public_id}`}
          aria-label={t("admin:content.active")}
          checked={c.is_active}
          onChange={(e) => save.mutate({ publicId: c.public_id, body: { is_active: e.target.checked } })}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      render: (c) => (
        <div className="btn-group btn-group-sm">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => setEditing(c)}
            aria-label={t("admin:content.edit")}
            title={t("admin:content.edit")}
          >
            <i className="fas fa-pen" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={() => window.confirm(t("admin:content.confirm_delete")) && remove.mutate(c.public_id)}
            aria-label={t("backoffice:actions.delete")}
            title={t("backoffice:actions.delete")}
          >
            <i className="fas fa-trash" aria-hidden="true" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <ContentHeader
        title={t("admin:cities.title")}
        breadcrumbs={[{ label: t("admin:nav.overview"), to: "/admin" }, { label: t("admin:cities.title") }]}
      />
      <section className="content">
        <div className="container-fluid">
          {flash && <Alert variant="success" dismissible onClose={() => setFlash("")} className="py-2">{flash}</Alert>}
          <Card
            outline
            variant="primary"
            title={t("admin:cities.title")}
            tools={
              <button type="button" className="btn btn-sm bbms-cta" onClick={() => setEditing({ ...EMPTY_CITY })}>
                <i className="fas fa-plus me-1" aria-hidden="true" />
                {t("admin:cities.create")}
              </button>
            }
          >
            <ApiErrorAlert error={(cities.error ?? remove.error) as ApiError | null} />
            <DataTable
              rows={cities.data ?? []}
              columns={columns}
              rowKey={(c) => c.public_id}
              isLoading={cities.isLoading}
              empty={t("admin:cities.empty")}
            />
          </Card>
        </div>
      </section>

      <Modal show={Boolean(editing)} onHide={() => setEditing(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title as="h5">{editing?.public_id ? t("admin:cities.edit") : t("admin:cities.create")}</Modal.Title>
        </Modal.Header>
        {editing && (
          <Modal.Body>
            <Form.Group className="mb-2" controlId="city-name-en">
              <Form.Label>{t("admin:cities.name_en")}</Form.Label>
              <Form.Control value={editing.name_en} onChange={(e) => setEditing({ ...editing, name_en: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-2" controlId="city-name-km">
              <Form.Label>{t("admin:cities.name_km")}</Form.Label>
              <Form.Control value={editing.name_km} onChange={(e) => setEditing({ ...editing, name_km: e.target.value })} />
            </Form.Group>
            <Form.Group controlId="city-country">
              <Form.Label>{t("admin:cities.country")}</Form.Label>
              <Form.Control
                value={editing.country_code}
                maxLength={2}
                className="text-uppercase"
                style={{ maxWidth: 100 }}
                onChange={(e) => setEditing({ ...editing, country_code: e.target.value.toUpperCase() })}
              />
            </Form.Group>
            <ApiErrorAlert error={save.error} className="py-2 mt-3 mb-0" />
          </Modal.Body>
        )}
        <Modal.Footer>
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
            {t("backoffice:actions.cancel")}
          </button>
          <button
            type="button"
            className="btn bbms-cta"
            disabled={!editing?.name_en || !editing?.name_km || !editing?.country_code || save.isPending}
            onClick={() =>
              editing &&
              save.mutate(
                { publicId: editing.public_id, body: editing },
                { onSuccess: () => { setEditing(null); setFlash(t("admin:content.saved")); } }
              )
            }
          >
            {t("backoffice:actions.save")}
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
