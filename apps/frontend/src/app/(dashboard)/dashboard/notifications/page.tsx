"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/progress";
import { Bell, CheckCheck } from "lucide-react";
import { formatRelative } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.getNotifications(),
  });

  const markRead = useMutation({
    mutationFn: (ids?: string[]) => api.markNotificationsRead(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Marked as read");
    },
  });

  const unread = notifications?.filter((n: any) => !n.readAt) ?? [];

  return (
    <DashboardShell
      title="Notifications"
      actions={
        unread.length > 0 ? (
          <Button variant="outline" size="sm" onClick={() => markRead.mutate()}>
            <CheckCheck className="mr-1 h-4 w-4" /> Mark all read
          </Button>
        ) : undefined
      }
    >
      <div className="max-w-2xl">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : !notifications?.length ? (
          <div className="text-center py-20">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-1">No notifications</h3>
            <p className="text-sm text-muted-foreground">
              You're all caught up!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n: any) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-4 border rounded-lg transition-colors ${
                  !n.readAt ? "bg-primary/5 border-primary/20" : "bg-card"
                }`}
              >
                <div
                  className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${!n.readAt ? "bg-primary" : "bg-transparent"}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {n.body}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatRelative(n.createdAt)}
                    </span>
                  </div>
                  {n.type && (
                    <Badge variant="outline" className="mt-1.5 text-xs">
                      {n.type}
                    </Badge>
                  )}
                </div>
                {!n.readAt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-shrink-0"
                    onClick={() => markRead.mutate([n.id])}
                  >
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
