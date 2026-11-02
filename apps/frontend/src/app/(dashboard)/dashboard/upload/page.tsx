"use client";

import { useCallback, useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatFileSize } from "@/lib/utils";
import {
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Image as ImgIcon,
  FolderOpen,
} from "lucide-react";
import { useSearchParams } from "next/navigation";

interface FileItem {
  file: File;
  id: string;
  status: "pending" | "uploading" | "done" | "duplicate" | "error";
  progress: number;
  error?: string;
}

export default function UploadPage() {
  const sp = useSearchParams();
  const [eventId, setEventId] = useState(sp.get("eventId") ?? "");
  const [groupId, setGroupId] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const abortRef = useRef(false);

  const { data: events } = useQuery({
    queryKey: ["events-list"],
    queryFn: () => api.getEvents({ limit: 100, status: "ACTIVE" }),
  });

  const { data: groups } = useQuery({
    queryKey: ["groups", eventId],
    queryFn: () => api.getGroups(eventId),
    enabled: !!eventId,
  });

  const onDrop = useCallback((accepted: File[]) => {
    const items: FileItem[] = accepted.map((f) => ({
      file: f,
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      status: "pending",
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...items]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic"] },
    multiple: true,
    maxSize: 50 * 1024 * 1024,
  });

  const removeFile = (id: string) =>
    setFiles((prev) => prev.filter((f) => f.id !== id));

  const startUpload = async () => {
    if (!eventId) return alert("Please select an event");
    if (!files.filter((f) => f.status === "pending").length) return;
    setUploading(true);
    abortRef.current = false;

    for (const item of files) {
      if (item.status !== "pending") continue;
      if (abortRef.current) break;

      setFiles((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, status: "uploading" } : f)),
      );

      try {
        const result = await api.uploadPhoto(
          item.file,
          eventId,
          groupId || null,
          (pct) => {
            setFiles((prev) =>
              prev.map((f) => (f.id === item.id ? { ...f, progress: pct } : f)),
            );
          },
        );
        const status = result.duplicate ? "duplicate" : "done";
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status, progress: 100 } : f,
          ),
        );
      } catch (err: any) {
        const msg =
          err?.response?.data?.error?.message ?? err.message ?? "Upload failed";
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status: "error", error: msg } : f,
          ),
        );
      }
    }

    setUploading(false);
  };

  const done = files.filter((f) => f.status === "done").length;
  const pending = files.filter((f) => f.status === "pending").length;
  const errors = files.filter((f) => f.status === "error").length;
  const dupes = files.filter((f) => f.status === "duplicate").length;

  return (
    <DashboardShell title="Upload Photos">
      <div className="max-w-3xl space-y-6">
        {/* Event/Group selector */}
        <Card>
          <CardContent className="pt-5 pb-4 grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Event *</label>
              <select
                value={eventId}
                onChange={(e) => {
                  setEventId(e.target.value);
                  setGroupId("");
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select event…</option>
                {events?.data?.map((ev: any) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Group (optional)</label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                disabled={!eventId}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
              >
                <option value="">No group (top-level)</option>
                {groups?.map((g: any) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">
            {isDragActive ? "Drop photos here" : "Drag & drop photos here"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            or click to browse • JPEG, PNG, WebP, HEIC • up to 50MB each
          </p>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-3">
            {/* Summary */}
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                {files.length} files selected
              </span>
              {done > 0 && <Badge variant="success">{done} uploaded</Badge>}
              {dupes > 0 && <Badge variant="warning">{dupes} duplicate</Badge>}
              {errors > 0 && (
                <Badge variant="destructive">{errors} failed</Badge>
              )}
              {pending > 0 && (
                <Badge variant="outline">{pending} pending</Badge>
              )}
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {files.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 border rounded-lg bg-card"
                >
                  <ImgIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm truncate">{item.file.name}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(item.file.size)}
                        </span>
                        {item.status === "done" && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        {item.status === "duplicate" && (
                          <Badge variant="warning" className="text-xs">
                            Dupe
                          </Badge>
                        )}
                        {item.status === "error" && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                        {item.status === "pending" && (
                          <button onClick={() => removeFile(item.id)}>
                            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </button>
                        )}
                      </div>
                    </div>
                    {item.status === "uploading" && (
                      <Progress value={item.progress} className="h-1 mt-1.5" />
                    )}
                    {item.status === "error" && (
                      <p className="text-xs text-destructive mt-0.5">
                        {item.error}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setFiles([])}
                disabled={uploading}
              >
                Clear All
              </Button>
              <Button
                onClick={startUpload}
                loading={uploading}
                disabled={!pending || !eventId}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload {pending} Photo{pending !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
