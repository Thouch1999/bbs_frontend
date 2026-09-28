// Small presentational helpers shared by every back-office page.
import type { ReactNode } from "react";
import { Alert, Badge, ProgressBar } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import type { ApiError } from "../../api/types";
import { useLocale } from "../../context/LocaleContext";
import { formatMoney } from "../../utils/money";

const STATUS_VARIANT: Record<string, string> = {
  scheduled: "primary",
  delayed: "warning",
  cancelled: "secondary",
  departed: "info",
  completed: "success",
  confirmed: "success",
  pending_payment: "warning",
  active: "success",
  maintenance: "warning",
  retired: "secondary",
  paid: "success",
  pay_at_counter: "warning",
  pending: "secondary",
  boarded: "success",
  no_show: "danger",
};

/** Colored status pill; label comes from backoffice:status.<value>. */
export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation("backoffice");
  const variant = STATUS_VARIANT[status] ?? "secondary";
  return (
    <Badge bg={variant} text={variant === "warning" ? "dark" : undefined} className="fw-semibold">
      {t(`status.${status}`, { defaultValue: status })}
    </Badge>
  );
}

/**
 * Money collected in each currency, shown side by side ("$456 · ៛1,869,600").
 * The two amounts are separate sums (a KHR booking's total is never
 * converted and added into USD), so this never displays a mixed total.
 */
export function DualMoney({ usd, khr, className }: { usd: string | number; khr: string | number; className?: string }) {
  const { language } = useLocale();
  const usdNumber = Number(usd);
  const khrNumber = Number(khr);
  const parts = [];
  if (usdNumber !== 0 || khrNumber === 0) parts.push(formatMoney(String(usd), "USD", language));
  if (khrNumber !== 0) parts.push(formatMoney(String(khr), "KHR", language));
  return <span className={className}>{parts.join(" · ")}</span>;
}

export function OccupancyBar({ sold, total }: { sold: number; total: number }) {
  const rate = total ? Math.round((sold / total) * 100) : 0;
  const variant = rate >= 90 ? "success" : rate >= 50 ? "primary" : "warning";
  return (
    <div className="bbms-occupancy">
      <div className="small">
        {sold}/{total} <span className="text-muted">({rate}%)</span>
      </div>
      <ProgressBar now={rate} variant={variant} aria-label={`${rate}%`} />
    </div>
  );
}

export function ApiErrorAlert({ error, className }: { error: ApiError | null | undefined; className?: string }) {
  const { t } = useTranslation("backoffice");
  if (!error) return null;
  return (
    <Alert variant="danger" className={className ?? "py-2"}>
      {t(`errors.${error.code}`, { defaultValue: error.message || t("errors.generic") })}
    </Alert>
  );
}

export function LoadingBlock({ children }: { children?: ReactNode }) {
  const { t } = useTranslation("backoffice");
  return (
    <div className="text-center text-muted py-4">
      <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
      {children ?? t("table.loading")}
    </div>
  );
}

/** Bilingual data (name_km/name_en columns) → the one active UI language. */
export function useLocalizedName() {
  const { language } = useLocale();
  return (entity: { name_en: string; name_km: string } | null | undefined) =>
    entity ? (language === "km" ? entity.name_km || entity.name_en : entity.name_en || entity.name_km) : "";
}

/** A route's display name: its own name, else "Origin → Destination" in the UI language. */
export function useRouteLabel() {
  const localizedName = useLocalizedName();
  return (route: { name: string; origin_city: { name_en: string; name_km: string }; destination_city: { name_en: string; name_km: string } }) =>
    route.name || `${localizedName(route.origin_city)} → ${localizedName(route.destination_city)}`;
}
