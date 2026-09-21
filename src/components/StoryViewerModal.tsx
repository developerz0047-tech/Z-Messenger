import React, { useState, useEffect, useCallback } from "react";
import { User, Story } from "../types";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Trash2,
  AlertTriangle,
  Lock,
} from "lucide-react";

interface StoryViewerModalProps {
  currentUser: User;
  stories?: Story[];
  initialIndex?: number;
  onClose: () => void;
  onStoryDeleted: (storyId: string) => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  currentUser,
  stories = [],
  initialIndex = 0,
  onClose,
  onStoryDeleted,
}) => {
  const safeStories = stories || [];
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.min(Math.max(0, initialIndex), Math.max(0, safeStories.length - 1))
  );
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const storyDurationMs = 5000; // 5 seconds per story
  const currentStory = safeStories[currentIndex];

  // Adjust index if stories count changes or close if empty
  useEffect(() => {
    if (safeStories.length === 0) {
      onClose();
    } else if (currentIndex >= safeStories.length) {
      setCurrentIndex(Math.max(0, safeStories.length - 1));
      setProgress(0);
    }
  }, [safeStories.length, currentIndex, onClose]);

  // Mark story as viewed by current user
  useEffect(() => {
    if (!currentStory?.id) return;

    fetch(`/api/stories/${currentStory.id}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewerId: currentUser.id }),
    }).catch((err) => console.warn("View record failed:", err));
  }, [currentStory?.id, currentUser.id]);

  const handleNext = useCallback(() => {
    if (currentIndex < safeStories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentIndex, safeStories.length, onClose]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  // Progress bar timer loop - purely increments progress, never calls parent callbacks
  useEffect(() => {
    setProgress(0);
    if (!currentStory || isPaused) return;

    const interval = 50; // update every 50ms
    const step = (interval / storyDurationMs) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + step;
      });
    }, interval);

    return () => {
      clearInterval(timer);
    };
  }, [currentIndex, isPaused, currentStory?.id]);

  // When progress reaches 100%, trigger handleNext in an effect outside the updater
  useEffect(() => {
    if (progress >= 100) {
      handleNext();
    }
  }, [progress, handleNext]);

  const handleDeleteStory = async () => {
    if (!currentStory) return;
    try {
      setIsDeleting(true);
      const storyIdToDelete = currentStory.id;
      const res = await fetch(`/api/stories/${storyIdToDelete}?requesterId=${currentUser.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onStoryDeleted(storyIdToDelete);
        const remainingCount = safeStories.length - 1;
        if (remainingCount <= 0) {
          onClose();
        } else if (currentIndex >= remainingCount) {
          setCurrentIndex(Math.max(0, remainingCount - 1));
          setProgress(0);
        } else {
          setProgress(0);
        }
      }
    } catch (e) {
      console.error("Delete story error:", e);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!currentStory) return null;

  const isOwner = currentStory.userId === currentUser.id;
  const isSuperadmin = currentUser.role === "superadmin" || currentUser.email === "hashir0047@gmail.com";
  const canDelete = isOwner || isSuperadmin;

  // Calculate remaining hours until 24h expiration
  const remainingHours = Math.max(
    0,
    Math.round((currentStory.expiresAt - Date.now()) / (1000 * 60 * 60))
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md select-none"
      onMouseDown={() => setIsPaused(true)}
      onMouseUp={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <div className="relative w-full max-w-md h-[88vh] max-h-[780px] bg-neutral-950 rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-white/10">
        {/* Progress Bars for all stories */}
        <div className="absolute top-3 inset-x-3 z-30 flex items-center gap-1.5">
          {safeStories.map((s, idx) => (
            <div key={s.id} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-75"
                style={{
                  width: idx < currentIndex ? "100%" : idx === currentIndex ? `${progress}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Top Header / Author Info */}
        <div className="absolute top-6 inset-x-4 z-30 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <img
              src={currentStory.userAvatar}
              alt={currentStory.userFullName}
              className="w-10 h-10 rounded-full object-cover border-2 border-orange-500 shadow-md"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold leading-tight">{currentStory.userFullName}</p>
                {isOwner && (
                  <span className="px-1.5 py-0.2 rounded-md bg-orange-500 text-white text-[9px] font-extrabold">
                    YOU
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-white/70">
                <span>@{currentStory.userUsername}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  {remainingHours > 0 ? `${remainingHours}h left` : "Expiring soon"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
                className="p-2 rounded-full bg-black/40 hover:bg-red-600/80 text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Delete Story"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Story Media Viewer */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          {currentStory.mediaType === "video" ? (
            <video
              src={currentStory.mediaUrl}
              autoPlay
              playsInline
              loop
              className="w-full h-full object-contain"
            />
          ) : (
            <img
              src={currentStory.mediaUrl}
              alt="Story"
              className="w-full h-full object-contain"
            />
          )}

          {/* Touch navigation zones (Left for prev, Right for next) */}
          <div
            className="absolute inset-y-0 left-0 w-1/3 z-20 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
          />
          <div
            className="absolute inset-y-0 right-0 w-1/3 z-20 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
          />

          {/* Desktop Arrows */}
          {currentIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/40 text-white hover:bg-black/70 transition-colors hidden sm:flex cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {currentIndex < stories.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/40 text-white hover:bg-black/70 transition-colors hidden sm:flex cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Bottom Bar: Caption & Viewers */}
        <div className="p-4 bg-gradient-to-t from-black via-black/80 to-transparent z-30 text-white">
          {currentStory.caption && (
            <p className="text-xs sm:text-sm font-medium mb-2 leading-snug drop-shadow-md">
              {currentStory.caption}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-white/70 pt-1 border-t border-white/10">
            <div className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {isOwner
                  ? `Seen by ${(currentStory.viewers || []).length} contacts`
                  : `Story disappears after 24h`}
              </span>
            </div>

            {currentStory.restrictedUserIds?.length > 0 && isOwner && (
              <span className="flex items-center gap-1 text-[11px] text-red-300">
                <Lock className="w-3 h-3" />
                Restricted for {currentStory.restrictedUserIds.length} person(s)
              </span>
            )}
          </div>
        </div>

        {/* Delete Confirmation Alert */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-xs flex items-center justify-center p-6">
            <div className="w-full max-w-xs bg-neutral-900 border border-neutral-700 rounded-2xl p-5 text-white text-center shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 mx-auto flex items-center justify-center mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold mb-1">Delete Story?</h4>
              <p className="text-xs text-neutral-400 mb-4">
                This story will be removed permanently for all viewers.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold cursor-pointer"
                >
                  Keep
                </button>
                <button
                  onClick={handleDeleteStory}
                  disabled={isDeleting}
                  className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
