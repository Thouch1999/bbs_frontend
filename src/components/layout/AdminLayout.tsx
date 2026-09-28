import { useTranslation } from "react-i18next";

import { useAdminOverview, useAdminTickets } from "../../api/admin";
import { useProfile } from "../../api/profile";
import { BackOfficeLayout } from "./BackOfficeLayout";
import type { NavItem } from "./adminlte";

// A1: the same reusable BackOfficeLayout as the operator back office, with a
// red ADMIN badge in the brand block and nav-header section labels.
export function AdminLayout() {
  const { t } = useTranslation(["admin", "backoffice"]);
  const profile = useProfile();
  const overview = useAdminOverview();
  const pending = overview.data?.pending_operators_count ?? 0;
  const openTickets = useAdminTickets({ status: "open" }).data?.filter((ticket) => ticket.unread_by_staff).length ?? 0;

  const navItems: NavItem[] = [
    { to: "/admin", label: t("admin:nav.overview"), icon: "fas fa-tachometer-alt", end: true },
    { header: t("admin:nav.header_marketplace") },
    { to: "/admin/operators", label: t("admin:nav.operators"), icon: "fas fa-building", badge: pending },
    { to: "/admin/users", label: t("admin:nav.users"), icon: "fas fa-users" },
    { header: t("admin:nav.header_money") },
    { to: "/admin/reconciliation", label: t("admin:nav.reconciliation"), icon: "fas fa-balance-scale" },
    { to: "/admin/reports", label: t("admin:nav.reports"), icon: "fas fa-chart-line" },
    { header: t("admin:nav.header_engagement") },
    { to: "/admin/content", label: t("admin:nav.content"), icon: "fas fa-bullhorn" },
    { to: "/admin/support", label: t("admin:nav.support"), icon: "fas fa-headset", badge: openTickets },
    { header: t("admin:nav.header_system") },
    { to: "/admin/audit", label: t("admin:nav.audit"), icon: "fas fa-history" },
  ];

  return (
    <BackOfficeLayout
      brand={
        <>
          BBMS <span className="bbms-admin-badge">ADMIN</span>
        </>
      }
      brandTo="/admin"
      navItems={navItems}
      userName={profile.data?.full_name || profile.data?.phone || ""}
      userSubtitle={t("backoffice:admin_nav.role")}
      notificationsCount={pending}
      notificationsTo="/admin/operators"
    />
  );
}
