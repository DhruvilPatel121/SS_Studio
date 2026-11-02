import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminApi } from "@/services/api";
import { formatDateShort, formatRelative, getErrorMessage } from "@/lib/utils";
import { Search, Shield } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800 border-green-200",
  UPDATE: "bg-blue-100 text-blue-800 border-blue-200",
  DELETE: "bg-red-100 text-red-800 border-red-200",
  LOGIN: "bg-purple-100 text-purple-800 border-purple-200",
  UPLOAD: "bg-orange-100 text-orange-800 border-orange-200",
};

export default function AdminAuditLogsPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", { page, action: actionFilter }],
    queryFn: () =>
      adminApi.auditLogs({
        page,
        limit: 20,
        action: actionFilter === "all" ? undefined : actionFilter,
      }),
  });

  const logs: any[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-editorial text-3xl font-bold tracking-tight">
            Audit Logs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} log entries
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="pl-9"
          />
        </div>
        <Select
          value={actionFilter}
          onValueChange={(v) => {
            setActionFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="CREATE">Create</SelectItem>
            <SelectItem value="UPDATE">Update</SelectItem>
            <SelectItem value="DELETE">Delete</SelectItem>
            <SelectItem value="LOGIN">Login</SelectItem>
            <SelectItem value="UPLOAD">Upload</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border border-border shadow-none">
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full min-w-max">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                    Action
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                    User
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                    Resource
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                    IP
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td colSpan={5} className="px-4 py-3">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      No log entries found
                    </td>
                  </tr>
                ) : (
                  logs.map((log: any) => (
                    <tr
                      key={log.id}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`text-xs px-2 py-0.5 rounded border font-medium ${ACTION_COLORS[log.action] ?? "bg-muted text-muted-foreground border-border"}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.user ? (
                          <div>
                            <p className="text-sm font-medium">
                              {log.user.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {log.user.email}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            System
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className="font-mono text-xs text-muted-foreground">
                          {log.resource}
                          {log.resourceId
                            ? `#${log.resourceId.slice(0, 8)}`
                            : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground font-mono">
                        {log.ipAddress ?? "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                        {formatRelative(log.created_at)}
                      </td>
                    </tr>
                  ))
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
