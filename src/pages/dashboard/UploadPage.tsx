import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { eventsApi, groupsApi, uploadApi } from "@/services/api";
import { formatFileSize, getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { Upload, X, CheckCircle, AlertCircle, Image } from "lucide-react";

interface FileItem {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

export default function UploadPage() {
  const [searchParams] = useSearchParams();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [eventId, setEventId] = useState(searchParams.get("eventId") ?? "");
  const [groupId, setGroupId] = useState("");

  const { data: eventsData } = useQuery<any>({
    queryKey: ["events-upload"],
    queryFn: () => eventsApi.list({ limit: 100 }),
  });

  const { data: groupsData } = useQuery<any>({
    queryKey: ["groups-upload", eventId],
    queryFn: () => groupsApi.list(eventId),
    enabled: !!eventId,
  });

  const events: any[] = Array.isArray(eventsData?.data) ? eventsData.data : [];
  const groups: any[] = Array.isArray(groupsData)
    ? groupsData
    : Array.isArray((groupsData as any)?.data)
      ? (groupsData as any).data
      : [];

  const onDrop = useCallback((accepted: File[]) => {
    const newItems: FileItem[] = accepted.map((f) => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      preview: URL.createObjectURL(f),
      status: "pending",
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newItems]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic"] },
    maxSize: 50 * 1024 * 1024,
    onDropRejected: (rej) => {
      rej.forEach((r) =>
        toast.error(`${r.file.name}: ${r.errors[0]?.message}`),
      );
    },
  });

  const uploadAll = async () => {
    if (!eventId) {
      toast.error("Select an event first");
      return;
    }
    const pendingItems = files.filter((f) => f.status === "pending");
    if (pendingItems.length === 0) return;

    const targetGroupId = groupId && groupId !== "none" ? groupId : undefined;
    let successCount = 0;
    let failCount = 0;

    for (const item of pendingItems) {
      setFiles((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, status: "uploading" } : f)),
      );
      try {
        await uploadApi.photo(item.file, eventId, targetGroupId, (pct) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, progress: pct } : f)),
          );
        });
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status: "done", progress: 100 } : f,
          ),
        );
        successCount++;
      } catch (err) {
        failCount++;
        const errMsg = getErrorMessage(err);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status: "error", error: errMsg } : f,
          ),
        );
      }
    }
    if (failCount === 0) {
      toast.success(
        `Successfully uploaded ${successCount} photo${successCount !== 1 ? "s" : ""}!`,
      );
    } else {
      toast.error(
        `Uploaded ${successCount}, failed ${failCount}. Click Retry to try again.`,
      );
    }
  };

  const retryFailed = () => {
    setFiles((prev) =>
      prev.map((f) =>
        f.status === "error"
          ? { ...f, status: "pending", error: undefined, progress: 0 }
          : f,
      ),
    );
  };

  const remove = (id: string) => {
    setFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  const pending = files.filter((f) => f.status === "pending").length;
  const uploading = files.filter((f) => f.status === "uploading").length;
  const done = files.filter((f) => f.status === "done").length;
  const errorCount = files.filter((f) => f.status === "error").length;

  return (
    <DashboardLayout>
      <h1 className="font-editorial text-3xl font-bold tracking-tight mb-6">
        Upload Photos
      </h1>

      {/* Event + Group selectors */}
      <div className="grid grid-cols-2 gap-4 mb-6 max-w-lg">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Event *</label>
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger>
              <SelectValue placeholder="Select event" />
            </SelectTrigger>
            <SelectContent>
              {events.map((ev: any) => (
                <SelectItem key={ev.id} value={ev.id}>
                  {ev.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Group (optional)</label>
          <Select
            value={groupId}
            onValueChange={setGroupId}
            disabled={!eventId}
          >
            <SelectTrigger>
              <SelectValue placeholder="No group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No group</SelectItem>
              {groups.map((g: any) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors mb-6 ${
          isDragActive
            ? "border-accent bg-accent/5"
            : "border-border hover:border-foreground/30 hover:bg-muted/30"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium mb-1">
          {isDragActive ? "Drop photos here" : "Drag & drop photos here"}
        </p>
        <p className="text-sm text-muted-foreground">
          or click to browse · JPEG, PNG, WEBP, HEIC · max 50 MB each
        </p>
      </div>

      {files.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              {pending > 0 && (
                <Badge variant="secondary">{pending} pending</Badge>
              )}
              {uploading > 0 && (
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                  {uploading} uploading
                </Badge>
              )}
              {done > 0 && (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  {done} done
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="destructive">{errorCount} failed</Badge>
              )}
            </div>
            <div className="flex gap-2">
              {errorCount > 0 && (
                <Button variant="outline" size="sm" onClick={retryFailed}>
                  Retry {errorCount} failed
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setFiles([])}>
                Clear all
              </Button>
              <Button
                size="sm"
                disabled={pending === 0 || uploading > 0}
                onClick={uploadAll}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Upload {pending} photo{pending !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {files.map((item) => (
              <div
                key={item.id}
                className="relative rounded-lg overflow-hidden border border-border bg-muted aspect-square group"
              >
                <img
                  src={item.preview}
                  alt={item.file.name}
                  className="w-full h-full object-cover"
                />
                {/* Status overlay */}
                {item.status === "uploading" && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1 p-2">
                    <Progress value={item.progress} className="h-1 w-full" />
                    <span className="text-xs text-white">{item.progress}%</span>
                  </div>
                )}
                {item.status === "done" && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-green-400" />
                  </div>
                )}
                {item.status === "error" && (
                  <div
                    className="absolute inset-0 bg-red-950/80 flex flex-col items-center justify-center p-2 text-center"
                    title={item.error}
                  >
                    <AlertCircle className="h-5 w-5 text-red-400 mb-1" />
                    <span className="text-[10px] text-red-200 line-clamp-2 px-1">
                      {item.error || "Upload failed"}
                    </span>
                  </div>
                )}
                {/* Remove button */}
                {item.status !== "uploading" && (
                  <button
                    onClick={() => remove(item.id)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                {/* File size */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 px-1.5 pb-1 pt-3">
                  <p className="text-xs text-white truncate">
                    {formatFileSize(item.file.size)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
