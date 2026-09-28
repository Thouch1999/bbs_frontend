import type { ReactNode } from "react";

import { InfoBox } from "./InfoBox";
import { SmallBox, type SmallBoxVariant } from "./SmallBox";

// Both KPI-tile families already match the Stitch reference (SmallBox's
// oversized watermark icon, InfoBox's left icon block) — this only unifies
// the call site so pages pick a `display` instead of importing either
// component directly and guessing which one a given row should use.
export type KpiTileVariant = SmallBoxVariant;

interface KpiTileProps {
  display?: "box" | "inline";
  value: ReactNode;
  label: ReactNode;
  icon: string;
  variant?: KpiTileVariant;
  detail?: ReactNode;
  to?: string;
  footerLabel?: ReactNode;
}

export function KpiTile({ display = "box", value, label, icon, variant, detail, to, footerLabel }: KpiTileProps) {
  if (display === "inline") {
    return <InfoBox value={value} label={label} icon={icon} variant={variant} />;
  }
  return <SmallBox value={value} label={label} icon={icon} variant={variant} detail={detail} to={to} footerLabel={footerLabel} />;
}
