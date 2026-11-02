import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { adminApi, permissionsApi } from "@/services/api";
import type { AdminPermissions } from "@/services/api";
import { toast } from "sonner";
import { getErrorMessage, formatDateShort } from "@/lib/utils";
import {
  Plus,
  Search,
  MoreVertical,
  UserCheck,
  UserX,
  Copy,
  RefreshCw,
  Users,
  Shield,
  Settings2,
  ChevronRight,
} from "lucide-react";
import type { User } from "@/types";

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "destructive",
  ADMIN: "default",
  PHOTOGRAPHER: "secondary",
  STAFF: "outline",
};

const ROLES = [
  { value: "ADMIN", label: "Admin" },
  { value: "PHOTOGRAPHER", label: "Photographer" },
  { value: "STAFF", label: "Staff" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
];

interface CreateAdminResult {
  email: string;
  password: string;
  name: string;
  studio_name?: string;
  quota_limit?: number;
}

// ─── Permission Editor Dialog ─────────────────────────────────────────────────
function PermissionsDialog({
  user,
  open,
  onClose,
}: {
  user: User | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const { data: perms, isLoading } = useQuery({
    queryKey: ["admin-perms", user?.id],
    queryFn: () => permissionsApi.get(user!.id),
    enabled: !!user?.id && open,
  });

  const defaultPerms: Omit<AdminPermissions, "id" | "id" | "updated_at"> =
    {
      can_upload: true,
      can_analytics: true,
      can_branding: true,
      can_team: true,
      can_qr: true,
      can_settings: false,
      max_events: 50,
      max_photos: 10000,
      max_storage_gb: 50,
      notes: null,
    };

  const [form, setForm] = useState(defaultPerms);

  React.useEffect(() => {
    if (perms) {
      const {
        id: _id,
        id: _aid,
        updated_at: _ua,
        ...rest
      } = perms as any;
      setForm(rest);
    } else {
      setForm(defaultPerms);
    }
  }, [perms]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () => permissionsApi.upsert(user!.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-perms", user?.id] });
      toast.success("Permissions saved");
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const toggle = (
    key: keyof Omit<
      AdminPermissions,
      | "id"
      | "id"
      | "updated_at"
      | "max_events"
      | "max_photos"
      | "max_storage_gb"
      | "notes"
    >,
  ) => setForm((f) => ({ ...f, [key]: !f[key] }));

  const setNum = (
    key: "max_events" | "max_photos" | "max_storage_gb",
    val: string,
  ) => setForm((f) => ({ ...f, [key]: Number(val) || 0 }));

  const featureFlags: Array<{
    key:
      | "can_upload"
      | "can_analytics"
      | "can_branding"
      | "can_team"
      | "can_qr"
      | "can_settings";
    label: string;
    desc: string;
  }> = [
    {
      key: "can_upload",
      label: "Photo Upload",
      desc: "Upload photos to events",
    },
    {
      key: "can_analytics",
      label: "Analytics",
      desc: "View event analytics & stats",
    },
    {
      key: "can_branding",
      label: "Branding",
      desc: "Customize studio logo & colors",
    },
    {
      key: "can_team",
      label: "Team Members",
      desc: "Invite photographers & staff",
    },
    { key: "can_qr", label: "QR Codes", desc: "Generate & download QR codes" },
    {
      key: "can_settings",
      label: "Settings",
      desc: "Access advanced account settings",
    },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-editorial flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Permissions — {user?.name}
          </DialogTitle>
          <DialogDescription>
            Control which features this admin account can access on their
            dashboard.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-5 py-1">
            {/* Feature toggles */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Feature Access
              </p>
              <div className="space-y-1">
                {featureFlags.map(({ key, label, desc }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-none">
                        {label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {desc}
                      </p>
                    </div>
                    <Switch
                      checked={!!form[key]}
                      onCheckedChange={() => toggle(key)}
                      className="shrink-0"
                    />
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Usage Limits */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Usage Limits
              </p>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    { key: "max_events", label: "Max Events" },
                    { key: "max_photos", label: "Max Photos" },
                    { key: "max_storage_gb", label: "Storage (GB)" },
                  ] as const
                ).map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form[key]}
                      onChange={(e) => setNum(key, e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Internal Notes
              </Label>
              <Textarea
                rows={2}
                placeholder="Notes about this admin account (internal only)…"
                value={form.notes ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value || null }))
                }
                className="text-sm resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => save.mutate()}
                disabled={save.isPending}
              >
                {save.isPending ? "Saving…" : "Save Permissions"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SuperAdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ADMIN");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<CreateAdminResult | null>(
    null,
  );
  const [form, setForm] = useState({
    name: "",
    email: "",
    studio_name: "",
    quota_limit: 25000,
    password: "CamSort@Admin2026!",
    role: "ADMIN" as string,
  });
  const [creating, setCreating] = useState(false);
  const [permsUser, setPermsUser] = useState<User | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["sa-users", search, roleFilter, page],
    queryFn: () =>
      adminApi.users({ page, search, role: roleFilter || undefined }),
  });

  const suspend = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adminApi.suspendUser(id, active),
    onSuccess: (_, { active }) => {
      qc.invalidateQueries({ queryKey: ["sa-users"] });
      toast.success(active ? "User activated" : "User suspended");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const users: User[] = (data?.data ?? []).filter(
    (u: User) => u.role !== "SUPER_ADMIN",
  );
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.studio_name) {
      toast.error("Name, email, and studio name are required");
      return;
    }
    setCreating(true);
    try {
      const result = await adminApi.createAdminUser({
        name: form.name,
        email: form.email,
        studio_name: form.studio_name,
        quota_limit: Number(form.quota_limit) || 25000,
        password: form.password || "CamSort@Admin2026!",
        role: form.role,
      });
      setCreatedCreds(result);
      setForm({
        name: "",
        email: "",
        studio_name: "",
        quota_limit: 25000,
        password: "CamSort@Admin2026!",
      });
      qc.invalidateQueries({ queryKey: ["sa-users"] });
      toast.success("Studio Admin account created successfully!");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  return (
    <DashboardLayout requiredRoles={["SUPER_ADMIN"]}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-editorial text-3xl font-bold tracking-tight">
            Studio Admins
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage admin accounts — each admin runs their own studio on CamSort
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setCreatedCreds(null);
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Create Admin
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: "Total Admins",
            value: users.filter((u) => u.role === "ADMIN").length,
            icon: Shield,
          },
          {
            label: "Photographers",
            value: users.filter((u) => u.role === "PHOTOGRAPHER").length,
            icon: Users,
          },
          {
            label: "Staff",
            value: users.filter((u) => u.role === "STAFF").length,
            icon: Users,
          },
          {
            label: "Active",
            value: users.filter((u) => u.is_active).length,
            icon: UserCheck,
          },
        ].map((s) => (
          <Card key={s.label} className="border shadow-none">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="font-bold text-xl">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email…"
            className="pl-9"
          />
        </div>
        <Select
          value={roleFilter || "all"}
          onValueChange={(v) => {
            setRoleFilter(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="PHOTOGRAPHER">Photographer</SelectItem>
            <SelectItem value="STAFF">Staff</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {[
                  "Name",
                  "Email",
                  "Role",
                  "Studio",
                  "Status",
                  "Joined",
                  "Permissions",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-4 py-3" colSpan={8}>
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-12 text-muted-foreground text-sm"
                  >
                    No studio admins found. Create the first one above.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                          {u.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <span className="text-sm font-medium whitespace-nowrap">
                          {u.name || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge
                        variant={ROLE_COLORS[u.role] as any}
                        className="text-xs"
                      >
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {u.studio_name || "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge
                        variant={u.is_active ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {u.is_active ? "Active" : "Suspended"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateShort(u.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {u.role === "ADMIN" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => setPermsUser(u)}
                        >
                          <Settings2 className="h-3 w-3" /> Edit
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {u.role === "ADMIN" && (
                            <DropdownMenuItem
                              onClick={() => setPermsUser(u)}
                              className="gap-2"
                            >
                              <Settings2 className="h-3.5 w-3.5" /> Manage
                              Permissions
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() =>
                              suspend.mutate({ id: u.id, active: !u.is_active })
                            }
                            className="gap-2"
                          >
                            {u.is_active ? (
                              <>
                                <UserX className="h-3.5 w-3.5" /> Suspend
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3.5 w-3.5" /> Activate
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
              Page {page} of {totalPages} · {total} total
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

      {/* Create Admin Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreatedCreds(null);
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-editorial">
              Create Studio Admin
            </DialogTitle>
            <DialogDescription>
              Creates a new admin account. A secure password will be
              auto-generated and shown once.
            </DialogDescription>
          </DialogHeader>
          {createdCreds ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/60 p-4 space-y-3 border border-border shadow-sm">
                <p className="text-sm font-semibold text-foreground">
                  Studio Admin account created! Save & share these credentials:
                </p>
                {[
                  { label: "Admin Email", value: createdCreds.email },
                  { label: "Password", value: createdCreds.password },
                  {
                    label: "Studio Organization",
                    value:
                      createdCreds.studio_name ||
                      form.studio_name ||
                      "Assigned",
                  },
                  {
                    label: "Media Storage Quota",
                    value: `${(createdCreds.quota_limit || form.quota_limit || 25000).toLocaleString()} photos & videos`,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 bg-card/60 p-2 rounded-lg border border-border/50"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="text-sm font-mono font-medium truncate text-foreground">
                        {item.value}
                      </p>
                    </div>
                    {item.label !== "Media Storage Quota" &&
                      item.label !== "Studio Organization" && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => copy(item.value)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                The new studio admin can now log in at{" "}
                <span className="font-mono text-foreground">/login</span> and
                will strictly access only their studio's media.
              </p>
              <Button
                className="w-full"
                onClick={() => {
                  setCreateOpen(false);
                  setCreatedCreds(null);
                }}
              >
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="admin-name">Admin Name *</Label>
                <Input
                  id="admin-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. David Miller"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-email">Admin Email *</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="e.g. admin@ddstudio.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-studio">Studio Organization Name *</Label>
                <Input
                  id="admin-studio"
                  value={form.studio_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, studio_name: e.target.value }))
                  }
                  placeholder="e.g. Dhruvil Studio"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-role">Role *</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
                >
                  <SelectTrigger id="admin-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Each studio is completely isolated; DD Studio will never see
                BR Studio's photos.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="admin-quota">
                  Combined Media Storage Quota (Photos & Videos) *
                </Label>
                <Input
                  id="admin-quota"
                  type="number"
                  min={100}
                  step={500}
                  value={form.quota_limit}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      quota_limit: Number(e.target.value) || 25000,
                    }))
                  }
                  placeholder="25000"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Combined photo & video limit (e.g. 25,000). Deleting old
                  photos automatically restores capacity.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-pass">Initial Password</Label>
                <Input
                  id="admin-pass"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  placeholder="CamSort@Admin2026!"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={creating}>
                  {creating ? "Creating…" : "Create Studio Admin"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <PermissionsDialog
        user={permsUser}
        open={!!permsUser}
        onClose={() => setPermsUser(null)}
      />
    </DashboardLayout>
  );
}
