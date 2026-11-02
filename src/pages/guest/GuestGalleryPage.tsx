/**
 * GuestGalleryPage — /e/:slug/gallery
 * Guest gallery with:
 * - Match confidence badges on photo cards
 * - Similarity threshold slider (dynamic client filter)
 * - Select All / Deselect All + individual selection checkboxes
 * - Batch ZIP download of selected or all photos
 * - Google Drive export integration
 * - Keyboard-navigable fullscreen lightbox with photo zoom (zoom in/out/reset, fullscreen toggle)
 * - Enhanced grid spacing, card shadows, and smooth progressive skeleton loading
 */
import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  useParams,
  useSearchParams,
  useNavigate,
  Link,
} from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  faceApi,
  guestApi,
  zipApi,
  googleDriveApi,
  favoritesApi,
} from "@/services/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Heart,
  FileArchive,
  X,
  ChevronLeft,
  ChevronRight,
  Camera,
  CheckSquare,
  Square,
  SlidersHorizontal,
  CloudUpload,
  Loader2,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Info,
} from "lucide-react";

export default function GuestGalleryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionToken = searchParams.get("session") ?? "";

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [exportingDrive, setExportingDrive] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(65); // 65% default
  const [showDriveDialog, setShowDriveDialog] = useState(false);
  const [driveExportResult, setDriveExportResult] = useState<any>(null);

  // Smooth loading image state
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  // Lightbox Zoom & Fullscreen
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lightboxRef = useRef<HTMLDivElement>(null);

  const initialTab =
    searchParams.get("tab") === "all" || !sessionToken ? "all" : "my";
  const [activeTab, setActiveTab] = useState<"my" | "all">(initialTab);

  // Fetch Event by slug
  const { data: ev } = useQuery<any>({
    queryKey: ["guest-event", slug],
    queryFn: () => guestApi.getEventBySlug(slug!),
    enabled: !!slug,
  });

  // Query 1: guest matched photos (when sessionToken is present)
  const { data: matchedPhotosRes = [], isLoading: matchedLoading } = useQuery<
    any[]
  >({
    queryKey: ["guest-photos", ev?.id, sessionToken],
    queryFn: () => faceApi.guestPhotos(ev!.id, sessionToken),
    enabled: !!ev?.id && !!sessionToken,
  });

  // Query 2: all photos for the event
  const { data: allPhotosRes, isLoading: allLoading } = useQuery<any>({
    queryKey: ["event-all-photos", ev?.id],
    queryFn: () => guestApi.allPhotos(ev!.id, { limit: 200 }),
    enabled: !!ev?.id,
  });

  const matchedPhotos: any[] = Array.isArray(matchedPhotosRes)
    ? matchedPhotosRes
    : [];
  const allPhotos: any[] = Array.isArray(allPhotosRes?.data)
    ? allPhotosRes.data
    : [];

  // Filter matched photos dynamically by similarity threshold
  const filteredMatchedPhotos = useMemo(() => {
    return matchedPhotos.filter((p) => {
      const score = p.quality ?? p.confidence ?? 0.9;
      return score * 100 >= similarityThreshold;
    });
  }, [matchedPhotos, similarityThreshold]);

  const currentList =
    activeTab === "my" && sessionToken ? filteredMatchedPhotos : allPhotos;
  const isLoading =
    activeTab === "my" && sessionToken ? matchedLoading : allLoading;
  const isSearch = !!sessionToken;

  const getPhotoUrl = (p: any) =>
    p.display_url || p.thumbnailUrl || p.signedUrl || "";

  const handleImageLoaded = (id: string) => {
    setLoadedImages((prev) => new Set(prev).add(id));
  };

  // Toggle favorite
  const toggleFav = useMutation({
    mutationFn: (photoId: string) => favoritesApi.toggle(photoId),
    onSuccess: (_res, photoId) => {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(photoId)) next.delete(photoId);
        else next.add(photoId);
        return next;
      });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  // Selection handlers
  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllSelected =
    currentList.length > 0 && currentList.every((p) => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentList.map((p) => p.id)));
    }
  };

  // Download single photo
  const downloadSingle = (p: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const url = getPhotoUrl(p);
    const a = document.createElement("a");
    a.href = url;
    a.download = p.original_name ?? "photo.jpg";
    a.target = "_blank";
    a.click();
  };

  // Batch ZIP Download handler
  const handleBatchZipDownload = async () => {
    if (!ev?.id || currentList.length === 0) return;
    setDownloadingZip(true);
    try {
      const idsToDownload =
        selectedIds.size > 0
          ? Array.from(selectedIds)
          : currentList.map((p) => p.id);

      const url = await zipApi.generateForPhotos(ev.id, idsToDownload);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ev.name || "photos"}-batch.zip`;
      a.click();
      toast.success(`Downloading ${idsToDownload.length} photos as ZIP!`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate ZIP archive");
    } finally {
      setDownloadingZip(false);
    }
  };

  // Google Drive Export handler
  const handleExportToGoogleDrive = async () => {
    if (!ev?.id || currentList.length === 0) return;
    setExportingDrive(true);
    setShowDriveDialog(true);
    setDriveExportResult(null);

    const photosToExport = (
      selectedIds.size > 0
        ? currentList.filter((p) => selectedIds.has(p.id))
        : currentList
    )
      .map((p, idx) => ({
        name: p.original_name || `photo-${idx + 1}.jpg`,
        url: getPhotoUrl(p),
      }))
      .filter((p) => !!p.url);

    try {
      const folderName = `${ev.name || "Event"} - Matched Photos`;
      const res = await googleDriveApi.exportPhotos({
        eventId: ev.id,
        folderName,
        photos: photosToExport,
      });

      setDriveExportResult(res);
      toast.success(
        `Successfully exported ${res.uploadedCount} photos to Google Drive!`,
      );
    } catch (err: any) {
      const msg = err?.message || "Export error";
      setDriveExportResult({ error: msg });
      toast.error(msg);
    } finally {
      setExportingDrive(false);
    }
  };

  const prevPhoto = useCallback(() => {
    setZoomLevel(1);
    setLightboxIndex((i) => (i != null && i > 0 ? i - 1 : i));
  }, []);

  const nextPhoto = useCallback(() => {
    setZoomLevel(1);
    setLightboxIndex((i) =>
      i != null && i < currentList.length - 1 ? i + 1 : i,
    );
  }, [currentList.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      lightboxRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          prevPhoto();
          break;
        case "ArrowRight":
          nextPhoto();
          break;
        case "Escape":
          setLightboxIndex(null);
          break;
        case "+":
        case "=":
          setZoomLevel((z) => Math.min(z + 0.25, 3));
          break;
        case "-":
          setZoomLevel((z) => Math.max(z - 0.25, 0.75));
          break;
        case "0":
          setZoomLevel(1);
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, prevPhoto, nextPhoto]);

  return (
    <div className="min-h-screen bg-background flex flex-col pb-16">
      {/* Top Navbar */}
      <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-3 sticky top-0 bg-background/95 backdrop-blur z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(`/e/${slug}`)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Back to event"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-editorial font-bold truncate text-base md:text-lg">
              {ev?.name ?? "Event Gallery"}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {activeTab === "my" && sessionToken
                ? `${filteredMatchedPhotos.length} matched photos`
                : `${allPhotos.length} total event photos`}
            </p>
          </div>
        </div>

        {/* Global Action buttons */}
        <div className="flex items-center gap-2">
          {currentList.length > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={toggleSelectAll}
                className="text-xs gap-1.5 h-8 hidden sm:inline-flex"
              >
                {isAllSelected ? (
                  <CheckSquare className="h-3.5 w-3.5 text-accent" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
                {isAllSelected ? "Deselect All" : "Select All"}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleBatchZipDownload}
                disabled={downloadingZip}
                className="text-xs gap-1.5 h-8"
              >
                {downloadingZip ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileArchive className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Batch ZIP</span>
              </Button>

              <Button
                size="sm"
                variant="default"
                onClick={handleExportToGoogleDrive}
                disabled={exportingDrive}
                className="text-xs gap-1.5 h-8 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {exportingDrive ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CloudUpload className="h-3.5 w-3.5" />
                )}
                <span>Export Drive</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs Bar: My Matched vs All Photos */}
      {isSearch && (
        <div className="border-b border-border px-4 py-2 bg-muted/20 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={activeTab === "my" ? "default" : "outline"}
              onClick={() => setActiveTab("my")}
              className="text-xs h-8 gap-1.5"
            >
              <Sparkles className="h-3 w-3 text-accent" />
              My Matched Photos ({matchedPhotos.length})
            </Button>
            <Button
              size="sm"
              variant={activeTab === "all" ? "default" : "outline"}
              onClick={() => setActiveTab("all")}
              className="text-xs h-8"
            >
              All Event Photos ({allPhotos.length})
            </Button>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={toggleSelectAll}
            className="text-xs gap-1.5 h-8 sm:hidden"
          >
            {isAllSelected ? (
              <CheckSquare className="h-3.5 w-3.5 text-accent" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            {isAllSelected ? "Deselect" : "Select All"}
          </Button>
        </div>
      )}

      {/* Similarity Threshold Slider Panel */}
      {isSearch && activeTab === "my" && matchedPhotos.length > 0 && (
        <div className="border-b border-border bg-card/60 px-4 py-3">
          <div className="max-w-2xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-accent" />
              <span className="text-xs font-semibold">
                Similarity Match Threshold:
              </span>
              <Badge variant="secondary" className="text-xs font-mono">
                {similarityThreshold}%
              </Badge>
              <span className="text-xs text-muted-foreground ml-1">
                ({filteredMatchedPhotos.length} of {matchedPhotos.length} match)
              </span>
            </div>

            <div className="flex items-center gap-3 flex-1 max-w-xs">
              <span className="text-[11px] text-muted-foreground">Loose</span>
              <Slider
                min={50}
                max={95}
                step={1}
                value={[similarityThreshold]}
                onValueChange={([v]) => setSimilarityThreshold(v)}
                className="flex-1"
              />
              <span className="text-[11px] text-muted-foreground">Strict</span>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Floating Multi-Select Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 inset-x-4 max-w-xl mx-auto z-40 bg-card/95 backdrop-blur border border-border shadow-2xl rounded-2xl p-3 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-xs px-2 py-0.5">
              {selectedIds.size}
            </Badge>
            <span className="text-xs font-medium">photos selected</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleBatchZipDownload}
              disabled={downloadingZip}
              className="text-xs h-8 gap-1"
            >
              <FileArchive className="h-3 w-3" />
              ZIP ({selectedIds.size})
            </Button>

            <Button
              size="sm"
              variant="default"
              onClick={handleExportToGoogleDrive}
              disabled={exportingDrive}
              className="text-xs h-8 gap-1 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <CloudUpload className="h-3 w-3" />
              Drive ({selectedIds.size})
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs h-8 px-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && currentList.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm space-y-4">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Camera className="h-10 w-10 text-muted-foreground opacity-40" />
            </div>
            <div>
              <h3 className="font-editorial text-xl font-bold mb-1">
                {activeTab === "my"
                  ? "No photos match your selfie"
                  : "No photos in this event yet"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {activeTab === "my"
                  ? "We strictly return only pictures featuring your face. Try lowering the threshold or upload another selfie."
                  : "Check back soon once the event photographer uploads photos."}
              </p>
            </div>
            {activeTab === "my" && (
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSimilarityThreshold(50)}
                >
                  Adjust Threshold to 50%
                </Button>
                <Link to={`/e/${slug}/find`}>
                  <Button size="sm" className="w-full gap-2">
                    <Camera className="h-4 w-4" /> Take Another Selfie
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab("all")}
                >
                  Browse All Event Photos ({allPhotos.length})
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photo Grid with Spacing, Shadows & Skeleton Progressive Load */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 md:gap-4 p-4 md:p-6">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-2xl overflow-hidden border border-border/60 bg-card shadow-sm p-1"
            >
              <Skeleton className="w-full h-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : currentList.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 md:gap-4 p-4 md:p-6">
          {currentList.map((p: any, idx: number) => {
            const isSelected = selectedIds.has(p.id);
            const isLoaded = loadedImages.has(p.id);
            const score = p.quality ?? p.confidence;
            const matchPct = score != null ? Math.round(score * 100) : null;
            const photoUrl = getPhotoUrl(p);

            return (
              <div
                key={p.id}
                className={`group relative aspect-square bg-muted/40 rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 ring-1 ${
                  isSelected
                    ? "ring-2 ring-accent border-transparent shadow-md"
                    : "ring-border/40 hover:ring-border hover:-translate-y-0.5"
                }`}
                onClick={() => {
                  setLightboxIndex(idx);
                  setZoomLevel(1);
                }}
              >
                {/* Smooth placeholder skeleton while image loads */}
                {!isLoaded && (
                  <Skeleton className="absolute inset-0 w-full h-full animate-pulse rounded-2xl" />
                )}

                <img
                  src={photoUrl}
                  alt={p.original_name ?? ""}
                  onLoad={() => handleImageLoaded(p.id)}
                  className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
                    isLoaded ? "opacity-100" : "opacity-0"
                  }`}
                  loading="lazy"
                />

                {/* Top Overlay: Checkbox and Match Confidence Badge */}
                <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none z-10">
                  <button
                    onClick={(e) => toggleSelectOne(p.id, e)}
                    className="pointer-events-auto p-1.5 rounded-lg bg-black/65 backdrop-blur text-white hover:bg-black/85 transition-colors shadow-sm"
                    title={isSelected ? "Deselect" : "Select"}
                  >
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-accent fill-accent" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>

                  {/* Match Confidence Badge */}
                  {matchPct != null && activeTab === "my" && (
                    <Badge
                      className={`text-[11px] font-mono px-2 py-0.5 border shadow-sm ${
                        matchPct >= 90
                          ? "bg-emerald-600/90 text-white border-emerald-500"
                          : matchPct >= 75
                            ? "bg-amber-600/90 text-white border-amber-500"
                            : "bg-zinc-700/90 text-white border-zinc-600"
                      }`}
                    >
                      <Sparkles className="h-2.5 w-2.5 mr-1 inline" />
                      {matchPct}% Match
                    </Badge>
                  )}
                </div>

                {/* Bottom Overlay: Actions */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                  <span className="text-[11px] text-white/90 truncate max-w-[65%] font-medium">
                    {p.original_name || "Photo"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFav.mutate(p.id);
                      }}
                      className="p-1.5 rounded-full bg-black/50 text-white hover:bg-black/75 transition-colors"
                    >
                      <Heart
                        className={`h-3.5 w-3.5 ${favorites.has(p.id) ? "fill-red-500 text-red-500" : "text-white"}`}
                      />
                    </button>
                    <button
                      onClick={(e) => downloadSingle(p, e)}
                      className="p-1.5 rounded-full bg-black/50 text-white hover:bg-black/75 transition-colors"
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Keyboard-Navigable Fullscreen Lightbox with Zoom Controls */}
      <Dialog
        open={lightboxIndex !== null}
        onOpenChange={() => {
          setLightboxIndex(null);
          setZoomLevel(1);
        }}
      >
        <DialogContent className="max-w-[calc(100%-1rem)] md:max-w-5xl p-0 bg-black/95 border border-zinc-800 overflow-hidden text-white">
          {lightboxIndex !== null && currentList[lightboxIndex] && (
            <div
              ref={lightboxRef}
              className="relative flex flex-col h-[85vh] select-none bg-black"
            >
              {/* Lightbox Header Bar */}
              <div className="flex items-center justify-between px-4 py-3 bg-zinc-950/80 border-b border-zinc-800 z-20">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium text-zinc-300 truncate max-w-[200px] md:max-w-md">
                    {currentList[lightboxIndex].original_name ??
                      `Photo ${lightboxIndex + 1}`}
                  </span>
                  {currentList[lightboxIndex].quality != null && (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-accent border-accent/40 font-mono"
                    >
                      {Math.round(
                        (currentList[lightboxIndex].quality || 0.95) * 100,
                      )}
                      % Match
                    </Badge>
                  )}
                </div>

                {/* Zoom & Control toolbar */}
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setZoomLevel((z) => Math.max(z - 0.25, 0.75))
                    }
                    className="h-8 w-8 p-0 text-zinc-300 hover:text-white hover:bg-zinc-800"
                    title="Zoom Out (-)"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setZoomLevel(1)}
                    className="h-8 px-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 font-mono"
                    title="Reset Zoom (0)"
                  >
                    {Math.round(zoomLevel * 100)}%
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                    className="h-8 w-8 p-0 text-zinc-300 hover:text-white hover:bg-zinc-800"
                    title="Zoom In (+)"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>

                  <div className="w-[1px] h-4 bg-zinc-700 mx-1" />

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={toggleFullscreen}
                    className="h-8 w-8 p-0 text-zinc-300 hover:text-white hover:bg-zinc-800"
                    title="Fullscreen (F)"
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setLightboxIndex(null)}
                    className="h-8 w-8 p-0 text-zinc-300 hover:text-white hover:bg-zinc-800"
                    title="Close (Esc)"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Lightbox Center Image Viewport */}
              <div className="flex-1 relative overflow-auto flex items-center justify-center p-2 md:p-4">
                <div
                  className="transition-transform duration-200 ease-out flex items-center justify-center"
                  style={{ transform: `scale(${zoomLevel})` }}
                >
                  <img
                    src={getPhotoUrl(currentList[lightboxIndex])}
                    alt=""
                    className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
                    draggable={false}
                  />
                </div>

                {/* Left & Right Navigation Chevrons */}
                {lightboxIndex > 0 && (
                  <button
                    onClick={prevPhoto}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white transition-all backdrop-blur shadow-lg border border-zinc-700/50"
                    title="Previous (ArrowLeft)"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                )}
                {lightboxIndex < currentList.length - 1 && (
                  <button
                    onClick={nextPhoto}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white transition-all backdrop-blur shadow-lg border border-zinc-700/50"
                    title="Next (ArrowRight)"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                )}
              </div>

              {/* Lightbox Bottom Footer */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-950/80 border-t border-zinc-800 text-xs text-zinc-400">
                <span>
                  {lightboxIndex + 1} of {currentList.length} photos · Press{" "}
                  <strong>←</strong> / <strong>→</strong> or{" "}
                  <strong>Esc</strong>
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-white"
                  onClick={() => downloadSingle(currentList[lightboxIndex])}
                >
                  <Download className="h-3.5 w-3.5" /> Download Photo
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Google Drive Export Feedback Dialog */}
      <Dialog open={showDriveDialog} onOpenChange={setShowDriveDialog}>
        <DialogContent className="max-w-md">
          <div className="p-4 space-y-4 text-center">
            <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
              <CloudUpload className="h-8 w-8 text-accent" />
            </div>

            <h3 className="font-editorial text-xl font-bold">
              Google Drive Export
            </h3>

            {exportingDrive ? (
              <div className="space-y-3 py-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-accent" />
                <p className="text-sm text-muted-foreground">
                  Creating Google Drive event folder and uploading photos…
                </p>
              </div>
            ) : driveExportResult?.error ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-left">
                  <p className="text-xs text-destructive leading-relaxed">
                    {driveExportResult.error}
                  </p>
                </div>
                <div className="rounded-xl bg-muted p-3 text-left space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Info className="h-3.5 w-3.5 text-accent" /> How to connect
                    Google Drive:
                  </div>
                  <p>
                    1. Open the <strong>Skill</strong> tab in the platform's
                    left sidebar.
                  </p>
                  <p>
                    2. Find <strong>Google Drive</strong> and click{" "}
                    <strong>Authorize</strong>.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowDriveDialog(false)}
                  >
                    Close
                  </Button>
                  <Button
                    className="flex-1 gap-1.5"
                    onClick={() => {
                      setShowDriveDialog(false);
                      handleBatchZipDownload();
                    }}
                  >
                    <FileArchive className="h-4 w-4" /> Download ZIP Instead
                  </Button>
                </div>
              </div>
            ) : driveExportResult?.success ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Export complete! Saved{" "}
                  <strong>{driveExportResult.uploadedCount}</strong> photos into
                  Google Drive folder{" "}
                  <strong>"{driveExportResult.folderName}"</strong>.
                </p>
                <Button
                  className="w-full"
                  onClick={() => setShowDriveDialog(false)}
                >
                  Done
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
