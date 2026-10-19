import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "../context/SessionContext";

export function RequireSession() {
  const { session, loading } = useSession();
  if (loading) return null;
  return session ? <Outlet /> : <Navigate to="/" replace />;
}
