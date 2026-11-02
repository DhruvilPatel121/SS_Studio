/**
 * PublicTokenFindPage — /join/:token/find
 * Selfie step: guests can TAKE a live selfie via camera OR upload a photo.
 * After match, navigates to /join/:token/gallery?session=xxx
 */
import React, { useCallback, useRef, useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
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

export default function PublicTokenFindPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<Step>("instructions");
  const [progress, setProgress] = useState(0);
  const [eventId, setEventId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(
    searchParams.get("session"),
  );
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

  useEffect(() => {
    if (!token) return;
    guestApi
      .getEventByPublicToken(token)
      .then((ev) => {
        setEventId(ev.id);
        if (!sessionToken) {
          guestApi
            .createSession(ev.id)
            .then((r) => setSessionToken(r.sessionToken))
            .catch(console.error);
        }
      })
      .catch(console.error);
  }, [token]); // eslint-disable-line

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

  // Start camera when switching to camera tab from instructions
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
    // Mirror if front camera
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
    if (!currentEventId && token) {
      try {
        const ev: any = await guestApi.getEventByPublicToken(token);
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
        const tok = res?.sessionToken ?? res?.data?.sessionToken;
        if (tok) {
          currentToken = tok;
          setSessionToken(tok);
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
        () => setProgress((p) => Math.min(p + 7, 82)),
        220,
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
        () => navigate(`/join/${token}/gallery?session=${currentToken}`),
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
      <div className="border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(`/join/${token}`)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="font-editorial font-bold">Find My Photos</span>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          {/* ── Instructions ── */}
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

          {/* ── Capture step: camera + upload tabs ── */}
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

          {/* ── Processing ── */}
          {step === "processing" && (
            <div className="text-center space-y-6">
              {previewUrl && (
                <div className="relative mx-auto w-32 h-32">
                  <img
                    src={previewUrl}
                    alt="Selfie"
                    className="w-full h-full object-cover rounded-full border-4 border-border"
                  />
                  <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/40 to-transparent" />
                </div>
              )}
              <div className="space-y-2">
                <h2 className="font-editorial text-xl font-bold">
                  {progress < 40
                    ? "Analyzing your selfie…"
                    : progress < 80
                      ? "Matching faces…"
                      : "Almost there…"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Searching the event photos for your face
                </p>
              </div>
              <div className="space-y-1.5">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">{progress}%</p>
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {step === "error" && (
            <div className="text-center space-y-6">
              <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertTriangle className="h-10 w-10 text-destructive" />
              </div>
              <div className="space-y-2">
                <h2 className="font-editorial text-xl font-bold">
                  {errorMsg.toLowerCase().includes("face")
                    ? "No face detected"
                    : "Something went wrong"}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {errorMsg.toLowerCase().includes("face")
                    ? "We couldn't detect a clear face. Please try again with better lighting."
                    : errorMsg || "Please try again with a different photo."}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => {
                    setStep("capture");
                    setPreviewUrl(null);
                    setErrorMsg("");
                  }}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" /> Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/join/${token}`)}
                >
                  Back to Event
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
