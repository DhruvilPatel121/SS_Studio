import React, { useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "./AppSidebar";
import { TopNavbar } from "./TopNavbar";
import { Breadcrumbs } from "./Breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserRole } from "@/types";

interface DashboardLayoutProps {
  children: ReactNode;
  requiredRoles?: UserRole[];
}

export function DashboardLayout({
  children,
  requiredRoles,
}: DashboardLayoutProps) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopNavbar onMenuClick={() => setMobileOpen(true)} />
        <Breadcrumbs />
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="p-4 md:p-6 max-w-[1400px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
