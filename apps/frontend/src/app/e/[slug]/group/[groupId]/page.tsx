"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  ArrowLeft,
  Image as ImgIcon,
  Download,
  Heart,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function GroupGalleryPage() {
  const { slug, groupId } = useParams<{ slug: string; groupId: string }>();
  const [page, setPage] = useState(1);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const { data: eventData } = useQuery({
    queryKey: ["public-event", slug],
    queryFn: () => api.getPublicEvent(slug),
  });

  const { data: photos, isLoading } = useQuery({
    queryKey: ["group-photos", groupId, page],
    queryFn: () => api.getPhotos({ groupId, page, limit: 30 }),
    enabled: !!groupId,
  });

  const event = eventData?.event;
  const group = event?.groups?.find((g: any) => g.id === groupId);

  const toggleFav = async (photoId: string) => {
    try {
      const res = await api.toggleFavorite(photoId);
      setFavorites((prev) => {
        const next = new Set(prev);
        res.favorited ? next.add(photoId) : next.delete(photoId);
        return next;
      });
    } catch {
      toast.error("Failed");
    }
  };

  const downloadPhoto = async (photoId: string) => {
    try {
      const { url } = await api.downloadSingle(photoId, undefined, "original");
      const a = document.createElement("a");
      a.href = url;
      a.download = "photo.jpg";
      a.click();
    } catch {
      toast.error("Download failed");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b px-4 py-3 flex items-center gap-3">
        <Link href={`/e/${slug}`}>
          <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </Link>
        <div>
          <h1 className="font-semibold">{group?.name ?? "Gallery"}</h1>
          <p className="text-xs text-muted-foreground">{event?.name}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Find my photos CTA */}
        {group?.isFaceMatchEnabled && (
          <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Camera className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium text-sm">Find photos of you</p>
                <p className="text-xs text-muted-foreground">
                  AI will search this album for your face
                </p>
              </div>
            </div>
            <Link href={`/e/${slug}/find-my-photos?groupId=${groupId}`}>
              <Button size="sm">Find My Photos</Button>
            </Link>
          </div>
        )}

        {/* Photo count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            {photos?.pagination?.total ?? 0} photos
          </p>
          {photos?.pagination?.total > 0 && (
            <Badge variant="outline">
              {group?.privacy === "ANONYMOUS_FACE_ACCESS"
                ? "AI Enabled"
                : "Browse Only"}
            </Badge>
          )}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : !photos?.data?.length ? (
          <div className="text-center py-20">
            <ImgIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              No photos in this album yet.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {photos.data.map((photo: any) => (
                <div
                  key={photo.id}
                  className="photo-card aspect-square rounded-lg overflow-hidden bg-muted"
                >
                  <img
                    src={photo.thumbnailUrl ?? "/placeholder.jpg"}
                    alt={photo.originalName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="overlay flex items-end justify-between">
                    <button
                      className={`p-1.5 rounded-full ${favorites.has(photo.id) ? "bg-red-500 text-white" : "bg-white/80"}`}
                      onClick={() => toggleFav(photo.id)}
                    >
                      <Heart
                        className="h-3.5 w-3.5"
                        fill={favorites.has(photo.id) ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      className="p-1.5 rounded-full bg-white/80"
                      onClick={() => downloadPhoto(photo.id)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {photos.pagination?.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm py-2">
                  {page} / {photos.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!photos.pagination.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
