import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { eventsApi, teamApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage, formatDateShort } from "@/lib/utils";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Trash2,
  Mail,
  Shield,
  Camera,
  Briefcase,
  CheckCircle2,
  Copy,
  Sparkles,
  KeyRound,
} from "lucide-react";
import type { User } from "@/types";

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
  role: z.enum(["PHOTOGRAPHER", "STAFF"]),
});
type InviteData = z.infer<typeof inviteSchema>;

const newMemberSchema = z.object({
  name: z.string().min(2, "Name must be at elast 2 characters"),
  email: z.string().email("Enter a valid email"),
  role: z.enum(["PHOTOGRAPHER", "STAFF"]),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type NewMemberData = z.infer<typeof newMemberSchema>;

export default function TeamPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"studio" | "event">("studio");
  const [eventId, setEventId] = useState("");
  const [createdMemberCreds, setCreatedMemberCreds] = useState<{
    email: string;
    pass: string;
    name: string;
    role: string;
  } | null>(null);

  // ── 1. Studio-wide Members Query ──
  const { data: studioMembers, isLoading: isStudioLoading } = useQuery<User[]>({
    queryKey: ["studio-team-members", user?.studio_name],
    queryFn: () => teamApi.listStudioMembers(),
  });

  // ── 2. Events Query (for event assignments) ──
  const { data: eventsData } = useQuery<any>({
    queryKey: ["events-team"],
    queryFn: () => eventsApi.list({ limit: 100 }),
  });

  // ── 3. Event-specific Members Query ──
  const { data: eventMembersData, isLoading: isEventLoading } = useQuery<any>({
    queryKey: ["team", eventId],
    queryFn: () => teamApi.list(eventId),
    enabled: !!eventId,
  });

  // Form for Event Invitation
  const {
    register: registerInvite,
    handleSubmit: handleInviteSubmit,
    reset: resetInvite,
    watch: watchInvite,
    setValue: setInviteValue,
    formState: { errors: inviteErrors, isSubmitting: isInviteSubmitting },
  } = useForm<InviteData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: "STAFF" },
  });

  // Form for Direct Studio Member Creation
  const {
    register: registerMember,
    handleSubmit: handleMemberSubmit,
    reset: resetMember,
    watch: watchMember,
    setValue: setMemberValue,
    formState: { errors: memberErrors, isSubmitting: isMemberSubmitting },
  } = useForm<NewMemberData>({
    resolver: zodResolver(newMemberSchema),
    defaultValues: { role: "PHOTOGRAPHER", password: "CamSort@Team2026!" },
  });

  // Create Studio Team Member Mutation
  const createStudioMember = useMutation({
    mutationFn: (d: NewMemberData) =>
      teamApi.createStudioMember(d.name, d.email, d.role, d.password),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["studio-team-members"] });
      setCreatedMemberCreds({
        name: variables.name,
        email: variables.email,
        pass: variables.password,
        role: variables.role,
      });
      toast.success("Team member added to your studio!");
      resetMember({
        name: "",
        email: "",
        role: "PHOTOGRAPHER",
        password: "CamSort@Team2026!",
      });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  // Remove Studio Member Mutation
  const removeStudioMember = useMutation({
    mutationFn: (userId: string) => teamApi.removeStudioMember(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["studio-team-members"] });
      toast.success("Member removed from studio");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  // Event Invite Mutation
  const inviteToEvent = useMutation({
    mutationFn: (d: InviteData) => teamApi.invite(eventId, d.email, d.role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team", eventId] });
      toast.success("Event invitation sent");
      resetInvite();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  // Remove From Event Mutation
  const removeFromEvent = useMutation({
    mutationFn: (userId: string) => teamApi.remove(eventId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team", eventId] });
      toast.success("Member unassigned from event");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const events: any[] = eventsData?.data ?? [];
  const eventMembers: any[] = Array.isArray(eventMembersData)
    ? eventMembersData
    : ((eventMembersData as any)?.data ?? []);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-editorial text-3xl font-bold tracking-tight">
            Studio Team & Roles
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your studio's photographers, assistants, and staff members
            for{" "}
            <span className="font-semibold text-foreground">
              {user?.studio_name || "your studio"}
            </span>
          </p>
        </div>

        <Badge
          variant="outline"
          className="h-7 text-xs bg-accent/10 border-accent/20 text-accent font-medium self-start md:self-auto"
        >
          Isolated Studio Boundary
        </Badge>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v: any) => setActiveTab(v)}
        className="space-y-6"
      >
        <TabsList className="bg-muted/60 p-1 border border-border/60">
          <TabsTrigger value="studio" className="gap-2">
            <Users className="h-4 w-4" /> Studio Team Members
          </TabsTrigger>
          <TabsTrigger value="event" className="gap-2">
            <Camera className="h-4 w-4" /> Event Assignments
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: STUDIO-WIDE TEAM & ROLES ── */}
        <TabsContent value="studio" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Create member card */}
            <div className="md:col-span-1">
              <Card className="border border-border/70 shadow-sm bg-card/80 backdrop-blur-sm sticky top-20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-accent" /> Add Studio
                    Member
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Create roles (Photographers, Assistants, Staff) belonging to{" "}
                    {user?.studio_name || "your studio"}.
                  </CardDescription>
                </CardHeader>

                {createdMemberCreds ? (
                  <CardContent className="space-y-4">
                    <div className="p-3 bg-muted/60 rounded-lg border border-border space-y-2 text-xs">
                      <p className="font-semibold text-foreground flex items-center gap-1.5 text-accent">
                        <CheckCircle2 className="h-4 w-4" /> Member Added
                        Successfully!
                      </p>
                      <div className="space-y-1 font-mono pt-1 text-[11px]">
                        <p>
                          <span className="text-muted-foreground">Name:</span>{" "}
                          {createdMemberCreds.name}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Email:</span>{" "}
                          {createdMemberCreds.email}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Role:</span>{" "}
                          {createdMemberCreds.role}
                        </p>
                        <p className="flex items-center justify-between">
                          <span>
                            <span className="text-muted-foreground">
                              Password:
                            </span>{" "}
                            {createdMemberCreds.pass}
                          </span>
                          <button
                            onClick={() => copy(createdMemberCreds.pass)}
                            className="text-accent hover:underline text-[10px]"
                          >
                            Copy
                          </button>
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => setCreatedMemberCreds(null)}
                    >
                      Add Another Member
                    </Button>
                  </CardContent>
                ) : (
                  <form
                    onSubmit={handleMemberSubmit((d: NewMemberData) =>
                      createStudioMember.mutate(d),
                    )}
                  >
                    <CardContent className="space-y-4 pt-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Full Name *</Label>
                        <Input
                          {...registerMember("name")}
                          placeholder="e.g. Alex Morgan"
                          className="h-9 text-sm"
                        />
                        {memberErrors.name && (
                          <p className="text-[11px] text-destructive">
                            {memberErrors.name.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Email Address *</Label>
                        <Input
                          {...registerMember("email")}
                          type="email"
                          placeholder="alex@studio.com"
                          className="h-9 text-sm"
                        />
                        {memberErrors.email && (
                          <p className="text-[11px] text-destructive">
                            {memberErrors.email.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Studio Role *</Label>
                        <Select
                          value={watchMember("role")}
                          onValueChange={(v) =>
                            setMemberValue("role", v as any)
                          }
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PHOTOGRAPHER">
                              Photographer (Can upload & manage events)
                            </SelectItem>
                            <SelectItem value="STAFF">
                              Assistant / Staff (Can view & support)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Initial Password</Label>
                        <div className="relative">
                          <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            {...registerMember("password")}
                            className="pl-8 h-9 text-xs font-mono"
                            placeholder="CamSort@Team2026!"
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={
                          isMemberSubmitting || createStudioMember.isPending
                        }
                        className="w-full text-xs"
                      >
                        {isMemberSubmitting || createStudioMember.isPending
                          ? "Adding Member…"
                          : "Add Studio Member"}
                      </Button>
                    </CardContent>
                  </form>
                )}
              </Card>
            </div>

            {/* Studio Members List */}
            <div className="md:col-span-2">
              <Card className="border border-border/70 shadow-sm bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4 text-accent" />
                      Active Studio Members
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Team members who have access to{" "}
                      {user?.studio_name || "your studio"} resources.
                    </CardDescription>
                  </div>

                  <Badge variant="secondary" className="text-xs font-mono">
                    {(studioMembers?.length ?? 0) + 1} Total (incl. you)
                  </Badge>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Current Admin (You) */}
                  <div className="flex items-center justify-between p-3.5 border border-accent/30 bg-accent/5 rounded-xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-xs shrink-0">
                        {user?.name?.[0]?.toUpperCase() ?? "A"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate text-foreground">
                            {user?.name} (You)
                          </p>
                          <Badge className="text-[10px] bg-accent text-accent-foreground font-mono">
                            Studio Admin
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {user?.email}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] text-muted-foreground font-mono shrink-0"
                    >
                      Owner
                    </Badge>
                  </div>

                  {/* List of other studio members */}
                  {isStudioLoading ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : (studioMembers?.length ?? 0) === 0 ? (
                    <div className="text-center py-10 border border-dashed border-border/80 rounded-xl p-6">
                      <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                      <p className="text-sm font-medium text-foreground">
                        No extra studio team members yet
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                        Add photographers or assistants using the form on the
                        left so they can upload media and work on your studio's
                        events.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {studioMembers?.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-3.5 border border-border/70 rounded-xl hover:bg-muted/40 transition-colors bg-card/60"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center font-bold text-xs shrink-0">
                              {m.name?.[0]?.toUpperCase() ?? "?"}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate text-foreground">
                                  {m.name}
                                </p>
                                <Badge
                                  variant={
                                    m.role === "PHOTOGRAPHER"
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="text-[10px]"
                                >
                                  {m.role === "PHOTOGRAPHER"
                                    ? "Photographer"
                                    : "Assistant / Staff"}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {m.email}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-muted-foreground hidden sm:inline">
                              Added {formatDateShort(m.created_at)}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                if (
                                  confirm(
                                    `Remove ${m.name} from your studio team?`,
                                  )
                                ) {
                                  removeStudioMember.mutate(m.id);
                                }
                              }}
                              disabled={removeStudioMember.isPending}
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
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 2: EVENT ASSIGNMENTS ── */}
        <TabsContent value="event" className="space-y-6">
          <div className="max-w-2xl space-y-6">
            <div className="space-y-1.5">
              <Label>Select Event</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an event…" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((ev: any) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      {ev.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {eventId && (
              <>
                <Card className="border border-border/70 shadow-sm bg-card/80">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <UserPlus className="h-4 w-4" /> Invite to Event
                    </CardTitle>
                  </CardHeader>
                  <form
                    onSubmit={handleInviteSubmit((d) =>
                      inviteToEvent.mutate(d),
                    )}
                  >
                    <CardContent className="space-y-4">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 space-y-1.5">
                          <Label>Email</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...registerInvite("email")}
                              type="email"
                              placeholder="colleague@studio.com"
                              className="pl-9"
                            />
                          </div>
                          {inviteErrors.email && (
                            <p className="text-xs text-destructive">
                              {inviteErrors.email.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label>Role</Label>
                          <Select
                            value={watchInvite("role")}
                            onValueChange={(v) =>
                              setInviteValue("role", v as any)
                            }
                          >
                            <SelectTrigger className="w-full sm:w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="STAFF">Staff</SelectItem>
                              <SelectItem value="PHOTOGRAPHER">
                                Photographer
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        type="submit"
                        disabled={isInviteSubmitting}
                        className="w-full"
                      >
                        {isInviteSubmitting ? "Sending…" : "Send Invitation"}
                      </Button>
                    </CardContent>
                  </form>
                </Card>

                <Card className="border border-border/70 shadow-sm bg-card/80">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" /> Event Members
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isEventLoading ? (
                      <div className="space-y-3">
                        {[1, 2].map((i) => (
                          <Skeleton key={i} className="h-14" />
                        ))}
                      </div>
                    ) : eventMembers.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">
                          No team members assigned to this event yet
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {eventMembers.map((m: any) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between p-3 border border-border/70 rounded-lg"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                                {(m.user?.name ??
                                  m.email ??
                                  "?")[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {m.user?.name ?? "Pending"}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {m.user?.email ?? m.email}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {m.role}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() =>
                                  removeFromEvent.mutate(m.user_id)
                                }
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
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
