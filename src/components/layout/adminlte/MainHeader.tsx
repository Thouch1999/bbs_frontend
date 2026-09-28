import type { ReactNode } from "react";

interface MainHeaderProps {
  onToggleSidebar?: () => void;
  toggleLabel?: string;
  right?: ReactNode;
}

export function MainHeader({ onToggleSidebar, toggleLabel = "Menu", right }: MainHeaderProps) {
  return (
    <nav className="main-header navbar navbar-expand navbar-white navbar-light">
      <ul className="navbar-nav">
        <li className="nav-item">
          <button
            type="button"
            className="nav-link btn btn-link"
            onClick={onToggleSidebar}
            aria-label={toggleLabel}
            data-widget="pushmenu"
          >
            <i className="fas fa-bars" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <ul className="navbar-nav ml-auto">{right}</ul>
    </nav>
  );
}
