import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export type SmallBoxVariant = "teal" | "orange" | "gold" | "success" | "danger" | "warning";

interface SmallBoxProps {
  value: ReactNode;
  label: ReactNode;
  icon: string;
  variant?: SmallBoxVariant;
  /** Secondary line under the value (e.g. the other currency). */
  detail?: ReactNode;
  to?: string;
  footerLabel?: ReactNode;
}

const VARIANT_CLASS: Record<SmallBoxVariant, string> = {
  teal: "bg-bbms-teal",
  orange: "bg-bbms-orange",
  gold: "bg-bbms-gold",
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
};

export function SmallBox({ value, label, icon, variant = "teal", detail, to, footerLabel }: SmallBoxProps) {
  return (
    <div className={`small-box ${VARIANT_CLASS[variant]}`}>
      <div className="inner">
        <h3>{value}</h3>
        {detail && <small>{detail}</small>}
        <p>{label}</p>
      </div>
      <div className="icon" aria-hidden="true">
        <i className={icon} />
      </div>
      {to && footerLabel && (
        <Link to={to} className="small-box-footer">
          {footerLabel} <i className="fas fa-arrow-circle-right" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
