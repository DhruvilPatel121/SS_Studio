import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/services/api";
import { formatRelative } from "@/lib/utils";
import { Search, RefreshCw, Shield } from "lucide-react";

export default function SuperAdminAuditLogsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["sa-audit-logs", search, page],
    queryFn: () => adminApi.auditLogs({ page, action: search || undefined }),
  });

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <DashboardLayout requiredRoles={["SUPER_ADMIN"]}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-editorial text-3xl font-bold tracking-tight">
            Audit Logs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} log entries
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
          placeholder="Filter by action…"
          className="pl-9"
        />
      </div>

      <Card className="border shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                  User
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                  Action
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                  Resource
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                  IP Address
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                  When
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-4 py-3" colSpan={5}>
                      <Skeleton className="h-7 w-full" />
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-12 text-muted-foreground"
                  >
                    <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No audit logs yet</p>
                  </td>
                </tr>
              ) : (
                logs.map((log: any) => (
                  <tr
                    key={log.id}
                    className="border-b border-border hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {log.user?.name || log.user?.email || "System"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {log.resource}
                      {log.resource_id
                        ? ` · ${log.resource_id.slice(0, 8)}…`
                        : ""}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground font-mono whitespace-nowrap">
                      {log.ip_address || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {formatRelative(log.created_at)}
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
