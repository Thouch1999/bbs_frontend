import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { PublicLayout } from "../components/layout/PublicLayout";
import { BoardingStopsPage } from "../pages/passenger/BoardingStopsPage";
import { CheckoutPage } from "../pages/passenger/CheckoutPage";
import { HomePage } from "../pages/passenger/HomePage";
import { PaymentResultPage } from "../pages/passenger/PaymentResultPage";
import { SearchResultsPage } from "../pages/passenger/SearchResultsPage";
import { SeatSelectionPage } from "../pages/passenger/SeatSelectionPage";
import { TicketPage } from "../pages/passenger/TicketPage";
import { ProtectedRoute } from "./ProtectedRoute";

// Operator and admin back offices are their own bundle — passengers never
// pay for that code (SRS: "keep the bundle small").
const OperatorLayout = lazy(() =>
  import("../components/layout/OperatorLayout").then((m) => ({ default: m.OperatorLayout }))
);
const AdminLayout = lazy(() =>
  import("../components/layout/AdminLayout").then((m) => ({ default: m.AdminLayout }))
);
const DashboardPage = lazy(() =>
  import("../pages/operator/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const SchedulePage = lazy(() =>
  import("../pages/operator/SchedulePage").then((m) => ({ default: m.SchedulePage }))
);
const FleetPage = lazy(() =>
  import("../pages/operator/FleetPage").then((m) => ({ default: m.FleetPage }))
);
const RoutesPage = lazy(() =>
  import("../pages/operator/RoutesPage").then((m) => ({ default: m.RoutesPage }))
);
const ManifestPage = lazy(() =>
  import("../pages/operator/ManifestPage").then((m) => ({ default: m.ManifestPage }))
);
const BookingsPage = lazy(() =>
  import("../pages/operator/BookingsPage").then((m) => ({ default: m.BookingsPage }))
);
const CounterBookingPage = lazy(() =>
  import("../pages/operator/CounterBookingPage").then((m) => ({ default: m.CounterBookingPage }))
);
const ReportsPage = lazy(() =>
  import("../pages/operator/ReportsPage").then((m) => ({ default: m.ReportsPage }))
);
const StaffPage = lazy(() =>
  import("../pages/operator/StaffPage").then((m) => ({ default: m.StaffPage }))
);
const RequireStaff = lazy(() =>
  import("../components/layout/OperatorLayout").then((m) => ({ default: m.RequireStaff }))
);
const OperatorsPage = lazy(() =>
  import("../pages/admin/OperatorsPage").then((m) => ({ default: m.OperatorsPage }))
);
const OperatorReviewPage = lazy(() =>
  import("../pages/admin/OperatorReviewPage").then((m) => ({ default: m.OperatorReviewPage }))
);
const UsersPage = lazy(() =>
  import("../pages/admin/UsersPage").then((m) => ({ default: m.UsersPage }))
);
const PlatformReportsPage = lazy(() =>
  import("../pages/admin/PlatformReportsPage").then((m) => ({ default: m.PlatformReportsPage }))
);
const ReconciliationPage = lazy(() =>
  import("../pages/admin/ReconciliationPage").then((m) => ({ default: m.ReconciliationPage }))
);
const ContentPage = lazy(() =>
  import("../pages/admin/ContentPage").then((m) => ({ default: m.ContentPage }))
);
const SupportPage = lazy(() =>
  import("../pages/admin/SupportPage").then((m) => ({ default: m.SupportPage }))
);
const AuditLogPage = lazy(() =>
  import("../pages/admin/AuditLogPage").then((m) => ({ default: m.AuditLogPage }))
);
const OverviewPage = lazy(() =>
  import("../pages/admin/OverviewPage").then((m) => ({ default: m.OverviewPage }))
);
const ScanValidatePage = lazy(() =>
  import("../pages/conductor/ScanValidatePage").then((m) => ({ default: m.ScanValidatePage }))
);

// Auth + account pages aren't needed for the first paint of the money path
// (search -> seats -> checkout -> ticket) — split them out too.
const LoginPage = lazy(() => import("../pages/passenger/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() =>
  import("../pages/passenger/RegisterPage").then((m) => ({ default: m.RegisterPage }))
);
const ForgotPasswordPage = lazy(() =>
  import("../pages/passenger/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage }))
);
const MyBookingsPage = lazy(() =>
  import("../pages/passenger/MyBookingsPage").then((m) => ({ default: m.MyBookingsPage }))
);
const BookingDetailPage = lazy(() =>
  import("../pages/passenger/BookingDetailPage").then((m) => ({ default: m.BookingDetailPage }))
);
const PassengerSupportPage = lazy(() =>
  import("../pages/passenger/SupportPage").then((m) => ({ default: m.SupportPage }))
);
const ProfilePage = lazy(() =>
  import("../pages/passenger/ProfilePage").then((m) => ({ default: m.ProfilePage }))
);

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/search" element={<SearchResultsPage />} />
            <Route path="/trips/:tripId/seats" element={<SeatSelectionPage />} />
            <Route path="/boarding-stops" element={<BoardingStopsPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/payment-result" element={<PaymentResultPage />} />
            <Route path="/ticket" element={<TicketPage />} />
            {/* Public: MyBookingsPage renders its own guest PNR+phone lookup
                when signed out, per the W8 Stitch brief — not gated here. */}
            <Route path="/my-bookings" element={<MyBookingsPage />} />

            <Route
              element={<ProtectedRoute allow={["passenger", "operator_staff", "admin"]} />}
            >
              <Route path="/bookings/:publicId" element={<BookingDetailPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/support" element={<PassengerSupportPage />} />
            </Route>

          </Route>

          {/* S2 has its own simplified bar (no passenger header, no sidebar). */}
          <Route element={<ProtectedRoute allow={["operator_staff"]} />}>
            <Route path="/conductor" element={<ScanValidatePage />} />
          </Route>

          <Route element={<ProtectedRoute allow={["operator_staff"]} />}>
            <Route path="/operator" element={<OperatorLayout />}>
              <Route element={<RequireStaff area="manage" />}>
                <Route index element={<DashboardPage />} />
                <Route path="schedule" element={<SchedulePage />} />
                <Route path="fleet" element={<FleetPage />} />
                <Route path="routes" element={<RoutesPage />} />
                <Route path="trips/:tripId/manifest" element={<ManifestPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="staff" element={<StaffPage />} />
              </Route>
              <Route element={<RequireStaff area="sell" />}>
                <Route path="counter" element={<CounterBookingPage />} />
                <Route path="bookings" element={<BookingsPage />} />
              </Route>
            </Route>
          </Route>

          <Route element={<ProtectedRoute allow={["admin"]} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<OverviewPage />} />
              <Route path="operators" element={<OperatorsPage />} />
              <Route path="operators/:operatorId" element={<OperatorReviewPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="reports" element={<PlatformReportsPage />} />
              <Route path="reconciliation" element={<ReconciliationPage />} />
              <Route path="content" element={<ContentPage />} />
              <Route path="support" element={<SupportPage />} />
              <Route path="audit" element={<AuditLogPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
