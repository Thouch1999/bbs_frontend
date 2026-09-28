import type { ReactNode } from "react";

type InfoBoxVariant = "teal" | "orange" | "gold" | "success" | "warning" | "danger";

interface InfoBoxProps {
  value: ReactNode;
  label: ReactNode;
  icon: string;
  variant?: InfoBoxVariant;
  /** A small trend/context line under the number (e.g. "+5.2% vs yesterday"). */
  detail?: ReactNode;
}

const VARIANT_CLASS: Record<InfoBoxVariant, string> = {
  teal: "bg-bbms-teal",
  orange: "bg-bbms-orange",
  gold: "bg-bbms-gold",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function InfoBox({ value, label, icon, variant = "teal", detail }: InfoBoxProps) {
  return (
    <div className="info-box">
      <span className={`info-box-icon ${VARIANT_CLASS[variant]}`} aria-hidden="true">
        <i className={icon} />
      </span>
      <div className="info-box-content">
        <span className="info-box-text">{label}</span>
        <span className="info-box-number">{value}</span>
        {detail && <span className="info-box-detail">{detail}</span>}
      </div>
    </div>
  );
}
