import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface BrandLinkProps {
  to?: string;
  logo?: ReactNode;
  children: ReactNode;
}

export function BrandLink({ to = "/", logo = <span className="brand-image">BBMS</span>, children }: BrandLinkProps) {
  return (
    <Link to={to} className="brand-link">
      {logo}
      <span className="brand-text">{children}</span>
    </Link>
  );
}
