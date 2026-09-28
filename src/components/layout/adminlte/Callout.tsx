import type { ReactNode } from "react";

interface CalloutProps {
  variant?: "info" | "success" | "warning" | "danger";
  title?: ReactNode;
  children: ReactNode;
}

export function Callout({ variant = "info", title, children }: CalloutProps) {
  return (
    <div className={`callout callout-${variant}`} role={variant === "danger" ? "alert" : "status"}>
      {title && <h5>{title}</h5>}
      <div>{children}</div>
    </div>
  );
}
