import React from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/db/supabase";
import { Database, Shield, Users, Calendar, Zap } from "lucide-react";

export default function SuperAdminSettingsPage() {
  const { data: stats } = useQuery({
    queryKey: ["sa-system-stats"],
    queryFn: async () => {
      const [users, events, photos, jobs] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("photos").select("id", { count: "exact", head: true }),
        supabase
          .from("processing_jobs")
          .select("id", { count: "exact", head: true })
          .eq("status", "PENDING"),
      ]);
      return {
        users: users.count ?? 0,
        events: events.count ?? 0,
        photos: photos.count ?? 0,
        pendingJobs: jobs.count ?? 0,
      };
    },
  });

  const systemInfo = [
    { label: "Platform", value: "CamSort SaaS" },
    { label: "Version", value: "1.0.0" },
    { label: "Database", value: "PostgreSQL 16 (Supabase)" },
    { label: "Auth", value: "Supabase Auth (email+password)" },
    { label: "Storage", value: "Supabase Storage (S3-compatible)" },
    { label: "AI Engine", value: "InsightFace / ArcFace (pending)" },
    { label: "Email verification", value: "Disabled" },
  ];

  return (
    <DashboardLayout requiredRoles={["SUPER_ADMIN"]}>
      <div className="mb-6">
        <h1 className="font-editorial text-3xl font-bold tracking-tight">
          System Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform configuration and health overview
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Users", value: stats?.users ?? "—", icon: Users },
          {
            label: "Total Events",
            value: stats?.events ?? "—",
            icon: Calendar,
          },
          {
            label: "Total Photos",
            value: stats?.photos ?? "—",
            icon: Database,
          },
          {
            label: "Pending Jobs",
            value: stats?.pendingJobs ?? "—",
            icon: Zap,
          },
        ].map((s) => (
          <Card key={s.label} className="border shadow-none">
            <CardContent className="p-5 flex items-center gap-3">
              <s.icon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="font-bold text-2xl">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System info */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" /> System
              Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {systemInfo.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between px-5 py-2.5"
                >
                  <span className="text-sm text-muted-foreground">
                    {item.label}
                  </span>
                  <span className="text-sm font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" /> Security
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {[
              {
                label: "Row Level Security (RLS)",
                status: "Enabled",
                ok: true,
              },
              { label: "Email verification", status: "Disabled", ok: true },
              { label: "Supabase Auth", status: "Active", ok: true },
              { label: "Service Role Functions", status: "Deployed", ok: true },
              { label: "AI Face Service", status: "Pending setup", ok: false },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between"
              >
                <span className="text-sm">{item.label}</span>
                <Badge
                  variant={item.ok ? "default" : "secondary"}
                  className="text-xs"
                >
                  {item.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
