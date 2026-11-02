"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { User, Lock } from "lucide-react";

const profileSchema = z.object({
  name: z.string().min(2),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

const pwSchema = z
  .object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(8),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

type ProfileData = z.infer<typeof profileSchema>;
type PwData = z.infer<typeof pwSchema>;

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => api.getMyProfile(),
  });

  const profileForm = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    values: profile ?? {},
  });

  const pwForm = useForm<PwData>({ resolver: zodResolver(pwSchema) });

  const saveProfile = useMutation({
    mutationFn: (d: ProfileData) => api.updateMyProfile(d as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Profile updated");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const changePw = useMutation({
    mutationFn: (d: PwData) =>
      api.changePassword(d.currentPassword, d.newPassword),
    onSuccess: () => {
      pwForm.reset();
      toast.success("Password changed");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <DashboardShell title="Settings">
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" /> Profile
            </CardTitle>
          </CardHeader>
          <form
            onSubmit={profileForm.handleSubmit((d) => saveProfile.mutate(d))}
          >
            <CardContent className="space-y-4">
              <Input
                {...profileForm.register("name")}
                label="Full Name"
                error={profileForm.formState.errors.name?.message}
              />
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">
                  Email
                </label>
                <p className="text-sm">{profile?.email}</p>
              </div>
              <Input
                {...profileForm.register("avatarUrl")}
                label="Avatar URL (optional)"
                placeholder="https://…"
                error={profileForm.formState.errors.avatarUrl?.message}
              />
              <div className="flex justify-end">
                <Button type="submit" loading={saveProfile.isPending}>
                  Save Profile
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" /> Change Password
            </CardTitle>
          </CardHeader>
          <form onSubmit={pwForm.handleSubmit((d) => changePw.mutate(d))}>
            <CardContent className="space-y-4">
              <Input
                {...pwForm.register("currentPassword")}
                label="Current Password"
                type="password"
              />
              <Input
                {...pwForm.register("newPassword")}
                label="New Password"
                type="password"
                error={pwForm.formState.errors.newPassword?.message}
              />
              <Input
                {...pwForm.register("confirmPassword")}
                label="Confirm New Password"
                type="password"
                error={pwForm.formState.errors.confirmPassword?.message}
              />
              <div className="flex justify-end">
                <Button type="submit" loading={changePw.isPending}>
                  Change Password
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      </div>
    </DashboardShell>
  );
}
