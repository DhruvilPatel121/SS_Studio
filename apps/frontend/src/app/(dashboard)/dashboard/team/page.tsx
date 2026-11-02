"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/progress";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { Users, UserPlus, Trash2, Mail } from "lucide-react";
import { useQuery as useEventsQuery } from "@tanstack/react-query";

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
  role: z.enum(["PHOTOGRAPHER", "STAFF"]),
});
type InviteData = z.infer<typeof inviteSchema>;

export default function TeamPage() {
  const qc = useQueryClient();
  const [eventId, setEventId] = useState("");

  const { data: events } = useQuery({
    queryKey: ["events-list"],
    queryFn: () => api.getEvents({ limit: 100 }),
  });

  const { data: members, isLoading } = useQuery({
    queryKey: ["team", eventId],
    queryFn: () => api.getTeamMembers(eventId),
    enabled: !!eventId,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: "STAFF" },
  });

  const invite = useMutation({
    mutationFn: (d: InviteData) =>
      api.inviteTeamMember(eventId, d.email, d.role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team", eventId] });
      toast.success("Invitation sent");
      reset();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => api.removeTeamMember(eventId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team", eventId] });
      toast.success("Member removed");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <DashboardShell title="Team Members">
      <div className="max-w-2xl space-y-6">
        {/* Event selector */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Select Event</label>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select an event…</option>
            {events?.data?.map((ev: any) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>

        {/* Invite form */}
        {eventId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Invite Team Member
              </CardTitle>
            </CardHeader>
            <form onSubmit={handleSubmit((d) => invite.mutate(d))}>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Input
                      {...register("email")}
                      placeholder="colleague@example.com"
                      leftIcon={<Mail className="h-4 w-4" />}
                      error={errors.email?.message}
                    />
                  </div>
                  <select
                    {...register("role")}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="STAFF">Staff</option>
                    <option value="PHOTOGRAPHER">Photographer</option>
                  </select>
                  <Button type="submit" loading={isSubmitting}>
                    Invite
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        )}

        {/* Members list */}
        {eventId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> Current Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14" />
                  ))}
                </div>
              ) : !members?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">
                    No team members yet. Invite someone to collaborate.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((m: any) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={m.user?.name ?? m.email} size="sm" />
                        <div>
                          <p className="text-sm font-medium">
                            {m.user?.name ?? "Pending"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {m.user?.email ?? m.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            m.role === "PHOTOGRAPHER" ? "default" : "secondary"
                          }
                        >
                          {m.role}
                        </Badge>
                        <Badge
                          variant={
                            m.status === "ACCEPTED" ? "success" : "warning"
                          }
                        >
                          {m.status ?? "INVITED"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Remove this team member?"))
                              remove.mutate(m.userId ?? m.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
