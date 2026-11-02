import React from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { eventsApi } from "@/services/api";
import { getErrorMessage } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

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

export default function NewEventPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      privacy: "PRIVATE" as const,
      theme: "DEFAULT" as const,
      ai_enabled: true,
      match_threshold: 0.45,
    },
  });

  const create = useMutation({
    mutationFn: (d: FormData) => eventsApi.create(d as any),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event created!");
      navigate(`/dashboard/events/${res?.id ?? res?.data?.id}`);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <DashboardLayout>
      <div className="max-w-2xl">
        <button
          onClick={() => navigate("/dashboard/events")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Events
        </button>

        <h1 className="font-editorial text-3xl font-bold tracking-tight mb-6">
          Create Event
        </h1>

        <form
          onSubmit={handleSubmit((d) => create.mutate(d))}
          className="space-y-6"
        >
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Event name *</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="Wedding of Jane & John"
                />
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
                  placeholder="Optional event description…"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    {...register("location")}
                    placeholder="Grand Ballroom, NYC"
                  />
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
                    Guests can find their photos using a selfie
                  </p>
                </div>
                <Switch
                  checked={watch("ai_enabled")}
                  onCheckedChange={(v) => setValue("ai_enabled", v)}
                />
              </div>
              {watch("ai_enabled") && (
                <div className="space-y-1.5">
                  <Label htmlFor="match_threshold">
                    Match threshold: {watch("match_threshold")}
                  </Label>
                  <Input
                    id="match_threshold"
                    {...register("match_threshold")}
                    type="range"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    className="h-2 cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Strict (fewer, accurate)</span>
                    <span>Loose (more, some false positives)</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/dashboard/events")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create Event"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
