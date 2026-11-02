"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatDate } from "@/lib/utils";
import {
  Camera,
  Users,
  Download,
  BarChart2,
  CalendarDays,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth.store";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["photographer-analytics"],
    queryFn: () => api.getPhotographerAnalytics(),
  });
  const { data: eventsData } = useQuery({
    queryKey: ["events", { limit: 5 }],
    queryFn: () => api.getEvents({ limit: 5, status: "ACTIVE" }),
  });

  const statCards = [
    {
      label: "Total Events",
      value: stats?.eventCount ?? 0,
      icon: CalendarDays,
      color: "text-blue-500",
    },
    {
      label: "Total Photos",
      value: stats?.totalPhotos ?? 0,
      icon: Camera,
      color: "text-violet-500",
    },
    {
      label: "Faces Detected",
      value: stats?.totalFaces ?? 0,
      icon: Zap,
      color: "text-amber-500",
    },
    {
      label: "Total Guests",
      value: stats?.totalGuests ?? 0,
      icon: Users,
      color: "text-green-500",
    },
    {
      label: "Downloads",
      value: stats?.totalDownloads ?? 0,
      icon: Download,
      color: "text-pink-500",
    },
  ];

  return (
    <DashboardShell
      title={`Welcome back, ${user?.name?.split(" ")[0] ?? "Photographer"} 👋`}
      actions={
        <Link href="/dashboard/events/new">
          <Button size="sm">
            <CalendarDays className="mr-2 h-4 w-4" /> New Event
          </Button>
        </Link>
      }
    >
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-20 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold mt-0.5">
                      {formatNumber(s.value)}
                    </p>
                  )}
                </div>
                <s.icon className={`h-5 w-5 ${s.color} mt-0.5`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Events */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Recent Events</CardTitle>
          <Link href="/dashboard/events">
            <Button variant="ghost" size="sm">
              View all
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {!eventsData?.data?.length ? (
            <div className="text-center py-10">
              <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No events yet.</p>
              <Link href="/dashboard/events/new">
                <Button variant="outline" size="sm" className="mt-3">
                  Create your first event
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {eventsData.data.map((ev: any) => (
                <Link
                  key={ev.id}
                  href={`/dashboard/events/${ev.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{ev.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ev.location} • {formatDate(ev.eventDate ?? ev.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {ev._count?.photos ?? 0} photos
                    </span>
                    <Badge
                      variant={ev.status === "ACTIVE" ? "success" : "secondary"}
                    >
                      {ev.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
