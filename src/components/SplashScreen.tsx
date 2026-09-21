import React, { useEffect, useState } from "react";
import { AppLogo } from "./AppLogo";
import { ArrowRight, Video, Mic, ShieldCheck, Sparkles, MonitorUp, MessageSquare } from "lucide-react";

interface SplashScreenProps {
  onContinue: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onContinue }) => {
  const [progress, setProgress] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(3);

  useEffect(() => {
    const startTime = Date.now();
    const duration = 3000; // Exactly 3 seconds as requested

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);

      const remaining = Math.max(1, Math.ceil((duration - elapsed) / 1000));
      setSecondsLeft(remaining);

      if (elapsed >= duration) {
        clearInterval(interval);
        onContinue();
      }
    }, 30);

    // Failsafe auto-dismiss after exactly 3000ms
    const timeout = setTimeout(() => {
      onContinue();
    }, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [onContinue]);

  return (
    <div
      id="z-messenger-splash-screen"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-br from-amber-50 via-orange-50/60 to-yellow-50 p-6 md:p-12 overflow-hidden select-none"
    >
      {/* Ambient background glowing circles */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-orange-400/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-yellow-400/25 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-gradient-to-tr from-amber-300/15 via-orange-400/10 to-transparent blur-2xl pointer-events-none" />

      {/* Top bar with subtle branding */}
      <div className="w-full max-w-4xl flex items-center justify-between z-10">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-orange-200/60 shadow-sm backdrop-blur-sm text-xs font-semibold text-orange-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          P2P WebRTC Signaling Active
        </div>

        <button
          id="splash-skip-btn"
          onClick={onContinue}
          className="text-xs font-bold text-amber-900/70 hover:text-orange-600 transition-colors cursor-pointer px-3 py-1 rounded-md hover:bg-orange-100/50"
        >
          Skip Intro →
        </button>
      </div>

      {/* Center hero with attractive logo and typography */}
      <div className="flex flex-col items-center text-center max-w-xl z-10 my-auto">
        <div className="relative mb-8">
          {/* Pulsing ring behind logo */}
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-orange-500/20 via-yellow-400/30 to-orange-500/20 blur-xl animate-pulse" />
          <AppLogo size="hero" showText={false} animate={true} />
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-neutral-900 tracking-tight font-['Outfit',sans-serif]">
          Welcome to{" "}
          <span className="bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
            Z-messenger
          </span>
        </h1>

        <p className="mt-4 text-base sm:text-lg text-neutral-700 leading-relaxed max-w-md font-medium">
          Ultra-fast, direct peer-to-peer messaging and WebRTC calling powered by built-in Gemini AI.
        </p>

        {/* Feature Pills */}
        <div className="mt-8 flex flex-wrap justify-center gap-2 max-w-lg">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-amber-200 text-xs font-medium text-neutral-800 shadow-xs">
            <MessageSquare className="w-3.5 h-3.5 text-orange-500" />
            <span>Voice & Video Messages</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-amber-200 text-xs font-medium text-neutral-800 shadow-xs">
            <Video className="w-3.5 h-3.5 text-amber-500" />
            <span>WebRTC P2P Video Calls</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-amber-200 text-xs font-medium text-neutral-800 shadow-xs">
            <MonitorUp className="w-3.5 h-3.5 text-orange-600" />
            <span>Screen Sharing</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-amber-200 text-xs font-medium text-neutral-800 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
            <span>In-Built Gemini AI</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-10 flex flex-col items-center gap-4 w-full sm:w-auto">
          <button
            id="splash-get-started-btn"
            onClick={onContinue}
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white font-bold text-base shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-102 active:scale-98 transition-all cursor-pointer w-full sm:w-auto"
          >
            <span>Start Messaging Now</span>
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </button>

          {/* Progress bar and countdown */}
          <div className="flex flex-col items-center gap-1.5 mt-2">
            <div className="w-52 h-1.5 bg-amber-200/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-yellow-400 transition-all duration-75 ease-linear rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold text-amber-900/60 font-mono">
              Opening in {secondsLeft}s...
            </span>
          </div>
        </div>
      </div>

      {/* Footer reassurance */}
      <div className="w-full max-w-md flex items-center justify-center gap-2 text-xs font-medium text-amber-900/60 z-10">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span>Strict Contact Isolation • Direct P2P Media Streams</span>
      </div>
    </div>
  );
};
