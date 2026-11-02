import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { settingsApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { User, Lock, Upload } from "lucide-react";

const profileSchema = z.object({
  name: z.string().min(2, "Name required"),
  phone: z.string().optional(),
  studio_name: z.string().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password required"),
    newPassword: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "Requires uppercase")
      .regex(/[0-9]/, "Requires number"),
    confirmNewPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

type ProfileData = z.infer<typeof profileSchema>;
type PasswordData = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.get,
  });

  const profileForm = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    values: data
      ? {
          name: (data as any).name ?? "",
          phone: (data as any).phone ?? "",
          studio_name: (data as any).studio_name ?? "",
        }
      : undefined,
  });

  const passwordForm = useForm<PasswordData>({
    resolver: zodResolver(passwordSchema),
  });

  const updateProfile = useMutation({
    mutationFn: (d: ProfileData) => settingsApi.updateProfile(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Profile updated");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const updatePassword = useMutation({
    mutationFn: (d: PasswordData) =>
      settingsApi.updatePassword({
        currentPassword: d.currentPassword,
        newPassword: d.newPassword,
      }),
    onSuccess: () => {
      passwordForm.reset();
      toast.success("Password updated");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => settingsApi.uploadAvatar(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Avatar updated");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (isLoading)
    return (
      <DashboardLayout>
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-64" />
      </DashboardLayout>
    );

  const profile = data as any;

  return (
    <DashboardLayout>
      <h1 className="font-editorial text-3xl font-bold tracking-tight mb-6">
        Settings
      </h1>

      <div className="max-w-2xl space-y-6">
        {/* Profile */}
        <Card className="border border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" /> Profile
            </CardTitle>
          </CardHeader>
          <form
            onSubmit={profileForm.handleSubmit((d) => updateProfile.mutate(d))}
          >
            <CardContent className="space-y-4">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-xl font-bold text-primary-foreground shrink-0 overflow-hidden">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (user?.name?.[0]?.toUpperCase() ?? "U")
                  )}
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadAvatar.mutate(f);
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      {uploadAvatar.isPending ? "Uploading…" : "Change avatar"}
                    </span>
                  </Button>
                </label>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Full name</Label>
                  <Input {...profileForm.register("name")} />
                  {profileForm.formState.errors.name && (
                    <p className="text-xs text-destructive">
                      {profileForm.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Studio name</Label>
                  <Input {...profileForm.register("studio_name")} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  {...profileForm.register("phone")}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  value={user?.email ?? ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={profileForm.formState.isSubmitting}
                >
                  {profileForm.formState.isSubmitting
                    ? "Saving…"
                    : "Save Profile"}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>

        {/* Password */}
        <Card className="border border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" /> Change Password
            </CardTitle>
          </CardHeader>
          <form
            onSubmit={passwordForm.handleSubmit((d) =>
              updatePassword.mutate(d),
            )}
          >
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Current password</Label>
                <Input
                  {...passwordForm.register("currentPassword")}
                  type="password"
                  placeholder="••••••••"
                />
                {passwordForm.formState.errors.currentPassword && (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.currentPassword.message}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>New password</Label>
                  <Input
                    {...passwordForm.register("newPassword")}
                    type="password"
                    placeholder="••••••••"
                  />
                  {passwordForm.formState.errors.newPassword && (
                    <p className="text-xs text-destructive">
                      {passwordForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm new password</Label>
                  <Input
                    {...passwordForm.register("confirmNewPassword")}
                    type="password"
                    placeholder="••••••••"
                  />
                  {passwordForm.formState.errors.confirmNewPassword && (
                    <p className="text-xs text-destructive">
                      {passwordForm.formState.errors.confirmNewPassword.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={passwordForm.formState.isSubmitting}
                >
                  {passwordForm.formState.isSubmitting
                    ? "Updating…"
                    : "Update Password"}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
