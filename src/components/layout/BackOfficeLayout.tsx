// The one reusable AdminLTE shell (playbook Step 15 "Done when": sidebar,
// navbar, content-header, footer as one layout). OperatorLayout and
// AdminLayout only supply their nav items, brand and header extras.
// Font Awesome is loaded globally from main.tsx now (the passenger UI uses
// it too), so this chunk only needs the AdminLTE-specific stylesheet.
import "../../styles/adminlte.scss";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Dropdown } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useUpdateProfile } from "../../api/profile";
import { useAuth } from "../../context/AuthContext";
import { useLocale } from "../../context/LocaleContext";
import type { Currency, Language } from "../../context/localePrefs";
import {
  BrandLink,
  MainFooter,
  MainHeader,
  MainSidebar,
  NavSidebar,
  UserPanel,
  type NavItem,
} from "./adminlte";

const LARGE_SCREEN = "(min-width: 992px)";

interface BackOfficeLayoutProps {
  brand: ReactNode;
  brandTo: string;
  navItems: NavItem[];
  userName: string;
  userSubtitle?: string;
  notificationsCount?: number;
  notificationsTo?: string;
  children?: ReactNode;
}

function filterNav(items: NavItem[], term: string): NavItem[] {
  if (!term) return items;
  const matches = (label: ReactNode) => String(label).toLowerCase().includes(term.toLowerCase());
  return items.flatMap((item): NavItem[] => {
    if ("header" in item) return []; // section labels hide while filtering
    if ("children" in item) {
      const children = item.children.filter((child) => matches(child.label));
      return matches(item.label) ? [item] : children.length ? [{ ...item, children }] : [];
    }
    return matches(item.label) ? [item] : [];
  });
}

export function BackOfficeLayout({
  brand,
  brandTo,
  navItems,
  userName,
  userSubtitle,
  notificationsCount = 0,
  notificationsTo,
  children,
}: BackOfficeLayoutProps) {
  const { t } = useTranslation("backoffice");
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { language, setLanguage, currency, setCurrency } = useLocale();
  const updateProfile = useUpdateProfile();
  const [collapsed, setCollapsed] = useState(false); // desktop push-menu
  const [mobileOpen, setMobileOpen] = useState(false); // below lg: overlay
  const [search, setSearch] = useState("");

  // Close the mobile overlay whenever the page changes.
  useEffect(() => setMobileOpen(false), [pathname]);

  function toggleSidebar() {
    if (window.matchMedia(LARGE_SCREEN).matches) setCollapsed((value) => !value);
    else setMobileOpen((value) => !value);
  }

  function changeLanguage(next: Language) {
    setLanguage(next);
    updateProfile.mutate({ preferred_language: next });
  }

  function changeCurrency(next: Currency) {
    setCurrency(next);
    updateProfile.mutate({ preferred_currency: next });
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const visibleNav = useMemo(() => filterNav(navItems, search), [navItems, search]);
  const wrapperClass = ["wrapper", collapsed ? "sidebar-collapse" : "", mobileOpen ? "sidebar-open" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClass}>
      <MainHeader
        onToggleSidebar={toggleSidebar}
        toggleLabel={t("header.toggle_menu")}
        right={
          <>
            <li className="nav-item">
              <Dropdown align="end">
                <Dropdown.Toggle variant="link" className="nav-link" id="bo-language">
                  <span aria-hidden="true">{language === "km" ? "🇰🇭" : "🇬🇧"}</span>
                  <span className="d-none d-md-inline">{language === "km" ? "ខ្មែរ" : "English"}</span>
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item active={language === "km"} onClick={() => changeLanguage("km")}>
                    🇰🇭 ខ្មែរ
                  </Dropdown.Item>
                  <Dropdown.Item active={language === "en"} onClick={() => changeLanguage("en")}>
                    🇬🇧 English
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </li>
            <li className="nav-item">
              <Dropdown align="end">
                <Dropdown.Toggle variant="link" className="nav-link" id="bo-currency" aria-label={t("header.currency")}>
                  {currency === "KHR" ? "៛ KHR" : "$ USD"}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item active={currency === "KHR"} onClick={() => changeCurrency("KHR")}>
                    ៛ KHR
                  </Dropdown.Item>
                  <Dropdown.Item active={currency === "USD"} onClick={() => changeCurrency("USD")}>
                    $ USD
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </li>
            {notificationsTo && (
              <li className="nav-item position-relative">
                <Link to={notificationsTo} className="nav-link" aria-label={t("header.notifications", { count: notificationsCount })}>
                  <i className="far fa-bell" aria-hidden="true" />
                  {notificationsCount > 0 && <span className="badge navbar-badge">{notificationsCount}</span>}
                </Link>
              </li>
            )}
            <li className="nav-item">
              <Dropdown align="end">
                <Dropdown.Toggle variant="link" className="nav-link" id="bo-user">
                  <i className="far fa-user-circle" aria-hidden="true" />
                  <span className="d-none d-md-inline">{userName}</span>
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item as={Link} to="/profile">
                    {t("header.profile")}
                  </Dropdown.Item>
                  <Dropdown.Item as={Link} to="/">
                    {t("header.passenger_site")}
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={handleLogout}>{t("header.logout")}</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </li>
          </>
        }
      />
      <MainSidebar
        brand={<BrandLink to={brandTo}>{brand}</BrandLink>}
        userPanel={<UserPanel name={userName} subtitle={userSubtitle} />}
        search={
          <div className="sidebar-search">
            <input
              type="search"
              className="form-control form-control-sm"
              placeholder={t("sidebar.search")}
              aria-label={t("sidebar.search")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        }
        nav={<NavSidebar items={visibleNav} />}
      />
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} aria-hidden="true" />}
      <div className="content-wrapper">
        {children}
        <Outlet />
      </div>
      <MainFooter>{t("footer.rights")}</MainFooter>
    </div>
  );
}
