import React, { useState, useEffect, useRef } from "react";
import { Video, Square, Trash2, Send, AlertCircle, RefreshCw, Sparkles } from "lucide-react";

interface VideoMessageRecorderProps {
  onSendVideoMessage: (videoDataUrl: string, durationSeconds: number) => void;
  onCancel: () => void;
}

// Detect best supported video container/codec across iOS Safari, Android, and Desktop
function getBestVideoMimeType(): string {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "";
  }
  const candidateTypes = [
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const t of candidateTypes) {
    try {
      if (MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    } catch (e) {}
  }
  return "";
}

export const VideoMessageRecorder: React.FC<VideoMessageRecorderProps> = ({
  onSendVideoMessage,
  onCancel,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isProcessing, setIsProcessing] = useState(false);

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<any>(null);
  const durationRef = useRef(0);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    initCamera();
    return () => {
      cleanup();
    };
  }, [facingMode]);

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const initCamera = async () => {
    try {
      setError(null);
      cleanup();

      // Mobile friendly camera constraints
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 480 },
            height: { ideal: 480 },
            facingMode: { ideal: facingMode },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
      } catch (streamErr) {
        // Fallback for strict mobile permissions
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      }

      streamRef.current = stream;

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }

      // Configure MediaRecorder safely with cross-device mimeType
      const mimeType = getBestVideoMimeType();
      const recorderOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};

      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      // Collect data every 100ms for continuous streaming buffers
      recorder.start(100);
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev >= 60) {
            handleStopAndSend();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setError("Camera or microphone permission is needed to record video messages.");
    }
  };

  const handleStopAndSend = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive" || isProcessing) return;

    setIsProcessing(true);
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const recordedDuration = Math.max(1, durationRef.current);

    recorder.onstop = () => {
      try {
        const mime = recorder.mimeType || getBestVideoMimeType() || "video/mp4";
        const blob = new Blob(recordedChunksRef.current, { type: mime });

        if (blob.size === 0) {
          setError("Recorded clip was empty. Please try recording again.");
          setIsProcessing(false);
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            onSendVideoMessage(reader.result, recordedDuration);
          }
          cleanup();
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        console.error("Failed to build video blob:", e);
        setError("Failed to process recorded video clip.");
        setIsProcessing(false);
      }
    };

    try {
      if (recorder.state === "recording") {
        recorder.requestData();
      }
      recorder.stop();
    } catch (err) {
      recorder.stop();
    }
  };

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div
        id="video-message-recorder-modal"
        className="w-full max-w-sm rounded-3xl bg-neutral-900 border border-orange-500/40 p-5 sm:p-6 flex flex-col items-center shadow-2xl text-white relative animate-in fade-in zoom-in-95"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between w-full mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
              Video Message
            </span>
          </div>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-black/50 border border-neutral-700">
            {formatDuration(duration)} / 1:00
          </span>
        </div>

        {error ? (
          <div className="my-8 p-4 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs text-center w-full">
            <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
            <p className="font-semibold">{error}</p>
            <div className="mt-4 flex gap-2 justify-center">
              <button
                type="button"
                onClick={initCamera}
                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Circular Camera Viewport (Telegram Style) */}
            <div className="relative my-2 w-48 h-48 sm:w-56 sm:h-56 rounded-full overflow-hidden border-4 border-orange-500 shadow-2xl shadow-orange-500/20 bg-black flex items-center justify-center">
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
              />

              {/* Recording progress indicator ring */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r="48%"
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="4"
                  strokeDasharray="300"
                  strokeDashoffset={300 - (duration / 60) * 300}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>

              {/* Switch Camera Button (Front / Back for Mobile) */}
              <button
                type="button"
                onClick={toggleCameraFacing}
                title="Switch Camera"
                className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition-all cursor-pointer border border-white/20"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* Center Recording Status Icon */}
              {isRecording && (
                <div className="absolute bottom-3 px-2 py-0.5 rounded-full bg-red-600/90 text-[10px] font-bold tracking-wider uppercase backdrop-blur-xs flex items-center gap-1 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  REC
                </div>
              )}
            </div>

            <p className="text-[11px] text-neutral-400 mt-2 text-center">
              Tap Send to deliver this video note to your chat.
            </p>

            {/* Bottom Controls Bar */}
            <div className="flex items-center justify-center gap-5 mt-5 w-full">
              {/* Cancel / Discard */}
              <button
                id="discard-video-message-btn"
                type="button"
                onClick={onCancel}
                disabled={isProcessing}
                title="Discard clip"
                className="p-3 rounded-2xl bg-neutral-800 hover:bg-red-500/20 hover:text-red-400 text-neutral-400 transition-all cursor-pointer"
              >
                <Trash2 className="w-5 h-5" />
              </button>

              {/* Stop & Send Button */}
              <button
                id="send-video-message-btn"
                type="button"
                onClick={handleStopAndSend}
                disabled={isProcessing}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-95 text-white font-bold text-sm transition-all shadow-lg shadow-orange-500/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Clip</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
