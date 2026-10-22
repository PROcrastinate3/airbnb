import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Spinner } from "./ui.jsx";

// FIREBASE: keep these guards for UX, but ALSO enforce roles in Firestore security rules.
export function RequireAuth({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner className="min-h-screen items-center" />;
  if (!user)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
