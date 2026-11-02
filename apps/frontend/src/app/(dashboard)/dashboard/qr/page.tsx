"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/progress";
import { toast } from "sonner";
import { QrCode, Download, Copy, RefreshCw, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function QRPage() {
  const sp = useSearchParams();
  const [eventId, setEventId] = useState(sp.get("eventId") ?? "");
  const [groupId, setGroupId] = useState("");

  const { data: events } = useQuery({
    queryKey: ["events-list"],
    queryFn: () => api.getEvents({ limit: 100 }),
  });

  const { data: groups } = useQuery({
    queryKey: ["groups", eventId],
    queryFn: () => api.getGroups(eventId),
    enabled: !!eventId,
  });

  const {
    data: qrCodes,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["qr-codes", eventId],
    queryFn: () => api.getQRCodes(eventId),
    enabled: !!eventId,
  });

  const generate = useMutation({
    mutationFn: () => api.generateQR(eventId, groupId || undefined),
    onSuccess: () => {
      refetch();
      toast.success("QR code generated!");
    },
    onError: () => toast.error("Failed to generate QR code"),
  });

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copied to clipboard");
  };

  return (
    <DashboardShell title="QR Codes">
      <div className="max-w-3xl space-y-6">
        {/* Generator */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generate New QR Code</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4 items-end">
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
                <option value="">Whole event</option>
                {groups?.map((g: any) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={() => generate.mutate()}
              loading={generate.isPending}
              disabled={!eventId}
            >
              <Plus className="mr-2 h-4 w-4" /> Generate
            </Button>
          </CardContent>
        </Card>

        {/* QR list */}
        {!eventId ? (
          <div className="text-center py-16 text-muted-foreground">
            <QrCode className="h-12 w-12 mx-auto mb-3" />
            <p>Select an event to see its QR codes</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : !qrCodes?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <QrCode className="h-10 w-10 mx-auto mb-2" />
            <p>No QR codes yet for this event.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {qrCodes.map((qr: any) => (
              <Card key={qr.id}>
                <CardContent className="pt-5 flex gap-6">
                  {/* SVG preview */}
                  <div
                    className="flex-shrink-0 w-24 h-24 bg-white border rounded p-1"
                    dangerouslySetInnerHTML={{ __html: qr.svgData ?? "" }}
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      {qr.group ? (
                        <Badge variant="outline">Group: {qr.group.name}</Badge>
                      ) : (
                        <Badge variant="secondary">Full Event</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {qr.scanCount ?? 0} scans
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground break-all">
                      {qr.url}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyUrl(qr.url)}
                      >
                        <Copy className="mr-1 h-3 w-3" /> Copy URL
                      </Button>
                      {qr.pngUrl && (
                        <a href={qr.pngUrl} download={`qr-${qr.token}.png`}>
                          <Button size="sm" variant="outline">
                            <Download className="mr-1 h-3 w-3" /> PNG
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
