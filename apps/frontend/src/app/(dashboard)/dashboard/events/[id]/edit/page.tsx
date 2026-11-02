"use client";

import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/progress";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
  location: z.string().optional(),
  eventDate: z.string().optional(),
  privacy: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]),
  theme: z.string().optional(),
  expiresAt: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: () => api.getEvent(id),
    enabled: !!id,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: event
      ? {
          name: event.name,
          description: event.description ?? "",
          location: event.location ?? "",
          eventDate: event.eventDate ? event.eventDate.slice(0, 10) : "",
          privacy: event.privacy ?? "PRIVATE",
          theme: event.theme ?? "",
          expiresAt: event.expiresAt ? event.expiresAt.slice(0, 16) : "",
        }
      : undefined,
  });

  const update = useMutation({
    mutationFn: (d: FormData) => api.updateEvent(id, d as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event", id] });
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event updated!");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isLoading)
    return (
      <DashboardShell>
        <div className="max-w-2xl space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64" />
        </div>
      </DashboardShell>
    );

  return (
    <DashboardShell title="Edit Event">
      <div className="max-w-2xl">
        <Link
          href={`/dashboard/events/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Event
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Edit Event Details</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit((d) => update.mutate(d))}>
            <CardContent className="space-y-4">
              <Input
                {...register("name")}
                label="Event Name *"
                error={errors.name?.message}
              />
              <Textarea {...register("description")} label="Description" />
              <div className="grid grid-cols-2 gap-4">
                <Input {...register("location")} label="Location" />
                <Input
                  {...register("eventDate")}
                  label="Event Date"
                  type="date"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Privacy</label>
                  <select
                    {...register("privacy")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="PRIVATE">Private</option>
                    <option value="UNLISTED">Unlisted</option>
                    <option value="PUBLIC">Public</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Theme</label>
                  <select
                    {...register("theme")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Default</option>
                    <option value="WEDDING">Wedding</option>
                    <option value="CORPORATE">Corporate</option>
                    <option value="BIRTHDAY">Birthday</option>
                    <option value="SPORTS">Sports</option>
                    <option value="GRADUATION">Graduation</option>
                  </select>
                </div>
              </div>
              <Input
                {...register("expiresAt")}
                label="Expiry Date (optional)"
                type="datetime-local"
              />
              <div className="flex justify-end gap-3 pt-2">
                <Link href={`/dashboard/events/${id}`}>
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" loading={isSubmitting}>
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      </div>
    </DashboardShell>
  );
}
