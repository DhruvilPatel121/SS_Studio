import React, { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { eventsApi } from "@/services/api";
import { getErrorMessage } from "@/lib/utils";
import { ArrowLeft, ImagePlus, X, Loader2 } from "lucide-react";

const THEME_VALUES = [
  "DEFAULT",
  "WEDDING",
  "CORPORATE",
  "BIRTHDAY",
  "SPORTS",
  "GRADUATION",
] as const;

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
  location: z.string().optional(),
  event_date: z.string().optional(),
  privacy: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]),
  theme: z.enum(THEME_VALUES),
  ai_enabled: z.boolean(),
  match_threshold: z.coerce.number().min(0.1).max(1),
});
type FormData = z.infer<typeof schema>;

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);

  const { data: evtRes, isLoading } = useQuery<any>({
    queryKey: ["event", id],
    queryFn: () => eventsApi.get(id!),
    enabled: !!id,
  });

  const ev = evtRes as any;

  // Sync cover preview from existing event data
  const currentCover = coverPreview ?? ev?.cover_image_url ?? null;

  const handleCoverUpload = async (file: File) => {
    if (!id) return;
    setCoverUploading(true);
    try {
      const { cover_image_url } = await eventsApi.uploadCoverImage(id, file);
      setCoverPreview(cover_image_url);
      qc.invalidateQueries({ queryKey: ["event", id] });
      toast.success("Cover photo updated!");
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setCoverUploading(false);
    }
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: ev
      ? {
          name: ev.name ?? "",
          description: ev.description ?? "",
          location: ev.location ?? "",
          event_date: ev.event_date ? ev.event_date.slice(0, 10) : "",
          privacy: (ev.privacy ?? "PRIVATE") as FormData["privacy"],
          theme: (ev.theme ?? "DEFAULT") as FormData["theme"],
          ai_enabled: ev.ai_enabled ?? true,
          match_threshold: ev.match_threshold ?? 0.45,
        }
      : undefined,
  });

  const update = useMutation({
    mutationFn: (d: FormData) => eventsApi.update(id!, d as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event", id] });
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event updated!");
      navigate(`/dashboard/events/${id}`);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-64" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl">
        <button
          onClick={() => navigate(`/dashboard/events/${id}`)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Event
        </button>

        <h1 className="font-editorial text-3xl font-bold tracking-tight mb-6">
          Edit Event
        </h1>

        <form
          onSubmit={handleSubmit((d) => update.mutate(d))}
          className="space-y-6"
        >
          {/* Cover Photo Upload */}
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cover Photo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentCover ? (
                <div className="relative rounded-lg overflow-hidden h-40 border border-border group">
                  <img
                    src={currentCover}
                    alt="Cover"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="border border-white/60 text-white hover:bg-white/10"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={coverUploading}
                    >
                      {coverUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <ImagePlus className="h-4 w-4 mr-1" />
                      )}
                      Change
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="border border-white/60 text-white hover:bg-white/10"
                      onClick={() => setCoverPreview("")}
                    >
                      <X className="h-4 w-4 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={coverUploading}
                  className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-accent/60 hover:bg-muted/30 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {coverUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <ImagePlus className="h-6 w-6" />
                  )}
                  <span className="text-sm">
                    {coverUploading
                      ? "Uploading…"
                      : "Click to upload event cover photo"}
                  </span>
                  <span className="text-xs">
                    JPEG, PNG, WebP · Recommended 1920×600
                  </span>
                </button>
              )}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCoverUpload(file);
                  e.target.value = "";
                }}
              />
            </CardContent>
          </Card>
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Event name *</Label>
                <Input id="name" {...register("name")} />
                {errors.name && (
                  <p className="text-xs text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" {...register("location")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event_date">Event date</Label>
                  <Input
                    id="event_date"
                    {...register("event_date")}
                    type="date"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Privacy</Label>
                  <Select
                    value={watch("privacy")}
                    onValueChange={(v) => setValue("privacy", v as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRIVATE">Private</SelectItem>
                      <SelectItem value="UNLISTED">Unlisted</SelectItem>
                      <SelectItem value="PUBLIC">Public</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Theme</Label>
                  <Select
                    value={watch("theme")}
                    onValueChange={(v) => setValue("theme", v as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEFAULT">Default</SelectItem>
                      <SelectItem value="WEDDING">Wedding</SelectItem>
                      <SelectItem value="CORPORATE">Corporate</SelectItem>
                      <SelectItem value="BIRTHDAY">Birthday</SelectItem>
                      <SelectItem value="SPORTS">Sports</SelectItem>
                      <SelectItem value="GRADUATION">Graduation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">AI Face Recognition</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Enable face recognition</p>
                  <p className="text-xs text-muted-foreground">
                    Guests can find photos using a selfie
                  </p>
                </div>
                <Switch
                  checked={watch("ai_enabled")}
                  onCheckedChange={(v) => setValue("ai_enabled", v)}
                />
              </div>
              {watch("ai_enabled") && (
                <div className="space-y-1.5">
                  <Label>Match threshold: {watch("match_threshold")}</Label>
                  <Input
                    {...register("match_threshold")}
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
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/dashboard/events/${id}`)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
