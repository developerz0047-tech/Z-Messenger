import React, { useState, useRef, useEffect } from "react";
import { User } from "../types";
import { AppLogo } from "./AppLogo";
import { Camera, Upload, Check, AlertCircle, Eye, EyeOff, ArrowRight, User as UserIcon, Mail, Lock, Loader2 } from "lucide-react";

interface AuthModalProps {
  onSuccess: (user: User) => void;
}

const DEFAULT_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
];

// Helper to safely parse API responses and prevent "Unexpected token '<'" HTML error crashes
async function parseResponseJson(resp: Response) {
  const text = await resp.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_e) {
    if (!resp.ok) {
      if (resp.status === 404) {
        throw new Error("Authentication service endpoint not found (404). Please ensure server routes are configured.");
      }
      if (resp.status === 502 || resp.status === 503 || resp.status === 504) {
        throw new Error("Server is initializing. Please wait a few seconds and try again.");
      }
      throw new Error(`Server returned an error (${resp.status}). Please try again.`);
    }
    throw new Error("Unexpected server response. Please try again.");
  }
  return data;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<"login" | "signup-step1" | "signup-step2">("login");

  // Step 1 State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 2 State (Profile Onboarding)
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatar, setAvatar] = useState(DEFAULT_AVATARS[0]);

  // Username validation state (enforce uniqueness)
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Loading & Error States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WebCam capture state
  const [isCapturingCamera, setIsCapturingCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Check username availability on change (enforcing: user cannot set username that already exists)
  useEffect(() => {
    const clean = username.trim().toLowerCase().replace(/^@/, "");
    if (!clean || clean.length < 3) {
      setUsernameStatus("idle");
      setUsernameError(clean.length > 0 ? "Username must be at least 3 characters" : null);
      return;
    }

    setUsernameStatus("checking");
    setUsernameError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-availability?username=${encodeURIComponent(clean)}`);
        const data = await parseResponseJson(res);
        if (data?.usernameTaken) {
          setUsernameStatus("taken");
          setUsernameError("This username already exists! Please choose another unique username.");
        } else {
          setUsernameStatus("available");
          setUsernameError(null);
        }
      } catch (err) {
        setUsernameStatus("idle");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [username]);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Please enter both your email/username and your password.");
      return;
    }

    setIsLoading(true);
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: email.trim(),
          password,
        }),
      });

      const data = await parseResponseJson(resp);
      if (!resp.ok) {
        throw new Error(data?.error || "Login failed. Please verify your credentials.");
      }

      onSuccess(data.user);
    } catch (err: any) {
      setError(err.message || "Unable to log in. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1 validation
  const handleStep1Next = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Please enter a valid email/gmail address.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setIsLoading(true);
    try {
      // Check if email already taken
      const checkResp = await fetch(`/api/auth/check-availability?email=${encodeURIComponent(cleanEmail)}`);
      const checkData = await parseResponseJson(checkResp);
      if (checkData?.emailTaken) {
        throw new Error("An account with this email/gmail already exists. Please log in.");
      }

      // Proceed to Step 2 (Profile Setup)
      setMode("signup-step2");
    } catch (err: any) {
      setError(err.message || "Failed to proceed. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2 Completion
  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim().toLowerCase().replace(/^@/, "");
    if (!cleanUsername || cleanUsername.length < 3) {
      setError("Please enter a unique username with at least 3 characters.");
      return;
    }
    if (!fullName.trim()) {
      setError("Please enter your name.");
      return;
    }

    // Prevent submission if username is already taken
    if (usernameStatus === "taken") {
      setError("This username is already taken! You cannot set a username that already exists.");
      return;
    }

    setIsLoading(true);
    try {
      const resp = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          username: cleanUsername,
          fullName: fullName.trim(),
          avatar,
        }),
      });

      const data = await parseResponseJson(resp);
      if (!resp.ok) {
        if (resp.status === 409 && data?.error?.toLowerCase().includes("username")) {
          setUsernameStatus("taken");
          setUsernameError("This username is already taken. Please choose another unique username.");
        }
        throw new Error(data?.error || "Registration failed");
      }

      stopCamera();
      onSuccess(data.user);
    } catch (err: any) {
      setError(err.message || "Could not register account. Try another username.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle image upload from file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatar(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Start webcam for selfie avatar
  const startCamera = async () => {
    try {
      setError(null);
      setIsCapturingCamera(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 320, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setIsCapturingCamera(false);
      setError("Camera permission denied or camera unavailable.");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, 300, 300);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setAvatar(dataUrl);
    }
    stopCamera();
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCapturingCamera(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
      <div
        id="auth-card"
        className="w-full max-w-md my-8 rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-orange-200/80 relative"
      >
        {/* Accent glowing aura */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1.5 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 rounded-b-full" />

        {/* Logo and Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <AppLogo size="md" />
          <p className="mt-2 text-sm text-neutral-600 font-medium">
            {mode === "login" && "Log in to your Z-messenger account"}
            {mode === "signup-step1" && "Create your account • Step 1 of 2"}
            {mode === "signup-step2" && "Profile Setup • Step 2 of 2"}
          </p>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div
            id="auth-error-banner"
            className="mb-5 flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium"
          >
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* -------------------- LOGIN FORM -------------------- */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Email / Gmail or Username
              </label>
              <div className="relative">
                <input
                  id="login-identifier-input"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@gmail.com or username"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-300 focus:border-orange-500 focus:ring-3 focus:ring-orange-500/20 text-neutral-900 placeholder:text-neutral-400 text-sm outline-hidden transition-all"
                  required
                />
                <UserIcon className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-neutral-300 focus:border-orange-500 focus:ring-3 focus:ring-orange-500/20 text-neutral-900 placeholder:text-neutral-400 text-sm outline-hidden transition-all"
                  required
                />
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white font-bold text-sm shadow-md shadow-orange-500/25 hover:shadow-orange-500/40 hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Log In to Z-messenger</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-4 text-center border-t border-neutral-100">
              <p className="text-xs text-neutral-600">
                Don't have an account yet?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode("signup-step1");
                  }}
                  className="font-bold text-orange-600 hover:text-orange-700 underline cursor-pointer"
                >
                  Create Account
                </button>
              </p>
            </div>
          </form>
        )}

        {/* -------------------- SIGNUP STEP 1: CREDENTIALS -------------------- */}
        {mode === "signup-step1" && (
          <form onSubmit={handleStep1Next} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Gmail / Email Address
              </label>
              <div className="relative">
                <input
                  id="signup-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@gmail.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-300 focus:border-orange-500 focus:ring-3 focus:ring-orange-500/20 text-neutral-900 placeholder:text-neutral-400 text-sm outline-hidden transition-all"
                  required
                />
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">Must be unique; cannot be registered twice.</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-neutral-300 focus:border-orange-500 focus:ring-3 focus:ring-orange-500/20 text-neutral-900 placeholder:text-neutral-400 text-sm outline-hidden transition-all"
                  required
                />
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="signup-confirm-password-input"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-300 focus:border-orange-500 focus:ring-3 focus:ring-orange-500/20 text-neutral-900 placeholder:text-neutral-400 text-sm outline-hidden transition-all"
                  required
                />
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <button
              id="signup-step1-next-btn"
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white font-bold text-sm shadow-md shadow-orange-500/25 hover:shadow-orange-500/40 hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Next: Choose Profile Pic & Username</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-4 text-center border-t border-neutral-100">
              <p className="text-xs text-neutral-600">
                Already registered?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode("login");
                  }}
                  className="font-bold text-orange-600 hover:text-orange-700 underline cursor-pointer"
                >
                  Log In
                </button>
              </p>
            </div>
          </form>
        )}

        {/* -------------------- SIGNUP STEP 2: PROFILE PIC, UNIQUE USERNAME, FULL NAME -------------------- */}
        {mode === "signup-step2" && (
          <form onSubmit={handleCompleteRegistration} className="space-y-4">
            {/* Profile Pic Picker */}
            <div className="flex flex-col items-center">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                Your Profile Picture
              </label>

              {isCapturingCamera ? (
                <div className="relative flex flex-col items-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-32 h-32 rounded-full object-cover border-4 border-orange-500 shadow-md bg-neutral-900"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="px-3 py-1 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 cursor-pointer"
                    >
                      Snap Photo
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-3 py-1 bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold hover:bg-neutral-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative group">
                  <img
                    src={avatar}
                    alt="Selected Profile"
                    className="w-24 h-24 rounded-full object-cover border-4 border-amber-400 shadow-md"
                  />
                  <div className="absolute -bottom-1 -right-1 flex gap-1">
                    <button
                      type="button"
                      onClick={startCamera}
                      title="Take selfie"
                      className="p-1.5 rounded-full bg-orange-500 text-white hover:bg-orange-600 shadow-xs cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Upload file"
                      className="p-1.5 rounded-full bg-amber-500 text-white hover:bg-amber-600 shadow-xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              )}

              {/* Preset Avatar Selection */}
              <div className="mt-3 flex items-center justify-center gap-2">
                {DEFAULT_AVATARS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatar(url)}
                    className={`w-7 h-7 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${
                      avatar === url ? "border-orange-500 scale-110 shadow-xs" : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={url} alt="Preset" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Unique Username */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Unique Username
                </label>
                {usernameStatus === "checking" && (
                  <span className="text-[11px] text-amber-600 flex items-center gap-1 font-medium">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking availability...
                  </span>
                )}
                {usernameStatus === "available" && (
                  <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-bold">
                    <Check className="w-3 h-3" /> Available
                  </span>
                )}
                {usernameStatus === "taken" && (
                  <span className="text-[11px] text-red-600 flex items-center gap-1 font-bold">
                    <AlertCircle className="w-3 h-3" /> Already Taken
                  </span>
                )}
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-3 text-orange-600 font-bold text-sm">@</span>
                <input
                  id="signup-username-input"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
                  placeholder="e.g. alex_z"
                  className={`w-full pl-8 pr-10 py-3 rounded-xl border text-sm outline-hidden transition-all font-medium ${
                    usernameStatus === "taken"
                      ? "border-red-500 bg-red-50/20 text-red-900 focus:border-red-600 focus:ring-3 focus:ring-red-500/20"
                      : usernameStatus === "available"
                      ? "border-emerald-500 bg-emerald-50/20 text-neutral-900 focus:border-emerald-600 focus:ring-3 focus:ring-emerald-500/20"
                      : "border-neutral-300 focus:border-orange-500 focus:ring-3 focus:ring-orange-500/20 text-neutral-900"
                  }`}
                  required
                />
                <div className="absolute right-3.5 top-3.5">
                  {usernameStatus === "checking" && <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" />}
                  {usernameStatus === "available" && <Check className="w-4 h-4 text-emerald-500" />}
                  {usernameStatus === "taken" && <AlertCircle className="w-4 h-4 text-red-500" />}
                </div>
              </div>

              {usernameStatus === "taken" ? (
                <p className="text-[12px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  This username is already taken. You cannot set a username that already exists.
                </p>
              ) : usernameStatus === "available" ? (
                <p className="text-[11px] text-emerald-600 font-medium mt-1">
                  ✓ Unique and verified. Contacts will use @{username.replace(/^@/, "")} to find you.
                </p>
              ) : (
                <p className="text-[11px] text-neutral-500 mt-1">
                  Unique across all users. Must not be taken by another user.
                </p>
              )}
            </div>

            {/* User's Own Full Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Your Full Name
              </label>
              <div className="relative">
                <input
                  id="signup-fullname-input"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-300 focus:border-orange-500 focus:ring-3 focus:ring-orange-500/20 text-neutral-900 placeholder:text-neutral-400 text-sm outline-hidden transition-all"
                  required
                />
                <UserIcon className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMode("signup-step1")}
                className="py-3 px-4 rounded-xl border border-neutral-300 text-neutral-700 font-semibold text-sm hover:bg-neutral-50 cursor-pointer"
              >
                Back
              </button>

              <button
                id="signup-finish-btn"
                type="submit"
                disabled={isLoading || usernameStatus === "taken" || usernameStatus === "checking"}
                className={`flex-1 py-3 px-4 rounded-xl text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  usernameStatus === "taken"
                    ? "bg-neutral-400 opacity-60 cursor-not-allowed"
                    : "bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 shadow-orange-500/25 hover:shadow-orange-500/40 hover:opacity-95 active:scale-98 disabled:opacity-50"
                }`}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Complete & Enter Z-messenger</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
