import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminApi } from "@/services/api";
import { formatRelative, getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RotateCcw,
} from "lucide-react";

const STATUS_META: Record<string, { color: string; icon: React.ElementType }> =
  {
    PENDING: { color: "secondary", icon: Clock },
    ACTIVE: { color: "default", icon: Loader2 },
    COMPLETED: { color: "secondary", icon: CheckCircle },
    FAILED: { color: "destructive", icon: XCircle },
  };

const TYPE_COLORS: Record<string, string> = {
  PHOTO_THUMBNAIL: "bg-blue-100 text-blue-800 border-blue-200",
  FACE_DETECTION: "bg-purple-100 text-purple-800 border-purple-200",
  ZIP_GENERATION: "bg-orange-100 text-orange-800 border-orange-200",
};

export default function AdminJobsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-jobs", { status: statusFilter, type: typeFilter, page }],
    queryFn: () =>
      adminApi.jobs({
        status: statusFilter === "all" ? undefined : statusFilter,
        type: typeFilter === "all" ? undefined : typeFilter,
        page,
      }),
    refetchInterval: 8000,
  });

  const retry = useMutation({
    mutationFn: (id: string) => adminApi.retryJob(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-jobs"] });
      toast.success("Job retrying");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const jobs: any[] = data?.data ?? [];
  const summary: any = (data as any)?.summary ?? {};
  const totalPages = data?.totalPages ?? 1;

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-editorial text-3xl font-bold tracking-tight">
            Job Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            BullMQ processing pipeline
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Pending",
            value: summary.pending ?? 0,
            color: "text-muted-foreground",
          },
          {
            label: "Active",
            value: summary.active ?? 0,
            color: "text-blue-600",
          },
          {
            label: "Completed",
            value: summary.completed ?? 0,
            color: "text-green-600",
          },
          {
            label: "Failed",
            value: summary.failed ?? 0,
            color: "text-destructive",
          },
        ].map((s) => (
          <Card key={s.label} className="border border-border shadow-none">
            <CardContent className="p-3">
              <p className={`font-editorial text-2xl font-bold ${s.color}`}>
                {s.value}
              </p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="PHOTO_THUMBNAIL">Photo Thumbnail</SelectItem>
            <SelectItem value="FACE_DETECTION">Face Detection</SelectItem>
            <SelectItem value="ZIP_GENERATION">ZIP Generation</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Jobs table */}
      <Card className="border border-border shadow-none">
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full min-w-max">
              <thead>
                <tr className="border-b border-border bg-muted/50">
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
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td colSpan={6} className="px-4 py-3">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                ) : jobs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      No jobs found
                    </td>
                  </tr>
                ) : (
                  jobs.map((j: any) => {
                    const meta = STATUS_META[j.status] ?? STATUS_META.PENDING;
                    const StatusIcon = meta.icon;
                    return (
                      <tr
                        key={j.id}
                        className="border-b border-border hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`text-xs px-2 py-0.5 rounded border font-medium ${TYPE_COLORS[j.type] ?? "bg-muted text-muted-foreground border-border"}`}
                          >
                            {j.type?.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <StatusIcon
                              className={`h-3.5 w-3.5 ${j.status === "ACTIVE" ? "animate-spin" : ""} ${j.status === "FAILED" ? "text-destructive" : j.status === "COMPLETED" ? "text-green-600" : "text-muted-foreground"}`}
                            />
                            <Badge
                              variant={meta.color as any}
                              className="text-xs"
                            >
                              {j.status}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {j.attempts}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-destructive max-w-[200px] truncate">
                          {j.error ?? "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                          {formatRelative(j.created_at)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          {j.status === "FAILED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => retry.mutate(j.id)}
                              disabled={retry.isPending}
                            >
                              <RotateCcw className="h-3 w-3" /> Retry
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </DashboardLayout>
  );
}
