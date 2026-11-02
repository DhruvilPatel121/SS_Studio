import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { notificationsApi } from "@/services/api";
import { formatRelative, getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { Bell, CheckCheck } from "lucide-react";

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: notificationsApi.list,
  });

  const markRead = useMutation({
    mutationFn: (ids?: string[]) => notificationsApi.markRead(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const notifications = Array.isArray(data) ? data : [];
  const unread = notifications.filter((n: any) => !n.read_at);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-editorial text-3xl font-bold tracking-tight">
          Notifications
        </h1>
        {unread.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => markRead.mutate()}>
            <CheckCheck className="h-3.5 w-3.5 mr-1.5" /> Mark all read
          </Button>
        )}
      </div>

      <div className="max-w-2xl">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <h3 className="font-semibold mb-1">All caught up!</h3>
            <p className="text-sm text-muted-foreground">
              No notifications yet
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n: any) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-4 border rounded-lg transition-colors ${
                  !n.read_at
                    ? "bg-accent/5 border-accent/20"
                    : "bg-card border-border"
                }`}
              >
                <div
                  className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${!n.read_at ? "bg-accent" : "bg-transparent"}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {n.body}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatRelative(n.created_at)}
                    </span>
                  </div>
                  {n.type && (
                    <Badge variant="outline" className="mt-1.5 text-xs">
                      {n.type}
                    </Badge>
                  )}
                </div>
                {!n.read_at && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => markRead.mutate([n.id])}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
