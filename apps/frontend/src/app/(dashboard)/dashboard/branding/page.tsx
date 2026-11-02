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
import { Palette, Upload } from "lucide-react";

const schema = z.object({
  studioName: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color")
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color")
    .optional(),
  backgroundColor: z.string().optional(),
  footerText: z.string().optional(),
  watermarkType: z.enum(["NONE", "LOGO", "TEXT", "COMBINED"]).optional(),
  watermarkPosition: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function BrandingPage() {
  const qc = useQueryClient();

  const { data: branding } = useQuery({
    queryKey: ["branding"],
    queryFn: () => api.getBranding(),
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: branding ?? {},
  });

  const save = useMutation({
    mutationFn: (d: FormData) => api.updateBranding(d as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branding"] });
      toast.success("Branding saved");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const primary = watch("primaryColor") ?? "#6366f1";
  const secondary = watch("secondaryColor") ?? "#f59e0b";

  return (
    <DashboardShell title="Branding">
      <div className="max-w-2xl">
        <form
          onSubmit={handleSubmit((d) => save.mutate(d))}
          className="space-y-6"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4" /> Studio Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                {...register("studioName")}
                label="Studio Name"
                placeholder="Your Photography Studio"
              />
              <Input
                {...register("logoUrl")}
                label="Logo URL"
                placeholder="https://…"
                error={errors.logoUrl?.message}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Colors</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Primary Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={primary}
                    {...register("primaryColor")}
                    className="h-10 w-12 rounded cursor-pointer border"
                  />
                  <Input
                    {...register("primaryColor")}
                    placeholder="#6366f1"
                    className="font-mono"
                  />
                </div>
                {errors.primaryColor && (
                  <p className="text-xs text-destructive">
                    {errors.primaryColor.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Secondary Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={secondary}
                    {...register("secondaryColor")}
                    className="h-10 w-12 rounded cursor-pointer border"
                  />
                  <Input
                    {...register("secondaryColor")}
                    placeholder="#f59e0b"
                    className="font-mono"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Watermark</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Watermark Type</label>
                <select
                  {...register("watermarkType")}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="NONE">None</option>
                  <option value="TEXT">Text</option>
                  <option value="LOGO">Logo</option>
                  <option value="COMBINED">Combined</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Position</label>
                <select
                  {...register("watermarkPosition")}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="BOTTOM_RIGHT">Bottom Right</option>
                  <option value="BOTTOM_LEFT">Bottom Left</option>
                  <option value="TOP_RIGHT">Top Right</option>
                  <option value="CENTER">Center</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Footer</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                {...register("footerText")}
                label="Footer Text"
                placeholder="© 2026 Your Studio. All rights reserved."
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting}>
              Save Branding
            </Button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
