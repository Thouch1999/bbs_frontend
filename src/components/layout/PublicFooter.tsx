import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

// Extracted from PublicLayout (Stitch reference: every passenger mockup
// shares one footer — a support CTA strip + a link/payment-method grid).
// Only internal routes are linked; no external URLs are guessed here.
const PAYMENT_METHODS: { icon: string; label: string }[] = [
  { icon: "fas fa-building-columns", label: "ABA PayWay" },
  { icon: "fas fa-mobile-screen", label: "Wing" },
  { icon: "fas fa-money-check-dollar", label: "ACLEDA" },
  { icon: "fas fa-cash-register", label: "Counter" },
];

export function PublicFooter() {
  const { t } = useTranslation();

  return (
    <footer className="border-top bg-white">
      <div className="container mt-4">
        <div className="bg-primary text-white rounded-3 p-3 p-lg-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-3">
            <span
              className="rounded-circle bg-white text-primary d-inline-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: "3rem", height: "3rem" }}
              aria-hidden="true"
            >
              <i className="fas fa-headset fs-5" />
            </span>
            <div>
              <div className="fw-semibold">{t("footer.help_cta")}</div>
              <div className="small opacity-75">{t("footer.help_cta_body")}</div>
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <a
              href="https://t.me/bbmscambodia"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-light btn-sm d-inline-flex align-items-center gap-2"
            >
              <i className="fab fa-telegram" aria-hidden="true" />
              {t("footer.telegram_handle")}
            </a>
            <Link to="/support" className="btn btn-sm bbms-cta">
              {t("footer.contact_support")}
            </Link>
          </div>
        </div>
      </div>

      <div className="container py-4">
        <div className="row g-4">
          <div className="col-12 col-md-4">
            <div className="fw-bold mb-2">{t("app_name")}</div>
            <p className="text-muted small mb-0">{t("footer.tagline")}</p>
          </div>

          <div className="col-6 col-md-4">
            <div className="fw-semibold small text-uppercase text-muted mb-2">{t("footer.links_title")}</div>
            <ul className="list-unstyled d-flex flex-column gap-1 mb-0">
              <li>
                <Link to="/" className="link-secondary text-decoration-none">
                  {t("footer.link_home")}
                </Link>
              </li>
              <li>
                <Link to="/my-bookings" className="link-secondary text-decoration-none">
                  {t("footer.link_my_bookings")}
                </Link>
              </li>
              <li>
                <Link to="/support" className="link-secondary text-decoration-none">
                  {t("nav.help")}
                </Link>
              </li>
            </ul>
          </div>

          <div className="col-6 col-md-4">
            <div className="fw-semibold small text-uppercase text-muted mb-2">{t("footer.payment_title")}</div>
            <div className="d-flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => (
                <span
                  key={method.label}
                  className="badge rounded-pill text-bg-light border d-inline-flex align-items-center gap-1 px-2 py-2"
                >
                  <i className={method.icon} aria-hidden="true" />
                  {method.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-top py-3">
        <div className="container text-muted small">
          &copy; {new Date().getFullYear()} {t("app_name")}. {t("footer.rights")}
        </div>
      </div>
    </footer>
  );
}
