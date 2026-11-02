"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/progress";
import {
  Camera,
  Upload,
  Image as ImgIcon,
  Download,
  Heart,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { api as apiClient } from "@/lib/api";

type SearchState =
  | "idle"
  | "uploading"
  | "searching"
  | "results"
  | "no_match"
  | "error";

export default function FindMyPhotosPage() {
  const { slug } = useParams<{ slug: string }>();
  const sp = useSearchParams();
  const groupId = sp.get("groupId") ?? undefined;

  const [state, setState] = useState<SearchState>("idle");
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [matchedPhotoIds, setMatchedPhotoIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [photos, setPhotos] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [downloadingZip, setDownloadingZip] = useState(false);
  const eventIdRef = useRef<string>("");

  const { data: eventData } = useQuery({
    queryKey: ["public-event", slug],
    queryFn: () => api.getPublicEvent(slug),
  });

  const event = eventData?.event;

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted[0] || !event) return;
      const file = accepted[0];
      setSelfiePreview(URL.createObjectURL(file));
      setState("uploading");
      setErrorMsg("");
      eventIdRef.current = event.id;

      try {
        setState("searching");
        const result = await api.searchBySelfie(
          file,
          event.id,
          groupId,
          sessionToken ?? undefined,
        );
        setSessionToken(result.guestSessionToken);
        setMatchedPhotoIds(result.photoIds ?? []);

        if (!result.photoIds?.length) {
          setState("no_match");
          return;
        }

        // Fetch photo details + signed URLs via guest-photos endpoint
        const photosResult = await api.getGuestPhotos(
          result.guestSessionToken,
          event.id,
          1,
          50,
        );
        setPhotos(photosResult.data ?? []);
        setState("results");
      } catch (err: any) {
        const code = err?.response?.data?.error?.code;
        if (code === "NO_FACE_DETECTED") {
          setErrorMsg(
            "No face detected in your selfie. Please try again with better lighting and face the camera directly.",
          );
        } else if (code === "MULTIPLE_FACES") {
          setErrorMsg(
            "Multiple faces detected. Please take a selfie with only your face in frame.",
          );
        } else {
          setErrorMsg(
            err?.response?.data?.error?.message ??
              "Something went wrong. Please try again.",
          );
        }
        setState("error");
      }
    },
    [event, groupId, sessionToken],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    multiple: false,
    maxSize: 15 * 1024 * 1024,
  });

  const toggleFavorite = async (photoId: string) => {
    try {
      const res = await api.toggleFavorite(photoId, sessionToken ?? undefined);
      setFavorites((prev) => {
        const next = new Set(prev);
        res.favorited ? next.add(photoId) : next.delete(photoId);
        return next;
      });
    } catch {
      toast.error("Failed to update favorite");
    }
  };

  const downloadPhoto = async (photoId: string) => {
    try {
      const { url } = await api.downloadSingle(
        photoId,
        sessionToken ?? undefined,
        "original",
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "photo.jpg";
      a.click();
    } catch {
      toast.error("Download failed");
    }
  };

  const downloadAll = async () => {
    if (!matchedPhotoIds.length || !event) return;
    setDownloadingZip(true);
    try {
      const job = await api.requestZip(
        matchedPhotoIds,
        event.id,
        sessionToken ?? undefined,
      );
      toast.info("Preparing your ZIP… you will be notified when ready.");
      // Poll for ZIP readiness
      const poll = setInterval(async () => {
        const status = await api.getZipStatus(job.jobId);
        if (status.status === "COMPLETED" && status.downloadUrl) {
          clearInterval(poll);
          setDownloadingZip(false);
          const a = document.createElement("a");
          a.href = status.downloadUrl;
          a.download = "my-photos.zip";
          a.click();
          toast.success("ZIP download started!");
        } else if (status.status === "FAILED") {
          clearInterval(poll);
          setDownloadingZip(false);
          toast.error("ZIP generation failed. Please try again.");
        }
      }, 3000);
    } catch {
      setDownloadingZip(false);
      toast.error("Failed to start ZIP download");
    }
  };

  const reset = () => {
    setState("idle");
    setSelfiePreview(null);
    setErrorMsg("");
  };

  const primaryColor = eventData?.branding?.primaryColor ?? "#6366f1";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3">
        <Link
          href={`/e/${slug}`}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-semibold">{event?.name ?? "Find My Photos"}</h1>
          <p className="text-xs text-muted-foreground">AI Face Search</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Idle / Upload state */}
        {(state === "idle" || state === "error") && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <div
                className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <Camera className="h-8 w-8" style={{ color: primaryColor }} />
              </div>
              <h2 className="text-2xl font-bold mb-2">Take a Selfie</h2>
              <p className="text-muted-foreground">
                Our AI will scan all {event?._count?.photos ?? 0} event photos
                and find the ones with you in them.
              </p>
            </div>

            {state === "error" && (
              <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    Search failed
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {errorMsg}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={reset}
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            )}

            {/* Drop zone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                isDragActive
                  ? "border-primary bg-primary/5 scale-[1.02]"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium mb-1">
                {isDragActive ? "Drop your selfie here" : "Upload your selfie"}
              </p>
              <p className="text-sm text-muted-foreground">
                JPEG, PNG or WebP • Max 15MB
              </p>
              <Button
                className="mt-4"
                style={{ backgroundColor: primaryColor }}
              >
                <Camera className="mr-2 h-4 w-4" />
                Choose Photo
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              {[
                {
                  icon: "📸",
                  title: "Take selfie",
                  desc: "Clear, well-lit photo of your face",
                },
                {
                  icon: "🤖",
                  title: "AI scans",
                  desc: "Face recognition across all photos",
                },
                {
                  icon: "🎉",
                  title: "Your photos",
                  desc: "View, download & share instantly",
                },
              ].map((step) => (
                <div key={step.title} className="p-3 rounded-lg bg-muted/50">
                  <div className="text-2xl mb-1">{step.icon}</div>
                  <p className="font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Searching */}
        {(state === "uploading" || state === "searching") && (
          <div className="flex flex-col items-center justify-center py-20 gap-6 animate-fade-in">
            {selfiePreview && (
              <img
                src={selfiePreview}
                alt="Your selfie"
                className="h-24 w-24 rounded-full object-cover border-4 border-primary shadow-lg"
              />
            )}
            <div className="text-center">
              <Spinner size="lg" className="mx-auto mb-4" />
              <h3 className="text-lg font-semibold">
                {state === "uploading"
                  ? "Uploading selfie…"
                  : "AI is scanning photos…"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {state === "searching"
                  ? `Searching through ${event?._count?.photos ?? 0} photos`
                  : "Processing your face"}
              </p>
            </div>
          </div>
        )}

        {/* No match */}
        {state === "no_match" && (
          <div className="text-center py-16 animate-fade-in">
            {selfiePreview && (
              <img
                src={selfiePreview}
                alt="Your selfie"
                className="h-24 w-24 rounded-full object-cover border-4 border-muted mx-auto mb-4"
              />
            )}
            <div className="text-4xl mb-3">😔</div>
            <h3 className="text-xl font-semibold mb-2">No photos found</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-6">
              We couldn't find photos of you in this event. Try uploading a
              clearer selfie or check if you were in a different album.
            </p>
            <Button onClick={reset} variant="outline">
              Try Different Selfie
            </Button>
          </div>
        )}

        {/* Results */}
        {state === "results" && (
          <div className="animate-fade-in space-y-5">
            {/* Results header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selfiePreview && (
                  <img
                    src={selfiePreview}
                    alt="You"
                    className="h-12 w-12 rounded-full object-cover border-2 border-primary"
                  />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="font-semibold">
                      {photos.length} photos found!
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your personal gallery
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={reset}>
                  <Camera className="mr-1 h-4 w-4" /> New Selfie
                </Button>
                <Button
                  size="sm"
                  onClick={downloadAll}
                  loading={downloadingZip}
                  style={{ backgroundColor: primaryColor }}
                >
                  <Download className="mr-1 h-4 w-4" /> Download All
                </Button>
              </div>
            </div>

            {/* Photo grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {photos.map((photo: any) => (
                <div
                  key={photo.id}
                  className="photo-card aspect-square bg-muted rounded-lg overflow-hidden"
                >
                  <img
                    src={
                      photo.thumbnailUrl ??
                      photo.previewUrl ??
                      "/placeholder.jpg"
                    }
                    alt={photo.originalName}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="overlay flex items-end justify-between">
                    <button
                      className={`p-1.5 rounded-full ${favorites.has(photo.id) ? "bg-red-500 text-white" : "bg-white/80 text-foreground"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(photo.id);
                      }}
                    >
                      <Heart
                        className="h-4 w-4"
                        fill={favorites.has(photo.id) ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      className="p-1.5 rounded-full bg-white/80 text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadPhoto(photo.id);
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-center text-muted-foreground">
              💡 Tap any photo to view full size. Your session is saved —
              refresh to see new photos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
