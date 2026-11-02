/**
 * PrivateTokenPage — /vip/:token
 * Full gallery access for close family / VIP guests.
 * No selfie needed — shows ALL photos in the event.
 */
import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Camera,
  MapPin,
  Calendar,
  Download,
  Images,
  Lock,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { guestApi, zipApi } from "@/services/api";
import { formatDateShort } from "@/lib/utils";
import { toast } from "sonner";

const PAGE_SIZE = 24;

export default function PrivateTokenPage() {
  const { token } = useParams<{ token: string }>();
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);

  const {
    data: ev,
    isLoading: evLoading,
    isError,
  } = useQuery({
    queryKey: ["event-private-token", token],
    queryFn: () => guestApi.getEventByPrivateToken(token!),
    enabled: !!token,
    retry: false,
  });

  const { data: photosRes, isLoading: photosLoading } = useQuery({
    queryKey: ["private-gallery", ev?.id, page],
    queryFn: () => guestApi.allPhotos(ev!.id, { page, limit: PAGE_SIZE }),
    enabled: !!ev?.id,
  });

  const photos: any[] = photosRes?.data ?? [];
  const totalPages = photosRes?.totalPages ?? 1;
  const total = photosRes?.total ?? 0;

  const handleDownloadAll = async () => {
    if (!ev?.id) return;
    setDownloading(true);
    try {
      const url = await zipApi.generateAll(ev.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ev.name ?? "photos"}.zip`;
      a.click();
      toast.success("Download started!");
    } catch (err: any) {
      toast.error(err?.message ?? "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadOne = (p: any) => {
    const a = document.createElement("a");
    a.href = p.display_url;
    a.download = p.original_name ?? "photo.jpg";
    a.target = "_blank";
    a.click();
  };

  if (evLoading) {
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
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="font-editorial text-xl font-bold">Link not found</h2>
          <p className="text-sm text-muted-foreground">
            This private link is invalid or has expired. Ask the photographer
            for a new one.
          </p>
        </div>
      </div>
    );
  }

  const photographer = (ev as any).photographer;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <div className="relative h-[35vh] md:h-[45vh] bg-primary overflow-hidden">
        {ev.cover_image_url && (
          <img
            src={ev.cover_image_url}
            alt={ev.name}
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/70" />
        <div className="relative z-10 flex flex-col h-full items-center justify-end pb-8 px-4 text-center">
          <div className="mb-3">
            {photographer?.avatar_url ? (
              <img
                src={photographer.avatar_url}
                alt="Studio"
                className="h-9 w-9 rounded-full mx-auto mb-2 border-2 border-white/30 object-cover"
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
          <div className="flex items-center gap-2 mb-2">
            <h1 className="font-editorial text-2xl md:text-4xl font-bold text-white tracking-tight text-balance">
              {ev.name}
            </h1>
            <Badge className="bg-accent/90 text-accent-foreground text-xs border-0 shrink-0">
              <Lock className="h-2.5 w-2.5 mr-1" /> Private
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-white/70 text-sm flex-wrap justify-center">
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
              {total} photos
            </Badge>
          </div>
        </div>
      </div>

      {/* Gallery header */}
      <div className="max-w-6xl mx-auto w-full px-4 py-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-base">Full Gallery</h2>
          {!photosLoading && (
            <p className="text-xs text-muted-foreground">{total} photos</p>
          )}
        </div>
        {photos.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 shrink-0"
            onClick={handleDownloadAll}
            disabled={downloading}
          >
            {downloading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing…
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" /> Download All
              </>
            )}
          </Button>
        )}
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto w-full px-4 pb-12 flex-1">
        {photosLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Images className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-editorial text-lg font-bold">No photos yet</h3>
            <p className="text-sm text-muted-foreground">
              Photos will appear here once uploaded and processed.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {photos.map((p: any) => (
                <div
                  key={p.id}
                  className="relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer group"
                >
                  <img
                    src={p.display_url || ""}
                    alt=""
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  <button
                    className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                    onClick={() => handleDownloadOne(p)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="gap-1"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
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
