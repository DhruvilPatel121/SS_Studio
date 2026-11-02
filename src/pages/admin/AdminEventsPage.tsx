import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { adminApi } from "@/services/api";
import { formatDateShort, getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { Search, MoreVertical, Archive, Trash2, Eye } from "lucide-react";
import { Link } from "react-router-dom";

export default function AdminEventsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-events", { search, page }],
    queryFn: () => adminApi.allEvents({ search, page, limit: 20 }),
  });

  const events: any[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-editorial text-3xl font-bold tracking-tight">
            All Events
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} events across all photographers
          </p>
        </div>
      </div>

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

      <Card className="border border-border shadow-none">
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full min-w-max">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                    Event
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                    Photographer
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                    Photos
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                    Status
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                    Date
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td colSpan={6} className="px-4 py-3">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                ) : events.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      No events found
                    </td>
                  </tr>
                ) : (
                  events.map((ev: any) => (
                    <tr
                      key={ev.id}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-sm font-medium">{ev.name}</p>
                        {ev.location && (
                          <p className="text-xs text-muted-foreground">
                            {ev.location}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                        {ev.photographer?.name ?? ev.photographer?.email ?? "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {ev.photo_count ?? 0}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant={
                            ev.status === "ACTIVE" ? "default" : "secondary"
                          }
                          className="text-xs"
                        >
                          {ev.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                        {ev.event_date ? formatDateShort(ev.event_date) : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link
                                to={`/dashboard/events/${ev.id}`}
                                className="gap-2 flex items-center"
                              >
                                <Eye className="h-3.5 w-3.5" /> View
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
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
    </DashboardLayout>
  );
}
