import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { analyticsApi, eventsApi } from "@/services/api";
import { formatDateShort, formatRelative } from "@/lib/utils";
import {
  Calendar,
  Images,
  Users,
  Download,
  TrendingUp,
  Plus,
  ArrowRight,
  Camera,
} from "lucide-react";
import { StudioQuotaMeter } from "@/components/dashboard/StudioQuotaMeter";

export default function DashboardHomePage() {
  const { data: analytics, isLoading: aLoading } = useQuery<any>({
    queryKey: ["analytics-photographer"],
    queryFn: () => analyticsApi.photographer(),
  });

  const { data: eventsData, isLoading: eLoading } = useQuery({
    queryKey: ["events-recent"],
    queryFn: () => eventsApi.list({ limit: 5, page: 1 }),
  });

  const stats: any = analytics ?? {};
  const events = eventsData?.data ?? [];

  const statCards = [
    {
      label: "Total Events",
      value: stats.totalEvents ?? "—",
      icon: Calendar,
      trend: stats.eventsGrowth,
    },
    {
      label: "Photos Uploaded",
      value: stats.totalPhotos ?? "—",
      icon: Images,
      trend: stats.photosGrowth,
    },
    {
      label: "Faces Detected",
      value: stats.totalFaces ?? "—",
      icon: Camera,
      trend: stats.facesGrowth,
    },
    {
      label: "Guest Searches",
      value: stats.totalSearches ?? "—",
      icon: Users,
      trend: stats.searchesGrowth,
    },
    {
      label: "Downloads",
      value: stats.totalDownloads ?? "—",
      icon: Download,
      trend: stats.downloadsGrowth,
    },
  ];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-editorial text-3xl font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of your photo sharing activity
          </p>
        </div>
        <Link to="/dashboard/events/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> New Event
          </Button>
        </Link>
      </div>

      {/* Studio Quota Meter */}
      <StudioQuotaMeter />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map((s) => (
          <Card key={s.label} className="border border-border shadow-none">
            <CardContent className="p-4">
              {aLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <s.icon className="h-4 w-4 text-muted-foreground" />
                    {s.trend != null && (
                      <span
                        className={`text-xs flex items-center gap-0.5 ${s.trend >= 0 ? "text-green-600" : "text-destructive"}`}
                      >
                        <TrendingUp className="h-3 w-3" />
                        {Math.abs(s.trend)}%
                      </span>
                    )}
                  </div>
                  <p className="font-editorial text-2xl font-bold mt-2">
                    {s.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent events */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border border-border shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">
              Recent Events
            </CardTitle>
            <Link to="/dashboard/events">
              <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {eLoading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No events yet</p>
                <Link to="/dashboard/events/new">
                  <Button variant="outline" size="sm" className="mt-3">
                    Create first event
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {events.map((ev: any) => (
                  <Link
                    key={ev.id}
                    to={`/dashboard/events/${ev.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{ev.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ev.event_date
                          ? formatDateShort(ev.event_date)
                          : "No date"}{" "}
                        · {ev.photo_count ?? 0} photos
                      </p>
                    </div>
                    <Badge
                      variant={ev.status === "ACTIVE" ? "default" : "secondary"}
                      className="shrink-0 ml-3 text-xs"
                    >
                      {ev.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card className="border border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              {
                label: "Create new event",
                to: "/dashboard/events/new",
                icon: Calendar,
              },
              { label: "Upload photos", to: "/dashboard/upload", icon: Images },
              { label: "Generate QR code", to: "/dashboard/qr", icon: Camera },
              {
                label: "View analytics",
                to: "/dashboard/analytics",
                icon: TrendingUp,
              },
              {
                label: "Customize branding",
                to: "/dashboard/branding",
                icon: Camera,
              },
            ].map((action) => (
              <Link key={action.to} to={action.to}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted transition-colors group cursor-pointer">
                  <action.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                  <span className="text-sm">{action.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
