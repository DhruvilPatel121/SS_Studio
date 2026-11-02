/**
 * PublicTokenPage — /join/:token
 * Anyone with the public link can upload a selfie and find only their photos.
 */
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Camera, MapPin, Calendar, Search, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { guestApi } from "@/services/api";
import { formatDateShort } from "@/lib/utils";
import { supabase } from "@/db/supabase";

export default function PublicTokenPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState<number | null>(null);

  const {
    data: ev,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["event-public-token", token],
    queryFn: () => guestApi.getEventByPublicToken(token!),
    enabled: !!token,
    retry: false,
  });

  // Create guest session
  useEffect(() => {
    if (!ev?.id || sessionToken) return;
    guestApi
      .createSession(ev.id)
      .then((res) => setSessionToken(res.sessionToken))
      .catch(console.error);
  }, [ev?.id, sessionToken]);

  // Fetch real photo count (all statuses) — updates in real-time via Supabase Realtime
  useEffect(() => {
    if (!ev?.id) return;
    // Initial count
    supabase
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("event_id", ev.id)
      .then(({ count }) => setPhotoCount(count ?? 0));

    // Subscribe to inserts/deletes for live count
    const channel = supabase
      .channel(`photo-count-${ev.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "photos",
          filter: `event_id=eq.${ev.id}`,
        },
        () => {
          supabase
            .from("photos")
            .select("id", { count: "exact", head: true })
            .eq("event_id", ev.id)
            .then(({ count }) => setPhotoCount(count ?? 0));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ev?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (isError || !ev) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="font-editorial text-xl font-bold">Link not found</h2>
          <p className="text-sm text-muted-foreground">
            This link is invalid or has expired. Ask the photographer for a new
            link.
          </p>
        </div>
      </div>
    );
  }

  const photographer = (ev as any).photographer;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero banner */}
      <div className="relative h-[40vh] md:h-[50vh] bg-primary overflow-hidden">
        {ev.cover_image_url && (
          <img
            src={ev.cover_image_url}
            alt={ev.name}
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/70" />
        <div className="relative z-10 flex flex-col h-full items-center justify-end pb-10 px-4 text-center">
          <div className="mb-3">
            {photographer?.avatar_url ? (
              <img
                src={photographer.avatar_url}
                alt="Studio"
                className="h-10 w-10 rounded-full mx-auto mb-2 border-2 border-white/30 object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-accent mx-auto mb-2 flex items-center justify-center">
                <Camera className="h-4 w-4 text-accent-foreground" />
              </div>
            )}
            <p className="text-xs text-white/70">
              {photographer?.studio_name ?? photographer?.name ?? "CamSort"}
            </p>
          </div>
          <h1 className="font-editorial text-3xl md:text-5xl font-bold text-white tracking-tight text-balance">
            {ev.name}
          </h1>
          <div className="flex items-center gap-3 mt-3 text-white/70 text-sm flex-wrap justify-center">
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
            <Badge
              variant="secondary"
              className="bg-white/15 text-white border-white/20 text-xs gap-1"
            >
              <Images className="h-3 w-3" />
              {photoCount === null ? "…" : photoCount} photo
              {photoCount !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-md mx-auto px-4 py-12 text-center space-y-8 flex-1">
        {ev.description && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {ev.description}
          </p>
        )}

        <div className="border border-border rounded-xl p-6 bg-card space-y-4">
          <div className="h-14 w-14 rounded-xl bg-accent/10 flex items-center justify-center mx-auto">
            <Search className="h-7 w-7 text-accent" />
          </div>
          <div className="space-y-1">
            <h2 className="font-editorial text-xl font-bold">
              Find Your Photos
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Take a quick selfie — our AI instantly finds every photo you
              appear in from this event.
            </p>
          </div>
          <Button
            className="w-full h-12 text-base gap-2 bg-accent text-accent-foreground hover:bg-accent/90 shadow-md"
            onClick={() => {
              const currentToken =
                sessionToken ||
                (typeof crypto !== "undefined" && crypto.randomUUID
                  ? crypto.randomUUID()
                  : `gst_${Date.now()}`);
              navigate(`/join/${token}/find?session=${currentToken}`);
            }}
          >
            <Camera className="h-5 w-5" />
            Find My Photos
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Your selfie is used exclusively for private face matching and is never
          shared with other guests.
        </p>
      </div>

      {photographer?.studio_name && (
        <div className="text-center pb-8">
          <p className="text-xs text-muted-foreground">
            Photos by {photographer.studio_name} · Powered by{" "}
            <span className="font-editorial font-bold">CamSort</span>
          </p>
        </div>
      )}
    </div>
  );
}
