import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/services/api";
import { formatRelative, formatDateShort } from "@/lib/utils";
import {
  RefreshCw,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "secondary",
  ACTIVE: "default",
  COMPLETED: "outline",
  FAILED: "destructive",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  PENDING: Clock,
  ACTIVE: Loader2,
  COMPLETED: CheckCircle2,
  FAILED: XCircle,
};

export default function SuperAdminJobsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["sa-jobs", statusFilter, typeFilter, page],
    queryFn: () =>
      adminApi.jobs({
        page,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
      }),
    refetchInterval: 10000, // auto-refresh every 10s
  });

  const jobs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <DashboardLayout requiredRoles={["SUPER_ADMIN"]}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-editorial text-3xl font-bold tracking-tight">
            Processing Jobs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} total jobs · auto-refreshes every 10s
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => {
            setStatusFilter(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={typeFilter || "all"}
          onValueChange={(v) => {
            setTypeFilter(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="PHOTO_THUMBNAIL">Photo Thumbnail</SelectItem>
            <SelectItem value="FACE_DETECTION">Face Detection</SelectItem>
            <SelectItem value="ZIP_GENERATION">ZIP Generation</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                  Type
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                  Attempts
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                  Error
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                  Created
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                  Updated
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
              ) : jobs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-12 text-muted-foreground text-sm"
                  >
                    No jobs found
                  </td>
                </tr>
              ) : (
                jobs.map((j: any) => {
                  const StatusIcon = STATUS_ICONS[j.status] ?? Zap;
                  return (
                    <tr
                      key={j.id}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-mono">{j.type}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant={STATUS_COLORS[j.status] as any}
                          className="gap-1 text-xs"
                        >
                          <StatusIcon
                            className={`h-3 w-3 ${j.status === "ACTIVE" ? "animate-spin" : ""}`}
                          />
                          {j.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {j.attempts}
                      </td>
                      <td className="px-4 py-3 text-xs text-destructive max-w-[200px] truncate">
                        {j.error || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {formatRelative(j.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {formatRelative(j.updated_at)}
                      </td>
                    </tr>
                  );
                })
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
