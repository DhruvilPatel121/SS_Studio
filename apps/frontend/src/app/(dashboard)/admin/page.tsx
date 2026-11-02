"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { formatDate, formatRelative, getErrorMessage } from "@/lib/utils";
import {
  Shield,
  Users,
  CalendarDays,
  Settings2,
  AlertTriangle,
  RefreshCw,
  Search,
  UserX,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

type AdminTab = "overview" | "users" | "events" | "jobs" | "audit" | "settings";

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("overview");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.getSuperAdminStats(),
  });

  const tabs: { key: AdminTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "users", label: "Users" },
    { key: "events", label: "Events" },
    { key: "jobs", label: "Jobs" },
    { key: "audit", label: "Audit Log" },
    { key: "settings", label: "Settings" },
  ];

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-md transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`;

  return (
    <DashboardShell title="Super Admin">
      <div className="space-y-6">
        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={tabClass(tab === t.key)}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <AdminOverview stats={stats} isLoading={isLoading} />
        )}
        {tab === "users" && <AdminUsers />}
        {tab === "events" && <AdminEvents />}
        {tab === "jobs" && <AdminJobs />}
        {tab === "audit" && <AdminAuditLog />}
        {tab === "settings" && <AdminSystemSettings />}
      </div>
    </DashboardShell>
  );
}

function AdminOverview({
  stats,
  isLoading,
}: {
  stats: any;
  isLoading: boolean;
}) {
  const { data: health } = useQuery({
    queryKey: ["system-health"],
    queryFn: () => api.getSystemHealth(),
    refetchInterval: 30000,
  });

  const statItems = [
    { label: "Total Users", value: stats?.users ?? 0, icon: Users },
    { label: "Photographers", value: stats?.photographers ?? 0, icon: Users },
    { label: "Events", value: stats?.events ?? 0, icon: CalendarDays },
    { label: "Photos", value: stats?.photos ?? 0, icon: CalendarDays },
    { label: "Faces Indexed", value: stats?.faces ?? 0, icon: Shield },
    {
      label: "Active Sessions",
      value: stats?.activeSessions ?? 0,
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))
          : statItems.map((item) => (
              <Card key={item.label}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold">
                    {item.value.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.label}
                  </p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* System health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">System Health</CardTitle>
        </CardHeader>
        <CardContent>
          {!health ? (
            <Skeleton className="h-16" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {health.services?.map((svc: any) => (
                <div
                  key={svc.name}
                  className="flex items-center gap-2 p-3 border rounded-lg"
                >
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${svc.status === "ONLINE" ? "bg-green-500" : "bg-red-500"}`}
                  />
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {svc.name.replace("_", " ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {svc.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processing job breakdown */}
      {stats?.processingJobs?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Processing Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.processingJobs.map((j: any) => (
                <Badge
                  key={j.status}
                  variant={
                    j.status === "FAILED"
                      ? "destructive"
                      : j.status === "ACTIVE"
                        ? "success"
                        : "secondary"
                  }
                >
                  {j.status}: {j._count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AdminUsers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, role, page],
    queryFn: () =>
      api.getAdminUsers({ search, role: role || undefined, page, limit: 20 }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      api.updateAdminUser(userId, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteUser = useMutation({
    mutationFn: (userId: string) => api.deleteAdminUser(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User deleted");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Input
          leftIcon={<Search className="h-4 w-4" />}
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All roles</option>
          <option value="SUPER_ADMIN">Super Admin</option>
          <option value="ADMIN">Admin</option>
          <option value="PHOTOGRAPHER">Photographer</option>
          <option value="STAFF">Staff</option>
          <option value="GUEST">Guest</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {data?.data?.map((user: any) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-card"
            >
              <div className="flex items-center gap-3">
                <Avatar name={user.name} size="sm" />
                <div>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    user.role === "SUPER_ADMIN" ? "default" : "secondary"
                  }
                >
                  {user.role}
                </Badge>
                <Badge variant={user.isActive ? "success" : "destructive"}>
                  {user.isActive ? "Active" : "Suspended"}
                </Badge>
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {user._count?.ownedEvents} events
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    toggleActive.mutate({
                      userId: user.id,
                      isActive: !user.isActive,
                    })
                  }
                  title={user.isActive ? "Suspend" : "Activate"}
                >
                  {user.isActive ? (
                    <UserX className="h-4 w-4 text-destructive" />
                  ) : (
                    <UserCheck className="h-4 w-4 text-green-600" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm(`Delete user ${user.email}?`))
                      deleteUser.mutate(user.id);
                  }}
                >
                  <span className="text-sm">×</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {data?.pagination && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm py-2">
            {page} / {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!data.pagination.hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function AdminEvents() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-events", search, status, page],
    queryFn: () =>
      api.getAdminEvents({
        search,
        status: status || undefined,
        page,
        limit: 20,
      }),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Input
          leftIcon={<Search className="h-4 w-4" />}
          placeholder="Search events…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
          <option value="DRAFT">Draft</option>
        </select>
      </div>

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="space-y-2">
          {data?.data?.map((ev: any) => (
            <div
              key={ev.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-card"
            >
              <div>
                <p className="text-sm font-medium">{ev.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ev.owner?.name} • {ev._count?.photos ?? 0} photos •{" "}
                  {ev._count?.guestProfiles ?? 0} guests
                </p>
              </div>
              <Badge variant={ev.status === "ACTIVE" ? "success" : "secondary"}>
                {ev.status}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {data?.pagination?.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm py-2">
            {page} / {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!data.pagination.hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function AdminJobs() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-jobs", status, type, page],
    queryFn: () =>
      api.getJobsList({
        status: status || undefined,
        type: type || undefined,
        page,
        limit: 20,
      }),
    refetchInterval: 10000,
  });

  const retry = useMutation({
    mutationFn: (jobId: string) => api.retryJob(jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-jobs"] });
      toast.success("Job queued for retry");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All types</option>
          <option value="PHOTO_THUMBNAIL">Thumbnail</option>
          <option value="FACE_DETECTION">Face Detection</option>
          <option value="ZIP_GENERATION">ZIP</option>
        </select>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="space-y-2">
          {data?.data?.map((job: any) => (
            <div
              key={job.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-card text-sm"
            >
              <div>
                <p className="font-medium">{job.type}</p>
                <p className="text-xs text-muted-foreground">
                  {formatRelative(job.createdAt)} • {job.progress ?? 0}%
                  complete
                  {job.error && (
                    <span className="text-destructive">
                      {" "}
                      • {job.error.slice(0, 50)}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    job.status === "COMPLETED"
                      ? "success"
                      : job.status === "FAILED"
                        ? "destructive"
                        : job.status === "ACTIVE"
                          ? "info"
                          : "secondary"
                  }
                >
                  {job.status}
                </Badge>
                {job.status === "FAILED" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => retry.mutate(job.id)}
                    loading={retry.isPending}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> Retry
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminAuditLog() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page],
    queryFn: () => api.getAuditLogs({ page, limit: 30 }),
  });

  return (
    <div className="space-y-3">
      {isLoading ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="space-y-1">
          {data?.data?.map((log: any) => (
            <div
              key={log.id}
              className="flex items-start gap-3 p-3 border rounded-lg bg-card text-sm"
            >
              <div className="flex-1">
                <span className="font-medium">
                  {log.user?.name ?? "System"}
                </span>
                <span className="text-muted-foreground"> performed </span>
                <Badge variant="outline" className="text-xs">
                  {log.action}
                </Badge>
                {log.resourceType && (
                  <span className="text-muted-foreground">
                    {" "}
                    on {log.resourceType}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatRelative(log.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}

      {data?.pagination?.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm py-2">
            {page} / {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!data.pagination.hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function AdminSystemSettings() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["system-settings"],
    queryFn: () => api.getSystemSettings(),
  });

  const save = useMutation({
    mutationFn: (d: any) => api.updateSystemSettings(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system-settings"] });
      toast.success("Settings saved");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const [form, setForm] = useState<any>(null);
  const current = form ?? settings ?? {};

  return (
    <div className="max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4" /> System Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="App Name"
            value={current.appName ?? ""}
            onChange={(e) => setForm({ ...current, appName: e.target.value })}
          />
          <Input
            label="Logo URL"
            value={current.logoUrl ?? ""}
            onChange={(e) => setForm({ ...current, logoUrl: e.target.value })}
          />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Maintenance Mode</p>
              <p className="text-xs text-muted-foreground">
                Disables new registrations and uploads
              </p>
            </div>
            <button
              onClick={() =>
                setForm({
                  ...current,
                  maintenanceMode: !current.maintenanceMode,
                })
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${current.maintenanceMode ? "bg-destructive" : "bg-muted"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${current.maintenanceMode ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </div>
          {current.maintenanceMode && (
            <Input
              label="Maintenance Message"
              value={current.maintenanceMessage ?? ""}
              onChange={(e) =>
                setForm({ ...current, maintenanceMessage: e.target.value })
              }
              placeholder="We're down for scheduled maintenance…"
            />
          )}
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => save.mutate(current)}
              loading={save.isPending}
            >
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
