"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/progress";
import { formatDate, formatNumber, getErrorMessage } from "@/lib/utils";
import {
  Plus,
  Search,
  CalendarDays,
  MapPin,
  Image,
  Users,
  MoreVertical,
  Archive,
  Trash2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function EventsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["events", { search, status }],
    queryFn: () => api.getEvents({ search, status: status || undefined }),
  });

  const archive = useMutation({
    mutationFn: (id: string) => api.archiveEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event archived");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event deleted");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const statusBadge = (s: string) => {
    const map: Record<string, any> = {
      ACTIVE: "success",
      ARCHIVED: "secondary",
      DRAFT: "warning",
      EXPIRED: "destructive",
    };
    return <Badge variant={map[s] ?? "outline"}>{s}</Badge>;
  };

  return (
    <DashboardShell
      title="Events"
      actions={
        <Link href="/dashboard/events/new">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> New Event
          </Button>
        </Link>
      }
    >
      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <Input
          placeholder="Search events…"
          leftIcon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      ) : !data?.data?.length ? (
        <div className="text-center py-20">
          <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-1">No events found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first event to get started
          </p>
          <Link href="/dashboard/events/new">
            <Button>Create Event</Button>
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.data.map((ev: any) => (
            <Card
              key={ev.id}
              className="group relative hover:shadow-md transition-shadow"
            >
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <Link href={`/dashboard/events/${ev.id}`}>
                      <h3 className="font-semibold truncate hover:text-primary transition-colors">
                        {ev.name}
                      </h3>
                    </Link>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <CalendarDays className="h-3 w-3" />
                      <span>{formatDate(ev.eventDate ?? ev.createdAt)}</span>
                    </div>
                    {ev.location && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{ev.location}</span>
                      </div>
                    )}
                  </div>
                  {statusBadge(ev.status)}
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Image className="h-3 w-3" />
                    {formatNumber(ev._count?.photos ?? 0)} photos
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {formatNumber(ev._count?.guestProfiles ?? 0)} guests
                  </span>
                </div>

                <div className="flex gap-2 pt-1">
                  <Link href={`/dashboard/events/${ev.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <ExternalLink className="mr-1 h-3 w-3" /> Open
                    </Button>
                  </Link>
                  {ev.status !== "ARCHIVED" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => archive.mutate(ev.id)}
                      title="Archive"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm("Delete this event and all photos?"))
                        del.mutate(ev.id);
                    }}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
