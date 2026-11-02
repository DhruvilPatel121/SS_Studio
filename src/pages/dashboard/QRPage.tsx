import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { eventsApi } from "@/services/api";
import { toast } from "sonner";
import QRCode from "qrcode";
import { QrCode, Download, Globe, Lock, Copy, RefreshCw } from "lucide-react";

const getAppUrl = () => {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return import.meta.env.VITE_APP_URL || "";
};

interface QRPair {
  publicDataUrl: string | null;
  privateDataUrl: string | null;
}

export default function QRPage() {
  const [searchParams] = useSearchParams();
  const [eventId, setEventId] = useState(searchParams.get("eventId") ?? "");
  const [qrPair, setQrPair] = useState<QRPair>({
    publicDataUrl: null,
    privateDataUrl: null,
  });
  const [generating, setGenerating] = useState(false);

  const { data: eventsData } = useQuery<any>({
    queryKey: ["events-qr"],
    queryFn: () => eventsApi.list({ limit: 100 }),
  });

  const events: any[] = Array.isArray(eventsData?.data) ? eventsData.data : [];
  const selectedEvent = events.find((e: any) => e.id === eventId);

  const generateBothQRs = async () => {
    if (!selectedEvent) {
      toast.error("Select an event");
      return;
    }
    if (!selectedEvent.public_token || !selectedEvent.private_token) {
      toast.error(
        "This event has no share tokens yet — try refreshing the events list.",
      );
      return;
    }
    setGenerating(true);
    try {
      const appUrl = getAppUrl();
      const opts = {
        width: 400,
        margin: 2,
        color: { dark: "#121212", light: "#FAFAFA" },
      };
      const [pubUrl, privUrl] = await Promise.all([
        QRCode.toDataURL(`${appUrl}/join/${selectedEvent.public_token}`, opts),
        QRCode.toDataURL(`${appUrl}/vip/${selectedEvent.private_token}`, opts),
      ]);
      setQrPair({ publicDataUrl: pubUrl, privateDataUrl: privUrl });
      toast.success("QR codes generated!");
    } catch {
      toast.error("Failed to generate QR codes");
    } finally {
      setGenerating(false);
    }
  };

  const download = (dataUrl: string, filename: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  const copy = (token: string, label: string) => {
    const appUrl = getAppUrl();
    const url =
      label === "Public" ? `${appUrl}/join/${token}` : `${appUrl}/vip/${token}`;
    navigator.clipboard.writeText(url);
    toast.success(`${label} link copied!`);
  };

  return (
    <DashboardLayout>
      <h1 className="font-editorial text-3xl font-bold tracking-tight mb-2">
        QR Codes
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Generate two QR codes per event — one for public face-search, one for
        private full-gallery access.
      </p>

      {/* Event selector */}
      <Card className="border border-border shadow-none mb-6">
        <CardContent className="pt-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Select Event *</label>
            <Select
              value={eventId}
              onValueChange={(v) => {
                setEventId(v);
                setQrPair({ publicDataUrl: null, privateDataUrl: null });
              }}
            >
              <SelectTrigger className="max-w-sm">
                <SelectValue placeholder="Choose an event…" />
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
          <Button
            onClick={generateBothQRs}
            disabled={!eventId || generating}
            className="gap-2"
          >
            {generating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <QrCode className="h-4 w-4" />
            )}
            {generating ? "Generating…" : "Generate Both QR Codes"}
          </Button>
        </CardContent>
      </Card>

      {/* QR pair display */}
      {(qrPair.publicDataUrl || qrPair.privateDataUrl) && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Public QR */}
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-accent" />
                Public QR Code
                <Badge variant="secondary" className="text-xs ml-auto">
                  For everyone
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Print and display at the event. Guests scan → upload selfie →
                see only their own photos.
              </p>
              {qrPair.publicDataUrl && (
                <>
                  <div className="flex justify-center">
                    <div className="border border-border rounded-lg p-3 bg-card inline-block">
                      <img
                        src={qrPair.publicDataUrl}
                        alt="Public QR"
                        className="w-44 h-44"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 gap-1.5"
                      onClick={() =>
                        download(
                          qrPair.publicDataUrl!,
                          `${selectedEvent?.name ?? "event"}-public-qr.png`,
                        )
                      }
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() =>
                        copy(selectedEvent?.public_token, "Public")
                      }
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <code className="block text-xs font-mono bg-muted rounded px-2 py-1.5 truncate border border-border">
                    {getAppUrl()}/join/{selectedEvent?.public_token}
                  </code>
                </>
              )}
            </CardContent>
          </Card>

          {/* Private QR */}
          <Card className="border border-accent/20 shadow-none bg-accent/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4 text-accent" />
                Private QR Code
                <Badge variant="default" className="text-xs ml-auto">
                  VIP / Family
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Share only with trusted guests. They scan → browse and download
                the full event gallery. No selfie needed.
              </p>
              {qrPair.privateDataUrl && (
                <>
                  <div className="flex justify-center">
                    <div className="border border-accent/30 rounded-lg p-3 bg-card inline-block">
                      <img
                        src={qrPair.privateDataUrl}
                        alt="Private QR"
                        className="w-44 h-44"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 gap-1.5"
                      onClick={() =>
                        download(
                          qrPair.privateDataUrl!,
                          `${selectedEvent?.name ?? "event"}-private-qr.png`,
                        )
                      }
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() =>
                        copy(selectedEvent?.private_token, "Private")
                      }
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <code className="block text-xs font-mono bg-muted rounded px-2 py-1.5 truncate border border-border">
                    {getAppUrl()}/vip/{selectedEvent?.private_token}
                  </code>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* How it works reminder */}
      {!qrPair.publicDataUrl && (
        <Card className="border border-border shadow-none mt-4">
          <CardContent className="pt-5 pb-5 space-y-4">
            <p className="text-sm font-medium">How the two links work:</p>
            <Separator />
            <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div className="space-y-1">
                <p className="font-medium text-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-accent" /> Public Link
                </p>
                <p className="text-xs leading-relaxed">
                  Share widely — printed signage, text message, social media.
                  Guests upload a selfie and AI finds only the photos they
                  appear in. They cannot see other guests' photos.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-accent" /> Private Link
                </p>
                <p className="text-xs leading-relaxed">
                  Share only with close family or VIP guests. They can browse
                  and download every single photo in the event — no selfie
                  required.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
