// A4 — content & promotions: banners, promo codes, announcements. Each
// user-facing text is stored once per language (the passenger site shows one
// language at a time), edited on km / en sub-tabs, previewed in the current
// UI language.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, Form, Modal, Nav, Offcanvas, Tab } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import { announcementApi, bannerApi, promoApi, useAdminOperators, useUploadBannerImage } from "../../api/admin";
import type { ApiError } from "../../api/types";
import { Callout, Card, ContentHeader, KpiTile } from "../../components/layout/adminlte";
import { DataTable, type Column } from "../../components/shared/DataTable";
import { ApiErrorAlert } from "../../components/shared/backoffice";
import { useLocale } from "../../context/LocaleContext";
import type { AdminPromoCode, Announcement, Banner } from "../../types/admin";
import { formatMoney } from "../../utils/money";
import { formatDate, formatDateTime, fromLocalInputValue, toLocalInputValue } from "../../utils/time";

type Tabs = "banners" | "promos" | "announcements";

/** A new, inactive banner with the same content (no id, so saving creates one). */
function duplicateOf(banner: Banner): Partial<Banner> {
  const copy: Partial<Banner> = { ...banner, is_active: false };
  delete copy.public_id;
  delete copy.created_at;
  delete copy.image;
  return copy;
}

const toInput = (iso: string | null) => (iso ? toLocalInputValue(iso) : "");
const fromInput = (value: string) => (value ? fromLocalInputValue(value) : null);

function LangTabs({ km, en }: { km: ReactNode; en: ReactNode }) {
  return (
    <Tab.Container defaultActiveKey="km">
      <Nav variant="tabs" className="mb-2">
        <Nav.Item><Nav.Link eventKey="km">ខ្មែរ</Nav.Link></Nav.Item>
        <Nav.Item><Nav.Link eventKey="en">English</Nav.Link></Nav.Item>
      </Nav>
      <Tab.Content>
        <Tab.Pane eventKey="km">{km}</Tab.Pane>
        <Tab.Pane eventKey="en">{en}</Tab.Pane>
      </Tab.Content>
    </Tab.Container>
  );
}

export function ContentPage() {
  const { t } = useTranslation(["admin", "backoffice"]);
  const [tab, setTab] = useState<Tabs>("banners");
  const [flash, setFlash] = useState("");

  const banners = bannerApi.useList();
  const promos = promoApi.useList();
  const announcements = announcementApi.useList();

  const counts = {
    banners: (banners.data ?? []).length,
    promos: (promos.data ?? []).length,
    announcements: (announcements.data ?? []).length,
  };
  const stats = useMemo(() => {
    const activeBanners = (banners.data ?? []).filter((b) => b.is_active);
    const activePromos = (promos.data ?? []).filter((p) => p.is_active);
    const liveAnnouncements = (announcements.data ?? []).filter((a) => a.is_active);
    return {
      activeBanners: activeBanners.length,
      placements: new Set(activeBanners.map((b) => b.placement)).size,
      activePromos: activePromos.length,
      redemptions: activePromos.reduce((sum, p) => sum + p.times_used, 0),
      liveAnnouncements: liveAnnouncements.length,
    };
  }, [banners.data, promos.data, announcements.data]);

  return (
    <>
      <ContentHeader
        title={t("admin:content.title")}
        breadcrumbs={[{ label: t("admin:nav.overview"), to: "/admin" }, { label: t("admin:content.title") }]}
      />
      <section className="content">
        <div className="container-fluid">
          {flash && <Alert variant="success" dismissible onClose={() => setFlash("")} className="py-2">{flash}</Alert>}
          <div className="row">
            <div className="col-lg-4 col-sm-6">
              <KpiTile
                variant="teal"
                icon="fas fa-images"
                value={stats.activeBanners}
                label={t("admin:content.kpi_banners")}
                detail={t("admin:content.kpi_banners_detail", { count: stats.placements })}
              />
            </div>
            <div className="col-lg-4 col-sm-6">
              <KpiTile
                variant="orange"
                icon="fas fa-ticket"
                value={stats.activePromos}
                label={t("admin:content.kpi_promos")}
                detail={t("admin:content.kpi_promos_detail", { count: stats.redemptions })}
              />
            </div>
            <div className="col-lg-4 col-sm-6">
              <KpiTile
                variant="gold"
                icon="fas fa-bullhorn"
                value={stats.liveAnnouncements}
                label={t("admin:content.kpi_announcements")}
                detail={t("admin:content.kpi_announcements_detail")}
              />
            </div>
          </div>
          <Tab.Container activeKey={tab} onSelect={(key) => setTab((key as Tabs) ?? "banners")}>
            <Card
              outline
              variant="primary"
              title={
                <Nav variant="tabs" className="card-header-tabs">
                  {(["banners", "promos", "announcements"] as const).map((key) => (
                    <Nav.Item key={key}>
                      <Nav.Link eventKey={key}>
                        {t(`admin:content.tab.${key}`)}{" "}
                        <span className="badge rounded-pill bbms-content-tab-count ms-1">{counts[key]}</span>
                      </Nav.Link>
                    </Nav.Item>
                  ))}
                </Nav>
              }
            >
              <Tab.Content>
                <Tab.Pane eventKey="banners"><BannersTab onFlash={setFlash} /></Tab.Pane>
                <Tab.Pane eventKey="promos"><PromosTab onFlash={setFlash} /></Tab.Pane>
                <Tab.Pane eventKey="announcements"><AnnouncementsTab onFlash={setFlash} /></Tab.Pane>
              </Tab.Content>
            </Card>
          </Tab.Container>
        </div>
      </section>
    </>
  );
}

// --- Banners -----------------------------------------------------------------
const EMPTY_BANNER: Partial<Banner> = {
  title_km: "", title_en: "", body_km: "", body_en: "", placement: "home", background_color: "#0D5F6E",
  image: null, link_url: "", sort_order: 0, starts_at: null, ends_at: null, is_active: true,
};

/** background_color alone (no image) is shown as a two-tone brand gradient, not a flat fill. */
function bannerGradient(color: string) {
  return `linear-gradient(135deg, ${color}, #08414C)`;
}

function BannersTab({ onFlash }: { onFlash: (m: string) => void }) {
  const { t } = useTranslation(["admin", "backoffice"]);
  const { language } = useLocale();
  const banners = bannerApi.useList();
  const save = bannerApi.useSave();
  const remove = bannerApi.useDelete();
  const uploadImage = useUploadBannerImage();
  const [editing, setEditing] = useState<Partial<Banner> | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  function openEditor(banner: Partial<Banner>) {
    setEditing(banner);
    setImageFile(null);
    setImagePreview(null);
  }

  function pickImage(file: File | null) {
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  return (
    <>
      <div className="d-flex justify-content-end mb-3">
        <button type="button" className="btn btn-sm bbms-cta" onClick={() => openEditor({ ...EMPTY_BANNER })}>
          <i className="fas fa-plus me-1" aria-hidden="true" />{t("admin:content.create_banner")}
        </button>
      </div>
      <ApiErrorAlert error={(banners.error ?? remove.error ?? uploadImage.error) as ApiError | null} />
      <div className="row g-3">
        {(banners.data ?? []).length === 0 && <p className="text-muted">{t("admin:content.no_banners")}</p>}
        {(banners.data ?? []).map((banner) => (
          <div className="col-lg-4 col-md-6" key={banner.public_id}>
            <div className="card h-100 mb-0 bbms-banner-card">
              <div
                className={`bbms-banner-preview${banner.image ? " has-image" : ""}`}
                style={banner.image ? { backgroundImage: `url(${banner.image})` } : { background: bannerGradient(banner.background_color) }}
              >
                <strong>{language === "km" ? banner.title_km : banner.title_en}</strong>
                <div className="small">{language === "km" ? banner.body_km : banner.body_en}</div>
              </div>
              <div className="card-body py-2">
                <span className="badge bg-light text-dark border me-1">{t(`admin:content.placement.${banner.placement}`)}</span>
                <div className="small text-muted mt-1">
                  {banner.starts_at ? formatDate(banner.starts_at, language) : t("admin:content.now")} – {banner.ends_at ? formatDate(banner.ends_at, language) : t("admin:content.no_end")}
                </div>
              </div>
              <div className="card-footer d-flex align-items-center gap-2">
                <Form.Check
                  type="switch"
                  id={`banner-active-${banner.public_id}`}
                  label={t("admin:content.active")}
                  checked={banner.is_active}
                  onChange={(e) => save.mutate({ publicId: banner.public_id, body: { is_active: e.target.checked } })}
                />
                <div className="ms-auto btn-group btn-group-sm">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => openEditor(banner)} aria-label={t("backoffice:actions.save")} title={t("admin:content.edit")}>
                    <i className="fas fa-pen" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn-outline-secondary" onClick={() => openEditor(duplicateOf(banner))} title={t("admin:content.duplicate")} aria-label={t("admin:content.duplicate")}>
                    <i className="fas fa-copy" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn-outline-danger" onClick={() => window.confirm(t("admin:content.confirm_delete")) && remove.mutate(banner.public_id)} title={t("backoffice:actions.delete")} aria-label={t("backoffice:actions.delete")}>
                    <i className="fas fa-trash" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Modal show={Boolean(editing)} onHide={() => setEditing(null)} centered size="lg">
        <Modal.Header closeButton><Modal.Title as="h5">{editing?.public_id ? t("admin:content.edit_banner") : t("admin:content.create_banner")}</Modal.Title></Modal.Header>
        {editing && (
          <Modal.Body>
            <LangTabs
              km={<>
                <Form.Control className="mb-2" placeholder={t("admin:content.title_field")} aria-label={`${t("admin:content.title_field")} (ខ្មែរ)`} value={editing.title_km} onChange={(e) => setEditing({ ...editing, title_km: e.target.value })} />
                <Form.Control placeholder={t("admin:content.body_field")} aria-label={`${t("admin:content.body_field")} (ខ្មែរ)`} value={editing.body_km} onChange={(e) => setEditing({ ...editing, body_km: e.target.value })} />
              </>}
              en={<>
                <Form.Control className="mb-2" placeholder={t("admin:content.title_field")} aria-label={`${t("admin:content.title_field")} (English)`} value={editing.title_en} onChange={(e) => setEditing({ ...editing, title_en: e.target.value })} />
                <Form.Control placeholder={t("admin:content.body_field")} aria-label={`${t("admin:content.body_field")} (English)`} value={editing.body_en} onChange={(e) => setEditing({ ...editing, body_en: e.target.value })} />
              </>}
            />
            <div className="row g-2 mt-1">
              <Form.Group className="col-md-4" controlId="banner-placement">
                <Form.Label>{t("admin:content.placement_label")}</Form.Label>
                <Form.Select value={editing.placement} onChange={(e) => setEditing({ ...editing, placement: e.target.value as Banner["placement"] })}>
                  {(["home", "search", "my_bookings"] as const).map((p) => <option key={p} value={p}>{t(`admin:content.placement.${p}`)}</option>)}
                </Form.Select>
              </Form.Group>
              <Form.Group className="col-md-2" controlId="banner-color">
                <Form.Label>{t("admin:content.color")}</Form.Label>
                <Form.Control type="color" value={editing.background_color} onChange={(e) => setEditing({ ...editing, background_color: e.target.value })} />
              </Form.Group>
              <Form.Group className="col-md-2" controlId="banner-sort-order">
                <Form.Label>{t("admin:content.sort_order")}</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  value={editing.sort_order ?? 0}
                  onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                />
              </Form.Group>
              <Form.Group className="col-md-6" controlId="banner-link">
                <Form.Label>{t("admin:content.link")}</Form.Label>
                <Form.Control value={editing.link_url} placeholder="/search?..." onChange={(e) => setEditing({ ...editing, link_url: e.target.value })} />
              </Form.Group>
              <Form.Group className="col-md-6" controlId="banner-start">
                <Form.Label>{t("admin:content.starts")}</Form.Label>
                <Form.Control type="datetime-local" value={toInput(editing.starts_at ?? null)} onChange={(e) => setEditing({ ...editing, starts_at: fromInput(e.target.value) })} />
              </Form.Group>
              <Form.Group className="col-md-6" controlId="banner-end">
                <Form.Label>{t("admin:content.ends")}</Form.Label>
                <Form.Control type="datetime-local" value={toInput(editing.ends_at ?? null)} onChange={(e) => setEditing({ ...editing, ends_at: fromInput(e.target.value) })} />
              </Form.Group>
              <Form.Group className="col-12" controlId="banner-image">
                <Form.Label>{t("admin:content.image")}</Form.Label>
                <div className="bbms-image-upload">
                  <Form.Control
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => pickImage((e.target as HTMLInputElement).files?.[0] ?? null)}
                  />
                  {(imagePreview || editing.image) && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger flex-shrink-0"
                      onClick={() => {
                        pickImage(null);
                        if (editing.public_id) {
                          save.mutate({ publicId: editing.public_id, body: { image: null } });
                        }
                        setEditing({ ...editing, image: null });
                      }}
                    >
                      {t("admin:content.remove_image")}
                    </button>
                  )}
                </div>
                <Form.Text muted>{t("admin:content.image_hint")}</Form.Text>
              </Form.Group>
            </div>
            <div
              className={`bbms-banner-preview mt-3${imagePreview || editing.image ? " has-image" : ""}`}
              style={
                imagePreview || editing.image
                  ? { backgroundImage: `url(${imagePreview ?? editing.image})` }
                  : { background: bannerGradient(editing.background_color ?? "#0D5F6E") }
              }
              aria-label={t("admin:content.preview")}
            >
              <strong>{language === "km" ? editing.title_km : editing.title_en}</strong>
              <div className="small">{language === "km" ? editing.body_km : editing.body_en}</div>
            </div>
            <ApiErrorAlert error={(save.error ?? uploadImage.error) as ApiError | null} className="py-2 mt-3 mb-0" />
          </Modal.Body>
        )}
        <Modal.Footer>
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>{t("backoffice:actions.cancel")}</button>
          <button
            type="button"
            className="btn bbms-cta"
            disabled={!editing?.title_km || !editing?.title_en || save.isPending || uploadImage.isPending}
            onClick={() => {
              if (!editing) return;
              const body: Partial<Banner> = { ...editing };
              delete body.image;
              save.mutate(
                { publicId: editing.public_id, body },
                {
                  onSuccess: (saved) => {
                    if (imageFile) {
                      uploadImage.mutate(
                        { publicId: saved.public_id, file: imageFile },
                        { onSuccess: () => { setEditing(null); onFlash(t("admin:content.saved")); } }
                      );
                    } else {
                      setEditing(null);
                      onFlash(t("admin:content.saved"));
                    }
                  },
                }
              );
            }}
          >
            {t("backoffice:actions.save")}
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

// --- Promo codes -----------------------------------------------------------------
function PromosTab({ onFlash }: { onFlash: (m: string) => void }) {
  const { t } = useTranslation(["admin", "backoffice"]);
  const { language } = useLocale();
  const promos = promoApi.useList();
  const save = promoApi.useSave();
  const [editing, setEditing] = useState<Partial<AdminPromoCode> | null>(null);

  const columns: Column<AdminPromoCode>[] = [
    { key: "code", header: t("admin:promo.code"), render: (p) => <code className="fw-bold">{p.code}</code>, sortValue: (p) => p.code },
    { key: "desc", header: t("admin:promo.description"), render: (p) => (language === "km" ? p.description_km : p.description_en) || "—" },
    { key: "type", header: t("admin:promo.type"), render: (p) => t(`admin:promo.type_${p.discount_type}`) },
    { key: "value", header: t("admin:promo.value"), render: (p) => (p.discount_type === "percent" ? `${Number(p.value)}%` : formatMoney(p.value, "USD", language)) },
    { key: "min", header: t("admin:promo.min_amount"), render: (p) => (p.min_amount ? formatMoney(p.min_amount, "USD", language) : "—") },
    {
      key: "used",
      header: t("admin:promo.used"),
      render: (p) =>
        p.max_uses ? (
          <div className="bbms-occupancy">
            <div className="small">{p.times_used}/{p.max_uses}</div>
            <div className="progress"><div className="progress-bar" style={{ width: `${Math.min(100, (p.times_used / p.max_uses) * 100)}%` }} /></div>
          </div>
        ) : (
          p.times_used
        ),
      sortValue: (p) => p.times_used,
    },
    { key: "valid", header: t("admin:promo.valid"), render: (p) => <span className="small">{formatDate(p.valid_from, language)} – {formatDate(p.valid_until, language)}</span> },
    { key: "scope", header: t("admin:promo.scope"), render: (p) => p.applicable_operator_name || t("admin:promo.all_operators") },
    {
      key: "active",
      header: t("admin:content.active"),
      render: (p) => (
        <Form.Check type="switch" id={`promo-${p.public_id}`} aria-label={t("admin:content.active")} checked={p.is_active} onChange={(e) => save.mutate({ publicId: p.public_id, body: { is_active: e.target.checked } })} />
      ),
    },
    { key: "edit", header: "", render: (p) => <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditing(p)}><i className="fas fa-pen" aria-hidden="true" /><span className="visually-hidden">{t("admin:content.edit")}</span></button> },
  ];

  const now = new Date();
  return (
    <>
      <div className="d-flex justify-content-end mb-3">
        <button
          type="button"
          className="btn btn-sm bbms-cta"
          onClick={() =>
            setEditing({ code: "", description_km: "", description_en: "", discount_type: "percent", value: "10", valid_from: now.toISOString(), valid_until: new Date(now.getTime() + 30 * 86400_000).toISOString(), is_active: true, applicable_operator_id: null })
          }
        >
          <i className="fas fa-plus me-1" aria-hidden="true" />{t("admin:promo.create")}
        </button>
      </div>
      <DataTable rows={promos.data ?? []} columns={columns} rowKey={(p) => p.public_id} isLoading={promos.isLoading} empty={t("admin:promo.empty")} />
      <PromoForm
        promo={editing}
        saving={save.isPending}
        error={save.error}
        onClose={() => setEditing(null)}
        onChange={setEditing}
        onSave={() =>
          editing &&
          save.mutate(
            { publicId: editing.public_id, body: { ...editing, min_amount: editing.min_amount || null, max_uses: editing.max_uses || null, max_uses_per_customer: editing.max_uses_per_customer || null } },
            { onSuccess: () => { setEditing(null); onFlash(t("admin:content.saved")); } }
          )
        }
      />
    </>
  );
}

function PromoForm({
  promo,
  saving,
  error,
  onClose,
  onChange,
  onSave,
}: {
  promo: Partial<AdminPromoCode> | null;
  saving: boolean;
  error: ApiError | null;
  onClose: () => void;
  onChange: (p: Partial<AdminPromoCode>) => void;
  onSave: () => void;
}) {
  const { t } = useTranslation(["admin", "booking", "backoffice"]);
  const { language } = useLocale();
  const operators = useAdminOperators({ status: "approved" });
  if (!promo) return null;

  // Illustration only: an example $20.00 booking, so the admin sees how the
  // line will read in the passenger fare breakdown (the real discount is
  // always computed server-side by validate_promo_code).
  const exampleSubtotal = 20;
  const value = Number(promo.value || 0);
  const discount = Math.min(exampleSubtotal, promo.discount_type === "percent" ? (exampleSubtotal * value) / 100 : value);
  const description = language === "km" ? promo.description_km : promo.description_en;

  return (
    <Offcanvas show onHide={onClose} placement="end" style={{ width: 480, maxWidth: "100vw" }}>
      <Offcanvas.Header closeButton><Offcanvas.Title as="h5">{promo.public_id ? promo.code : t("admin:promo.create")}</Offcanvas.Title></Offcanvas.Header>
      <Offcanvas.Body>
        <Form.Group className="mb-2" controlId="promo-code">
          <Form.Label>{t("admin:promo.code")}</Form.Label>
          <Form.Control value={promo.code} maxLength={30} className="text-uppercase" onChange={(e) => onChange({ ...promo, code: e.target.value.toUpperCase() })} />
        </Form.Group>
        <Form.Label>{t("admin:promo.description")}</Form.Label>
        <LangTabs
          km={<Form.Control aria-label={`${t("admin:promo.description")} (ខ្មែរ)`} value={promo.description_km} onChange={(e) => onChange({ ...promo, description_km: e.target.value })} />}
          en={<Form.Control aria-label={`${t("admin:promo.description")} (English)`} value={promo.description_en} onChange={(e) => onChange({ ...promo, description_en: e.target.value })} />}
        />
        <div className="row g-2 mt-1">
          <Form.Group className="col-6" controlId="promo-type">
            <Form.Label>{t("admin:promo.type")}</Form.Label>
            <Form.Select value={promo.discount_type} onChange={(e) => onChange({ ...promo, discount_type: e.target.value as AdminPromoCode["discount_type"] })}>
              <option value="percent">{t("admin:promo.type_percent")}</option>
              <option value="fixed">{t("admin:promo.type_fixed")}</option>
            </Form.Select>
          </Form.Group>
          <Form.Group className="col-6" controlId="promo-value">
            <Form.Label>{t("admin:promo.value")} {promo.discount_type === "percent" ? "(%)" : "($)"}</Form.Label>
            <Form.Control type="number" min="0.01" step="0.01" value={promo.value} onChange={(e) => onChange({ ...promo, value: e.target.value })} />
          </Form.Group>
          <Form.Group className="col-4" controlId="promo-min">
            <Form.Label>{t("admin:promo.min_amount")}</Form.Label>
            <Form.Control type="number" min="0" step="0.01" value={promo.min_amount ?? ""} onChange={(e) => onChange({ ...promo, min_amount: e.target.value || null })} />
          </Form.Group>
          <Form.Group className="col-4" controlId="promo-max">
            <Form.Label>{t("admin:promo.max_uses")}</Form.Label>
            <Form.Control type="number" min="1" value={promo.max_uses ?? ""} onChange={(e) => onChange({ ...promo, max_uses: e.target.value ? Number(e.target.value) : null })} />
          </Form.Group>
          <Form.Group className="col-4" controlId="promo-max-customer">
            <Form.Label>{t("admin:promo.per_customer")}</Form.Label>
            <Form.Control type="number" min="1" value={promo.max_uses_per_customer ?? ""} onChange={(e) => onChange({ ...promo, max_uses_per_customer: e.target.value ? Number(e.target.value) : null })} />
          </Form.Group>
          <Form.Group className="col-6" controlId="promo-from">
            <Form.Label>{t("admin:promo.valid_from")}</Form.Label>
            <Form.Control type="datetime-local" value={toInput(promo.valid_from ?? null)} onChange={(e) => onChange({ ...promo, valid_from: fromInput(e.target.value) ?? undefined })} />
          </Form.Group>
          <Form.Group className="col-6" controlId="promo-until">
            <Form.Label>{t("admin:promo.valid_until")}</Form.Label>
            <Form.Control type="datetime-local" value={toInput(promo.valid_until ?? null)} onChange={(e) => onChange({ ...promo, valid_until: fromInput(e.target.value) ?? undefined })} />
          </Form.Group>
          <Form.Group className="col-12" controlId="promo-operator">
            <Form.Label>{t("admin:promo.scope")}</Form.Label>
            <Form.Select value={promo.applicable_operator_id ?? ""} onChange={(e) => onChange({ ...promo, applicable_operator_id: e.target.value || null })}>
              <option value="">{t("admin:promo.all_operators")}</option>
              {(operators.data?.results ?? []).map((op) => <option key={op.public_id} value={op.public_id}>{op.name}</option>)}
            </Form.Select>
          </Form.Group>
        </div>
        <div className="border rounded p-3 mt-3 bg-light">
          <div className="small text-muted mb-2">{t("admin:promo.preview_title")}</div>
          <div className="d-flex justify-content-between"><span>{t("admin:promo.preview_subtotal")}</span><span>{formatMoney(String(exampleSubtotal), "USD", language)}</span></div>
          <div className="d-flex justify-content-between text-success">
            <span>{t("admin:promo.preview_discount", { code: promo.code || "CODE" })}{description ? ` — ${description}` : ""}</span>
            <span>−{formatMoney(discount.toFixed(2), "USD", language)}</span>
          </div>
          <hr className="my-2" />
          <div className="d-flex justify-content-between fw-bold"><span>{t("admin:promo.preview_total")}</span><span>{formatMoney((exampleSubtotal - discount).toFixed(2), "USD", language)}</span></div>
        </div>
        <ApiErrorAlert error={error} className="py-2 mt-3 mb-0" />
      </Offcanvas.Body>
      <div className="border-top p-3 d-flex justify-content-end gap-2">
        <button type="button" className="btn btn-secondary" onClick={onClose}>{t("backoffice:actions.cancel")}</button>
        <button type="button" className="btn bbms-cta" disabled={!promo.code || !promo.value || saving} onClick={onSave}>{t("backoffice:actions.save")}</button>
      </div>
    </Offcanvas>
  );
}

// --- Announcements ---------------------------------------------------------------
function AnnouncementsTab({ onFlash }: { onFlash: (m: string) => void }) {
  const { t } = useTranslation(["admin", "backoffice"]);
  const { language } = useLocale();
  const list = announcementApi.useList();
  const save = announcementApi.useSave();
  const remove = announcementApi.useDelete();
  const [editing, setEditing] = useState<Partial<Announcement> | null>(null);

  useEffect(() => save.reset(), [editing?.public_id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="d-flex justify-content-end mb-3">
        <button type="button" className="btn btn-sm bbms-cta" onClick={() => setEditing({ message_km: "", message_en: "", severity: "info", audience: "all", is_active: true, starts_at: null, ends_at: null })}>
          <i className="fas fa-plus me-1" aria-hidden="true" />{t("admin:announce.create")}
        </button>
      </div>
      {(list.data ?? []).length === 0 && <p className="text-muted">{t("admin:announce.empty")}</p>}
      <ul className="list-group">
        {(list.data ?? []).map((a) => (
          <li key={a.public_id} className="list-group-item d-flex flex-wrap align-items-center gap-2">
            <span className={`badge ${a.severity === "warning" ? "bg-warning text-dark" : "bg-info"}`}>{t(`admin:announce.severity.${a.severity}`)}</span>
            <span className="flex-grow-1">{language === "km" ? a.message_km : a.message_en}</span>
            <span className="small text-muted">{t(`admin:announce.audience.${a.audience}`)} · {a.starts_at ? formatDateTime(a.starts_at, language) : t("admin:content.now")} – {a.ends_at ? formatDateTime(a.ends_at, language) : t("admin:content.no_end")}</span>
            <Form.Check type="switch" id={`ann-${a.public_id}`} aria-label={t("admin:content.active")} checked={a.is_active} onChange={(e) => save.mutate({ publicId: a.public_id, body: { is_active: e.target.checked } })} />
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditing(a)} aria-label={t("admin:content.edit")}><i className="fas fa-pen" aria-hidden="true" /></button>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => window.confirm(t("admin:content.confirm_delete")) && remove.mutate(a.public_id)} aria-label={t("backoffice:actions.delete")}><i className="fas fa-trash" aria-hidden="true" /></button>
          </li>
        ))}
      </ul>
      <Modal show={Boolean(editing)} onHide={() => setEditing(null)} centered>
        <Modal.Header closeButton><Modal.Title as="h5">{editing?.public_id ? t("admin:announce.edit") : t("admin:announce.create")}</Modal.Title></Modal.Header>
        {editing && (
          <Modal.Body>
            <LangTabs
              km={<Form.Control as="textarea" rows={2} aria-label={`${t("admin:announce.message")} (ខ្មែរ)`} value={editing.message_km} onChange={(e) => setEditing({ ...editing, message_km: e.target.value })} />}
              en={<Form.Control as="textarea" rows={2} aria-label={`${t("admin:announce.message")} (English)`} value={editing.message_en} onChange={(e) => setEditing({ ...editing, message_en: e.target.value })} />}
            />
            <div className="row g-2 mt-1">
              <Form.Group className="col-6" controlId="ann-severity">
                <Form.Label>{t("admin:announce.severity_label")}</Form.Label>
                <Form.Select value={editing.severity} onChange={(e) => setEditing({ ...editing, severity: e.target.value as Announcement["severity"] })}>
                  <option value="info">{t("admin:announce.severity.info")}</option>
                  <option value="warning">{t("admin:announce.severity.warning")}</option>
                </Form.Select>
              </Form.Group>
              <Form.Group className="col-6" controlId="ann-audience">
                <Form.Label>{t("admin:announce.audience_label")}</Form.Label>
                <Form.Select value={editing.audience} onChange={(e) => setEditing({ ...editing, audience: e.target.value as Announcement["audience"] })}>
                  {(["all", "passengers", "operators"] as const).map((a) => <option key={a} value={a}>{t(`admin:announce.audience.${a}`)}</option>)}
                </Form.Select>
              </Form.Group>
              <Form.Group className="col-6" controlId="ann-start">
                <Form.Label>{t("admin:content.starts")}</Form.Label>
                <Form.Control type="datetime-local" value={toInput(editing.starts_at ?? null)} onChange={(e) => setEditing({ ...editing, starts_at: fromInput(e.target.value) })} />
              </Form.Group>
              <Form.Group className="col-6" controlId="ann-end">
                <Form.Label>{t("admin:content.ends")}</Form.Label>
                <Form.Control type="datetime-local" value={toInput(editing.ends_at ?? null)} onChange={(e) => setEditing({ ...editing, ends_at: fromInput(e.target.value) })} />
              </Form.Group>
            </div>
            <div className="mt-3">
              <div className="small text-muted mb-1">{t("admin:content.preview")}</div>
              <Callout variant={editing.severity === "warning" ? "warning" : "info"}>{language === "km" ? editing.message_km : editing.message_en}</Callout>
            </div>
            <ApiErrorAlert error={save.error} className="py-2 mb-0" />
          </Modal.Body>
        )}
        <Modal.Footer>
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>{t("backoffice:actions.cancel")}</button>
          <button
            type="button"
            className="btn bbms-cta"
            disabled={!editing?.message_km || !editing?.message_en || save.isPending}
            onClick={() => editing && save.mutate({ publicId: editing.public_id, body: editing }, { onSuccess: () => { setEditing(null); onFlash(t("admin:content.saved")); } })}
          >
            {t("backoffice:actions.save")}
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
