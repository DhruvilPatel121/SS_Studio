import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { eventsApi, analyticsApi } from "@/services/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = [
  "hsl(354 64% 33%)",
  "hsl(0 0% 20%)",
  "hsl(0 0% 45%)",
  "hsl(354 40% 55%)",
  "hsl(0 0% 70%)",
];

const RANGE_OPTIONS = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
];

export default function AnalyticsPage() {
  const [range, setRange] = useState("30d");
  const [eventId, setEventId] = useState("all");

  const { data: eventsData } = useQuery({
    queryKey: ["events-analytics"],
    queryFn: () => eventsApi.list({ limit: 100 }),
  });

  const { data: analyticsData, isLoading } = useQuery<any>({
    queryKey: ["analytics", eventId, range],
    queryFn: () =>
      eventId === "all"
        ? analyticsApi.photographer()
        : analyticsApi.event(eventId),
  });

  const events = eventsData?.data ?? [];
  const stats: any = analyticsData ?? {};
  const timelineData = (stats as any).timeline ?? [];
  const topEvents = (stats as any).topEvents ?? [];

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="font-editorial text-3xl font-bold tracking-tight">
          Analytics
        </h1>
        <div className="flex items-center gap-3">
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {events.map((ev: any) => (
                <SelectItem key={ev.id} value={ev.id}>
                  {ev.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Photos", value: stats.totalPhotos ?? 0 },
              { label: "Faces Detected", value: stats.totalFaces ?? 0 },
              { label: "Guest Searches", value: stats.totalSearches ?? 0 },
              { label: "Downloads", value: stats.totalDownloads ?? 0 },
            ].map((s) => (
              <Card key={s.label} className="border border-border shadow-none">
                <CardContent className="p-4">
                  <p className="font-editorial text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {s.label}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Timeline chart */}
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Activity Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {timelineData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                  No data available for this period
                </div>
              ) : (
                <div className="w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={timelineData}
                      margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                        }}
                      />
                      <Bar
                        dataKey="searches"
                        name="Searches"
                        fill={COLORS[0]}
                        radius={[3, 3, 0, 0]}
                      />
                      <Bar
                        dataKey="downloads"
                        name="Downloads"
                        fill={COLORS[1]}
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top events */}
          {topEvents.length > 0 && (
            <Card className="border border-border shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Top Events by Searches
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={topEvents}
                        dataKey="searches"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                      >
                        {topEvents.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend
                        layout="horizontal"
                        wrapperStyle={{ paddingTop: 8 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
