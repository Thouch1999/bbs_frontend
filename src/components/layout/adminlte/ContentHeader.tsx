import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface Breadcrumb {
  label: string;
  to?: string;
}

interface ContentHeaderProps {
  title: ReactNode;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
}

export function ContentHeader({ title, breadcrumbs = [], actions }: ContentHeaderProps) {
  return (
    <div className="content-header">
      <div className="container-fluid">
        <div className="row mb-2 align-items-center g-2">
          <div className="col-sm-6 d-flex align-items-center gap-2 flex-wrap">
            <h1 className="m-0">{title}</h1>
            {actions}
          </div>
          <div className="col-sm-6">
            <ol className="breadcrumb float-sm-right">
              {breadcrumbs.map((crumb) => (
                <li className="breadcrumb-item" key={crumb.label}>
                  {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : crumb.label}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
