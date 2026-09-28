import type { ReactNode } from "react";

interface CardProps {
  title?: ReactNode;
  tools?: ReactNode;
  footer?: ReactNode;
  variant?: "primary" | "success" | "warning" | "danger";
  /** AdminLTE "card-outline": a colored top border instead of a filled header. */
  outline?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function Card({ title, tools, footer, variant, outline, className, bodyClassName, children }: CardProps) {
  const classes = ["card"];
  if (outline) classes.push("card-outline");
  if (variant) classes.push(`card-${variant}`);
  if (className) classes.push(className);

  return (
    <div className={classes.join(" ")}>
      {(title || tools) && (
        <div className="card-header">
          {title && <h3 className="card-title">{title}</h3>}
          {tools && <div className="card-tools">{tools}</div>}
        </div>
      )}
      <div className={`card-body${bodyClassName ? ` ${bodyClassName}` : ""}`}>{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}
