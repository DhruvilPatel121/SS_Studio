import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { adminApi } from "@/services/api";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import {
  Server,
  Shield,
  Gauge,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export default function AdminSystemSettingsPage() {
  const qc = useQueryClient();

  const { data: settingsRes, isLoading: sLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: adminApi.systemSettings,
  });

  const { data: healthRes, isLoading: hLoading } = useQuery({
    queryKey: ["system-health"],
    queryFn: adminApi.health,
    refetchInterval: 30000,
  });

  const settings = settingsRes ?? {};
  const health = healthRes ?? {};

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm({
    values: Object.keys(settings).length
      ? {
          appName: (settings as any).appName ?? "CamSort",
          maintenanceMode: (settings as any).maintenanceMode ?? false,
          defaultMatchThreshold:
            (settings as any).defaultMatchThreshold ?? 0.45,
          maxUploadSizeMb: (settings as any).maxUploadSizeMb ?? 50,
          rateLimit: (settings as any).rateLimit ?? 10,
          allowRegistration: (settings as any).allowRegistration ?? true,
        }
      : undefined,
  });

  const updateSettings = useMutation({
    mutationFn: (d: Record<string, unknown>) =>
      adminApi.updateSystemSettings(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system-settings"] });
      toast.success("Settings saved");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (sLoading) {
    return (
      <DashboardLayout>
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-80" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <h1 className="font-editorial text-3xl font-bold tracking-tight mb-6">
        System Settings
      </h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Settings form */}
        <form
          onSubmit={handleSubmit((d) => updateSettings.mutate(d as any))}
          className="space-y-6"
        >
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="h-4 w-4" /> Platform Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>App name</Label>
                <Input {...register("appName")} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Maintenance mode</p>
                  <p className="text-xs text-muted-foreground">
                    Disable platform access for non-admins
                  </p>
                </div>
                <Switch
                  checked={watch("maintenanceMode")}
                  onCheckedChange={(v) => setValue("maintenanceMode", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Allow registration</p>
                  <p className="text-xs text-muted-foreground">
                    Allow new photographers to sign up
                  </p>
                </div>
                <Switch
                  checked={watch("allowRegistration")}
                  onCheckedChange={(v) => setValue("allowRegistration", v)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="h-4 w-4" /> Limits & Thresholds
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>
                  Default face match threshold: {watch("defaultMatchThreshold")}
                </Label>
                <Input
                  {...register("defaultMatchThreshold")}
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  className="h-2 cursor-pointer"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Strict</span>
                  <span>Loose</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Max upload size (MB)</Label>
                  <Input
                    {...register("maxUploadSizeMb")}
                    type="number"
                    min="1"
                    max="200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Search rate limit (req/min)</Label>
                  <Input
                    {...register("rateLimit")}
                    type="number"
                    min="1"
                    max="100"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Saving…" : "Save Settings"}
          </Button>
        </form>

        {/* System health */}
        <Card className="border border-border shadow-none h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  {
                    label: "API Server",
                    status: (health as any).api ?? "unknown",
                  },
                  {
                    label: "Database (PostgreSQL)",
                    status: (health as any).database ?? "unknown",
                  },
                  {
                    label: "Cache (Redis)",
                    status: (health as any).redis ?? "unknown",
                  },
                  {
                    label: "Storage (MinIO)",
                    status: (health as any).storage ?? "unknown",
                  },
                  {
                    label: "AI Service",
                    status: (health as any).aiService ?? "unknown",
                  },
                  {
                    label: "Queue (BullMQ)",
                    status: (health as any).queue ?? "unknown",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center justify-between p-3 border border-border rounded-lg"
                  >
                    <span className="text-sm font-medium">{s.label}</span>
                    <div className="flex items-center gap-1.5">
                      {s.status === "ok" || s.status === "healthy" ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <Badge
                            variant="secondary"
                            className="text-xs text-green-700 bg-green-50 border-green-200"
                          >
                            Healthy
                          </Badge>
                        </>
                      ) : s.status === "degraded" ? (
                        <>
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          <Badge
                            variant="secondary"
                            className="text-xs text-yellow-700 bg-yellow-50 border-yellow-200"
                          >
                            Degraded
                          </Badge>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          <Badge variant="destructive" className="text-xs">
                            Down
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
