import React, { useCallback, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { eventsApi, groupsApi, uploadApi } from "@/services/api";
import { compressImage, formatFileSize } from "@/lib/imageCompression";
import { toast } from "sonner";
import {
  ArrowLeft,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
  Loader2,
  Zap,
  FolderOpen,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
type UploadStatus = "queued" | "compressing" | "uploading" | "done" | "error";

interface FileItem {
  id: string;
  file: File;
  preview: string;
  status: UploadStatus;
  progress: number; // 0–100
  originalSize: number;
  compressedSize: number | null;
  error: string | null;
  compressionRatio: number; // 0–1
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
const MAX_FILES = 500;

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function StatusIcon({ status }: { status: UploadStatus }) {
  if (status === "done")
    return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  if (status === "error")
    return <AlertCircle className="h-4 w-4 text-destructive shrink-0" />;
  if (status === "compressing")
    return <Zap className="h-4 w-4 text-yellow-500 shrink-0 animate-pulse" />;
  if (status === "uploading")
    return <Loader2 className="h-4 w-4 text-accent shrink-0 animate-spin" />;
  return <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function StatusBadge({ status }: { status: UploadStatus }) {
  const map: Record<
    UploadStatus,
    {
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
    }
  > = {
    queued: { label: "Queued", variant: "secondary" },
    compressing: { label: "Compressing", variant: "outline" },
    uploading: { label: "Uploading", variant: "default" },
    done: { label: "Done", variant: "default" },
    error: { label: "Error", variant: "destructive" },
  };
  const { label, variant } = map[status];
  return (
    <Badge
      variant={variant}
      className={cn(
        "text-xs shrink-0",
        status === "done" && "bg-green-600 hover:bg-green-600",
      )}
    >
      {label}
    </Badge>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BulkUploadPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preselectedEventId = params.get("eventId") ?? "";

  const [selectedEventId, setSelectedEventId] = useState(preselectedEventId);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [concurrentLimit] = useState(3);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: eventsRes, isLoading: eventsLoading } = useQuery({
    queryKey: ["events-for-upload"],
    queryFn: () => eventsApi.list({ limit: 200 }),
  });

  const { data: groupsRes } = useQuery({
    queryKey: ["groups-for-upload", selectedEventId],
    queryFn: () => groupsApi.list(selectedEventId),
    enabled: !!selectedEventId,
  });

  const events: any[] = Array.isArray(eventsRes)
    ? eventsRes
    : ((eventsRes as any)?.data ?? []);
  const groups: any[] = Array.isArray(groupsRes)
    ? groupsRes
    : ((groupsRes as any)?.data ?? []);

  // ── File intake ────────────────────────────────────────────────────────────
  const addFiles = useCallback(
    (incoming: File[]) => {
      const valid = incoming.filter(
        (f) =>
          ACCEPTED_TYPES.includes(f.type) ||
          f.name.match(/\.(jpe?g|png|webp|heic|heif)$/i),
      );
      if (valid.length !== incoming.length) {
        toast.warning(
          `${incoming.length - valid.length} file(s) skipped — unsupported format`,
        );
      }
      if (files.length + valid.length > MAX_FILES) {
        toast.error(`Maximum ${MAX_FILES} files per upload session`);
        return;
      }
      const items: FileItem[] = valid.map((f) => ({
        id: makeId(),
        file: f,
        preview: URL.createObjectURL(f),
        status: "queued",
        progress: 0,
        originalSize: f.size,
        compressedSize: null,
        error: null,
        compressionRatio: 0,
      }));
      setFiles((prev) => [...prev, ...items]);
    },
    [files.length],
  );

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  const clearCompleted = () => {
    setFiles((prev) => {
      prev
        .filter((f) => f.status === "done")
        .forEach((f) => URL.revokeObjectURL(f.preview));
      return prev.filter((f) => f.status !== "done");
    });
  };

  const clearAll = () => {
    setFiles((prev) => {
      prev.forEach((f) => URL.revokeObjectURL(f.preview));
      return [];
    });
  };

  // ── Drag-and-drop ──────────────────────────────────────────────────────────
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  // ── Upload queue with concurrency ─────────────────────────────────────────
  const updateFile = (id: string, patch: Partial<FileItem>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const processOne = async (item: FileItem): Promise<void> => {
    if (abortRef.current) return;

    // Step 1 — compress
    updateFile(item.id, { status: "compressing", progress: 5 });
    let uploadFile = item.file;
    let compressedSize = item.originalSize;
    let compressionRatio = 0;

    try {
      const result = await compressImage(item.file);
      uploadFile = result.file;
      compressedSize = result.compressedSize;
      compressionRatio = result.compressionRatio;
      updateFile(item.id, { compressedSize, compressionRatio, progress: 20 });
    } catch {
      // Compression failed — upload original
      updateFile(item.id, { compressedSize: item.originalSize, progress: 20 });
    }

    // Step 2 — upload with progress
    updateFile(item.id, { status: "uploading", progress: 25 });

    try {
      await uploadApi.photo(
        uploadFile,
        selectedEventId,
        selectedGroupId || undefined,
        (pct) => {
          // pct is 0–100 from the api; map to 25–95 range
          updateFile(item.id, { progress: 25 + Math.round(pct * 0.7) });
        },
      );
      updateFile(item.id, {
        status: "done",
        progress: 100,
        compressedSize,
        compressionRatio,
      });
    } catch (err: any) {
      updateFile(item.id, {
        status: "error",
        progress: 0,
        error: err?.message ?? "Upload failed",
      });
    }
  };

  const startUpload = async () => {
    if (!selectedEventId) {
      toast.error("Please select an event first");
      return;
    }
    const queued = files.filter(
      (f) => f.status === "queued" || f.status === "error",
    );
    if (!queued.length) {
      toast.info("No files to upload");
      return;
    }

    setIsUploading(true);
    abortRef.current = false;

    // Process in batches of `concurrentLimit`
    for (let i = 0; i < queued.length; i += concurrentLimit) {
      if (abortRef.current) break;
      const batch = queued.slice(i, i + concurrentLimit);
      await Promise.all(batch.map(processOne));
    }

    setIsUploading(false);
    const done = files.filter((f) => f.status === "done").length;
    const errs = files.filter((f) => f.status === "error").length;
    if (errs === 0) toast.success(`All ${done} photos uploaded successfully!`);
    else toast.warning(`${done} uploaded, ${errs} failed — retry errors below`);
  };

  const cancelUpload = () => {
    abortRef.current = true;
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const countQueued = files.filter((f) => f.status === "queued").length;
  const countUploading = files.filter(
    (f) => f.status === "uploading" || f.status === "compressing",
  ).length;
  const countDone = files.filter((f) => f.status === "done").length;
  const countError = files.filter((f) => f.status === "error").length;
  const totalOriginal = files.reduce((s, f) => s + f.originalSize, 0);
  const totalCompressed = files.reduce(
    (s, f) => s + (f.compressedSize ?? f.originalSize),
    0,
  );
  const overallProgress = files.length
    ? Math.round(files.reduce((s, f) => s + f.progress, 0) / files.length)
    : 0;

  return (
    <DashboardLayout>
      {/* Back nav */}
      <button
        onClick={() =>
          navigate(
            selectedEventId
              ? `/dashboard/events/${selectedEventId}`
              : "/dashboard/events",
          )
        }
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Event
      </button>

      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-editorial text-3xl font-bold tracking-tight">
            Bulk Photo Upload
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drag &amp; drop photos — auto-compressed to save storage while
            preserving quality
          </p>
        </div>
        {files.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            {countDone > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={clearCompleted}
              >
                <X className="h-3.5 w-3.5" /> Clear Done ({countDone})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={clearAll}
              disabled={isUploading}
            >
              <X className="h-3.5 w-3.5" /> Clear All
            </Button>
          </div>
        )}
      </div>

      {/* Configuration row */}
      <Card className="border shadow-none mb-5">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            {/* Event selector */}
            <div className="flex-1 space-y-1.5 min-w-0">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Target Event *
              </label>
              {eventsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  value={selectedEventId || "none"}
                  onValueChange={(v) => {
                    setSelectedEventId(v === "none" ? "" : v);
                    setSelectedGroupId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an event…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>
                      Select an event…
                    </SelectItem>
                    {events.map((ev: any) => (
                      <SelectItem key={ev.id} value={ev.id}>
                        {ev.name}
                        <span className="ml-2 text-xs text-muted-foreground">
                          · {ev.status}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Group selector */}
            <div className="flex-1 space-y-1.5 min-w-0">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Group (optional)
              </label>
              <Select
                value={selectedGroupId || "none"}
                disabled={!selectedEventId || groups.length === 0}
                onValueChange={(v) => setSelectedGroupId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      groups.length === 0
                        ? "No groups — upload to event root"
                        : "Select group…"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No group (event root)</SelectItem>
                  {groups.map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Upload / Cancel */}
            <div className="shrink-0">
              {isUploading ? (
                <Button
                  variant="destructive"
                  className="gap-1.5"
                  onClick={cancelUpload}
                >
                  <X className="h-4 w-4" /> Cancel
                </Button>
              ) : (
                <Button
                  className="gap-1.5"
                  disabled={
                    !selectedEventId ||
                    files.filter(
                      (f) => f.status === "queued" || f.status === "error",
                    ).length === 0
                  }
                  onClick={startUpload}
                >
                  <Upload className="h-4 w-4" />
                  Upload{" "}
                  {countQueued + countError > 0
                    ? `(${countQueued + countError})`
                    : ""}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overall progress bar — only visible while uploading */}
      {isUploading && (
        <div className="mb-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Uploading{" "}
              {countUploading > 0 ? `${countUploading} in parallel` : ""}…
            </span>
            <span>{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>
      )}

      {/* Stats pills — only when files are loaded */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {[
            { label: "Total", val: files.length, color: "" },
            {
              label: "Queued",
              val: countQueued,
              color: "text-muted-foreground",
            },
            { label: "Active", val: countUploading, color: "text-yellow-600" },
            { label: "Done", val: countDone, color: "text-green-600" },
            { label: "Errors", val: countError, color: "text-destructive" },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-1.5 bg-muted/60 rounded-full px-3 py-1 text-xs"
            >
              <span className="text-muted-foreground">{s.label}</span>
              <span className={cn("font-semibold", s.color)}>{s.val}</span>
            </div>
          ))}
          {totalOriginal > 0 && (
            <div className="flex items-center gap-1.5 bg-muted/60 rounded-full px-3 py-1 text-xs">
              <Zap className="h-3 w-3 text-yellow-500" />
              <span className="text-muted-foreground">Saved</span>
              <span className="font-semibold text-green-600">
                {formatFileSize(totalOriginal - totalCompressed)}
              </span>
              <span className="text-muted-foreground">
                ({formatFileSize(totalOriginal)} →{" "}
                {formatFileSize(totalCompressed)})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all mb-5 select-none",
          files.length > 0 ? "py-5" : "py-16",
          isDragging
            ? "border-accent bg-accent/8 scale-[1.005]"
            : "border-border hover:border-accent/60 hover:bg-muted/30",
          isUploading && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          className="hidden"
          onChange={onFileInputChange}
        />
        <div
          className={cn(
            "rounded-full bg-accent/10 p-3 transition-transform",
            isDragging && "scale-110",
          )}
        >
          <FolderOpen className="h-6 w-6 text-accent" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">
            {isDragging
              ? "Drop photos here"
              : "Drag & drop photos, or click to browse"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            JPEG, PNG, WebP, HEIC · Up to {MAX_FILES} files · Auto-compressed
            before upload
          </p>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <Card className="border shadow-none">
          <CardHeader className="py-3 px-4 border-b border-border">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>
                {files.length} file{files.length !== 1 ? "s" : ""} ready
              </span>
              {countError > 0 && !isUploading && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => {
                    // Reset errors back to queued so they can be retried
                    setFiles((prev) =>
                      prev.map((f) =>
                        f.status === "error"
                          ? { ...f, status: "queued", progress: 0, error: null }
                          : f,
                      ),
                    );
                  }}
                >
                  <RefreshCw className="h-3 w-3" /> Retry {countError} error
                  {countError !== 1 ? "s" : ""}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <div className="divide-y divide-border">
            {files.map((item) => (
              <FileRow
                key={item.id}
                item={item}
                onRemove={() => removeFile(item.id)}
                disabled={
                  isUploading &&
                  (item.status === "uploading" || item.status === "compressing")
                }
              />
            ))}
          </div>
        </Card>
      )}

      {/* Empty state */}
      {files.length === 0 && !isUploading && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <p>
            No photos added yet — drag some in above, or click the drop zone to
            browse.
          </p>
          {preselectedEventId && (
            <Link
              to={`/dashboard/events/${preselectedEventId}`}
              className="text-accent hover:underline mt-2 inline-block text-xs"
            >
              ← Back to event
            </Link>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

// ─── File Row ────────────────────────────────────────────────────────────────
function FileRow({
  item,
  onRemove,
  disabled,
}: {
  item: FileItem;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors min-w-0">
      {/* Thumbnail */}
      <div className="h-10 w-10 shrink-0 rounded overflow-hidden bg-muted">
        <img
          src={item.preview}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Name + compression info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate leading-tight">
          {item.file.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {formatFileSize(item.originalSize)}
            {item.compressedSize !== null &&
              item.compressedSize !== item.originalSize && (
                <span className="text-green-600 font-medium">
                  {" → "}
                  {formatFileSize(item.compressedSize)}{" "}
                  <span className="text-green-500">
                    (−{Math.round(item.compressionRatio * 100)}%)
                  </span>
                </span>
              )}
          </span>
          {item.error && (
            <span className="text-xs text-destructive truncate">
              {item.error}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {(item.status === "uploading" || item.status === "compressing") && (
          <div className="mt-1.5">
            <Progress value={item.progress} className="h-1.5" />
          </div>
        )}
        {item.status === "done" && (
          <div className="mt-1.5">
            <Progress value={100} className="h-1.5" />
          </div>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 shrink-0">
        <StatusIcon status={item.status} />
        <StatusBadge status={item.status} />
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        disabled={disabled}
        className={cn(
          "shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors",
          disabled && "opacity-30 cursor-not-allowed",
        )}
        title="Remove"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
