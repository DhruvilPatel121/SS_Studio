import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { adminApi } from "@/services/api";
import { formatDateShort, getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import {
  Search,
  MoreVertical,
  UserCheck,
  UserX,
  Trash2,
  Edit,
  Shield,
} from "lucide-react";
import type { User } from "@/types";

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "default",
  ADMIN: "default",
  PHOTOGRAPHER: "secondary",
  STAFF: "outline",
};

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editUser, setEditUser] = useState<User | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", { search, role: roleFilter, page }],
    queryFn: () =>
      adminApi.users({
        search,
        role: roleFilter === "all" ? undefined : roleFilter,
        page,
        limit: 20,
      }),
  });

  const suspend = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adminApi.suspendUser(id, active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User status updated");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User deleted");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<User> }) =>
      adminApi.updateUser(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setEditUser(null);
      toast.success("User updated");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const users: User[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-editorial text-3xl font-bold tracking-tight">
            User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{total} users</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search users…"
            className="pl-9"
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(v) => {
            setRoleFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="PHOTOGRAPHER">Photographer</SelectItem>
            <SelectItem value="STAFF">Staff</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border border-border shadow-none">
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full min-w-max">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                    User
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                    Role
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                    Status
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                    Joined
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="px-4 py-3">
                        <Skeleton className="h-8 w-48" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-6 w-20" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-6 w-16" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-6 w-24" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-6 w-8 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
                            {u.name?.[0]?.toUpperCase() ?? "U"}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{u.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant={ROLE_COLORS[u.role] as any}
                          className="text-xs"
                        >
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant={u.is_active ? "secondary" : "destructive"}
                          className="text-xs"
                        >
                          {u.is_active ? "Active" : "Suspended"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                        {formatDateShort(u.created_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
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
                            <DropdownMenuItem
                              onClick={() => setEditUser(u)}
                              className="gap-2"
                            >
                              <Edit className="h-3.5 w-3.5" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                suspend.mutate({
                                  id: u.id,
                                  active: !u.is_active,
                                })
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
                            <DropdownMenuItem
                              onClick={() => {
                                if (confirm("Delete this user?"))
                                  deleteUser.mutate(u.id);
                              }}
                              className="gap-2 text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
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
        </CardContent>
      </Card>

      {/* Pagination */}
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

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editUser && (
            <EditUserForm
              user={editUser}
              onSave={(data) => updateUser.mutate({ id: editUser.id, data })}
              isLoading={updateUser.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function EditUserForm({
  user,
  onSave,
  isLoading,
}: {
  user: User;
  onSave: (data: Partial<User>) => void;
  isLoading: boolean;
}) {
  const { register, handleSubmit, watch, setValue } = useForm({
    defaultValues: { name: user.name, role: user.role },
  });

  return (
    <form
      onSubmit={handleSubmit((d) => onSave(d as any))}
      className="space-y-4 mt-2"
    >
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input {...register("name")} />
      </div>
      <div className="space-y-1.5">
        <Label>Role</Label>
        <Select
          value={watch("role")}
          onValueChange={(v) => setValue("role", v as any)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="PHOTOGRAPHER">Photographer</SelectItem>
            <SelectItem value="STAFF">Staff</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
