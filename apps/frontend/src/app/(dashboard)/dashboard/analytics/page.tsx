"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/progress";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6"];

export default function AnalyticsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["photographer-analytics"],
    queryFn: () => api.getPhotographerAnalytics(),
  });

  const processingData =
    stats?.processingQueue?.map((q: any) => ({
      name: q.status,
      value: q._count,
    })) ?? [];

  return (
    <DashboardShell title="Analytics">
      <div className="space-y-6">
        {/* Overview stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))
            : [
                { label: "Events", value: stats?.eventCount ?? 0 },
                { label: "Photos", value: stats?.totalPhotos ?? 0 },
                { label: "Faces", value: stats?.totalFaces ?? 0 },
                { label: "Guests", value: stats?.totalGuests ?? 0 },
                { label: "Downloads", value: stats?.totalDownloads ?? 0 },
              ].map((item) => (
                <Card key={item.label}>
                  <CardContent className="pt-5 pb-4">
                    <p className="text-2xl font-bold">
                      {formatNumber(item.value)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.label}
                    </p>
                  </CardContent>
                </Card>
              ))}
        </div>

        {/* Processing status breakdown */}
        {processingData.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Photo Processing Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={processingData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status Distribution</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={processingData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {processingData.map((_: any, idx: number) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
