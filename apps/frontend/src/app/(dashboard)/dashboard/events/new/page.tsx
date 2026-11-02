"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function NewEventPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { privacy: "PRIVATE" },
  });

  const create = useMutation({
    mutationFn: (d: FormData) => api.createEvent(d as any),
    onSuccess: (event) => {
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event created!");
      router.push(`/dashboard/events/${event.id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <DashboardShell title="Create Event">
      <div className="max-w-2xl">
        <Link
          href="/dashboard/events"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Events
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit((d) => create.mutate(d))}>
            <CardContent className="space-y-4">
              <Input
                {...register("name")}
                label="Event Name *"
                placeholder="Raj & Priya Wedding 2026"
                error={errors.name?.message}
              />
              <Textarea
                {...register("description")}
                label="Description"
                placeholder="Brief description of this event"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  {...register("location")}
                  label="Location"
                  placeholder="The Grand Ballroom, Mumbai"
                />
                <Input
                  {...register("eventDate")}
                  label="Event Date"
                  type="date"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Privacy *</label>
                  <select
                    {...register("privacy")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="PRIVATE">Private (invite only)</option>
                    <option value="UNLISTED">Unlisted (link access)</option>
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
                <Link href="/dashboard/events">
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" loading={isSubmitting}>
                  Create Event
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      </div>
    </DashboardShell>
  );
}
