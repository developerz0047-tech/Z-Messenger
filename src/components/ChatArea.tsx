import React, { useState, useRef, useEffect } from "react";
import { User, Contact, Message, MessageType } from "../types";
import { VoiceRecorder } from "./VoiceRecorder";
import { VideoMessageRecorder } from "./VideoMessageRecorder";
import { LocationPickerModal } from "./LocationPickerModal";
import { GroupDetailsModal } from "./GroupDetailsModal";
import { UserProfileModal } from "./UserProfileModal";
import {
  Paperclip,
  Mic,
  Video as VideoIcon,
  MapPin,
  Send,
  FileText,
  Download,
  Play,
  Pause,
  CheckCheck,
  Check,
  Smile,
  ExternalLink,
  MoreVertical,
  Volume2,
  VolumeX,
  Maximize2,
  ArrowLeft,
  LogOut,
  Users,
  Copy,
  Share2,
  Trash2,
  Image as ImageIcon,
  Flame,
  Heart,
  X,
  Search,
  Camera,
  Info,
  MessageSquare,
  Ban,
  Flag,
  ShieldAlert,
  Sparkles,
  AlertTriangle,
  Server,
} from "lucide-react";

interface ChatAreaProps {
  currentUser: User;
  activeContact: Contact | null;
  contacts?: Contact[];
  messages: Message[];
  onSendMessage: (
    type: MessageType,
    content: string,
    metadata?: any
  ) => void;
  onLogout?: () => void;
  onBack?: () => void;
  onRefreshMessages?: () => void;
  onToggleContactsSidebar?: () => void;
  onGroupUpdated?: (updatedGroup: any) => void;
  onClearChat?: () => Promise<void> | void;
  onToggleBlockContact?: (contact: Contact) => Promise<void> | void;
  onReportContact?: (contact: Contact) => void;
  onDeleteContact?: (contact: Contact) => Promise<void> | void;
  onDeleteGroup?: (groupId: string) => Promise<void> | void;
  isSplitView?: boolean;
}

// Telegram-Style Interactive Circular Video Note Component
const VideoNoteBubble: React.FC<{
  src: string;
  duration?: number;
  isMe: boolean;
}> = ({ src, duration = 1, isMe }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  return (
    <div className="flex flex-col items-center select-none py-1">
      <div
        onClick={togglePlay}
        className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-full overflow-hidden border-3 border-white shadow-xl bg-black cursor-pointer group shrink-0"
      >
        <video
          ref={videoRef}
          src={src}
          playsInline
          preload="metadata"
          onTimeUpdate={() => {
            if (videoRef.current && videoRef.current.duration) {
              setProgress(
                (videoRef.current.currentTime / videoRef.current.duration) * 100
              );
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            setProgress(0);
          }}
          className="w-full h-full object-cover"
        />

        {/* Circular SVG Progress Ring */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none -rotate-90">
          <circle
            cx="50%"
            cy="50%"
            r="48%"
            fill="none"
            stroke="#f97316"
            strokeWidth="4"
            strokeDasharray="300"
            strokeDashoffset={300 - (progress / 100) * 300}
            className="transition-all duration-150"
          />
        </svg>

        {/* Play/Pause Center Overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs group-hover:bg-black/50 transition-all">
            <div className="w-12 h-12 rounded-full bg-orange-500/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Play className="w-6 h-6 fill-white ml-0.5" />
            </div>
          </div>
        )}

        {/* Controls on hover / active */}
        <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={toggleMute}
            className="p-1.5 rounded-full bg-black/70 text-white hover:bg-black/90 cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsFullscreen(true);
            }}
            className="p-1.5 rounded-full bg-black/70 text-white hover:bg-black/90 cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <span className="text-[10px] mt-1.5 opacity-80 font-medium">
        Video Clip ({duration}s)
      </span>

      {/* Expanded Modal View if user clicks expand */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            setIsFullscreen(false);
          }}
        >
          <div className="relative max-w-lg w-full rounded-2xl overflow-hidden bg-black shadow-2xl">
            <video
              src={src}
              controls
              autoPlay
              playsInline
              className="w-full max-h-[80vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};

const POPULAR_GIFS = [
  { id: "g1", title: "Thumbs Up", category: "Agree", url: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif" },
  { id: "g2", title: "Party Celebration", category: "Party", url: "https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif" },
  { id: "g3", title: "Applause Clapping", category: "Applause", url: "https://media.giphy.com/media/ytTYwIlWYnm6Y/giphy.gif" },
  { id: "g4", title: "Laughing Cat", category: "Funny", url: "https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif" },
  { id: "g5", title: "Mind Blown", category: "Shocked", url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif" },
  { id: "g6", title: "Heart Love", category: "Love", url: "https://media.giphy.com/media/uw0KqTWZPAhu0/giphy.gif" },
  { id: "g7", title: "Dancing Dog", category: "Dance", url: "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif" },
  { id: "g8", title: "Popcorn Watching", category: "Relax", url: "https://media.giphy.com/media/t3dLl0TGHCxTG/giphy.gif" },
  { id: "g9", title: "Yes Absolutely", category: "Agree", url: "https://media.giphy.com/media/nXxOjZrbnbRxS/giphy.gif" },
  { id: "g10", title: "Facepalm", category: "Funny", url: "https://media.giphy.com/media/WrNfErAnGV7lm/giphy.gif" },
  { id: "g11", title: "High Five", category: "Party", url: "https://media.giphy.com/media/pHb82xtBPfqEg/giphy.gif" },
  { id: "g12", title: "Fire Awesome", category: "Cool", url: "https://media.giphy.com/media/3o72FfM5HJydzafgUE/giphy.gif" },
  { id: "g13", title: "Crying Laughing", category: "Funny", url: "https://media.giphy.com/media/ltIFdjNAasOwVvKhvx/giphy.gif" },
  { id: "g14", title: "Great Job", category: "Applause", url: "https://media.giphy.com/media/3oEjI5VtIhHvK37WYo/giphy.gif" },
  { id: "g15", title: "Coffee Sip", category: "Relax", url: "https://media.giphy.com/media/hPTZgtzfRIB5Nfb5rL/giphy.gif" },
  { id: "g16", title: "Shocked Face", category: "Shocked", url: "https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif" },
];

export const ChatArea: React.FC<ChatAreaProps> = ({
  currentUser,
  activeContact,
  contacts = [],
  messages = [],
  onSendMessage,
  onLogout,
  onBack,
  onRefreshMessages,
  onToggleContactsSidebar,
  onGroupUpdated,
  onClearChat,
  onToggleBlockContact,
  onReportContact,
  onDeleteContact,
  onDeleteGroup,
  isSplitView = false,
}) => {
  const safeMessages = messages || [];
  const [inputText, setInputText] = useState("");
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isGroupDetailsOpen, setIsGroupDetailsOpen] = useState(false);
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);

  // Dialog states for destructive actions
  const [confirmClearChat, setConfirmClearChat] = useState(false);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);
  const [confirmDeleteContact, setConfirmDeleteContact] = useState(false);

  const isBlocked = !!(activeContact && currentUser?.blockedUserIds?.includes(activeContact.id));
  const isZAssistant = activeContact?.id === "z_assistant_ai";

  // Message Actions state (Long hold / Right-click)
  const [selectedMessageForAction, setSelectedMessageForAction] = useState<Message | null>(null);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [forwardSearch, setForwardSearch] = useState("");
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
  const [gifSearchQuery, setGifSearchQuery] = useState("");
  const [gifCategory, setGifCategory] = useState("All");
  const [copiedToast, setCopiedToast] = useState(false);
  const [clearChatToast, setClearChatToast] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const longPressTimerRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Active contact bot trigger files (for quick test chips)
  const [activeBotTriggerFiles, setActiveBotTriggerFiles] = useState<any[]>([]);

  useEffect(() => {
    if (!activeContact) {
      setActiveBotTriggerFiles([]);
      return;
    }

    if (activeContact.botConfig?.triggerFiles && activeContact.botConfig.triggerFiles.length > 0) {
      setActiveBotTriggerFiles(activeContact.botConfig.triggerFiles);
    } else if (activeContact.id === "z_assistant_ai" || activeContact.botConfig?.enabled) {
      fetch(`/api/bot/trigger-files?userId=${activeContact.id}`)
        .then((r) => (r.ok ? r.json() : { triggerFiles: [] }))
        .then((d) => {
          if (d.success && Array.isArray(d.triggerFiles)) {
            setActiveBotTriggerFiles(d.triggerFiles);
          }
        })
        .catch(() => {});
    } else {
      setActiveBotTriggerFiles([]);
    }
  }, [activeContact]);

  // Long press detection handlers
  const handleTouchStart = (msg: Message) => {
    if (msg.isDeletedForEveryone) return;
    longPressTimerRef.current = setTimeout(() => {
      setSelectedMessageForAction(msg);
      if ("vibrate" in navigator) {
        try {
          navigator.vibrate(50);
        } catch (e) {}
      }
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleMessageReaction = async (msgId: string, emoji: string) => {
    try {
      await fetch(`/api/messages/${msgId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, emoji }),
      });
      setSelectedMessageForAction(null);
      if (onRefreshMessages) onRefreshMessages();
    } catch (e) {
      console.warn("Reaction error:", e);
    }
  };

  const handleCopyMessage = (content: string) => {
    try {
      navigator.clipboard.writeText(content);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2000);
    } catch (e) {}
    setSelectedMessageForAction(null);
  };

  const handleDeleteForMe = async (msgId: string) => {
    try {
      await fetch(`/api/messages/${msgId}/delete-me`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      setSelectedMessageForAction(null);
      if (onRefreshMessages) onRefreshMessages();
    } catch (e) {}
  };

  const handleDeleteForEveryone = async (msgId: string) => {
    try {
      await fetch(`/api/messages/${msgId}?userId=${currentUser.id}`, {
        method: "DELETE",
      });
      setSelectedMessageForAction(null);
      if (onRefreshMessages) onRefreshMessages();
    } catch (e) {}
  };

  const handleForwardTo = async (target: Contact) => {
    if (!selectedMessageForAction) return;
    try {
      await fetch("/api/messages/forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalMessageId: selectedMessageForAction.id,
          senderId: currentUser.id,
          targetUserId: target.isGroup ? undefined : target.id,
          targetGroupId: target.isGroup ? target.id : undefined,
        }),
      });
      setIsForwardModalOpen(false);
      setSelectedMessageForAction(null);
      if (onRefreshMessages) onRefreshMessages();
    } catch (e) {}
  };

  const handleSendGif = (gifUrl: string, title: string) => {
    onSendMessage("file", gifUrl, {
      fileName: `${title}.gif`,
      fileType: "image/gif",
    });
    setIsGifPickerOpen(false);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Audio Playback Helper
  const handleTogglePlayAudio = (msgId: string, audioUrl: string) => {
    if (playingAudioId === msgId) {
      audioPlayerRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      audio.onended = () => setPlayingAudioId(null);
      audio.play();
      setPlayingAudioId(msgId);
    }
  };

  // Send Text Message
  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    onSendMessage("text", inputText.trim());
    setInputText("");
  };

  // Handle File Attachment
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onSendMessage("file", reader.result, {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  if (!activeContact) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-gradient-to-br from-amber-50/20 via-orange-50/20 to-white p-8 text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 p-5 text-white shadow-xl shadow-orange-500/20 flex items-center justify-center mb-6">
          <MessageSquare className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-extrabold text-neutral-900 font-['Outfit',sans-serif]">
          Select a Conversation or Add a Contact
        </h2>
        <p className="mt-2 text-sm text-neutral-600 max-w-md">
          Send direct messages, share images, audio notes, video messages, and files, or create multi-person groups with custom DP.
        </p>
      </div>
    );
  }

  return (
    <div id="active-chat-area" className="flex-1 h-full flex flex-col bg-white overflow-hidden">
      {/* Active Contact Header */}
      <div className="p-3 sm:p-3.5 border-b border-orange-100 flex items-center justify-between bg-white z-10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onBack && (
            <button
              id="chat-back-to-contacts-btn"
              type="button"
              onClick={onBack}
              title="Back to contacts list"
              className="md:hidden p-2 -ml-1 rounded-xl text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div
            className="relative shrink-0 cursor-pointer group"
            onClick={() => {
              if (activeContact.isGroup) {
                setIsGroupDetailsOpen(true);
              } else {
                setIsUserProfileOpen(true);
              }
            }}
            title={activeContact.isGroup ? "View group details" : "View profile and About"}
          >
            <img
              src={activeContact.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
              alt={activeContact.fullName}
              className="w-10 h-10 rounded-full object-cover border-2 border-orange-400 group-hover:opacity-90 transition-opacity"
            />
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                activeContact.status === "online"
                  ? "bg-emerald-500"
                  : "bg-neutral-300"
              }`}
            />
          </div>
          <div
            className="cursor-pointer"
            onClick={() => {
              if (activeContact.isGroup) {
                setIsGroupDetailsOpen(true);
              } else {
                setIsUserProfileOpen(true);
              }
            }}
            title={activeContact.isGroup ? "View group details & change DP" : "Click to view profile and About"}
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-neutral-900 hover:text-orange-600 transition-colors">
                {activeContact.fullName}
              </h3>
              <span className="text-xs font-semibold text-orange-600">
                {activeContact.isGroup ? "Group" : `@${activeContact.username}`}
              </span>
            </div>
            <p className="text-[11px] text-neutral-600 flex items-center gap-1.5">
              {activeContact.isGroup ? (
                <>
                  <Users className="w-3.5 h-3.5 text-orange-500" />
                  <span>{activeContact.groupData?.memberIds?.length || 3} members • Tap to view & change DP</span>
                </>
              ) : (
                <>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      activeContact.status === "online" ? "bg-emerald-500" : "bg-neutral-400"
                    }`}
                  />
                  <span className="capitalize">{activeContact.status}</span>
                  <span className="text-neutral-400">•</span>
                  <span className="text-orange-600 font-semibold hover:underline">View About</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {activeContact.isGroup ? (
            <button
              id="chat-group-dp-btn"
              type="button"
              onClick={() => setIsGroupDetailsOpen(true)}
              title="Change Group Display Picture (DP) & Info"
              className="px-2.5 py-1.5 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-800 transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <Camera className="w-3.5 h-3.5 text-orange-600" />
              <span className="hidden sm:inline">Change DP</span>
            </button>
          ) : (
            <button
              id="chat-person-about-btn"
              type="button"
              onClick={() => setIsUserProfileOpen(true)}
              title="Click to see person profile & About"
              className="px-2.5 py-1.5 rounded-xl bg-orange-100/80 hover:bg-orange-200 text-orange-800 transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <Info className="w-3.5 h-3.5 text-orange-600" />
              <span className="hidden sm:inline">About</span>
            </button>
          )}

          {/* More Options dropdown menu (Clear Chat, Block, Delete, Report) */}
          <div className="relative">
            <button
              id="chat-header-more-btn"
              type="button"
              onClick={() => setIsHeaderMenuOpen((prev) => !prev)}
              title="Chat Options & Controls"
              className="p-2 rounded-xl text-neutral-600 hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isHeaderMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsHeaderMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-neutral-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  {/* Clear Chat */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      setConfirmClearChat(true);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-neutral-700 hover:bg-orange-50 hover:text-orange-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Clear Chat</span>
                  </button>

                  {/* 1-on-1 Contact Actions */}
                  {!activeContact.isGroup && !isZAssistant && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsHeaderMenuOpen(false);
                          if (onToggleBlockContact) onToggleBlockContact(activeContact);
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs font-semibold text-neutral-700 hover:bg-red-50 hover:text-red-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{isBlocked ? "Unblock Contact" : "Block Contact"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsHeaderMenuOpen(false);
                          if (onReportContact) onReportContact(activeContact);
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs font-semibold text-neutral-700 hover:bg-red-50 hover:text-red-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <Flag className="w-3.5 h-3.5 text-red-500" />
                        <span>Report Contact</span>
                      </button>

                      <div className="my-1 border-t border-neutral-100" />

                      <button
                        type="button"
                        onClick={() => {
                          setIsHeaderMenuOpen(false);
                          setConfirmDeleteContact(true);
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        <span>Delete Contact</span>
                      </button>
                    </>
                  )}

                  {/* Group Chat Actions */}
                  {activeContact.isGroup && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsHeaderMenuOpen(false);
                          setIsGroupDetailsOpen(true);
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs font-semibold text-neutral-700 hover:bg-orange-50 hover:text-orange-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Group Information</span>
                      </button>

                      <div className="my-1 border-t border-neutral-100" />

                      <button
                        type="button"
                        onClick={() => {
                          setIsHeaderMenuOpen(false);
                          setConfirmDeleteGroup(true);
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        <span>Delete Group</span>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {onToggleContactsSidebar && (
            <button
              id="chat-toggle-contacts-btn"
              type="button"
              onClick={onToggleContactsSidebar}
              title="Toggle Contacts List"
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <Users className="w-4 h-4 text-orange-600" />
              <span className="hidden sm:inline">Contacts</span>
            </button>
          )}

          {/* Optional Direct Log Out button */}
          {onLogout && (
            <button
              onClick={onLogout}
              title="Sign out of account"
              className="p-2.5 rounded-xl border border-neutral-200 text-neutral-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Special Banners for AI Assistant and Blocked Contacts */}
      {isZAssistant && (
        <div className="px-4 pt-2.5">
          <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-yellow-500/10 border border-orange-200/80 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-xs shrink-0">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <span className="font-bold text-neutral-900">Z-Assistant AI — Powered by Google Gemini</span>
                <span className="text-[11px] text-neutral-600 block">
                  Ask anything: general knowledge, translations, summaries, coding, advice, or calculations!
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {isBlocked && (
        <div className="px-4 pt-2.5">
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-between gap-3 text-xs text-red-700">
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4 text-red-600 shrink-0" />
              <span>You have blocked this contact. Unblock them to exchange messages.</span>
            </div>
            {onToggleBlockContact && (
              <button
                type="button"
                onClick={() => onToggleBlockContact(activeContact)}
                className="px-3 py-1 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 text-xs cursor-pointer shadow-xs shrink-0"
              >
                Unblock
              </button>
            )}
          </div>
        </div>
      )}

      {/* Message Stream */}
      <div
        id="messages-viewport"
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-orange-50/10 via-amber-50/5 to-white"
      >
        {safeMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-neutral-400 p-6">
            <div className="w-12 h-12 rounded-2xl bg-orange-100/60 text-orange-500 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-neutral-600">No messages yet</p>
            <p className="text-[11px] text-neutral-400 mt-1 max-w-xs">
              Send a text, record a voice clip, snap a video note, or share media with this contact.
            </p>
          </div>
        ) : (
          safeMessages.map((msg) => {
            const isMe = msg.senderId === currentUser.id;
            const isDeleted = !!msg.isDeletedForEveryone;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"} select-none`}
              >
                <div
                  onTouchStart={() => handleTouchStart(msg)}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={() => handleTouchStart(msg)}
                  onMouseUp={handleTouchEnd}
                  onMouseLeave={handleTouchEnd}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (!isDeleted) setSelectedMessageForAction(msg);
                  }}
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 shadow-xs relative group cursor-pointer transition-shadow hover:shadow-md ${
                    isDeleted
                      ? "bg-neutral-100 text-neutral-500 border border-neutral-200"
                      : isMe
                      ? "bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500 text-white rounded-tr-none"
                      : "bg-white border border-orange-100/90 text-neutral-900 rounded-tl-none"
                  }`}
                >
                  {/* Action 3-dots button on hover */}
                  {!isDeleted && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMessageForAction(msg);
                      }}
                      title="Message options (hold or click)"
                      className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-2 right-2 p-1 rounded-full bg-white text-neutral-700 shadow-md border border-neutral-200 hover:bg-orange-50 hover:text-orange-600 cursor-pointer z-10"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Forwarded Header Indicator */}
                  {msg.isForwarded && (
                    <div className="text-[10px] italic opacity-85 mb-1 flex items-center gap-1 font-semibold">
                      <Share2 className="w-2.5 h-2.5" />
                      <span>Forwarded</span>
                    </div>
                  )}

                  {/* DELETED MESSAGE PLACEHOLDER */}
                  {isDeleted ? (
                    <div className="text-xs italic py-1 flex items-center gap-1.5 opacity-80">
                      <Trash2 className="w-3.5 h-3.5 text-neutral-400" />
                      <span>This message was deleted</span>
                    </div>
                  ) : (
                    <>
                      {/* System Software Report Header Badge */}
                      {msg.metadata?.isSystemReport && (
                        <div
                          className={`mb-2 pb-1.5 border-b flex items-center justify-between gap-2 text-[10px] font-bold ${
                            isMe ? "border-white/30 text-white" : "border-indigo-100 text-indigo-950"
                          }`}
                        >
                          <span
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ${
                              isMe ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                            }`}
                          >
                            <Server className="w-3 h-3" />
                            <span>{msg.metadata.systemSoftwareName || "Verified System Report"}</span>
                          </span>
                          {msg.metadata.recordTitle && (
                            <span className="opacity-80 font-medium truncate max-w-[140px]">
                              {msg.metadata.recordTitle}
                            </span>
                          )}
                        </div>
                      )}

                      {/* TEXT MESSAGE */}
                      {msg.type === "text" && (
                        <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {msg.content}
                        </div>
                      )}

                      {/* VOICE MESSAGE */}
                      {msg.type === "voice" && (
                        <div className="flex items-center gap-3 min-w-[220px]">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePlayAudio(msg.id, msg.content);
                            }}
                            className={`p-2.5 rounded-full transition-transform cursor-pointer ${
                              isMe ? "bg-white text-orange-600 hover:scale-105" : "bg-orange-500 text-white hover:bg-orange-600"
                            }`}
                          >
                            {playingAudioId === msg.id ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4 ml-0.5" />
                            )}
                          </button>

                          <div className="flex-1">
                            {/* Audio waveform mockup */}
                            <div className="flex items-center gap-1 h-6">
                              {[30, 80, 45, 90, 60, 100, 75, 40, 85, 50, 95, 65, 30].map((h, idx) => (
                                <div
                                  key={idx}
                                  className={`w-1 rounded-full ${
                                    isMe ? "bg-white/80" : "bg-orange-500"
                                  } ${playingAudioId === msg.id ? "animate-pulse" : ""}`}
                                  style={{ height: `${h}%` }}
                                />
                              ))}
                            </div>
                            <div className="flex items-center justify-between text-[10px] mt-1 opacity-80">
                              <span>Voice Message</span>
                              <span>{msg.metadata?.duration || 1}s</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* VIDEO MESSAGE NOTE */}
                      {msg.type === "video" && (
                        <VideoNoteBubble
                          src={msg.content}
                          duration={msg.metadata?.duration}
                          isMe={isMe}
                        />
                      )}

                      {/* FILE / GIF ATTACHMENT */}
                      {msg.type === "file" && (
                        <div>
                          {msg.metadata?.triggerMatched && (
                            <div
                              className={`mb-2 flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-lg border w-fit ${
                                isMe
                                  ? "bg-white/20 text-white border-white/30"
                                  : "bg-orange-50 text-orange-700 border-orange-200"
                              }`}
                            >
                              <Sparkles className="w-3 h-3 text-orange-500" />
                              <span>Bot Trigger: "{msg.metadata.triggerMatched}"</span>
                            </div>
                          )}

                          {msg.metadata?.fileType?.startsWith("image/") ||
                          msg.content.startsWith("data:image/") ||
                          msg.content.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) ? (
                            <div className="rounded-xl overflow-hidden max-w-[280px]">
                              <img
                                src={msg.content}
                                alt={msg.metadata?.fileName || "Media GIF"}
                                className="w-full max-h-64 object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity bg-neutral-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(msg.content, "_blank");
                                }}
                              />
                              {msg.metadata?.fileName && (
                                <p className="text-[10px] mt-1 opacity-75 truncate">
                                  {msg.metadata.fileName}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 min-w-[200px]">
                              <div
                                className={`p-2.5 rounded-xl ${
                                  isMe ? "bg-white/20 text-white" : "bg-orange-100 text-orange-600"
                                }`}
                              >
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate">
                                  {msg.metadata?.fileName || "Attached File"}
                                </p>
                                <p className="text-[10px] opacity-75">
                                  {msg.metadata?.fileSize
                                    ? `${(msg.metadata.fileSize / (1024 * 1024)).toFixed(2)} MB`
                                    : "File document"}
                                </p>
                              </div>
                              <a
                                href={msg.content}
                                download={msg.metadata?.fileName || "attachment"}
                                onClick={(e) => e.stopPropagation()}
                                className={`p-2 rounded-lg transition-colors ${
                                  isMe ? "hover:bg-white/20 text-white" : "hover:bg-neutral-100 text-neutral-600"
                                }`}
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            </div>
                          )}

                          {msg.metadata?.caption && (
                            <p className="text-xs mt-1.5 font-medium leading-relaxed opacity-95">
                              {msg.metadata.caption}
                            </p>
                          )}
                        </div>
                      )}

                      {/* LOCATION ATTACHMENT */}
                      {msg.type === "location" && (
                        <div className="min-w-[230px] rounded-xl overflow-hidden">
                          <div className="h-28 bg-neutral-200 relative overflow-hidden rounded-lg">
                            <iframe
                              title="Location View"
                              width="100%"
                              height="100%"
                              frameBorder="0"
                              scrolling="no"
                              src={`https://www.openstreetmap.org/export/embed.html?bbox=${(msg.metadata?.longitude || 0) - 0.008}%2C${(msg.metadata?.latitude || 0) - 0.008}%2C${(msg.metadata?.longitude || 0) + 0.008}%2C${(msg.metadata?.latitude || 0) + 0.008}&layer=mapnik&marker=${msg.metadata?.latitude}%2C${msg.metadata?.longitude}`}
                              className="w-full h-full pointer-events-none"
                            />
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-red-400" />
                                <span>{msg.metadata?.address || "Shared Location"}</span>
                              </p>
                              <p className="text-[10px] opacity-75">
                                {msg.metadata?.latitude?.toFixed(4)}, {msg.metadata?.longitude?.toFixed(4)}
                              </p>
                            </div>
                            <a
                              href={`https://www.google.com/maps?q=${msg.metadata?.latitude},${msg.metadata?.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-md hover:bg-black/10 cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Message Footer: Time + Read Checkmarks */}
                  <div
                    className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] ${
                      isMe ? "text-white/80" : "text-neutral-400"
                    }`}
                  >
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {isMe && !isDeleted && (
                      <span>
                        {msg.read ? (
                          <CheckCheck className="w-3 h-3 text-emerald-300" />
                        ) : (
                          <Check className="w-3 h-3 text-white/60" />
                        )}
                      </span>
                    )}
                  </div>

                  {/* Message Reactions Display */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-white/15">
                      {Object.entries(
                        Object.values(msg.reactions).reduce((acc: Record<string, number>, em: string) => {
                          acc[em] = (acc[em] || 0) + 1;
                          return acc;
                        }, {})
                      ).map(([em, cnt]) => {
                        const isMyReaction = msg.reactions?.[currentUser.id] === em;
                        return (
                          <button
                            key={em}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMessageReaction(msg.id, em);
                            }}
                            className={`px-1.5 py-0.5 rounded-full text-[11px] flex items-center gap-1 cursor-pointer transition-transform active:scale-90 ${
                              isMyReaction
                                ? "bg-white text-neutral-900 font-bold shadow-xs ring-1 ring-orange-400"
                                : isMe
                                ? "bg-black/20 text-white"
                                : "bg-orange-100 text-orange-800"
                            }`}
                          >
                            <span>{em}</span>
                            <span className="text-[10px]">{cnt}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Action Panel */}
      <div className="p-3 bg-white border-t border-orange-100">
        {/* Quick Trigger Chips for Bot (if bot has configured trigger files) */}
        {activeBotTriggerFiles.length > 0 && !isBlocked && (
          <div className="mb-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 border border-amber-200">
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Special File Triggers:</span>
            </span>
            {activeBotTriggerFiles.map((tf: any) => (
              <button
                key={tf.id}
                type="button"
                onClick={() => setInputText(tf.triggerPhrase)}
                title={`Click to fill: "${tf.triggerPhrase}" (Sends ${tf.fileName})`}
                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100/80 text-amber-900 border border-amber-200/90 text-[11px] font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 active:scale-95 shadow-2xs"
              >
                <FileText className="w-3 h-3 text-amber-600" />
                <span>{tf.triggerPhrase}</span>
              </button>
            ))}
          </div>
        )}

        {isBlocked ? (
          <div className="py-3 px-4 rounded-xl bg-red-50/70 border border-red-200 text-center text-xs font-semibold text-red-700 flex items-center justify-center gap-2">
            <Ban className="w-4 h-4 text-red-500" />
            <span>You have blocked this contact. Unblock to send messages.</span>
            {onToggleBlockContact && (
              <button
                type="button"
                onClick={() => onToggleBlockContact(activeContact)}
                className="ml-2 px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer transition-all shadow-xs"
              >
                Unblock
              </button>
            )}
          </div>
        ) : isRecordingVoice ? (
          <VoiceRecorder
            onSendVoiceMessage={(audioData, duration) => {
              onSendMessage("voice", audioData, { duration });
              setIsRecordingVoice(false);
            }}
            onCancel={() => setIsRecordingVoice(false)}
          />
        ) : (
          <form onSubmit={handleSendText} className="flex items-center gap-2">
            {/* Attachment Actions Menu */}
            <div className="flex items-center gap-1">
              {/* File Attachment */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach Document / Media"
                className="p-2 rounded-xl text-neutral-500 hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* GIF Picker Button */}
              <button
                id="open-gif-picker-btn"
                type="button"
                onClick={() => setIsGifPickerOpen(true)}
                title="Send Animated GIF"
                className="p-1.5 px-2 rounded-xl text-neutral-500 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer flex items-center gap-1"
              >
                <span className="font-extrabold text-[11px] tracking-tight px-1 py-0.5 rounded bg-amber-100 text-amber-800">
                  GIF
                </span>
              </button>

              {/* Location Attachment */}
              <button
                type="button"
                onClick={() => setIsPickingLocation(true)}
                title="Attach GPS Location"
                className="p-2 rounded-xl text-neutral-500 hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer"
              >
                <MapPin className="w-4 h-4" />
              </button>

              {/* Video Message Recorder */}
              <button
                type="button"
                onClick={() => setIsRecordingVideo(true)}
                title="Record Video Message"
                className="p-2 rounded-xl text-neutral-500 hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer"
              >
                <VideoIcon className="w-4 h-4" />
              </button>

              {/* Voice Message Recorder */}
              <button
                type="button"
                onClick={() => setIsRecordingVoice(true)}
                title="Record Voice Message"
                className="p-2 rounded-xl text-neutral-500 hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer"
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>

            {/* Text Message Input */}
            <input
              id="message-input-field"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Message @${activeContact.username}...`}
              className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 text-xs sm:text-sm text-neutral-900 outline-hidden transition-all"
            />

            {/* Send Button */}
            <button
              id="send-message-btn"
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 disabled:opacity-40 text-white shadow-xs cursor-pointer active:scale-95 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>

      {/* Video Message Modal */}
      {isRecordingVideo && (
        <VideoMessageRecorder
          onSendVideoMessage={(videoData, duration) => {
            onSendMessage("video", videoData, { duration });
            setIsRecordingVideo(false);
          }}
          onCancel={() => setIsRecordingVideo(false)}
        />
      )}

      {/* Location Picker Modal */}
      {isPickingLocation && (
        <LocationPickerModal
          onSendLocation={(loc) => {
            onSendMessage("location", "Shared Location", {
              latitude: loc.latitude,
              longitude: loc.longitude,
              address: loc.address,
            });
            setIsPickingLocation(false);
          }}
          onClose={() => setIsPickingLocation(false)}
        />
      )}

      {/* Message Action Sheet / Context Menu Modal */}
      {selectedMessageForAction && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-3 animate-in fade-in"
          onClick={() => setSelectedMessageForAction(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-4 shadow-2xl border border-orange-100 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Quick Emoji Reactions Bar */}
            <div className="flex items-center justify-between p-2 rounded-2xl bg-orange-50/70 border border-orange-100 mb-3 overflow-x-auto">
              {["❤️", "👍", "😂", "😮", "😢", "🙏", "🔥", "🎉"].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleMessageReaction(selectedMessageForAction.id, emoji)}
                  className="text-2xl p-1.5 rounded-xl hover:scale-125 transition-transform cursor-pointer active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Action Items */}
            <div className="space-y-1">
              {/* Copy Message */}
              <button
                type="button"
                onClick={() => handleCopyMessage(selectedMessageForAction.content)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-neutral-100 text-neutral-800 text-sm font-semibold cursor-pointer transition-colors"
              >
                <Copy className="w-4 h-4 text-neutral-500" />
                <span>Copy Message</span>
              </button>

              {/* Forward Message */}
              <button
                type="button"
                onClick={() => setIsForwardModalOpen(true)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-neutral-100 text-neutral-800 text-sm font-semibold cursor-pointer transition-colors"
              >
                <Share2 className="w-4 h-4 text-orange-500" />
                <span>Forward Message</span>
              </button>

              {/* Delete for Myself */}
              <button
                type="button"
                onClick={() => handleDeleteForMe(selectedMessageForAction.id)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-neutral-100 text-neutral-800 text-sm font-semibold cursor-pointer transition-colors"
              >
                <Trash2 className="w-4 h-4 text-neutral-500" />
                <span>Delete for Myself</span>
              </button>

              {/* Delete for Everyone (Sender or Super Admin) */}
              {(selectedMessageForAction.senderId === currentUser.id ||
                currentUser.role === "superadmin" ||
                currentUser.email.toLowerCase() === "hashir0047@gmail.com") && (
                <button
                  type="button"
                  onClick={() => handleDeleteForEveryone(selectedMessageForAction.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-red-50 text-red-600 text-sm font-semibold cursor-pointer transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                  <span>Delete for Everyone</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Forward Message Modal */}
      {isForwardModalOpen && selectedMessageForAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setIsForwardModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-orange-100 flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-orange-100">
              <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-orange-500" />
                <span>Forward Message</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsForwardModalOpen(false)}
                className="p-1 rounded-xl text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-3 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={forwardSearch}
                onChange={(e) => setForwardSearch(e.target.value)}
                placeholder="Search contacts & groups..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-neutral-100 text-xs text-neutral-900 border border-transparent focus:border-orange-400 focus:bg-white outline-hidden"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 divide-y divide-neutral-100">
              {contacts
                .filter((c) =>
                  c.fullName.toLowerCase().includes(forwardSearch.toLowerCase()) ||
                  c.username.toLowerCase().includes(forwardSearch.toLowerCase())
                )
                .map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => handleForwardTo(contact)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-orange-50 transition-colors text-left cursor-pointer"
                  >
                    <img
                      src={contact.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                      alt={contact.fullName}
                      className="w-10 h-10 rounded-full object-cover border border-orange-200"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-neutral-900 truncate">{contact.fullName}</p>
                      <p className="text-[11px] text-neutral-500 truncate">
                        {contact.isGroup ? "Group" : `@${contact.username}`}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-orange-500 text-white text-[11px] font-bold shadow-xs">
                      Send
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* GIF Picker Modal */}
      {isGifPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-3 animate-in fade-in"
          onClick={() => setIsGifPickerOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl p-4 shadow-2xl border border-orange-100 flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-orange-100">
              <div className="flex items-center gap-2">
                <div className="px-2 py-0.5 rounded bg-amber-500 text-white font-extrabold text-xs">
                  GIF
                </div>
                <h3 className="text-sm font-bold text-neutral-900">Send Animated GIF</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGifPickerOpen(false)}
                className="p-1 rounded-xl text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="my-3 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={gifSearchQuery}
                onChange={(e) => setGifSearchQuery(e.target.value)}
                placeholder="Search GIFs (e.g. party, cat, dance, laugh)..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-neutral-100 text-xs text-neutral-900 border border-transparent focus:border-orange-400 focus:bg-white outline-hidden"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              {["All", "Agree", "Party", "Applause", "Funny", "Love", "Dance", "Relax", "Shocked", "Cool"].map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setGifCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      gifCategory === cat
                        ? "bg-orange-500 text-white shadow-xs"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>

            {/* GIF Grid */}
            <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2 p-1 max-h-80">
              {POPULAR_GIFS.filter((g) => {
                const matchCat = gifCategory === "All" || g.category.toLowerCase() === gifCategory.toLowerCase();
                const matchQuery =
                  !gifSearchQuery ||
                  g.title.toLowerCase().includes(gifSearchQuery.toLowerCase()) ||
                  g.category.toLowerCase().includes(gifSearchQuery.toLowerCase());
                return matchCat && matchQuery;
              }).map((gif) => (
                <div
                  key={gif.id}
                  onClick={() => handleSendGif(gif.url, gif.title)}
                  className="group relative rounded-2xl overflow-hidden cursor-pointer border border-neutral-100 hover:border-orange-400 hover:shadow-md transition-all aspect-video bg-neutral-100"
                >
                  <img
                    src={gif.url}
                    alt={gif.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <span className="text-[10px] font-bold text-white truncate">{gif.title}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Group Details / Change DP Modal */}
      {isGroupDetailsOpen && activeContact?.isGroup && (
        <GroupDetailsModal
          currentUser={currentUser}
          activeContact={activeContact}
          onClose={() => setIsGroupDetailsOpen(false)}
          onGroupUpdated={(updatedGroup) => {
            if (onGroupUpdated) {
              onGroupUpdated(updatedGroup);
            }
            if (onRefreshMessages) {
              onRefreshMessages();
            }
          }}
        />
      )}

      {/* User Profile / About Modal */}
      {isUserProfileOpen && activeContact && !activeContact.isGroup && (
        <UserProfileModal
          user={activeContact}
          currentUser={currentUser}
          isBlocked={isBlocked}
          onClose={() => setIsUserProfileOpen(false)}
          onToggleBlock={(u) => {
            if (onToggleBlockContact) onToggleBlockContact(u as Contact);
          }}
          onReportUser={(u) => {
            if (onReportContact) onReportContact(u as Contact);
          }}
          onDeleteContact={(u) => {
            if (onDeleteContact) onDeleteContact(u as Contact);
          }}
        />
      )}

      {/* Confirmation Modal: Clear Chat */}
      {confirmClearChat && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-neutral-200">
            <div className="flex items-center gap-3 text-red-600 mb-2">
              <div className="p-2.5 rounded-full bg-red-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Clear Chat History?</h3>
                <p className="text-xs text-neutral-500">This will remove your copy of messages in this chat.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setConfirmClearChat(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearingChat}
                onClick={async () => {
                  try {
                    setIsClearingChat(true);
                    if (onClearChat) {
                      await onClearChat();
                      setClearChatToast(true);
                      setTimeout(() => setClearChatToast(false), 2500);
                    }
                  } finally {
                    setIsClearingChat(false);
                    setConfirmClearChat(false);
                  }
                }}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isClearingChat ? (
                  <>
                    <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    <span>Clearing...</span>
                  </>
                ) : (
                  <span>Clear Chat</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Contact */}
      {confirmDeleteContact && activeContact && !activeContact.isGroup && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-neutral-200">
            <div className="flex items-center gap-3 text-red-600 mb-2">
              <div className="p-2.5 rounded-full bg-red-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Delete Contact?</h3>
                <p className="text-xs text-neutral-500">Remove @{activeContact.username} from your contacts list?</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setConfirmDeleteContact(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmDeleteContact(false);
                  if (onDeleteContact) await onDeleteContact(activeContact);
                }}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Delete Contact
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Group */}
      {confirmDeleteGroup && activeContact && activeContact.isGroup && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-neutral-200">
            <div className="flex items-center gap-3 text-red-600 mb-2">
              <div className="p-2.5 rounded-full bg-red-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Delete Group?</h3>
                <p className="text-xs text-neutral-500">Are you sure you want to delete or leave this group?</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setConfirmDeleteGroup(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmDeleteGroup(false);
                  if (onDeleteGroup) await onDeleteGroup(activeContact.id);
                }}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Delete Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copied Toast */}
      {copiedToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold shadow-xl animate-in fade-in slide-in-from-bottom-2">
          Message copied to clipboard!
        </div>
      )}

      {/* Clear Chat Toast */}
      {clearChatToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Trash2 className="w-3.5 h-3.5 text-orange-400" />
          <span>Chat history cleared successfully!</span>
        </div>
      )}
    </div>
  );
};
