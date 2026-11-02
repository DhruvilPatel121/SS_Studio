import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { eventsApi } from "@/services/api";
import { formatDateShort, getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Calendar,
  Images,
  MoreVertical,
  Archive,
  Trash2,
  Edit,
  Eye,
  Copy,
  Users,
} from "lucide-react";
import type { Event } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "default",
  ARCHIVED: "secondary",
  DELETED: "destructive",
};

export default function EventsListPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["events", { search, page }],
    queryFn: () => eventsApi.list({ search, page, limit: 12 }),
  });

  const archive = useMutation({
    mutationFn: (id: string) => eventsApi.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event archived");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => eventsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event deleted");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const clone = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      eventsApi.clone(id, `${name} (copy)`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event cloned");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const events: Event[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-editorial text-3xl font-bold tracking-tight">
            Events
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} event{total !== 1 ? "s" : ""}
          </p>
        </div>
        <Link to="/dashboard/events/new">
          <Button className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> New Event
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search events…"
          className="pl-9"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-lg">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <h3 className="font-semibold mb-1">
            {search ? "No events found" : "No events yet"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {search
              ? "Try a different search term"
              : "Create your first event to get started"}
          </p>
          {!search && (
            <Link to="/dashboard/events/new">
              <Button>
                <Plus className="h-4 w-4 mr-1" /> Create event
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((ev) => (
              <Card
                key={ev.id}
                className="border border-border shadow-none overflow-hidden group hover:border-foreground/20 transition-colors"
              >
                {/* Cover */}
                <div className="h-32 bg-muted relative overflow-hidden">
                  {ev.cover_image_url ? (
                    <img
                      src={ev.cover_image_url}
                      alt={ev.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Calendar className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <Badge
                      variant={STATUS_COLORS[ev.status] as any}
                      className="text-xs"
                    >
                      {ev.status}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm truncate">
                        {ev.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ev.event_date
                          ? formatDateShort(ev.event_date)
                          : "No date set"}
                        {ev.location && ` · ${ev.location}`}
                      </p>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem asChild>
                          <Link
                            to={`/dashboard/events/${ev.id}`}
                            className="flex items-center gap-2"
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            to={`/dashboard/events/${ev.id}/edit`}
                            className="flex items-center gap-2"
                          >
                            <Edit className="h-3.5 w-3.5" /> Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            clone.mutate({ id: ev.id, name: ev.name })
                          }
                          className="flex items-center gap-2"
                        >
                          <Copy className="h-3.5 w-3.5" /> Clone
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => archive.mutate(ev.id)}
                          className="flex items-center gap-2"
                        >
                          <Archive className="h-3.5 w-3.5" /> Archive
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (confirm("Delete this event?"))
                              del.mutate(ev.id);
                          }}
                          className="flex items-center gap-2 text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Images className="h-3 w-3" /> {ev.photo_count ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {ev.guest_count ?? 0}
                    </span>
                    <Link
                      to={`/dashboard/events/${ev.id}`}
                      className="ml-auto text-accent hover:underline font-medium"
                    >
                      Open →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
