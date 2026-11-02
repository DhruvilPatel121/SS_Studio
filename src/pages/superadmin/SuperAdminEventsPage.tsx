import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/services/api";
import { formatDateShort } from "@/lib/utils";
import { Search, Calendar, Images, Users, RefreshCw } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "default",
  ARCHIVED: "secondary",
  DELETED: "destructive",
};

export default function SuperAdminEventsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["sa-events", search, page],
    queryFn: () => adminApi.allEvents({ page, search }),
  });

  const events = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <DashboardLayout requiredRoles={["SUPER_ADMIN"]}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-editorial text-3xl font-bold tracking-tight">
            All Events
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} events across all studios
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="gap-1.5 shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search events…"
          className="pl-9"
        />
      </div>

      <Card className="border shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                  Event
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                  Date
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                  Photographer
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                  Privacy
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-4 py-3" colSpan={6}>
                      <Skeleton className="h-7 w-full" />
                    </td>
                  </tr>
                ))
              ) : events.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-12 text-muted-foreground text-sm"
                  >
                    No events found
                  </td>
                </tr>
              ) : (
                events.map((ev: any) => (
                  <tr
                    key={ev.id}
                    className="border-b border-border hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium whitespace-nowrap">
                          {ev.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {ev.event_date ? formatDateShort(ev.event_date) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {ev.photographer?.name || "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge
                        variant={STATUS_COLORS[ev.status] as any}
                        className="text-xs"
                      >
                        {ev.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="outline" className="text-xs">
                        {ev.privacy}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateShort(ev.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </DashboardLayout>
  );
}
