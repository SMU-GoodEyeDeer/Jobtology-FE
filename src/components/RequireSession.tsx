import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "../context/SessionContext";

export function RequireSession() {
  const { session, loading } = useSession();
  // A background session refresh must not remount a signed-in page (e.g. the onboarding outro).
  if (loading && !session) return null;
  return session ? <Outlet /> : <Navigate to="/" replace />;
}
