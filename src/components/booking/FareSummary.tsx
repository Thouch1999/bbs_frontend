import { useState } from "react";
import { useTranslation } from "react-i18next";

import { usePublicConfig } from "../../api/operator";
import { usePromoValidate } from "../../api/payments";
import type { Currency, Language } from "../../context/localePrefs";
import { formatMoney } from "../../utils/money";

interface FareSummaryProps {
  tripId: string;
  numSeats: number;
  subtotal: number;
  currency: Currency;
  language: Language;
  contactPhone: string;
  onDiscountChange: (discountAmount: number, promoCode: string | null) => void;
  discountAmount: number;
  promoCode: string | null;
}

export function FareSummary({
  tripId,
  numSeats,
  subtotal,
  currency,
  language,
  contactPhone,
  onDiscountChange,
  discountAmount,
  promoCode,
}: FareSummaryProps) {
  const { t } = useTranslation("booking");
  const [codeInput, setCodeInput] = useState("");
  const promoValidate = usePromoValidate();
  const config = usePublicConfig();

  function applyCode() {
    if (!codeInput) return;
    promoValidate.mutate(
      { code: codeInput, trip_id: tripId, num_seats: numSeats, currency, contact_phone: contactPhone },
      {
        onSuccess: (result) => {
          onDiscountChange(Number(result.discount_amount), codeInput);
        },
      }
    );
  }

  function removeCode() {
    setCodeInput("");
    onDiscountChange(0, null);
  }

  const total = Math.max(0, subtotal - discountAmount);

  return (
    <div className="border rounded-3 p-3 mb-3">
      <h2 className="h6 fw-bold">{t("fare_summary.title")}</h2>
      <div className="d-flex justify-content-between">
        <span className="text-muted">{t("fare_summary.subtotal")}</span>
        <span className="fw-semibold">{formatMoney(String(subtotal), currency, language)}</span>
      </div>
      {discountAmount > 0 && (
        <div className="d-flex justify-content-between text-primary">
          <span>{t("fare_summary.discount")}</span>
          <span className="fw-semibold">-{formatMoney(String(discountAmount), currency, language)}</span>
        </div>
      )}
      <hr />
      <div className="d-flex justify-content-between align-items-end">
        <span className="fw-bold">{t("fare_summary.total")}</span>
        <span className="fs-3 fw-bold text-primary">{formatMoney(String(total), currency, language)}</span>
      </div>
      {config.data && (
        <div className="text-muted small text-end mb-3">
          $1.00 = {formatMoney(config.data.khr_per_usd, "KHR", language)}
        </div>
      )}

      <div className="mt-3">
        {promoCode ? (
          <div className="d-flex justify-content-between align-items-center">
            <span className="badge bg-success-subtle text-success-emphasis">{promoCode}</span>
            <button type="button" className="btn btn-sm btn-link" onClick={removeCode}>
              {t("fare_summary.remove")}
            </button>
          </div>
        ) : (
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              placeholder={t("fare_summary.promo_code")}
              value={codeInput}
              onChange={(event) => setCodeInput(event.target.value)}
            />
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={applyCode}
              disabled={promoValidate.isPending || !codeInput}
            >
              {t("fare_summary.apply")}
            </button>
          </div>
        )}
        {promoValidate.isError && <div className="text-danger small mt-1">{promoValidate.error.message}</div>}
      </div>
    </div>
  );
}
