"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/progress";
import { formatDate, formatNumber, getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  Users,
  Download,
  QrCode,
  FolderOpen,
  Settings,
  Plus,
  Upload,
  BarChart2,
} from "lucide-react";
import Link from "next/link";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("photos");

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: () => api.getEvent(id),
    enabled: !!id,
  });

  const { data: stats } = useQuery({
    queryKey: ["event-stats", id],
    queryFn: () => api.getEventStats(id),
    enabled: !!id,
  });

  const { data: groups } = useQuery({
    queryKey: ["groups", id],
    queryFn: () => api.getGroups(id),
    enabled: !!id,
  });

  const archive = useMutation({
    mutationFn: () => api.archiveEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event", id] });
      toast.success("Event archived");
    },
  });

  if (isLoading)
    return (
      <DashboardShell>
        <div className="space-y-4">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardShell>
    );

  if (!event)
    return (
      <DashboardShell>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Event not found.</p>
          <Link href="/dashboard/events">
            <Button variant="outline" className="mt-4">
              Back to Events
            </Button>
          </Link>
        </div>
      </DashboardShell>
    );

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-md transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <DashboardShell
      title={event.name}
      actions={
        <div className="flex gap-2">
          <Link href={`/dashboard/upload?eventId=${id}`}>
            <Button size="sm">
              <Upload className="mr-1 h-4 w-4" /> Upload
            </Button>
          </Link>
          <Link href={`/dashboard/qr?eventId=${id}`}>
            <Button variant="outline" size="sm">
              <QrCode className="mr-1 h-4 w-4" /> QR Code
            </Button>
          </Link>
        </div>
      }
    >
      <Link
        href="/dashboard/events"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Events
      </Link>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Badge variant={event.status === "ACTIVE" ? "success" : "secondary"}>
          {event.status}
        </Badge>
        {event.theme && <Badge variant="outline">{event.theme}</Badge>}
        <Badge variant="outline">{event.privacy}</Badge>
        <span className="text-sm text-muted-foreground">
          {formatDate(event.eventDate ?? event.createdAt)}
        </span>
        {event.location && (
          <span className="text-sm text-muted-foreground">
            📍 {event.location}
          </span>
        )}
      </div>

      {/* Stat mini cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Photos",
            value: stats?.photoCount ?? event._count?.photos ?? 0,
            icon: Camera,
          },
          { label: "Groups", value: groups?.length ?? 0, icon: FolderOpen },
          { label: "Guests", value: stats?.guestCount ?? 0, icon: Users },
          {
            label: "Downloads",
            value: stats?.downloadCount ?? 0,
            icon: Download,
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <s.icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xl font-bold">{formatNumber(s.value)}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit mb-6">
        {["photos", "groups", "guests", "analytics"].map((tab) => (
          <button
            key={tab}
            className={tabClass(activeTab === tab)}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === "photos" && (
        <PhotosTab eventId={id} groups={groups ?? []} />
      )}
      {activeTab === "groups" && (
        <GroupsTab eventId={id} groups={groups ?? []} />
      )}
      {activeTab === "guests" && <GuestsTab eventId={id} />}
      {activeTab === "analytics" && <AnalyticsTab eventId={id} />}
    </DashboardShell>
  );
}

function PhotosTab({ eventId, groups }: { eventId: string; groups: any[] }) {
  const [groupId, setGroupId] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["photos", { eventId, groupId, page }],
    queryFn: () =>
      api.getPhotos({
        eventId,
        groupId: groupId || undefined,
        page,
        limit: 30,
      }),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select
          value={groupId}
          onChange={(e) => {
            setGroupId(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Groups</option>
          {groups.map((g: any) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">
          {data?.pagination?.total ?? 0} photos
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded" />
          ))}
        </div>
      ) : !data?.data?.length ? (
        <div className="text-center py-16">
          <Camera className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No photos yet.</p>
          <Link href={`/dashboard/upload?eventId=${eventId}`}>
            <Button size="sm" className="mt-3">
              <Upload className="mr-1 h-4 w-4" /> Upload Photos
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {data.data.map((photo: any) => (
              <div key={photo.id} className="photo-card aspect-square bg-muted">
                {photo.thumbnailPath ? (
                  <img
                    src={photo.thumbnailUrl ?? "/placeholder.jpg"}
                    alt={photo.originalName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="overlay">
                  <Badge
                    variant={
                      photo.status === "PROCESSED" ? "success" : "warning"
                    }
                    className="text-xs"
                  >
                    {photo.faceCount ?? 0} faces
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm py-1.5 px-2">
              Page {page} / {data.pagination?.totalPages ?? 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!data.pagination?.hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function GroupsTab({ eventId, groups }: { eventId: string; groups: any[] }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: (gid: string) => api.deleteGroup(eventId, gid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups", eventId] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add Group
        </Button>
      </div>
      {groups.map((g: any) => (
        <div
          key={g.id}
          className="flex items-center justify-between p-4 border rounded-lg"
        >
          <div>
            <p className="font-medium">{g.name}</p>
            <p className="text-xs text-muted-foreground">
              {g._count?.photos ?? 0} photos • {g.privacy}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant={g.isFaceMatchEnabled ? "success" : "secondary"}>
              {g.isFaceMatchEnabled ? "AI Enabled" : "AI Off"}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => {
                if (confirm("Delete group?")) del.mutate(g.id);
              }}
            >
              <span className="text-xs">×</span>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function GuestsTab({ eventId }: { eventId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["guests", eventId],
    queryFn: () => api.getGuestList(eventId),
  });

  return (
    <div>
      {isLoading ? (
        <Skeleton className="h-32" />
      ) : !data?.data?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2" />
          <p>No guests yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.data.map((g: any) => (
            <div
              key={g.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div>
                <p className="text-sm font-medium">
                  {g.name ?? "Anonymous Guest"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {g._count?.selfies ?? 0} selfies • {g._count?.downloads ?? 0}{" "}
                  downloads
                </p>
              </div>
              <Badge variant={g._count?.selfies > 0 ? "success" : "outline"}>
                {g._count?.selfies > 0 ? "Has selfie" : "No selfie"}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalyticsTab({ eventId }: { eventId: string }) {
  const { data } = useQuery({
    queryKey: ["event-analytics", eventId],
    queryFn: () => api.getEventAnalytics(eventId),
  });

  const a = data?.analytics;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: "Total Photos", value: a?.totalPhotos ?? 0 },
        { label: "Processed", value: a?.processedPhotos ?? 0 },
        { label: "Faces Found", value: a?.totalFaces ?? 0 },
        { label: "Searches", value: a?.totalSearches ?? 0 },
        { label: "Successful Matches", value: a?.successfulSearches ?? 0 },
        { label: "Downloads", value: a?.totalDownloads ?? 0 },
        { label: "Favorites", value: a?.totalFavorites ?? 0 },
        { label: "Guest Views", value: a?.totalGuests ?? 0 },
      ].map((item) => (
        <Card key={item.label}>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{formatNumber(item.value)}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
