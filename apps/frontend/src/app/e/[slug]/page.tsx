"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton, Spinner } from "@/components/ui/progress";
import { formatDate } from "@/lib/utils";
import {
  Camera,
  CalendarDays,
  MapPin,
  Users,
  QrCode,
  Image as ImgIcon,
} from "lucide-react";
import Link from "next/link";

export default function EventLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [showGroups, setShowGroups] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-event", slug],
    queryFn: () => api.getPublicEvent(slug),
    retry: false,
  });

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );

  if (error || !data?.event)
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <Camera className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Event Not Found</h1>
        <p className="text-muted-foreground">
          This event may have expired or been removed.
        </p>
      </div>
    );

  const { event, branding } = data;
  const primaryColor = branding?.primaryColor ?? "#6366f1";

  return (
    <div className="min-h-screen bg-background">
      {/* Hero banner */}
      <div
        className="relative py-16 px-4 text-center"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}20, ${primaryColor}05)`,
        }}
      >
        {branding?.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={branding.studioName ?? "Studio"}
            className="h-12 mx-auto mb-4"
          />
        ) : (
          <Camera
            className="h-12 w-12 mx-auto mb-4"
            style={{ color: primaryColor }}
          />
        )}
        <h1 className="text-3xl md:text-4xl font-bold mb-2">{event.name}</h1>
        {event.description && (
          <p className="text-muted-foreground max-w-lg mx-auto mb-4">
            {event.description}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground mb-6">
          {event.eventDate && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4" /> {formatDate(event.eventDate)}
            </span>
          )}
          {event.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" /> {event.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <ImgIcon className="h-4 w-4" /> {event._count?.photos ?? 0} photos
          </span>
        </div>

        {/* Main CTA */}
        <Link href={`/e/${slug}/find-my-photos`}>
          <Button
            size="lg"
            style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
            className="text-white shadow-lg hover:opacity-90 transition-opacity"
          >
            <Camera className="mr-2 h-5 w-5" />
            Find My Photos with AI
          </Button>
        </Link>
        <p className="text-xs text-muted-foreground mt-2">
          Take a selfie → AI finds your photos instantly
        </p>
      </div>

      {/* Groups / Albums */}
      {event.groups?.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 py-10">
          <h2 className="text-xl font-semibold mb-6 text-center">
            Photo Albums
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {event.groups.map((group: any) => (
              <Link key={group.id} href={`/e/${slug}/group/${group.id}`}>
                <Card className="group hover:shadow-md transition-shadow cursor-pointer overflow-hidden">
                  {group.coverImageUrl ? (
                    <img
                      src={group.coverImageUrl}
                      alt={group.name}
                      className="h-36 w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="h-36 bg-muted flex items-center justify-center">
                      <ImgIcon className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{group.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {group._count?.photos ?? 0} photos
                        </p>
                      </div>
                      {group.isFaceMatchEnabled && (
                        <Badge variant="info" className="text-xs">
                          AI
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      {branding?.footerText && (
        <footer className="text-center py-6 text-xs text-muted-foreground border-t">
          {branding.footerText}
        </footer>
      )}
    </div>
  );
}
