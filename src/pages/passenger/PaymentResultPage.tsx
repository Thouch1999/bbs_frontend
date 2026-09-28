import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { useBookingLookup } from "../../api/bookings";
import type { CounterGatewayPayload, GatewayPayload, PaymentProvider } from "../../types";

interface PaymentResultState {
  pnr: string;
  contactPhone: string;
  provider: PaymentProvider;
  gateway: GatewayPayload;
  operatorName: string;
}

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 2 * 60 * 1000;

function isCounterPayload(gateway: GatewayPayload): gateway is CounterGatewayPayload {
  return "pay_at_counter" in gateway;
}

export function PaymentResultPage() {
  const { t } = useTranslation(["booking", "common"]);
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as PaymentResultState | null;
  const [hasTimedOut, setHasTimedOut] = useState(false);

  const isCounter = state ? isCounterPayload(state.gateway) : false;
  const { data: booking } = useBookingLookup(state?.pnr ?? null, state?.contactPhone ?? null, {
    refetchInterval: !isCounter && !hasTimedOut ? POLL_INTERVAL_MS : false,
  });

  useEffect(() => {
    if (isCounter || hasTimedOut) return;
    const timer = setTimeout(() => setHasTimedOut(true), POLL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isCounter, hasTimedOut]);

  useEffect(() => {
    if (booking?.status === "confirmed" && state) {
      navigate(`/ticket?pnr=${state.pnr}&phone=${encodeURIComponent(state.contactPhone)}`, { replace: true });
    }
  }, [booking, navigate, state]);

  if (!state) {
    return <p className="container py-4 text-danger">{t("common.error")}</p>;
  }

  return (
    <div className="container py-4">
      {isCounter && isCounterPayload(state.gateway) && (
        <div className="alert alert-info">
          {t("payment.counter_instructions", {
            operator: state.operatorName,
            deadline: new Date(state.gateway.deadline).toLocaleString(),
          })}
        </div>
      )}

      {!isCounter && !hasTimedOut && booking?.status !== "cancelled" && (
        <div>
          <h1 className="h5">{t("payment.waiting_title")}</h1>
          <p className="text-muted">{t("payment.waiting_body")}</p>
          <div className="spinner-border text-primary" role="status" />
        </div>
      )}

      {(hasTimedOut || booking?.status === "cancelled") && (
        <div className="alert alert-danger">{t("payment.failed")}</div>
      )}

      <p className="mt-3">
        <strong>{t("ticket.pnr_label")}:</strong> {state.pnr}
      </p>
    </div>
  );
}
