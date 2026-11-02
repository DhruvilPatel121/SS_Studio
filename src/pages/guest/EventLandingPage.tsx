import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Camera, MapPin, Calendar, QrCode, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { guestApi } from "@/services/api";
import { formatDateShort } from "@/lib/utils";

export default function EventLandingPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["guest-event", slug],
    queryFn: () => guestApi.getEventBySlug(slug!),
    enabled: !!slug,
  });

  const ev = data as any;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 rounded-full bg-accent animate-pulse mx-auto" />
          <p className="text-sm text-muted-foreground">Loading event…</p>
        </div>
      </div>
    );
  }

  if (isError || !ev) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm px-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <QrCode className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="font-editorial text-xl font-bold">Event not found</h2>
          <p className="text-sm text-muted-foreground">
            This event link is invalid or has expired. Please scan the QR code
            again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative h-[45vh] md:h-[55vh] bg-primary overflow-hidden">
        {ev.cover_image_url && (
          <img
            src={ev.cover_image_url}
            alt={ev.name}
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/70" />
        <div className="relative z-10 flex flex-col h-full items-center justify-end pb-10 px-4 text-center">
          {/* Branding */}
          <div className="mb-4">
            {ev.photographer?.avatar_url ? (
              <img
                src={ev.photographer.avatar_url}
                alt="Studio"
                className="h-10 w-10 rounded-full mx-auto mb-2 border-2 border-white/30"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-accent mx-auto mb-2 flex items-center justify-center">
                <Camera className="h-4 w-4 text-accent-foreground" />
              </div>
            )}
            <p className="text-xs text-white/70">
              {ev.photographer?.studio_name ??
                ev.photographer?.name ??
                "CamSort"}
            </p>
          </div>
          <h1 className="font-editorial text-3xl md:text-5xl font-bold text-white tracking-tight text-balance">
            {ev.name}
          </h1>
          <div className="flex items-center gap-4 mt-3 text-white/70 text-sm flex-wrap justify-center">
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
              className="bg-white/15 text-white border-white/20 text-xs"
            >
              {ev.photo_count ?? 0} photos
            </Badge>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-8">
        {ev.description && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {ev.description}
          </p>
        )}

        <div className="space-y-3">
          <div className="border border-border rounded-xl p-6 bg-card space-y-3">
            <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto">
              <Search className="h-6 w-6 text-accent" />
            </div>
            <h2 className="font-editorial text-xl font-bold">
              Find Your Photos
            </h2>
            <p className="text-sm text-muted-foreground">
              Take a selfie and our AI will instantly find all photos of you
              from this event
            </p>
            <Link to={`/e/${slug}/find`} className="block">
              <Button className="w-full h-12 text-base gap-2">
                <Camera className="h-5 w-5" />
                Find My Photos
              </Button>
            </Link>
          </div>

          <Link to={`/e/${slug}/gallery`} className="block">
            <Button variant="outline" className="w-full h-11">
              Browse All Photos
            </Button>
          </Link>
        </div>

        <p className="text-xs text-muted-foreground">
          Your selfie is used only for face matching and is never stored or
          shared.
        </p>
      </div>

      {/* Footer */}
      {ev.photographer?.studio_name && (
        <div className="text-center pb-8">
          <p className="text-xs text-muted-foreground">
            Photos by {ev.photographer.studio_name} · Powered by{" "}
            <span className="font-editorial font-bold">CamSort</span>
          </p>
        </div>
      )}
    </div>
  );
}
