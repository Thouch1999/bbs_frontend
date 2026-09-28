import { Link } from "react-router-dom";

interface UserPanelProps {
  name: string;
  subtitle?: string;
  avatarSrc?: string;
  to?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "");
}

export function UserPanel({ name, subtitle, avatarSrc, to = "/profile" }: UserPanelProps) {
  return (
    <div className="user-panel">
      <div className="image">
        {avatarSrc ? (
          <img src={avatarSrc} alt="" />
        ) : (
          <span className="avatar" aria-hidden="true">
            {initials(name).toUpperCase()}
          </span>
        )}
      </div>
      <div className="info">
        <Link to={to}>{name}</Link>
        {subtitle && <span>{subtitle}</span>}
      </div>
    </div>
  );
}
