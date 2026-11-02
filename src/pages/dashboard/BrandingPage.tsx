import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { brandingApi } from "@/services/api";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import {
  Upload,
  Palette,
  Eye,
  Stamp,
  Image as ImageIcon,
  CheckCircle2,
} from "lucide-react";

const schema = z.object({
  primary_color: z.string().optional(),
  secondary_color: z.string().optional(),
  watermark_type: z.enum(["NONE", "TEXT", "LOGO"]),
  watermark_text: z.string().optional(),
  watermark_position: z.enum([
    "TOP_LEFT",
    "TOP_RIGHT",
    "BOTTOM_LEFT",
    "BOTTOM_RIGHT",
    "CENTER",
  ]),
  watermark_opacity: z.number().min(0).max(1),
  footer_text: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function BrandingPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["branding"],
    queryFn: brandingApi.get,
  });

  const branding = data;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: branding
      ? {
          primary_color: branding.primary_color ?? "#121212",
          secondary_color: branding.secondary_color ?? "#8B1E1E",
          watermark_type: branding.watermark_type ?? "NONE",
          watermark_text: branding.watermark_text ?? "",
          watermark_position: branding.watermark_position ?? "BOTTOM_RIGHT",
          watermark_opacity: branding.watermark_opacity ?? 0.5,
          footer_text: branding.footer_text ?? "",
        }
      : undefined,
  });

  const update = useMutation({
    mutationFn: (d: FormData) => brandingApi.update(d as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branding"] });
      toast.success("Branding & watermark settings saved successfully!");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const uploadLogo = useMutation({
    mutationFn: (file: File) => brandingApi.uploadLogo(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branding"] });
      toast.success("Studio logo uploaded successfully");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const currentWatermarkType = watch("watermark_type") || "NONE";
  const currentWatermarkText = watch("watermark_text") || "© CamSort Studio";
  const currentPosition = watch("watermark_position") || "BOTTOM_RIGHT";
  const currentOpacity = watch("watermark_opacity") ?? 0.5;

  if (isLoading)
    return (
      <DashboardLayout>
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-64" />
      </DashboardLayout>
    );

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-editorial text-3xl font-bold tracking-tight">
            Branding & Watermark
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Customize event branding, upload studio logos, and configure
            automatic photo watermarks.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Form Controls Column */}
        <form
          onSubmit={handleSubmit((d) => update.mutate(d))}
          className="lg:col-span-7 space-y-6"
        >
          {/* Logo Card */}
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4 text-accent" /> Studio Logo &
                Identity
              </CardTitle>
              <CardDescription className="text-xs">
                Upload your studio emblem or event brand logo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                {branding?.logo_url ? (
                  <div className="relative group">
                    <img
                      src={branding.logo_url}
                      alt="Logo"
                      className="h-20 w-20 object-contain border border-border rounded-xl p-1 bg-card"
                    />
                  </div>
                ) : (
                  <div className="h-20 w-20 border-2 border-dashed border-border rounded-xl flex items-center justify-center text-muted-foreground bg-muted/20">
                    <Palette className="h-7 w-7 opacity-40" />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="cursor-pointer inline-block">
                    <input
                      type="file"
                      accept="image/png,image/svg+xml,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadLogo.mutate(f);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      asChild
                    >
                      <span>
                        <Upload className="h-3.5 w-3.5" />
                        {uploadLogo.isPending
                          ? "Uploading…"
                          : "Upload New Logo"}
                      </span>
                    </Button>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    PNG, SVG or WEBP (transparent recommended, max 5 MB)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Watermark Controls Card */}
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Stamp className="h-4 w-4 text-accent" /> Custom Photo Watermark
                Controls
              </CardTitle>
              <CardDescription className="text-xs">
                Apply copyright protections or branding over event photographs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Watermark Type</Label>
                  <Select
                    value={currentWatermarkType}
                    onValueChange={(v) => setValue("watermark_type", v as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None (Disabled)</SelectItem>
                      <SelectItem value="TEXT">Text Watermark</SelectItem>
                      <SelectItem value="LOGO">Logo Image</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Placement Position</Label>
                  <Select
                    value={currentPosition}
                    onValueChange={(v) =>
                      setValue("watermark_position", v as any)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BOTTOM_RIGHT">
                        Bottom Right (Default)
                      </SelectItem>
                      <SelectItem value="BOTTOM_LEFT">Bottom Left</SelectItem>
                      <SelectItem value="TOP_RIGHT">Top Right</SelectItem>
                      <SelectItem value="TOP_LEFT">Top Left</SelectItem>
                      <SelectItem value="CENTER">Center</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {currentWatermarkType === "TEXT" && (
                <div className="space-y-1.5">
                  <Label>Watermark Text</Label>
                  <Input
                    {...register("watermark_text")}
                    placeholder="e.g. © 2026 Jane & Jone Wedding · CamSort"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    This custom text is overlaid onto the photo in the selected
                    corner.
                  </p>
                </div>
              )}

              {currentWatermarkType === "LOGO" && !branding?.logo_url && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500">
                  Please upload a studio logo above to use as your image
                  watermark.
                </div>
              )}

              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center text-xs">
                  <Label>Watermark Opacity</Label>
                  <span className="font-mono font-medium">
                    {Math.round(currentOpacity * 100)}%
                  </span>
                </div>
                <Slider
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={[currentOpacity]}
                  onValueChange={([v]) => setValue("watermark_opacity", v)}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>

          {/* Brand Colors */}
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4 text-accent" /> Guest Interface
                Colors
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="primary_color">Primary Theme Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    {...register("primary_color")}
                    className="h-9 w-12 cursor-pointer rounded border border-input p-0.5"
                  />
                  <Input
                    {...register("primary_color")}
                    placeholder="#121212"
                    className="flex-1 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="secondary_color">Accent Highlight Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    {...register("secondary_color")}
                    className="h-9 w-12 cursor-pointer rounded border border-input p-0.5"
                  />
                  <Input
                    {...register("secondary_color")}
                    placeholder="#8B1E1E"
                    className="flex-1 font-mono text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Guest Page Footer */}
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Guest Gallery Footer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <Label>Footer Branding Text</Label>
                <Input
                  {...register("footer_text")}
                  placeholder="Photos by CamSort Studio · camsort.io"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-36 gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isSubmitting ? "Saving Changes…" : "Save All Settings"}
            </Button>
          </div>
        </form>

        {/* Live Watermark Preview Column */}
        <div className="lg:col-span-5 sticky top-20 space-y-4">
          <Card className="border border-border shadow-none overflow-hidden">
            <CardHeader className="pb-3 bg-muted/30 border-b border-border">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-accent" /> Live Watermark Preview
                </span>
                <Badge
                  variant={
                    currentWatermarkType === "NONE" ? "secondary" : "default"
                  }
                  className="text-xs"
                >
                  {currentWatermarkType === "NONE"
                    ? "Disabled"
                    : currentWatermarkType}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time preview of how photos will display and download.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {/* Photo Canvas Simulation */}
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-zinc-950 border border-border shadow-inner">
                {/* Background sample image */}
                <img
                  src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80"
                  alt="Sample wedding preview"
                  className="w-full h-full object-cover brightness-90"
                />

                {/* Watermark Overlay Element */}
                {currentWatermarkType === "TEXT" && (
                  <div
                    style={{ opacity: currentOpacity }}
                    className={`absolute p-3 text-xs md:text-sm font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] pointer-events-none transition-all ${
                      currentPosition === "TOP_LEFT"
                        ? "top-2 left-2 text-left"
                        : currentPosition === "TOP_RIGHT"
                          ? "top-2 right-2 text-right"
                          : currentPosition === "BOTTOM_LEFT"
                            ? "bottom-2 left-2 text-left"
                            : currentPosition === "CENTER"
                              ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
                              : "bottom-2 right-2 text-right"
                    }`}
                  >
                    {currentWatermarkText}
                  </div>
                )}

                {currentWatermarkType === "LOGO" && (
                  <div
                    style={{ opacity: currentOpacity }}
                    className={`absolute p-3 pointer-events-none transition-all ${
                      currentPosition === "TOP_LEFT"
                        ? "top-2 left-2"
                        : currentPosition === "TOP_RIGHT"
                          ? "top-2 right-2"
                          : currentPosition === "BOTTOM_LEFT"
                            ? "bottom-2 left-2"
                            : currentPosition === "CENTER"
                              ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                              : "bottom-2 right-2"
                    }`}
                  >
                    {branding?.logo_url ? (
                      <img
                        src={branding.logo_url}
                        alt="Watermark logo"
                        className="h-10 md:h-12 w-auto object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                      />
                    ) : (
                      <div className="border border-white/60 bg-black/40 backdrop-blur rounded px-2 py-1 text-[11px] text-white">
                        [Logo Placeholder]
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>Sample resolution: 1200 x 900</span>
                <span>
                  Position:{" "}
                  <strong className="text-foreground">{currentPosition}</strong>
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
