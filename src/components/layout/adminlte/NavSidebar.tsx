import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";

export interface NavLeaf {
  to: string;
  label: ReactNode;
  icon?: string;
  /** Match the path exactly (for an index route like /operator). */
  end?: boolean;
  /** AdminLTE right-aligned count badge (e.g. pending approvals). */
  badge?: number;
}

/** AdminLTE "nav-header": a small section label between groups. */
export interface NavHeader {
  header: ReactNode;
}

export interface NavGroup {
  label: ReactNode;
  icon?: string;
  children: NavLeaf[];
}

export type NavItem = NavLeaf | NavGroup | NavHeader;

function isGroup(item: NavItem): item is NavGroup {
  return "children" in item;
}

function isHeader(item: NavItem): item is NavHeader {
  return "header" in item;
}

interface NavSidebarProps {
  items: NavItem[];
}

function Leaf({ item }: { item: NavLeaf }) {
  return (
    <li className="nav-item">
      <NavLink to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
        {item.icon && <i className={`nav-icon ${item.icon}`} aria-hidden="true" />}
        <p>{item.label}</p>
        {item.badge ? <span className="badge bbms-nav-badge">{item.badge}</span> : null}
      </NavLink>
    </li>
  );
}

/** AdminLTE "nav-treeview" group — starts open when one of its children is the current page. */
function Group({ item }: { item: NavGroup }) {
  const { pathname } = useLocation();
  const containsActive = item.children.some((child) => pathname.startsWith(child.to));
  const [open, setOpen] = useState(containsActive);
  const isOpen = open || containsActive;

  return (
    <li className={`nav-item${isOpen ? " menu-open" : ""}`}>
      <button type="button" className="nav-link" aria-expanded={isOpen} onClick={() => setOpen(!isOpen)}>
        {item.icon && <i className={`nav-icon ${item.icon}`} aria-hidden="true" />}
        <p>{item.label}</p>
        <i className="fas fa-angle-left menu-caret" aria-hidden="true" />
      </button>
      {isOpen && (
        <ul className="nav nav-treeview flex-column">
          {item.children.map((child) => (
            <Leaf key={child.to} item={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function NavSidebar({ items }: NavSidebarProps) {
  return (
    <nav className="mt-2">
      <ul className="nav nav-pills nav-sidebar flex-column" role="menu" data-accordion="false">
        {items.map((item, index) =>
          isHeader(item) ? (
            <li key={`header-${index}`} className="nav-header">
              {item.header}
            </li>
          ) : isGroup(item) ? (
            <Group key={index} item={item} />
          ) : (
            <Leaf key={item.to} item={item} />
          )
        )}
      </ul>
    </nav>
  );
}
