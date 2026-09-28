import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth, type AppRole } from "../context/AuthContext";

interface ProtectedRouteProps {
  allow: AppRole[];
}

/**
 * Role comes straight off the JWT's "role" claim (passenger/operator_staff/
 * admin). "conductor" isn't a top-level role — it's an OperatorStaff.staff_role
 * — so conductor-only screens additionally check that once profile data
 * carries it (Phase 6/7); this guard only handles the three JWT roles.
 */
export function ProtectedRoute({ allow }: ProtectedRouteProps) {
  const { isAuthenticated, isInitializing, role } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return null;
  }

  if (!isAuthenticated || !role || !allow.includes(role)) {
    // Carries the page the visitor actually wanted (e.g. mid seat-selection
    // or checkout) so LoginPage/RegisterPage can send them back there
    // instead of always landing on the generic post-login page.
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return <Outlet />;
}
