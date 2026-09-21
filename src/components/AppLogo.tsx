import React from "react";

interface AppLogoProps {
  size?: "sm" | "md" | "lg" | "xl" | "hero";
  showText?: boolean;
  animate?: boolean;
  className?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  size = "md",
  showText = true,
  animate = false,
  className = "",
}) => {
  const sizeMap = {
    sm: { icon: 32, text: "text-lg", badge: "p-1.5" },
    md: { icon: 44, text: "text-2xl", badge: "p-2" },
    lg: { icon: 64, text: "text-3xl", badge: "p-3" },
    xl: { icon: 96, text: "text-4xl", badge: "p-4" },
    hero: { icon: 128, text: "text-5xl", badge: "p-5" },
  };

  const current = sizeMap[size];

  return (
    <div id="z-messenger-logo" className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Dynamic Animated Logo Badge */}
      <div
        className={`relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 shadow-lg shadow-orange-500/25 ${current.badge} ${
          animate ? "animate-pulse" : ""
        }`}
        style={{
          boxShadow: "0 10px 25px -5px rgba(249, 115, 22, 0.4), 0 8px 10px -6px rgba(245, 158, 11, 0.3)",
        }}
      >
        {/* Glow Ring */}
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-tr from-yellow-300 via-orange-400 to-amber-500 opacity-30 blur-sm pointer-events-none" />

        <svg
          width={current.icon}
          height={current.icon}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 transition-transform duration-300 hover:scale-105"
        >
          <defs>
            <linearGradient id="zGradient" x1="15" y1="15" x2="85" y2="85" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#FFFBEB" />
              <stop offset="100%" stopColor="#FEF08A" />
            </linearGradient>
            <linearGradient id="orangeGlow" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#EA580C" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#9A3412" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* Speech Bubble Contour Accent */}
          <path
            d="M50 8C27.9 8 10 24.1 10 44C10 52.8 13.5 60.8 19.3 67L15 88L36.2 78.4C40.6 79.5 45.2 80 50 80C72.1 80 90 63.9 90 44C90 24.1 72.1 8 50 8Z"
            fill="url(#orangeGlow)"
            opacity="0.2"
          />

          {/* Bold Futuristic 'Z' Lightning Shape */}
          <path
            d="M24 26C24 23.7909 25.7909 22 28 22H72C74.6865 22 76.5778 24.5771 75.8361 27.1517L44.5 70H72C74.2091 70 76 71.7909 76 74C76 76.2091 74.2091 78 72 78H28C25.3135 78 23.4222 75.4229 24.1639 72.8483L55.5 30H28C25.7909 30 24 28.2091 24 26Z"
            fill="url(#zGradient)"
            filter="url(#dropShadow)"
          />

          {/* Sparkle / Connection Nodes */}
          <circle cx="28" cy="26" r="3.5" fill="#FFFFFF" />
          <circle cx="72" cy="74" r="3.5" fill="#FEF08A" />
          <circle cx="50" cy="50" r="2.5" fill="#F97316" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1">
            <span className={`font-extrabold tracking-tight text-neutral-900 ${current.text} font-['Outfit',sans-serif]`}>
              Z<span className="text-orange-500">-</span>
            </span>
            <span className={`font-extrabold tracking-tight bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent ${current.text} font-['Outfit',sans-serif]`}>
              messenger
            </span>
          </div>
          <span className="text-[10px] tracking-wider uppercase font-semibold text-amber-700/70 mt-0.5">
            P2P • WebRTC • Gemini AI
          </span>
        </div>
      )}
    </div>
  );
};
