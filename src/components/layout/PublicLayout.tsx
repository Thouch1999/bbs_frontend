import { Dropdown, Nav, Navbar } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { Link, Outlet } from "react-router-dom";

import { useUpdateProfile } from "../../api/profile";
import { useAuth } from "../../context/AuthContext";
import { useLocale } from "../../context/LocaleContext";
import type { Currency, Language } from "../../context/localePrefs";
import { SiteAnnouncements } from "../shared/SiteContent";
import { PublicFooter } from "./PublicFooter";

export function PublicLayout() {
  const { t } = useTranslation();
  const { isAuthenticated, logout } = useAuth();
  const { language, setLanguage, currency, setCurrency } = useLocale();
  const updateProfile = useUpdateProfile();

  function handleLanguageChange(next: Language) {
    setLanguage(next);
    if (isAuthenticated) updateProfile.mutate({ preferred_language: next });
  }

  function handleCurrencyChange(next: Currency) {
    setCurrency(next);
    if (isAuthenticated) updateProfile.mutate({ preferred_currency: next });
  }

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar bg="white" className="border-bottom sticky-top" expand="md">
        <div className="container">
          <Navbar.Brand as={Link} to="/" className="fw-bold text-primary">
            {t("app_name")}
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="bbms-public-nav" />
          <Navbar.Collapse id="bbms-public-nav">
            {isAuthenticated && (
              <Nav className="me-auto">
                <Nav.Link as={Link} to="/my-bookings">
                  {t("nav.my_bookings")}
                </Nav.Link>
                <Nav.Link as={Link} to="/profile">
                  {t("nav.profile")}
                </Nav.Link>
                <Nav.Link as={Link} to="/support">
                  {t("nav.help")}
                </Nav.Link>
              </Nav>
            )}
            <Nav className="ms-md-auto align-items-md-center gap-md-2">
              <Dropdown align="end">
                <Dropdown.Toggle variant="outline-secondary" size="sm" id="public-language">
                  <span aria-hidden="true">{language === "km" ? "🇰🇭" : "🇬🇧"}</span>{" "}
                  {language === "km" ? "ខ្មែរ" : "English"}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item active={language === "km"} onClick={() => handleLanguageChange("km")}>
                    🇰🇭 ខ្មែរ
                  </Dropdown.Item>
                  <Dropdown.Item active={language === "en"} onClick={() => handleLanguageChange("en")}>
                    🇬🇧 English
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              <Dropdown align="end">
                <Dropdown.Toggle variant="outline-secondary" size="sm" id="public-currency">
                  {currency === "KHR" ? "៛ KHR" : "$ USD"}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item active={currency === "KHR"} onClick={() => handleCurrencyChange("KHR")}>
                    ៛ KHR
                  </Dropdown.Item>
                  <Dropdown.Item active={currency === "USD"} onClick={() => handleCurrencyChange("USD")}>
                    $ USD
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              {isAuthenticated ? (
                <button type="button" className="btn btn-link" onClick={logout}>
                  {t("nav.logout")}
                </button>
              ) : (
                <Link to="/login" className="btn btn-outline-primary btn-sm">
                  {t("nav.login")}
                </Link>
              )}
            </Nav>
          </Navbar.Collapse>
        </div>
      </Navbar>
      <SiteAnnouncements audience="passengers" />
      <main className="flex-grow-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
