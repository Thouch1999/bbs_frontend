import { useTranslation } from "react-i18next";

import type { PaymentProvider } from "../../types";

// Same hex values as the validated operator dashboard chart palette
// (src/components/operator/charts.tsx PAYMENT_COLORS) — duplicated rather
// than imported, since that file pulls in recharts and must stay out of
// the passenger bundle.
const PROVIDER_ICON: Record<PaymentProvider, { icon: string; color: string }> = {
  aba_payway: { icon: "fas fa-qrcode", color: "#2a78d6" },
  wing: { icon: "fas fa-wallet", color: "#eb6834" },
  acleda: { icon: "fas fa-building-columns", color: "#1baf7a" },
  counter: { icon: "fas fa-store", color: "#eda100" },
  mock: { icon: "fas fa-mobile-screen", color: "#e87ba4" },
};

const AVAILABLE: PaymentProvider[] = ["mock", "counter"];
const NOT_YET_WIRED: PaymentProvider[] = ["aba_payway", "wing", "acleda"];

interface PaymentMethodSelectProps {
  value: PaymentProvider;
  onChange: (provider: PaymentProvider) => void;
}

export function PaymentMethodSelect({ value, onChange }: PaymentMethodSelectProps) {
  const { t } = useTranslation("booking");

  return (
    <div className="border rounded-3 p-3 mb-3">
      <h2 className="h6 fw-bold">{t("payment.title")}</h2>
      <div className="d-flex flex-column gap-2">
        {AVAILABLE.map((provider) => {
          const isSelected = value === provider;
          return (
            <label
              key={provider}
              className={`d-flex align-items-center gap-3 border rounded-3 p-3 ${
                isSelected ? "border-primary border-2 bg-bbms-tint" : ""
              }`}
              style={{ cursor: "pointer" }}
            >
              <input
                type="radio"
                className="form-check-input m-0"
                name="payment-provider"
                checked={isSelected}
                onChange={() => onChange(provider)}
              />
              <span
                className="rounded-3 d-inline-flex align-items-center justify-content-center text-white flex-shrink-0"
                style={{ width: "2.5rem", height: "2.5rem", backgroundColor: PROVIDER_ICON[provider].color }}
                aria-hidden="true"
              >
                <i className={PROVIDER_ICON[provider].icon} />
              </span>
              <span className="fw-semibold">{t(`payment.${provider}`)}</span>
            </label>
          );
        })}

        {NOT_YET_WIRED.map((provider) => (
          <div key={provider} className="d-flex align-items-center gap-3 border rounded-3 p-3 opacity-50">
            <input type="radio" className="form-check-input m-0" disabled />
            <span
              className="rounded-3 d-inline-flex align-items-center justify-content-center text-white flex-shrink-0"
              style={{ width: "2.5rem", height: "2.5rem", backgroundColor: PROVIDER_ICON[provider].color }}
              aria-hidden="true"
            >
              <i className={PROVIDER_ICON[provider].icon} />
            </span>
            <span className="fw-semibold text-muted">{t(`payment.${provider}`)}</span>
            <span className="badge bg-light text-dark border ms-auto">{t("payment.not_available")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
