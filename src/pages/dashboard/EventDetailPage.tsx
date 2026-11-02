import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { eventsApi, groupsApi, photosApi } from "@/services/api";
import { formatDateShort, getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import {
  ArrowLeft,
  Edit,
  Calendar,
  MapPin,
  Users,
  Images,
  Camera,
  Download,
  Plus,
  Trash2,
  MoreVertical,
  QrCode,
  Eye,
  Copy,
  Lock,
  Globe,
  Link as LinkIcon,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  Activity,
  ImagePlus,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/db/supabase";
import { cn } from "@/lib/utils";

const getAppUrl = () => {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return import.meta.env.VITE_APP_URL || "";
};

function ShareLinksCard({ ev }: { ev: any }) {
  const appUrl = getAppUrl();
  const publicUrl = ev.public_token
    ? `${appUrl}/join/${ev.public_token}`
    : null;
  const privateUrl = ev.private_token
    ? `${appUrl}/vip/${ev.private_token}`
    : null;

  const copy = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    toast.success(`${label} link copied!`);
  };

  return (
    <Card className="border border-border shadow-none mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-accent" /> Share Links
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Public link */}
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="h-4 w-4 text-accent shrink-0" />
            <span className="text-sm font-semibold">
              Public Link — Selfie Search
            </span>
            <Badge variant="secondary" className="text-xs ml-auto">
              For everyone
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Share this with all attendees. Guests upload a selfie and AI finds
            only their photos. They cannot browse other guests' photos.
          </p>
          {publicUrl ? (
            <div className="flex items-center gap-2 mt-2">
              <code className="flex-1 text-xs bg-background border border-border rounded px-2 py-1.5 truncate font-mono">
                {publicUrl}
              </code>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 shrink-0"
                onClick={() => copy(publicUrl, "Public")}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Generating…</p>
          )}
        </div>

        <Separator />

        {/* Private link */}
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="h-4 w-4 text-accent shrink-0" />
            <span className="text-sm font-semibold">
              Private Link — Full Gallery
            </span>
            <Badge variant="default" className="text-xs ml-auto">
              Close family / VIP
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Share only with trusted people (e.g. close family). They can browse
            and download every photo in the event — no selfie required.
          </p>
          {privateUrl ? (
            <div className="flex items-center gap-2 mt-2">
              <code className="flex-1 text-xs bg-background border border-border rounded px-2 py-1.5 truncate font-mono">
                {privateUrl}
              </code>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 shrink-0"
                onClick={() => copy(privateUrl, "Private")}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Generating…</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground pt-1">
          You can also share via the{" "}
          <Link
            to={`/dashboard/qr?eventId=${ev.id}`}
            className="text-accent hover:underline"
          >
            QR Code page
          </Link>{" "}
          to print QR codes for both links.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Processing Status Panel (Realtime) ──────────────────────────────────────
type PhotoStatus = {
  id: string;
  original_name: string;
  processing_status: string;
  created_at: string;
  storage_key: string;
  thumbnail_key: string | null;
  file_size: number;
  display_url?: string;
};

function ProcessingStatusPanel({ eventId }: { eventId: string }) {
  const [statuses, setStatuses] = useState<PhotoStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatuses = useCallback(async () => {
    const { data, error } = await supabase
      .from("photos")
      .select(
        "id, original_name, processing_status, created_at, storage_key, thumbnail_key, file_size",
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setStatuses(data as PhotoStatus[]);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchStatuses();
    const channel = supabase
      .channel(`processing-status-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "photos",
          filter: `event_id=eq.${eventId}`,
        },
        () => fetchStatuses(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, fetchStatuses]);

  const counts = {
    PENDING: statuses.filter((s) => s.processing_status === "PENDING").length,
    PROCESSING: statuses.filter((s) => s.processing_status === "PROCESSING")
      .length,
    COMPLETED: statuses.filter((s) => s.processing_status === "COMPLETED")
      .length,
    FAILED: statuses.filter((s) => s.processing_status === "FAILED").length,
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "COMPLETED")
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />;
    if (status === "PROCESSING")
      return (
        <Loader2 className="h-3.5 w-3.5 text-accent shrink-0 animate-spin" />
      );
    if (status === "FAILED")
      return <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
    return <Clock className="h-3.5 w-3.5 text-yellow-500 shrink-0" />;
  };

  return (
    <Card className="border border-border shadow-none mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent" /> Processing Status
            <span className="text-xs font-normal text-muted-foreground ml-1">
              live
            </span>
            <span className="inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={fetchStatuses}
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary pills */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Total", val: statuses.length, color: "" },
            { label: "Pending", val: counts.PENDING, color: "text-yellow-600" },
            {
              label: "Processing",
              val: counts.PROCESSING,
              color: "text-accent",
            },
            { label: "Done", val: counts.COMPLETED, color: "text-green-600" },
            { label: "Failed", val: counts.FAILED, color: "text-destructive" },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-1.5 bg-muted/60 rounded-full px-3 py-1 text-xs"
            >
              <span className="text-muted-foreground">{s.label}</span>
              <span className={cn("font-semibold", s.color)}>{s.val}</span>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : statuses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <ImagePlus className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No photos uploaded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border border border-border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
            {statuses.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 px-3 py-2.5 bg-card hover:bg-muted/20 transition-colors"
              >
                <StatusIcon status={p.processing_status} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {p.original_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(p.file_size / 1024).toFixed(1)} KB ·{" "}
                    {new Date(p.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <Badge
                  variant={
                    p.processing_status === "COMPLETED"
                      ? "default"
                      : p.processing_status === "FAILED"
                        ? "destructive"
                        : p.processing_status === "PROCESSING"
                          ? "default"
                          : "secondary"
                  }
                  className={cn(
                    "text-[10px] shrink-0",
                    p.processing_status === "COMPLETED" &&
                      "bg-green-600 hover:bg-green-600",
                    p.processing_status === "PROCESSING" &&
                      "bg-accent hover:bg-accent",
                  )}
                >
                  {p.processing_status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  // Realtime-synced photo list for the photos tab
  const [realtimePhotos, setRealtimePhotos] = useState<any[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);

  const { data: evtRes, isLoading } = useQuery<any>({
    queryKey: ["event", id],
    queryFn: () => eventsApi.get(id!),
    enabled: !!id,
  });

  const { data: groupsRes } = useQuery<any>({
    queryKey: ["groups", id],
    queryFn: () => groupsApi.list(id!),
    enabled: !!id,
  });

  // Realtime fetch — ALL photos regardless of processing_status, using public URLs
  const fetchPhotos = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("photos")
      .select(
        "id, original_name, storage_key, thumbnail_key, processing_status, created_at, file_size",
      )
      .eq("event_id", id)
      .order("created_at", { ascending: false })
      .limit(200);
    // Use getPublicUrl — event-photos bucket is public, no auth needed
    const withUrls = (data ?? []).map((p: any) => {
      const { data: s } = supabase.storage
        .from("event-photos")
        .getPublicUrl(p.thumbnail_key ?? p.storage_key);
      return { ...p, display_url: s?.publicUrl ?? "" };
    });
    setRealtimePhotos(withUrls);
    setPhotosLoading(false);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchPhotos();
    const channel = supabase
      .channel(`event-photos-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "photos",
          filter: `event_id=eq.${id}`,
        },
        () => fetchPhotos(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchPhotos]);

  const archive = useMutation({
    mutationFn: () => eventsApi.archive(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event", id] });
      toast.success("Event archived");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deletePhoto = useMutation({
    mutationFn: async (photoId: string) => {
      await photosApi.delete(photoId);
      setRealtimePhotos((prev) => prev.filter((p) => p.id !== photoId));
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const ev = evtRes as any;
  const groups: any[] = Array.isArray(groupsRes)
    ? groupsRes
    : (groupsRes?.data ?? []);
  const photos = realtimePhotos;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  if (!ev) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Event not found</p>
          <Link to="/dashboard/events">
            <Button variant="outline" className="mt-4">
              Back to Events
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Breadcrumb */}
      <button
        onClick={() => navigate("/dashboard/events")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Events
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-editorial text-3xl font-bold tracking-tight">
              {ev.name}
            </h1>
            <Badge variant={ev.status === "ACTIVE" ? "default" : "secondary"}>
              {ev.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground flex-wrap">
            {ev.event_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />{" "}
                {formatDateShort(ev.event_date)}
              </span>
            )}
            {ev.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {ev.location}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link to={`/e/${ev.slug}`} target="_blank">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Eye className="h-3.5 w-3.5" /> Preview
            </Button>
          </Link>
          <Link to={`/dashboard/qr?eventId=${ev.id}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <QrCode className="h-3.5 w-3.5" /> QR Code
            </Button>
          </Link>
          <Link to={`/dashboard/events/${ev.id}/edit`}>
            <Button size="sm" className="gap-1.5">
              <Edit className="h-3.5 w-3.5" /> Edit
            </Button>
          </Link>
        </div>
      </div>

      {/* Cover image preview */}
      {ev.cover_image_url && (
        <div className="mb-6 rounded-xl overflow-hidden h-40 border border-border">
          <img
            src={ev.cover_image_url}
            alt={ev.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Share Links */}
      <ShareLinksCard ev={ev} />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Photos", value: photos.length, icon: Images },
          { label: "Faces", value: ev.face_count ?? 0, icon: Camera },
          { label: "Guests", value: ev.guest_count ?? 0, icon: Users },
          { label: "Downloads", value: ev.download_count ?? 0, icon: Download },
        ].map((s) => (
          <Card key={s.label} className="border border-border shadow-none">
            <CardContent className="p-3 flex items-center gap-3">
              <s.icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-editorial text-xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Real-time processing status panel */}
      <ProcessingStatusPanel eventId={ev.id} />

      {/* Tabs */}
      <Tabs defaultValue="photos">
        <TabsList className="mb-4">
          <TabsTrigger value="photos">
            Photos ({photosLoading ? "…" : photos.length})
          </TabsTrigger>
          <TabsTrigger value="groups">Groups ({groups.length})</TabsTrigger>
          <TabsTrigger value="guests">Guests</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Photos tab */}
        <TabsContent value="photos">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {photosLoading
                ? "Loading…"
                : `${photos.length} photo${photos.length !== 1 ? "s" : ""}`}
            </p>
            <Link to={`/dashboard/events/${ev.id}/upload`}>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Upload Photos
              </Button>
            </Link>
          </div>

          {photosLoading ? (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded" />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-lg">
              <Images className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground mb-3">
                No photos yet
              </p>
              <Link to={`/dashboard/events/${ev.id}/upload`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Upload
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {photos.map((p: any) => (
                <div
                  key={p.id}
                  className="photo-card aspect-square bg-muted relative overflow-hidden rounded"
                >
                  {p.display_url ? (
                    <img
                      src={p.display_url}
                      alt={p.original_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <ImagePlus className="h-6 w-6 text-muted-foreground opacity-40" />
                    </div>
                  )}
                  <div className="photo-card-overlay">
                    <div className="flex gap-1 ml-auto">
                      <button
                        onClick={() => {
                          if (confirm("Delete photo?"))
                            deletePhoto.mutate(p.id);
                        }}
                        className="p-1 rounded bg-black/50 text-white hover:bg-red-600/80 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  {/* Processing status dot */}
                  <div className="absolute top-1 left-1">
                    {p.processing_status === "PENDING" && (
                      <div
                        className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse"
                        title="Pending"
                      />
                    )}
                    {p.processing_status === "PROCESSING" && (
                      <div
                        className="h-2 w-2 rounded-full bg-accent animate-pulse"
                        title="Processing"
                      />
                    )}
                    {p.processing_status === "COMPLETED" && (
                      <div
                        className="h-2 w-2 rounded-full bg-green-500"
                        title="Done"
                      />
                    )}
                    {p.processing_status === "FAILED" && (
                      <div
                        className="h-2 w-2 rounded-full bg-destructive"
                        title="Failed"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Groups tab */}
        <TabsContent value="groups">
          <GroupsTab eventId={id!} groups={groups} />
        </TabsContent>

        {/* Guests tab */}
        <TabsContent value="guests">
          <div className="text-center py-16 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">
              Guest activity will appear here as guests search for their photos
            </p>
          </div>
        </TabsContent>

        {/* Analytics tab */}
        <TabsContent value="analytics">
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">
              View detailed analytics in the{" "}
              <Link
                to="/dashboard/analytics"
                className="text-accent hover:underline"
              >
                Analytics page
              </Link>
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

function GroupsTab({ eventId, groups }: { eventId: string; groups: any[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<{ name: string; description?: string }>();

  const createGroup = useMutation({
    mutationFn: (d: { name: string; description?: string }) =>
      groupsApi.create(eventId, { ...d, ai_enabled: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", eventId] });
      toast.success("Group created");
      setOpen(false);
      reset();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteGroup = useMutation({
    mutationFn: (gId: string) => groupsApi.delete(gId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups", eventId] }),
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {groups.length} group{groups.length !== 1 ? "s" : ""}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Group
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Group</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={handleSubmit((d) => createGroup.mutate(d))}
              className="space-y-4 mt-2"
            >
              <div className="space-y-1.5">
                <Label>Group name *</Label>
                <Input
                  {...register("name", { required: true })}
                  placeholder="Ceremony, Reception…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input {...register("description")} placeholder="Optional" />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  Create
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground mb-3">No groups yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g: any) => (
            <Card key={g.id} className="border border-border shadow-none">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{g.name}</p>
                    {g.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {g.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {g.photo_count ?? 0} photos
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          if (confirm("Delete group?"))
                            deleteGroup.mutate(g.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
