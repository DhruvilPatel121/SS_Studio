/**
 * FindMyPhotosPage — /e/:slug/find
 * Selfie step: guests can TAKE a live selfie via camera OR upload a photo.
 * After match, navigates to /e/:slug/gallery?session=xxx
 */
import React, { useCallback, useRef, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { faceApi, guestApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import {
  Camera,
  Upload,
  ArrowLeft,
  RotateCcw,
  AlertTriangle,
  Video,
  VideoOff,
  FlipHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "instructions" | "capture" | "processing" | "error";

export default function FindMyPhotosPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("instructions");
  const [progress, setProgress] = useState(0);
  const [eventId, setEventId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [activeTab, setActiveTab] = useState<"camera" | "upload">("camera");

  // Create guest session when component mounts
  useEffect(() => {
    if (!slug) return;
    guestApi
      .getEventBySlug(slug)
      .then((res) => {
        const ev = res as any;
        if (ev?.id) {
          setEventId(ev.id);
          return guestApi.createSession(ev.id);
        }
      })
      .then((res) => {
        const token =
          (res as any)?.sessionToken ?? (res as any)?.data?.sessionToken;
        if (token) setSessionToken(token);
      })
      .catch(console.error);
  }, [slug]);

  // ── Camera helpers ───────────────────────────────────────────────────────
  const startCamera = useCallback(
    async (facing: "user" | "environment" = facingMode) => {
      stopCamera();
      setCameraError("");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraActive(true);
      } catch (err: any) {
        setCameraError(
          err?.name === "NotAllowedError"
            ? "Camera permission denied. Please allow camera access and try again."
            : "Could not start camera. Use file upload instead.",
        );
        setCameraActive(false);
      }
    },
    [facingMode],
  );

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const flipCamera = () => {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    startCamera(next);
  };

  // Start camera when switching to camera tab
  useEffect(() => {
    if (step === "capture" && activeTab === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [step, activeTab]); // eslint-disable-line

  // Capture frame from live camera
  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          toast.error("Could not capture image");
          return;
        }
        const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
        setPreviewUrl(URL.createObjectURL(blob));
        stopCamera();
        await processFile(file);
      },
      "image/jpeg",
      0.9,
    );
  }, [facingMode, eventId, sessionToken]); // eslint-disable-line

  // ── File upload ──────────────────────────────────────────────────────────
  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      setPreviewUrl(URL.createObjectURL(file));
      await processFile(file);
    },
    [eventId, sessionToken],
  ); // eslint-disable-line

  const processFile = async (file: File) => {
    let currentEventId = eventId;
    let currentToken = sessionToken;

    // Lazily resolve eventId if missing
    if (!currentEventId && slug) {
      try {
        const ev: any = await guestApi.getEventBySlug(slug);
        if (ev?.id) {
          currentEventId = ev.id;
          setEventId(ev.id);
        }
      } catch (e) {
        console.warn("Lazy event fetch failed:", e);
      }
    }

    // Lazily create session if missing
    if (!currentToken && currentEventId) {
      try {
        const res: any = await guestApi.createSession(currentEventId);
        const token = res?.sessionToken ?? res?.data?.sessionToken;
        if (token) {
          currentToken = token;
          setSessionToken(token);
        }
      } catch (e) {
        console.warn("Lazy session creation fallback:", e);
      }
    }

    // Guaranteed fallback token so guest is never blocked
    if (!currentToken) {
      currentToken = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      setSessionToken(currentToken);
    }

    if (!currentEventId) {
      toast.error("Event information not found. Please reload the page.");
      return;
    }

    setStep("processing");
    setProgress(0);
    try {
      const interval = setInterval(
        () => setProgress((p) => Math.min(p + 8, 85)),
        200,
      );
      await faceApi.searchBySelfie(
        file,
        currentEventId,
        currentToken,
        setProgress,
      );
      clearInterval(interval);
      setProgress(100);
      setTimeout(
        () => navigate(`/e/${slug}/gallery?session=${currentToken}`),
        600,
      );
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
      setStep("error");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(`/e/${slug}`)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="font-editorial font-bold">Find My Photos</span>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          {/* Instructions */}
          {step === "instructions" && (
            <div className="text-center space-y-6">
              <div className="h-20 w-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                <Camera className="h-10 w-10 text-accent" />
              </div>
              <div className="space-y-2">
                <h2 className="font-editorial text-2xl font-bold">
                  Take or Upload a Selfie
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Use your camera for a live selfie, or upload an existing
                  photo. Our AI finds every photo you appear in.
                </p>
              </div>
              <div className="text-left space-y-2 bg-muted/50 rounded-xl p-4">
                {[
                  "Face clearly visible, no sunglasses",
                  "Good lighting, avoid harsh shadows",
                  "Looking directly at camera works best",
                  "Single face in the photo preferred",
                ].map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <div className="h-5 w-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center shrink-0 font-bold mt-0.5">
                      {i + 1}
                    </div>
                    <span className="text-muted-foreground">{tip}</span>
                  </div>
                ))}
              </div>
              <Button
                className="w-full h-12 gap-2 text-base"
                onClick={() => setStep("capture")}
              >
                <Camera className="h-5 w-5" /> Continue
              </Button>
            </div>
          )}

          {/* Capture step: camera + upload tabs */}
          {step === "capture" && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="font-editorial text-2xl font-bold">
                  Your Selfie
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Take a live photo or upload one
                </p>
              </div>

              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as "camera" | "upload")}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="camera" className="flex-1 gap-1.5">
                    <Video className="h-4 w-4" /> Live Camera
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="flex-1 gap-1.5">
                    <Upload className="h-4 w-4" /> Upload File
                  </TabsTrigger>
                </TabsList>

                {/* Camera tab */}
                <TabsContent value="camera" className="mt-3 space-y-3">
                  {cameraError ? (
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
                      <VideoOff className="h-10 w-10 text-destructive mx-auto" />
                      <p className="text-sm text-destructive">{cameraError}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startCamera()}
                      >
                        <RotateCcw className="h-4 w-4 mr-1.5" /> Retry Camera
                      </Button>
                    </div>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={cn(
                          "w-full h-full object-cover",
                          facingMode === "user" && "scale-x-[-1]",
                        )}
                      />
                      {/* Oval face guide */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-36 h-48 rounded-full border-2 border-white/50 border-dashed" />
                      </div>
                      {/* Camera controls */}
                      <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-4">
                        <button
                          onClick={flipCamera}
                          className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                          title="Flip camera"
                        >
                          <FlipHorizontal className="h-5 w-5" />
                        </button>
                        <button
                          onClick={captureFrame}
                          disabled={!cameraActive}
                          className="h-16 w-16 rounded-full bg-white border-4 border-white/30 shadow-lg hover:scale-105 transition-transform disabled:opacity-40"
                        />
                      </div>
                    </div>
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                  {!cameraActive && !cameraError && (
                    <p className="text-xs text-center text-muted-foreground animate-pulse">
                      Starting camera…
                    </p>
                  )}
                </TabsContent>

                {/* Upload tab */}
                <TabsContent value="upload" className="mt-3 space-y-3">
                  <div
                    {...getRootProps()}
                    className={cn(
                      "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors",
                      isDragActive
                        ? "border-accent bg-accent/5"
                        : "border-border hover:border-foreground/30 hover:bg-muted/20",
                    )}
                  >
                    <input {...getInputProps()} />
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="font-medium mb-1">
                      {isDragActive ? "Drop here" : "Tap or drag to upload"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      JPEG or PNG · max 20 MB · One photo only
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setStep("instructions")}
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
              </Button>
            </div>
          )}

          {/* Processing */}
          {step === "processing" && (
            <div className="text-center space-y-6">
              {previewUrl && (
                <div className="relative mx-auto w-32 h-32">
                  <img
                    src={previewUrl}
                    alt="Your selfie"
                    className="w-full h-full object-cover rounded-full border-4 border-border"
                  />
                  <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/40 to-transparent" />
                </div>
              )}
              <div className="space-y-2">
                <h3 className="font-editorial text-xl font-bold">
                  Scanning Event Photos…
                </h3>
                <p className="text-sm text-muted-foreground">
                  Our face recognition AI is comparing your selfie with event
                  photos
                </p>
              </div>
              <div className="space-y-2 max-w-xs mx-auto">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {progress}% complete
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {step === "error" && (
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="font-editorial text-xl font-bold">
                Face Search Failed
              </h3>
              <p className="text-sm text-muted-foreground">
                {errorMsg || "Something went wrong. Please try again."}
              </p>
              <Button onClick={() => setStep("capture")} className="gap-2">
                <RotateCcw className="h-4 w-4" /> Try Again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
