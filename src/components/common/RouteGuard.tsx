import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { routes } from "@/routes";
import type { UserRole } from "@/types";

interface RouteGuardProps {
  children: React.ReactNode;
}

const SYSTEM_PUBLIC_ROUTES = ["/403", "/404"];
const routePublicPaths = routes.filter((r) => r.public).map((r) => r.path);
const PUBLIC_ROUTES = [...SYSTEM_PUBLIC_ROUTES, ...routePublicPaths];

function matchPublicRoute(path: string, patterns: string[]) {
  return patterns.some((pattern) => {
    if (pattern.includes(":") || pattern.includes("*")) {
      const regexStr =
        "^" + pattern.replace(/:[^/]+/g, "[^/]+").replace(/\*/g, ".*") + "$";
      return new RegExp(regexStr).test(path);
    }
    return path === pattern;
  });
}

function getRoleHome(role: UserRole): string {
  if (role === "SUPER_ADMIN") return "/super-admin/users";
  return "/dashboard";
}

// Super-admin-only paths
const SUPER_ADMIN_PATHS = ["/super-admin"];

function requiresSuperAdmin(path: string) {
  return SUPER_ADMIN_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

export function RouteGuard({ children }: RouteGuardProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;

    const isPublic = matchPublicRoute(location.pathname, PUBLIC_ROUTES);

    if (!isAuthenticated && !isPublic) {
      navigate("/login", { state: { from: location.pathname }, replace: true });
      return;
    }

    if (isAuthenticated && user) {
      // Redirect from auth pages to proper home
      const authPages = ["/login", "/register", "/forgot-password"];
      if (authPages.includes(location.pathname)) {
        navigate(getRoleHome(user.role), { replace: true });
        return;
      }

      // Non-super-admin trying to access super-admin routes
      if (
        requiresSuperAdmin(location.pathname) &&
        user.role !== "SUPER_ADMIN"
      ) {
        navigate("/dashboard", { replace: true });
        return;
      }

      // Suspended user — only allow settings (disabled for now - allow all pages)
      // if (!user.is_active && location.pathname !== "/dashboard/settings") {
      //   navigate("/dashboard/settings", { replace: true });
      //   return;
      // }
    }
  }, [user, isLoading, isAuthenticated, location.pathname, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
