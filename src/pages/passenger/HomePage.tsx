import { useTranslation } from "react-i18next";

import { PopularRoutes } from "../../components/booking/PopularRoutes";
import { SearchForm } from "../../components/booking/SearchForm";
import { BannerStrip } from "../../components/shared/SiteContent";

const BENEFITS: { icon: string; titleKey: string; bodyKey: string }[] = [
  { icon: "fas fa-bus", titleKey: "home.benefit_operators_title", bodyKey: "home.benefit_operators_body" },
  { icon: "fas fa-qrcode", titleKey: "home.benefit_payment_title", bodyKey: "home.benefit_payment_body" },
  { icon: "fas fa-ticket", titleKey: "home.benefit_ticket_title", bodyKey: "home.benefit_ticket_body" },
];

export function HomePage() {
  const { t } = useTranslation();

  return (
    <div>
      <section className="bg-primary text-white py-5">
        <div className="container">
          <span className="badge rounded-pill bg-white text-primary bg-opacity-75 mb-2 px-3 py-2">
            {t("home.badge")}
          </span>
          <h1 className="fw-bold mb-2">{t("home.headline")}</h1>
          <p className="fs-5 opacity-75 mb-0" style={{ maxWidth: "40rem" }}>
            {t("home.subtitle")}
          </p>
        </div>
      </section>

      <div className="container">
        <div className="bg-white rounded-3 shadow-sm p-3 p-lg-4 position-relative" style={{ marginTop: "-3rem" }}>
          <SearchForm />
        </div>

        <div className="row g-4 mt-1 mb-4">
          {BENEFITS.map((benefit) => (
            <div key={benefit.titleKey} className="col-12 col-md-4">
              <div className="border rounded-3 p-4 h-100">
                <span
                  className="bg-bbms-tint text-primary rounded-3 d-inline-flex align-items-center justify-content-center mb-3"
                  style={{ width: "3rem", height: "3rem" }}
                  aria-hidden="true"
                >
                  <i className={`${benefit.icon} fs-4`} />
                </span>
                <h3 className="h5 fw-bold">{t(benefit.titleKey)}</h3>
                <p className="text-muted mb-0">{t(benefit.bodyKey)}</p>
              </div>
            </div>
          ))}
        </div>

        <PopularRoutes />

        <BannerStrip placement="home" />
      </div>
    </div>
  );
}
