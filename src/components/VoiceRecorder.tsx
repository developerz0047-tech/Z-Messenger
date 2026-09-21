import React, { useState, useEffect, useRef } from "react";
import { Mic, Square, Trash2, Send, AlertCircle } from "lucide-react";

interface VoiceRecorderProps {
  onSendVoiceMessage: (audioDataUrl: string, durationSeconds: number) => void;
  onCancel: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onSendVoiceMessage,
  onCancel,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    startRecording();
    return () => {
      stopTracks();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setError("Microphone access denied or unavailable.");
    }
  };

  const handleStopAndSend = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
      return;
    }

    const recordedDuration = Math.max(1, duration);
    if (timerRef.current) clearInterval(timerRef.current);

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm;codecs=opus" });
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          onSendVoiceMessage(reader.result, recordedDuration);
        }
      };
      reader.readAsDataURL(audioBlob);
      stopTracks();
    };

    mediaRecorderRef.current.stop();
  };

  const handleDiscard = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    stopTracks();
    onCancel();
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  if (error) {
    return (
      <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span>{error}</span>
        </div>
        <button
          onClick={handleDiscard}
          className="px-2.5 py-1 rounded-md bg-white border border-red-200 text-neutral-700 font-semibold cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div
      id="voice-recorder-bar"
      className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-yellow-500/10 border border-orange-200 animate-in fade-in slide-in-from-bottom-2"
    >
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-ping absolute" />
          <span className="w-3 h-3 rounded-full bg-red-600 relative" />
        </div>

        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-orange-600" />
          <span className="text-xs font-bold text-neutral-800 font-mono">
            {formatDuration(duration)}
          </span>
        </div>

        {/* Animated sound wave bars */}
        <div className="flex items-center gap-1 h-5 px-2">
          {[40, 75, 100, 60, 85, 45, 90, 65, 30].map((h, i) => (
            <div
              key={i}
              className="w-1 bg-orange-500 rounded-full animate-pulse"
              style={{
                height: `${h}%`,
                animationDelay: `${i * 0.12}s`,
                animationDuration: "0.8s",
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDiscard}
          title="Cancel recording"
          className="p-2 rounded-xl text-neutral-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleStopAndSend}
          title="Send voice message"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
        >
          <span>Send Voice</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
