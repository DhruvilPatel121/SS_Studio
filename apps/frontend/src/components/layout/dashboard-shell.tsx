"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { Sidebar } from "./sidebar";
import { Navbar } from "./navbar";
import { Spinner } from "@/components/ui/progress";

interface DashboardShellProps {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}

export function DashboardShell({
  children,
  title,
  actions,
}: DashboardShellProps) {
  const { user, isLoading, fetchMe } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!user) fetchMe();
  }, []);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user]);

  if (isLoading || !user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden relative">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar title={title} actions={actions} />
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
