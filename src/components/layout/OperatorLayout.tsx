import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useOperatorDashboard, useOperatorMe } from "../../api/operator";
import { useProfile } from "../../api/profile";
import { useLocale } from "../../context/LocaleContext";
import type { OperatorStaffProfile } from "../../types/operator";
import { canOpen, isManager } from "../../utils/staff";
import { LoadingBlock } from "../shared/backoffice";
import { SiteAnnouncements } from "../shared/SiteContent";
import { BackOfficeLayout } from "./BackOfficeLayout";
import type { NavItem } from "./adminlte";

// Flat, header-labeled sections (like AdminLayout's nav) rather than
// collapsible accordion groups — same sidebar look/feel across back offices.
function navFor(staff: OperatorStaffProfile, t: (key: string) => string): NavItem[] {
  const manage = canOpen(staff, "manage");
  const sell = canOpen(staff, "sell");
  const items: NavItem[] = [];
  if (manage) items.push({ to: "/operator", label: t("nav.dashboard"), icon: "fas fa-tachometer-alt", end: true });
  if (manage) {
    items.push({ header: t("nav.trips_group") });
    items.push({ to: "/operator/schedule", label: t("nav.schedule"), icon: "fas fa-calendar-alt" });
    items.push({ to: "/operator/routes", label: t("nav.routes"), icon: "fas fa-route" });
    items.push({ to: "/operator/fleet", label: t("nav.fleet"), icon: "fas fa-bus" });
  }
  if (sell) {
    items.push({ header: t("nav.bookings_group") });
    items.push({ to: "/operator/counter", label: t("nav.counter"), icon: "fas fa-cash-register" });
    items.push({ to: "/operator/bookings", label: t("nav.bookings"), icon: "fas fa-ticket-alt" });
  }
  if (manage) {
    items.push({ header: t("nav.header_management") });
    items.push({ to: "/operator/reports", label: t("nav.reports"), icon: "fas fa-chart-bar" });
    items.push({ to: "/operator/staff", label: t("nav.staff"), icon: "fas fa-users" });
  }
  if (staff.can_validate_tickets) {
    items.push({ header: t("nav.header_boarding") });
    items.push({ to: "/conductor", label: t("nav.conductor"), icon: "fas fa-qrcode" });
  }
  return items;
}

export function OperatorLayout() {
  const { t } = useTranslation(["operator", "backoffice"]);
  const { language } = useLocale();
  const { pathname } = useLocation();
  const profile = useProfile();
  const staff = profile.data?.operator_staff ?? null;
  const manager = isManager(staff);
  const dashboard = useOperatorDashboard(manager);
  // While an application is pending, show the admin's "please send more
  // information" requests (OperatorReviewNote kind info_request).
  const operatorMe = useOperatorMe(manager && staff?.operator_status !== "approved");

  const navItems = useMemo(() => (staff ? navFor(staff, t) : []), [staff, t]);

  if (profile.isLoading) return <LoadingBlock />;
  if (!staff) return <Navigate to="/login" replace />;

  // A conductor-only account has no operator back-office screens.
  if (!manager && !staff.can_create_bookings) return <Navigate to="/conductor" replace />;
  // Counter agents land on the counter screen, not the (manager-only) dashboard.
  if (!manager && pathname === "/operator") return <Navigate to="/operator/counter" replace />;

  const attention = dashboard.data?.attention;
  const attentionCount = attention
    ? attention.pending_counter_payments + attention.refunds_to_process + attention.unassigned_trips
    : 0;
  const operatorName = language === "km" ? staff.operator_name_km || staff.operator_name : staff.operator_name;

  return (
    <BackOfficeLayout
      brand={operatorName}
      brandTo={manager ? "/operator" : "/operator/counter"}
      navItems={navItems}
      userName={profile.data?.full_name || profile.data?.phone || ""}
      userSubtitle={t(`backoffice:staff_role.${staff.staff_role}`)}
      notificationsCount={attentionCount}
      notificationsTo={manager ? "/operator" : undefined}
    >
      <SiteAnnouncements audience="operators" />
      {staff.operator_status !== "approved" && (
        <div className="alert alert-warning m-3 mb-0" role="status">
          {t("operator:pending_banner", { status: t(`backoffice:operator_status.${staff.operator_status}`) })}
          {(operatorMe.data?.info_requests ?? []).map((request) => (
            <div key={request.created_at} className="mt-2 p-2 bg-white rounded border">
              <strong>{t("operator:info_request")}</strong> {request.body}
            </div>
          ))}
        </div>
      )}
    </BackOfficeLayout>
  );
}

/** Route guard for manager-only / selling screens inside OperatorLayout. */
export function RequireStaff({ area }: { area: "manage" | "sell" }) {
  const profile = useProfile();
  const staff = profile.data?.operator_staff;
  if (profile.isLoading) return <LoadingBlock />;
  if (!staff || !canOpen(staff, area)) return <Navigate to="/operator/counter" replace />;
  return <Outlet />;
}
