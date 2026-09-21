import React, { useState, useRef } from "react";
import { User, Contact, Story } from "../types";
import {
  Sparkles,
  X,
  Upload,
  Camera,
  EyeOff,
  Clock,
  Check,
  AlertCircle,
  Video,
  Image as ImageIcon,
} from "lucide-react";

interface CreateStoryModalProps {
  currentUser: User;
  contacts: Contact[];
  onClose: () => void;
  onStoryCreated: (story: Story) => void;
}

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  currentUser,
  contacts,
  onClose,
  onStoryCreated,
}) => {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [caption, setCaption] = useState("");
  const [restrictMode, setRestrictMode] = useState<boolean>(false);
  const [restrictedUserIds, setRestrictedUserIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isOptimizingMedia, setIsOptimizingMedia] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Combine contacts and any registered users for restriction
  const [allUsers, setAllUsers] = useState<any[]>([]);
  React.useEffect(() => {
    fetch(`/api/users/all?excludeUserId=${currentUser.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.users) setAllUsers(d.users);
      })
      .catch(() => {});
  }, [currentUser.id]);

  const candidateMap = new Map<string, { id: string; fullName: string; username: string; avatar: string }>();
  for (const c of (contacts || [])) {
    if (!c.isGroup && c.id !== currentUser.id) {
      candidateMap.set(c.id, { id: c.id, fullName: c.fullName, username: c.username, avatar: c.avatar });
    }
  }
  for (const u of (allUsers || [])) {
    if (u.id !== currentUser.id && !candidateMap.has(u.id)) {
      candidateMap.set(u.id, { id: u.id, fullName: u.fullName, username: u.username, avatar: u.avatar });
    }
  }
  const availableCandidates = Array.from(candidateMap.values());

  // Compress image to keep Firestore document size safely under 500KB
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          const maxDim = 1080;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.78));
        };
        img.onerror = () => reject(new Error("Unable to load image for optimization"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const isVid = file.type.startsWith("video/");

    if (isVid) {
      if (file.size > 800 * 1024) {
        setError("Video size limit for 24h stories is 800KB. Please select a shorter video clip or an image.");
        e.target.value = "";
        return;
      }
      setMediaType("video");
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setMediaUrl(reader.result);
        }
      };
      reader.onerror = () => {
        setError("Failed to read the selected video file.");
      };
      reader.readAsDataURL(file);
    } else {
      setMediaType("image");
      try {
        setIsOptimizingMedia(true);
        const compressedDataUrl = await compressImage(file);
        setMediaUrl(compressedDataUrl);
      } catch (err: any) {
        setError("Failed to optimize image: " + (err.message || "Unknown error"));
      } finally {
        setIsOptimizingMedia(false);
      }
    }
  };

  const samplePresets = [
    {
      label: "Sunset Calm",
      url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
      type: "image" as const,
    },
    {
      label: "Urban Lights",
      url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&auto=format&fit=crop&q=80",
      type: "image" as const,
    },
    {
      label: "Focus Workspace",
      url: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=800&auto=format&fit=crop&q=80",
      type: "image" as const,
    },
  ];

  const toggleRestrictUser = (userId: string) => {
    setRestrictedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaUrl) {
      setError("Please select a photo or video to share in your story.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          mediaUrl,
          mediaType,
          caption: caption.trim(),
          restrictedUserIds: restrictMode ? restrictedUserIds : [],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to publish story.");
      }

      onStoryCreated(data.story);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to publish story.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div
        id="create-story-modal"
        className="w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-orange-200 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">Add to Story</h2>
              <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Automatically deletes after 24 hours (1 day)</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 pr-1 space-y-4 pt-3">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Media Preview or Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1.5">
              Story Media (Photo or Video) *
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {isOptimizingMedia ? (
              <div className="p-8 rounded-2xl border-2 border-dashed border-orange-400 bg-orange-50/50 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs font-bold text-orange-950">Optimizing photo for story...</p>
                <p className="text-[11px] text-orange-700/80 mt-1">Compressing image resolution for instant viewing</p>
              </div>
            ) : mediaUrl ? (
              <div className="relative rounded-2xl overflow-hidden bg-neutral-900 aspect-4/3 flex items-center justify-center border border-neutral-200 shadow-inner group">
                {mediaType === "video" ? (
                  <video src={mediaUrl} controls autoPlay muted loop className="w-full h-full object-cover" />
                ) : (
                  <img src={mediaUrl} alt="Story preview" className="w-full h-full object-cover" />
                )}

                <div className="absolute top-2 right-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-white text-xs font-semibold backdrop-blur-xs transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaUrl(null)}
                    className="p-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 rounded-2xl border-2 border-dashed border-neutral-300 hover:border-orange-500 bg-neutral-50/60 hover:bg-orange-50/40 transition-all flex flex-col items-center justify-center text-center cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-2 shadow-xs">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-neutral-800">Click to upload photo or video</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Supports JPG, PNG, WEBM, MP4</p>
                </div>

                {/* Preset suggestions */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-neutral-400">Or use sample:</span>
                  {samplePresets.map((preset, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setMediaUrl(preset.url);
                        setMediaType(preset.type);
                      }}
                      className="px-2 py-1 rounded-lg bg-neutral-100 hover:bg-orange-100 text-neutral-700 hover:text-orange-700 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Caption */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1.5">
              Story Caption (Optional)
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a thought or caption to your story..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-neutral-900 text-xs outline-hidden"
              maxLength={120}
            />
            <div className="text-right text-[10px] text-neutral-400 mt-1">
              {caption.length}/120 characters
            </div>
          </div>

          {/* RESTRICT A PERSON FROM SEEING STORY (Direct User Requirement) */}
          <div className="pt-2 border-t border-neutral-100">
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-red-100 text-red-600">
                  <EyeOff className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-900">Restrict People From Seeing Story</p>
                  <p className="text-[11px] text-neutral-500">
                    Choose specific contacts who cannot view this story
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={restrictMode}
                  onChange={(e) => setRestrictMode(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
              </label>
            </div>

            {/* List of Contacts to Restrict */}
            {restrictMode && (
              <div className="p-3 rounded-xl border border-red-200 bg-red-50/40 space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-red-900">
                    Select Contacts to Restrict ({restrictedUserIds.length} restricted)
                  </span>
                  {restrictedUserIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setRestrictedUserIds([])}
                      className="text-[11px] text-red-600 underline cursor-pointer"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {availableCandidates.length === 0 ? (
                  <p className="text-[11px] text-neutral-500 py-1">No other users found to restrict.</p>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {availableCandidates.map((c) => {
                      const isRestricted = restrictedUserIds.includes(c.id);

                      return (
                        <div
                          key={c.id}
                          onClick={() => toggleRestrictUser(c.id)}
                          className={`p-2 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                            isRestricted
                              ? "bg-red-100/70 border-red-300"
                              : "bg-white border-neutral-200 hover:bg-neutral-50"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={c.avatar}
                              alt={c.fullName}
                              className="w-7 h-7 rounded-full object-cover border border-neutral-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-neutral-900 truncate">{c.fullName}</p>
                              <p className="text-[10px] text-neutral-500 truncate">@{c.username}</p>
                            </div>
                          </div>

                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                              isRestricted
                                ? "bg-red-600 text-white"
                                : "bg-neutral-100 text-neutral-600"
                            }`}
                          >
                            {isRestricted ? "Restricted" : "Visible"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !mediaUrl}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold shadow-md shadow-orange-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isSubmitting ? "Sharing Story..." : "Share to Story (24h)"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
