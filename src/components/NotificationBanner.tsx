import React, { useEffect } from "react";
import { X, MessageSquare, ArrowRight, Bell, Sparkles } from "lucide-react";
import { Message } from "../types";

export interface ActiveNotification {
  id: string;
  message: Message;
  senderName: string;
  senderAvatar: string;
  groupName?: string;
  preview: string;
  timestamp: number;
}

interface NotificationBannerProps {
  notification: ActiveNotification | null;
  onOpenChat: (contactId: string) => void;
  onDismiss: () => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  notification,
  onOpenChat,
  onDismiss,
}) => {
  useEffect(() => {
    if (!notification) return;
    // Mobile APK haptic feedback when on-screen notification pops up
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate([80, 50, 80]);
      } catch (e) {}
    }

    const timer = setTimeout(() => {
      onDismiss();
    }, 6000);
    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  const targetChatId = notification.message.groupId || notification.message.senderId;

  return (
    <div
      id="on-screen-notification-banner"
      className="fixed top-2 sm:top-4 left-2 right-2 sm:left-auto sm:right-4 z-[99999] sm:w-96 max-w-md mx-auto pointer-events-auto select-none animate-in slide-in-from-top-3 fade-in duration-300"
    >
      <div className="bg-neutral-900/95 text-white backdrop-blur-xl rounded-2xl shadow-2xl border border-orange-500/40 p-3.5 flex items-start gap-3 ring-1 ring-white/10 hover:shadow-orange-500/10 transition-all">
        {/* Avatar */}
        <div className="relative shrink-0">
          <img
            src={
              notification.senderAvatar ||
              "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"
            }
            alt={notification.senderName}
            className="w-10 h-10 rounded-full object-cover border-2 border-orange-500 shadow-md"
          />
          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-white ring-2 ring-neutral-900 shadow-xs">
            <Bell className="w-2.5 h-2.5" />
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <h4 className="text-xs font-bold text-white truncate flex items-center gap-1.5">
              <span>{notification.senderName}</span>
              {notification.message.metadata?.isAiAutoReply && (
                <span className="text-[10px] text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded-sm font-semibold flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5" /> Bot
                </span>
              )}
            </h4>
            <span className="text-[10px] text-neutral-400 font-medium shrink-0">Now</span>
          </div>

          {notification.groupName && (
            <p className="text-[10px] font-semibold text-orange-400 truncate">
              in {notification.groupName}
            </p>
          )}

          <p className="text-xs text-neutral-200 line-clamp-2 mt-0.5 font-normal">
            {notification.preview}
          </p>

          <div className="flex items-center gap-2 mt-2.5">
            <button
              id="notif-banner-reply-btn"
              type="button"
              onClick={() => {
                onOpenChat(targetChatId);
                onDismiss();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              <span>Open Chat</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              id="notif-banner-dismiss-btn"
              type="button"
              onClick={onDismiss}
              className="px-2.5 py-1.5 rounded-xl text-neutral-300 hover:text-white text-xs font-medium hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>

        {/* Close button */}
        <button
          id="notif-banner-close-btn"
          type="button"
          onClick={onDismiss}
          className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
