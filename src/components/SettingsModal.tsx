import React, { useState, useEffect, useRef } from "react";
import { User, UserBotConfig, BotTrainingQA, BotTriggerFile } from "../types";
import {
  Settings,
  X,
  UserPlus,
  Users,
  ShieldAlert,
  LogOut,
  Check,
  ChevronRight,
  Bot,
  Sparkles,
  Shield,
  Key,
  Copy,
  Globe,
  Database,
  Radio,
  UserX,
  AlertCircle,
  Bell,
  Volume2,
  VolumeX,
  Upload,
  Camera,
  Image as ImageIcon,
  Plus,
  Trash2,
  Code,
  BookOpen,
  Smartphone,
  ExternalLink,
  HelpCircle,
  FileText,
  CheckCircle2,
  Share2,
  Send,
  RefreshCw,
  Play,
  Lock,
  Unlock,
  ShieldCheck,
  Phone,
  MessageSquare,
  Terminal,
  Eye,
  EyeOff,
  Power,
  Paperclip,
  FileUp,
  File,
  Download,
} from "lucide-react";
import { playMessageChime, requestNotificationPermission } from "../utils/notifications";

const PRESET_PROFILE_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
];

interface SettingsModalProps {
  currentUser: User;
  onClose: () => void;
  onUpdateProfile: (updated: Partial<User>) => Promise<boolean>;
  onOpenAddContact: () => void;
  onOpenCreateGroup: () => void;
  onOpenSuperAdmin?: () => void;
  onLogout: () => void;
  onUnblockUser?: (targetUserId: string) => Promise<void>;
  onUpdateCurrentUser?: (updatedUser: User) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentUser,
  onClose,
  onUpdateProfile,
  onOpenAddContact,
  onOpenCreateGroup,
  onOpenSuperAdmin,
  onLogout,
  onUnblockUser,
  onUpdateCurrentUser,
}) => {
  const [activeTab, setActiveTab] = useState<
    "general" | "chatbot" | "developer_api" | "privacy" | "notifications" | "profile"
  >("general");

  // Profile fields
  const [fullName, setFullName] = useState(currentUser.fullName);
  const [username, setUsername] = useState(currentUser.username);
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [about, setAbout] = useState(currentUser.about || "Available");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [showProfileUrlInput, setShowProfileUrlInput] = useState(false);
  const profileFileInputRef = useRef<HTMLInputElement | null>(null);

  // Notification fields
  const [soundEnabled, setSoundEnabled] = useState(
    typeof window !== "undefined" ? localStorage.getItem("zmsg_sound_enabled") !== "false" : true
  );
  const [bannersEnabled, setBannersEnabled] = useState(
    typeof window !== "undefined" ? localStorage.getItem("zmsg_banners_enabled") !== "false" : true
  );
  const [desktopEnabled, setDesktopEnabled] = useState(
    typeof window !== "undefined" ? localStorage.getItem("zmsg_notifications_enabled") !== "false" : true
  );
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
  );

  // AI Chatbot fields & Super Admin permission state
  const isSuperadmin =
    currentUser.role === "superadmin" ||
    currentUser.email.toLowerCase() === "hashir0047@gmail.com";

  const [botAccessStatus, setBotAccessStatus] = useState<"none" | "requested" | "approved" | "rejected">(
    currentUser.botAccessStatus || (isSuperadmin ? "approved" : "none")
  );
  const isBotApproved = isSuperadmin || botAccessStatus === "approved";

  const [phoneNumber, setPhoneNumber] = useState(
    currentUser.phoneNumber || currentUser.botConfig?.phoneNumber || ""
  );
  const [geminiConnected, setGeminiConnected] = useState<boolean>(
    Boolean(currentUser.botConfig?.geminiConnected)
  );

  const [botEnabled, setBotEnabled] = useState(
    isBotApproved ? (currentUser.botConfig?.enabled ?? false) : false
  );
  const [triggerMode, setTriggerMode] = useState<"phrase" | "always">(
    currentUser.botConfig?.triggerMode ?? "always"
  );
  const [triggerPhrase, setTriggerPhrase] = useState(
    currentUser.botConfig?.triggerPhrase ?? "!bot"
  );
  const [trainingPrompt, setTrainingPrompt] = useState(
    currentUser.botConfig?.trainingPrompt ??
      "I am an official assistant representing this profile on Z-Messenger. I provide helpful answers regarding our services, operations, schedule, and inquiries, and take messages when needed."
  );
  const [instructions, setInstructions] = useState(
    currentUser.botConfig?.instructions ??
      "Speak politely, concisely, and wisely. Give accurate answers based on the knowledge base. If unsure, take a message and provide our contact phone number."
  );
  const [qaTraining, setQaTraining] = useState<BotTrainingQA[]>(
    currentUser.botConfig?.qaTraining || []
  );
  const [avoidRepetition, setAvoidRepetition] = useState<boolean>(
    currentUser.botConfig?.avoidRepetition !== false
  );

  // Q&A creation
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");

  // AI Generated Training Questions state
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<string[]>([]);
  const [answeringQuestionIndex, setAnsweringQuestionIndex] = useState<number | null>(null);
  const [answeringQuestionText, setAnsweringQuestionText] = useState("");

  // Super Admin Bot Access Request state
  const [requestNotes, setRequestNotes] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState("");
  const [requestError, setRequestError] = useState("");

  // Connect Chatbot to Gemini state
  const [isConnectingGemini, setIsConnectingGemini] = useState(false);
  const [geminiConnectSuccess, setGeminiConnectSuccess] = useState("");
  const [geminiConnectError, setGeminiConnectError] = useState("");

  // Developer API & Key state
  const [apiKey, setApiKey] = useState(currentUser.apiKey || currentUser.botConfig?.apiKey || "");
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [isRegeneratingKey, setIsRegeneratingKey] = useState(false);
  const [copiedCodeSnippet, setCopiedCodeSnippet] = useState<string | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<"curl" | "javascript" | "python">("curl");

  // Developer API Live Test Sandbox
  const [testApiMessage, setTestApiMessage] = useState("Hello, what services do you provide?");
  const [testApiResult, setTestApiResult] = useState<string | null>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);

  // General Bot save state
  const [savingBot, setSavingBot] = useState(false);
  const [botSuccess, setBotSuccess] = useState(false);
  const [botSuccessMsg, setBotSuccessMsg] = useState("");
  const [botError, setBotError] = useState("");
  const [togglingBotPower, setTogglingBotPower] = useState(false);

  // Privacy / Blocked users
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  // Chatbot Trigger Files State (Upload any file with special message trigger)
  const [selectedBotScope, setSelectedBotScope] = useState<string>(currentUser.id);
  const [triggerFiles, setTriggerFiles] = useState<BotTriggerFile[]>(
    currentUser.botConfig?.triggerFiles || []
  );
  const [newFileTriggerPhrase, setNewFileTriggerPhrase] = useState("");
  const [newFileMatchType, setNewFileMatchType] = useState<"contains" | "exact">("contains");
  const [newFileCaption, setNewFileCaption] = useState("");
  const [selectedUploadFile, setSelectedUploadFile] = useState<{
    fileName: string;
    fileSize: number;
    fileType: string;
    fileData: string;
  } | null>(null);
  const [isUploadingTriggerFile, setIsUploadingTriggerFile] = useState(false);
  const [triggerFileUploadSuccess, setTriggerFileUploadSuccess] = useState("");
  const [triggerFileUploadError, setTriggerFileUploadError] = useState("");
  const [testTriggerInput, setTestTriggerInput] = useState("");
  const [testTriggerResult, setTestTriggerResult] = useState<{
    matched: boolean;
    message: string;
    file?: BotTriggerFile;
  } | null>(null);
  const [isTestingTrigger, setIsTestingTrigger] = useState(false);
  const triggerFileInputRef = useRef<HTMLInputElement | null>(null);

  // Synchronize state when currentUser updates
  useEffect(() => {
    if (currentUser.apiKey && currentUser.apiKey !== apiKey) {
      setApiKey(currentUser.apiKey);
    }
    if (currentUser.botAccessStatus && currentUser.botAccessStatus !== botAccessStatus) {
      setBotAccessStatus(currentUser.botAccessStatus);
    }
    if (currentUser.botConfig?.enabled !== undefined) {
      setBotEnabled(Boolean(currentUser.botConfig.enabled));
    }
    if (currentUser.botConfig?.geminiConnected !== undefined) {
      setGeminiConnected(Boolean(currentUser.botConfig.geminiConnected));
    }
    if (currentUser.phoneNumber) {
      setPhoneNumber(currentUser.phoneNumber);
    }
    if (currentUser.botConfig?.triggerFiles && selectedBotScope === currentUser.id) {
      setTriggerFiles(currentUser.botConfig.triggerFiles);
    }
  }, [currentUser, selectedBotScope]);

  // Load trigger files whenever selectedBotScope changes
  useEffect(() => {
    fetch(`/api/bot/trigger-files?userId=${selectedBotScope}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.triggerFiles)) {
          setTriggerFiles(data.triggerFiles);
        }
      })
      .catch((err) => console.warn("Failed to fetch trigger files:", err));
  }, [selectedBotScope]);

  // File selection handler
  const handleSelectTriggerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setTriggerFileUploadError("File exceeds 25MB limit. Please select a smaller file.");
      return;
    }

    setTriggerFileUploadError("");
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setSelectedUploadFile({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || "application/octet-stream",
        fileData: result,
      });

      // Auto-suggest trigger phrase if empty
      if (!newFileTriggerPhrase) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
        setNewFileTriggerPhrase(`!${cleanName || "file"}`);
      }
    };
    reader.readAsDataURL(file);
  };

  // Upload trigger file handler
  const handleUploadTriggerFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUploadFile) {
      setTriggerFileUploadError("Please select or drop a file to upload.");
      return;
    }
    if (!newFileTriggerPhrase.trim()) {
      setTriggerFileUploadError("Please specify the special message/phrase that triggers this file.");
      return;
    }

    setIsUploadingTriggerFile(true);
    setTriggerFileUploadError("");
    setTriggerFileUploadSuccess("");

    try {
      const res = await fetch("/api/bot/upload-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedBotScope,
          triggerPhrase: newFileTriggerPhrase.trim(),
          matchType: newFileMatchType,
          caption: newFileCaption.trim() || undefined,
          fileName: selectedUploadFile.fileName,
          fileType: selectedUploadFile.fileType,
          fileSize: selectedUploadFile.fileSize,
          fileData: selectedUploadFile.fileData,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload file to chatbot");
      }

      setTriggerFiles(data.triggerFiles || []);
      setTriggerFileUploadSuccess(
        `File '${selectedUploadFile.fileName}' ready! When users type '${newFileTriggerPhrase.trim()}', this file will be sent.`
      );

      // Update currentUser botConfig if uploading to self
      if (selectedBotScope === currentUser.id) {
        const updatedUser: User = {
          ...currentUser,
          botConfig: {
            ...currentUser.botConfig,
            triggerFiles: data.triggerFiles,
          } as UserBotConfig,
        };
        if (onUpdateCurrentUser) onUpdateCurrentUser(updatedUser);
      }

      // Reset form
      setSelectedUploadFile(null);
      setNewFileTriggerPhrase("");
      setNewFileCaption("");
      if (triggerFileInputRef.current) {
        triggerFileInputRef.current.value = "";
      }

      setTimeout(() => setTriggerFileUploadSuccess(""), 4500);
    } catch (err: any) {
      setTriggerFileUploadError(err?.message || "Failed to upload trigger file.");
    } finally {
      setIsUploadingTriggerFile(false);
    }
  };

  // Delete trigger file handler
  const handleDeleteTriggerFile = async (fileId: string) => {
    try {
      const res = await fetch(`/api/bot/trigger-files/${fileId}?userId=${selectedBotScope}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.triggerFiles) {
        setTriggerFiles(data.triggerFiles);
        if (selectedBotScope === currentUser.id && currentUser.botConfig) {
          const updatedUser: User = {
            ...currentUser,
            botConfig: {
              ...currentUser.botConfig,
              triggerFiles: data.triggerFiles,
            } as UserBotConfig,
          };
          if (onUpdateCurrentUser) onUpdateCurrentUser(updatedUser);
        }
      }
    } catch (err) {
      console.error("Failed to delete trigger file:", err);
    }
  };

  // Test special message trigger live
  const handleTestTriggerMessage = async () => {
    if (!testTriggerInput.trim()) return;
    setIsTestingTrigger(true);
    setTestTriggerResult(null);

    try {
      const res = await fetch("/api/bot/trigger-files/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedBotScope,
          message: testTriggerInput.trim(),
        }),
      });
      const data = await res.json();
      setTestTriggerResult(data);
    } catch (err: any) {
      setTestTriggerResult({
        matched: false,
        message: "Failed to test trigger matching: " + err?.message,
      });
    } finally {
      setIsTestingTrigger(false);
    }
  };

  // Fetch blocked users when privacy tab is selected
  useEffect(() => {
    if (activeTab === "privacy") {
      setLoadingBlocked(true);
      fetch(`/api/users/blocked?userId=${currentUser.id}`)
        .then((res) => (res.ok ? res.json() : { blockedUsers: [] }))
        .then((data) => setBlockedUsers(data.blockedUsers || []))
        .catch((err) => console.warn("Failed to fetch blocked users:", err))
        .finally(() => setLoadingBlocked(false));
    }
  }, [activeTab, currentUser.id]);

  // 1. Submit Chatbot Access Request to Super Admin
  const handleRequestBotAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestError("");
    setRequestSuccess("");

    if (!phoneNumber.trim()) {
      setRequestError("Please enter your phone number to submit the chatbot request.");
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const res = await fetch("/api/bot/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          phoneNumber: phoneNumber.trim(),
          notes: requestNotes.trim() || "User requested AI chatbot access.",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit access request");
      }

      setBotAccessStatus("requested");
      setRequestSuccess(
        "Your request has been submitted to Super Admin. You will be notified once approved!"
      );
      if (data.user && onUpdateCurrentUser) {
        onUpdateCurrentUser(data.user);
      }
    } catch (err: any) {
      setRequestError(err?.message || "Failed to submit request.");
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // 2. Connect Chatbot to Gemini with Phone Number
  const handleConnectGemini = async () => {
    setGeminiConnectError("");
    setGeminiConnectSuccess("");

    if (!phoneNumber.trim()) {
      setGeminiConnectError("Please enter your phone number before connecting to Gemini AI.");
      return;
    }

    setIsConnectingGemini(true);
    try {
      const res = await fetch("/api/bot/connect-gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          phoneNumber: phoneNumber.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to connect chatbot to Gemini AI");
      }

      setGeminiConnected(true);
      setGeminiConnectSuccess(
        "Chatbot connected to Google Gemini AI successfully! Responses will now be wise, contextual, and intelligent."
      );
      if (data.user && onUpdateCurrentUser) {
        onUpdateCurrentUser(data.user);
      }
    } catch (err: any) {
      setGeminiConnectError(err?.message || "Failed to connect to Gemini.");
    } finally {
      setIsConnectingGemini(false);
    }
  };

  // 3. AI Generates Questions based on Foundational Training Prompt
  const handleGenerateTrainingQuestions = async () => {
    if (!trainingPrompt.trim()) {
      setBotError("Please enter your Foundational Training Prompt first so the AI can formulate relevant questions.");
      return;
    }

    setBotError("");
    setIsGeneratingQuestions(true);
    try {
      const res = await fetch("/api/bot/generate-training-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          trainingPrompt: trainingPrompt.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate training questions");
      }

      if (Array.isArray(data.questions) && data.questions.length > 0) {
        setGeneratedQuestions(data.questions);
        setAnsweringQuestionIndex(0);
        setAnsweringQuestionText("");
      }
    } catch (err: any) {
      setBotError(err?.message || "Failed to generate questions.");
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  // Save answer to generated question into verified Q&A knowledge base
  const handleSaveAnswerToQuestion = (qText: string) => {
    if (!answeringQuestionText.trim()) return;

    const newQA: BotTrainingQA = {
      id: "qa_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      question: qText.trim(),
      answer: answeringQuestionText.trim(),
    };

    setQaTraining((prev) => [...prev, newQA]);
    setAnsweringQuestionText("");

    // Advance to next generated question if available
    if (answeringQuestionIndex !== null && answeringQuestionIndex < generatedQuestions.length - 1) {
      setAnsweringQuestionIndex(answeringQuestionIndex + 1);
    } else {
      setAnsweringQuestionIndex(null);
    }
  };

  // Add custom Q&A
  const handleAddCustomQA = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) return;

    const newQA: BotTrainingQA = {
      id: "qa_" + Date.now(),
      question: newQuestion.trim(),
      answer: newAnswer.trim(),
    };

    setQaTraining((prev) => [...prev, newQA]);
    setNewQuestion("");
    setNewAnswer("");
  };

  const handleRemoveQA = (id: string) => {
    setQaTraining((prev) => prev.filter((qa) => qa.id !== id));
  };

  // 4. Quick Master Switch to Turn ON or Turn OFF AI Chatbot immediately
  const handleToggleBotPower = async (newEnabled: boolean) => {
    if (newEnabled && !isBotApproved) {
      setBotError("Only Super Admin approved users can enable the chatbot. Please submit an access request below.");
      return;
    }

    setTogglingBotPower(true);
    setBotError("");
    setBotSuccess(false);
    setBotSuccessMsg("");

    // Optimistically update local switch
    setBotEnabled(newEnabled);

    try {
      const res = await fetch("/api/bot/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          enabled: newEnabled,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to toggle AI chatbot status");
      }

      const updatedUser: User = {
        ...currentUser,
        botConfig: data.botConfig || {
          ...(currentUser.botConfig || {}),
          enabled: newEnabled,
        },
      };

      if (onUpdateCurrentUser) {
        onUpdateCurrentUser(updatedUser);
      }

      try {
        localStorage.setItem("z_user_session", JSON.stringify(updatedUser));
      } catch (err) {}

      setBotSuccess(true);
      setBotSuccessMsg(
        newEnabled
          ? "AI Chatbot turned ON! It is now actively responding to visitors and incoming messages."
          : "AI Chatbot turned OFF! Automated auto-responses are now paused."
      );
    } catch (err: any) {
      // Revert optimistic state on failure
      setBotEnabled(!newEnabled);
      setBotError(err?.message || "Failed to toggle chatbot power status");
    } finally {
      setTogglingBotPower(false);
    }
  };

  // 5. Save Overall Bot Configuration
  const handleSaveBotConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setBotError("");
    setSavingBot(true);
    setBotSuccess(false);
    setBotSuccessMsg("");

    if (botEnabled && !isBotApproved) {
      setBotError("Only Super Admin approved users can enable the chatbot. Please request access above.");
      setSavingBot(false);
      return;
    }

    try {
      const botConfig: UserBotConfig = {
        enabled: isBotApproved ? botEnabled : false,
        triggerPhrase: triggerPhrase.trim() || "!bot",
        triggerMode,
        trainingPrompt: trainingPrompt.trim(),
        instructions: instructions.trim(),
        qaTraining,
        triggerFiles,
        avoidRepetition,
        phoneNumber: phoneNumber.trim(),
        geminiConnected,
        connectedAt: currentUser.botConfig?.connectedAt || Date.now(),
        apiKey: apiKey || currentUser.apiKey,
      };

      const res = await fetch("/api/users/bot-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          botConfig,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save chatbot settings");
      }

      if (data.apiKey) {
        setApiKey(data.apiKey);
      }

      const updatedUser: User = {
        ...currentUser,
        botConfig: data.botConfig,
        apiKey: data.apiKey || apiKey,
        phoneNumber: phoneNumber.trim(),
      };

      if (onUpdateCurrentUser) {
        onUpdateCurrentUser(updatedUser);
      }

      try {
        localStorage.setItem("z_user_session", JSON.stringify(updatedUser));
      } catch (err) {}

      setBotSuccess(true);
      setTimeout(() => setBotSuccess(false), 3000);
    } catch (err: any) {
      setBotError(err?.message || "Failed to save chatbot configuration.");
    } finally {
      setSavingBot(false);
    }
  };

  // 5. Regenerate Website Developer API Key
  const handleRegenerateApiKey = async () => {
    if (!confirm("Are you sure you want to regenerate your Developer API key? Any external applications using the previous key will need to be updated.")) {
      return;
    }

    setIsRegeneratingKey(true);
    try {
      const res = await fetch("/api/user/regenerate-api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to regenerate API key");
      }

      setApiKey(data.apiKey);
      if (data.user && onUpdateCurrentUser) {
        onUpdateCurrentUser(data.user);
      }
    } catch (err: any) {
      alert("Error regenerating API key: " + err?.message);
    } finally {
      setIsRegeneratingKey(false);
    }
  };

  // 6. Test Developer API Query Live
  const handleTestApiCall = async () => {
    if (!testApiMessage.trim()) return;
    setIsTestingApi(true);
    setTestApiResult(null);

    try {
      const keyToUse = apiKey || currentUser.apiKey || "demo_key";
      const res = await fetch("/api/v1/bot/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": keyToUse,
        },
        body: JSON.stringify({
          message: testApiMessage.trim(),
          senderName: "Developer Test Client",
        }),
      });

      const data = await res.json();
      setTestApiResult(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setTestApiResult(JSON.stringify({ error: err?.message || "Failed to reach Developer API" }, null, 2));
    } finally {
      setIsTestingApi(false);
    }
  };

  // Copy helper
  const copyToClipboard = (text: string, snippetId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeSnippet(snippetId);
    setTimeout(() => setCopiedCodeSnippet(null), 2000);
  };

  // Profile save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setSavingProfile(true);
    setProfileSuccess(false);

    try {
      const ok = await onUpdateProfile({
        fullName: fullName.trim(),
        username: username.trim(),
        avatar: avatar.trim(),
        about: about.trim(),
      });

      if (ok) {
        setProfileSuccess(true);
        setTimeout(() => setProfileSuccess(false), 2500);
      } else {
        setProfileError("Failed to update profile. The username might already be taken.");
      }
    } catch (err: any) {
      setProfileError(err?.message || "Failed to save profile changes.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleProfileFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setProfileError("Image file must be smaller than 8MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatar(reader.result);
        setProfileError("");
        setProfileSuccess(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    localStorage.setItem("zmsg_sound_enabled", enabled ? "true" : "false");
    if (enabled) playMessageChime();
  };

  const handleToggleBanners = (enabled: boolean) => {
    setBannersEnabled(enabled);
    localStorage.setItem("zmsg_banners_enabled", enabled ? "true" : "false");
  };

  const handleToggleDesktop = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestNotificationPermission();
      setNotifPermission(granted ? "granted" : "denied");
      setDesktopEnabled(granted);
      localStorage.setItem("zmsg_notifications_enabled", granted ? "true" : "false");
    } else {
      setDesktopEnabled(false);
      localStorage.setItem("zmsg_notifications_enabled", "false");
    }
  };

  const originUrl = typeof window !== "undefined" ? window.location.origin : "https://zmessenger.app";
  const effectiveKey = apiKey || currentUser.apiKey || "YOUR_WEBSITE_API_KEY";

  // Code snippets for whole website developer API
  const curlSnippet = `# Query your trained Gemini Chatbot
curl -X POST "${originUrl}/api/v1/bot/query" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${effectiveKey}" \\
  -d '{"message": "What are your business hours?", "senderName": "Client"}'

# Fetch your contacts
curl -X GET "${originUrl}/api/v1/contacts" \\
  -H "x-api-key: ${effectiveKey}"

# Send a message to any user in Z-Messenger
curl -X POST "${originUrl}/api/v1/messages/send" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${effectiveKey}" \\
  -d '{"recipient": "hashir0047", "content": "Automated update from Developer API"}'`;

  const jsSnippet = `// Send query to your trained Gemini Chatbot
const response = await fetch("${originUrl}/api/v1/bot/query", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "${effectiveKey}"
  },
  body: JSON.stringify({
    message: "What are your pricing packages?",
    senderName: "Website Visitor"
  })
});

const data = await response.json();
console.log("Chatbot intelligent answer:", data.reply);`;

  const pythonSnippet = `import requests

API_KEY = "${effectiveKey}"
BASE_URL = "${originUrl}"

# Query trained Gemini chatbot
res = requests.post(
    f"{BASE_URL}/api/v1/bot/query",
    headers={"x-api-key": API_KEY},
    json={"message": "What are your available consulting slots?", "senderName": "Partner"}
)
print("Bot response:", res.json().get("reply"))

# Fetch messenger contacts
contacts = requests.get(f"{BASE_URL}/api/v1/contacts", headers={"x-api-key": API_KEY}).json()
print("Contacts count:", contacts.get("count"))`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="settings-modal"
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-neutral-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-100 text-orange-600">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">Settings</h2>
              <p className="text-xs text-neutral-500">
                AI Chatbot Training, Developer API Key, Profile, and Controls
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-100 px-5 pt-2 shrink-0 bg-white gap-2 sm:gap-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`pb-2.5 text-xs font-bold transition-all relative cursor-pointer whitespace-nowrap ${
              activeTab === "general"
                ? "text-orange-600 border-b-2 border-orange-500"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            General
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("chatbot")}
            className={`pb-2.5 text-xs font-bold transition-all relative cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "chatbot"
                ? "text-orange-600 border-b-2 border-orange-500"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-orange-500" />
            <span>AI Chatbot</span>
            {botEnabled && isBotApproved && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("developer_api")}
            className={`pb-2.5 text-xs font-bold transition-all relative cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "developer_api"
                ? "text-orange-600 border-b-2 border-orange-500"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Code className="w-3.5 h-3.5 text-indigo-500" />
            <span>Developer API & Key</span>
            <span className="px-1.5 py-0.2 rounded-md bg-indigo-50 text-[10px] text-indigo-600 font-bold">
              v1
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("privacy")}
            className={`pb-2.5 text-xs font-bold transition-all relative cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              activeTab === "privacy"
                ? "text-orange-600 border-b-2 border-orange-500"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-neutral-400" />
            <span>Privacy</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            className={`pb-2.5 text-xs font-bold transition-all relative cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              activeTab === "notifications"
                ? "text-orange-600 border-b-2 border-orange-500"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-orange-500" />
            <span>Notifications</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`pb-2.5 text-xs font-bold transition-all relative cursor-pointer whitespace-nowrap ${
              activeTab === "profile"
                ? "text-orange-600 border-b-2 border-orange-500"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            Profile & About
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* ========================================================================= */}
          {/* 1. GENERAL TAB */}
          {/* ========================================================================= */}
          {activeTab === "general" && (
            <div className="space-y-4">
              {/* User overview mini card */}
              <div className="p-3.5 rounded-xl border border-neutral-200/80 bg-neutral-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.fullName}
                    className="w-11 h-11 rounded-full object-cover border border-neutral-200"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-neutral-900">{currentUser.fullName}</h3>
                      {isSuperadmin && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          Superadmin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500">@{currentUser.username} • {currentUser.email}</p>
                    {phoneNumber && (
                      <p className="text-[11px] text-neutral-600 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-neutral-400" />
                        <span>{phoneNumber}</span>
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("profile")}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-xs font-semibold text-neutral-700 cursor-pointer"
                >
                  Edit Profile
                </button>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Quick Actions</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAddContact();
                    }}
                    className="p-3 rounded-xl border border-neutral-200/80 hover:border-orange-300 hover:bg-orange-50/40 text-left transition-all flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="p-2 rounded-lg bg-orange-100 text-orange-600 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-neutral-800">Add New Contact</p>
                      <p className="text-[11px] text-neutral-500">Search by username or email</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCreateGroup();
                    }}
                    className="p-3 rounded-xl border border-neutral-200/80 hover:border-orange-300 hover:bg-orange-50/40 text-left transition-all flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="p-2 rounded-lg bg-orange-100 text-orange-600 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-neutral-800">Create Group</p>
                      <p className="text-[11px] text-neutral-500">Chat with multiple contacts</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("chatbot")}
                    className="p-3 rounded-xl border border-neutral-200/80 hover:border-orange-300 hover:bg-orange-50/40 text-left transition-all flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="p-2 rounded-lg bg-orange-100 text-orange-600 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-neutral-800">Train AI Chatbot</p>
                      <p className="text-[11px] text-neutral-500">Prompt & Question Answering</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("developer_api")}
                    className="p-3 rounded-xl border border-neutral-200/80 hover:border-indigo-300 hover:bg-indigo-50/40 text-left transition-all flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                      <Code className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-neutral-800">Website Developer API</p>
                      <p className="text-[11px] text-neutral-500">API Key & Documentation</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Superadmin Panel Access */}
              {isSuperadmin && onOpenSuperAdmin && (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-950">Superadmin Control Center</h4>
                      <p className="text-[11px] text-amber-700">
                        Manage all users, review chatbot requests, and monitor system metrics.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSuperAdmin();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    Open Console
                  </button>
                </div>
              )}

              {/* Log out */}
              <div className="pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="w-full p-3 rounded-xl border border-neutral-200 hover:bg-red-50 hover:border-red-200 text-neutral-700 hover:text-red-600 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. AI CHATBOT TAB */}
          {/* ========================================================================= */}
          {activeTab === "chatbot" && (
            <div className="space-y-4">
              {botError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{botError}</span>
                </div>
              )}

              {botSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{botSuccessMsg || "AI Chatbot settings and training updated successfully!"}</span>
                </div>
              )}

              {/* MASTER POWER & STATUS SWITCH (TURN ON / TURN OFF AI CHATBOT) */}
              <div
                id="ai-chatbot-master-power-card"
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  !isBotApproved
                    ? "border-neutral-200 bg-neutral-50/70"
                    : botEnabled
                    ? "border-emerald-300 bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-white shadow-xs"
                    : "border-neutral-300 bg-gradient-to-br from-neutral-50 via-stone-50/50 to-white shadow-xs"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                        !isBotApproved
                          ? "bg-neutral-200 text-neutral-500"
                          : botEnabled
                          ? "bg-emerald-500 text-white shadow-emerald-500/20 shadow-md"
                          : "bg-neutral-200 text-neutral-600"
                      }`}
                    >
                      <Power className={`w-5 h-5 ${botEnabled && isBotApproved ? "animate-pulse" : ""}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-neutral-900">
                          AI Chatbot Power Status
                        </h3>
                        {!isBotApproved ? (
                          <span className="px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700 text-[10px] font-bold uppercase tracking-wider">
                            Super Admin Approval Needed
                          </span>
                        ) : botEnabled ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                            ONLINE & ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-neutral-200 text-neutral-700 text-[11px] font-extrabold">
                            <span className="w-2 h-2 rounded-full bg-neutral-400 inline-block" />
                            TURNED OFF
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">
                        {!isBotApproved
                          ? "You need Super Admin approval before enabling your AI Chatbot auto-responder."
                          : botEnabled
                          ? "Your AI Chatbot is ON and will automatically reply to incoming messages using your trained prompt & Q&A."
                          : "Your AI Chatbot is currently TURNED OFF. Automated replies are paused and disabled."}
                      </p>
                    </div>
                  </div>

                  {/* Big Action Button & Toggle */}
                  {isBotApproved && (
                    <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                      <button
                        id="toggle-chatbot-power-btn"
                        type="button"
                        disabled={togglingBotPower}
                        onClick={() => handleToggleBotPower(!botEnabled)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 ${
                          botEnabled
                            ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                        }`}
                        title={botEnabled ? "Turn OFF AI Chatbot" : "Turn ON AI Chatbot"}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{botEnabled ? "Turn OFF Chatbot" : "Turn ON Chatbot"}</span>
                      </button>

                      {/* iOS-style toggle */}
                      <label className="relative inline-flex items-center cursor-pointer" title={botEnabled ? "Click to Turn OFF" : "Click to Turn ON"}>
                        <input
                          type="checkbox"
                          checked={botEnabled}
                          disabled={togglingBotPower}
                          onChange={(e) => handleToggleBotPower(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 peer-disabled:opacity-40" />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION A: SUPER ADMIN ACCESS CONTROL & PERMISSION */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  isBotApproved
                    ? "border-emerald-200 bg-emerald-50/40"
                    : botAccessStatus === "requested"
                    ? "border-amber-200 bg-amber-50/40"
                    : botAccessStatus === "rejected"
                    ? "border-rose-200 bg-rose-50/40"
                    : "border-neutral-200 bg-neutral-50/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`p-2 rounded-xl mt-0.5 ${
                        isBotApproved
                          ? "bg-emerald-100 text-emerald-700"
                          : botAccessStatus === "requested"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-neutral-200 text-neutral-700"
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-neutral-900">
                          Super Admin Permission Status
                        </h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isBotApproved
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : botAccessStatus === "requested"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : botAccessStatus === "rejected"
                              ? "bg-rose-100 text-rose-800 border border-rose-300"
                              : "bg-neutral-200 text-neutral-700 border border-neutral-300"
                          }`}
                        >
                          {isBotApproved
                            ? isSuperadmin
                              ? "Superadmin (Full Access)"
                              : "Approved by Super Admin"
                            : botAccessStatus === "requested"
                            ? "Pending Super Admin Approval"
                            : botAccessStatus === "rejected"
                            ? "Access Rejected"
                            : "Permission Required"}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-600 mt-1 leading-relaxed">
                        {isBotApproved
                          ? "You have full authorization to train, connect to Gemini, and activate your personal AI Chatbot on Z-Messenger."
                          : "Only Super Admin allowed users can activate the chatbot. Submit a request with your phone number for Super Admin review."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* If Not Approved: Request Access Form */}
                {!isBotApproved && (
                  <form onSubmit={handleRequestBotAccess} className="mt-3 pt-3 border-t border-neutral-200 space-y-2.5">
                    {requestSuccess && (
                      <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{requestSuccess}</span>
                      </div>
                    )}

                    {requestError && (
                      <div className="p-2.5 rounded-lg bg-rose-100 text-rose-800 text-xs font-semibold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{requestError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                          Your Phone Number *
                        </label>
                        <input
                          type="tel"
                          required
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="e.g. +1 555-0192 or 0300-1234567"
                          className="w-full px-3 py-1.5 rounded-xl border border-neutral-200 bg-white text-xs outline-hidden focus:border-orange-500 font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                          Note for Super Admin (Optional)
                        </label>
                        <input
                          type="text"
                          value={requestNotes}
                          onChange={(e) => setRequestNotes(e.target.value)}
                          placeholder="e.g. Requesting access for business inquiry bot"
                          className="w-full px-3 py-1.5 rounded-xl border border-neutral-200 bg-white text-xs outline-hidden focus:border-orange-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-neutral-500">
                        Super Admin will view your phone number and request in the admin panel.
                      </span>
                      <button
                        type="submit"
                        disabled={isSubmittingRequest || !phoneNumber.trim()}
                        className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isSubmittingRequest ? "Sending Request..." : "Request Chatbot Access"}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* SECTION B: ENTER NUMBER & CONNECT CHATBOT TO GEMINI */}
              <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-900">
                        Connect Chatbot to Gemini AI
                      </h4>
                      <p className="text-[11px] text-neutral-500">
                        Enter your contact number and link the chatbot to Google Gemini AI so it responds wisely
                      </p>
                    </div>
                  </div>
                  {geminiConnected ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Gemini Connected
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">
                      Not Connected
                    </span>
                  )}
                </div>

                {geminiConnectSuccess && (
                  <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{geminiConnectSuccess}</span>
                  </div>
                )}

                {geminiConnectError && (
                  <div className="p-2.5 rounded-lg bg-rose-100 text-rose-800 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{geminiConnectError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-neutral-700 mb-1 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Contact Phone Number *</span>
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="e.g. +1 555-0199 or 0300-9876543"
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white text-xs outline-hidden focus:border-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={handleConnectGemini}
                      disabled={isConnectingGemini || !phoneNumber.trim()}
                      className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isConnectingGemini ? "Connecting..." : geminiConnected ? "Reconnect Gemini" : "Connect to Gemini"}</span>
                    </button>
                  </div>
                </div>

                {geminiConnected && (
                  <p className="text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      Gemini is active on your number (<strong>{phoneNumber}</strong>). When contacts chat with you, your chatbot responds intelligently and politely.
                    </span>
                  </p>
                )}
              </div>

              {/* SECTION C: TRAINING PROMPT & QUESTION-ANSWERING FLOW */}
              <div className="p-4 rounded-2xl border border-amber-200/90 bg-amber-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-900">
                        1. Foundational Training Prompt
                      </h4>
                      <p className="text-[11px] text-neutral-600">
                        First, add your training prompt. The AI will formulate targeted questions for you to answer.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                    Step 1: Prompt
                  </span>
                </div>

                {/* Training Prompt Textarea */}
                <div>
                  <textarea
                    rows={4}
                    value={trainingPrompt}
                    onChange={(e) => setTrainingPrompt(e.target.value)}
                    placeholder="Enter your foundational training prompt: Describe your identity, business background, services, operational schedule, pricing, return policy, or how you handle client requests..."
                    className="w-full p-3 rounded-xl border border-amber-200 bg-white text-xs outline-hidden focus:border-amber-500 leading-relaxed resize-none shadow-inner"
                  />
                  <div className="flex items-center justify-between mt-1 text-[10px] text-neutral-500">
                    <span>{trainingPrompt.length} characters</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-neutral-400">Presets:</span>
                      <button
                        type="button"
                        onClick={() =>
                          setTrainingPrompt(
                            "I run a specialized software development agency named CodeCraft. We build mobile apps, web systems, and AI tools. Operating hours: Monday-Friday 9AM-6PM EST. We offer free 30-minute discovery calls, milestone-based billing, and dedicated support. For urgent inquiries, callers can reach our contact phone number."
                          )
                        }
                        className="text-amber-700 hover:underline cursor-pointer"
                      >
                        Software Agency
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() =>
                          setTrainingPrompt(
                            "I am the admissions counselor for Al-Noor Academy. We offer grades K-12 with academic excellence and STEM programs. Tuition is payable in annual or quarterly installments. Admissions open each February and August. Parents must bring previous report cards and birth certificates for the entrance assessment."
                          )
                        }
                        className="text-amber-700 hover:underline cursor-pointer"
                      >
                        School / Academy
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() =>
                          setTrainingPrompt(
                            "I manage an online store selling eco-friendly tech accessories. We ship worldwide with free delivery over $50. Returns are accepted within 30 days of receipt in original packaging. Wholesale pricing is available for orders above 50 units."
                          )
                        }
                        className="text-amber-700 hover:underline cursor-pointer"
                      >
                        Online Store
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action to Generate Smart Questions */}
                <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-amber-900 font-medium">
                    Step 2: Have the bot ask you questions to complete its training.
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateTrainingQuestions}
                    disabled={isGeneratingQuestions || !trainingPrompt.trim()}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isGeneratingQuestions ? "Formulating Questions..." : "Ask Me Questions to Train Bot"}</span>
                  </button>
                </div>

                {/* Active Questions Asked by the Bot */}
                {generatedQuestions.length > 0 && (
                  <div className="p-3.5 rounded-xl border border-amber-300 bg-white space-y-3 mt-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Bot className="w-4 h-4 text-amber-600" />
                        <h5 className="text-xs font-bold text-neutral-900">
                          Questions from Chatbot ({generatedQuestions.length} Formulated)
                        </h5>
                      </div>
                      <span className="text-[10px] text-neutral-400">Click any question to answer</span>
                    </div>

                    <div className="space-y-2">
                      {generatedQuestions.map((q, idx) => {
                        const isAnswering = answeringQuestionIndex === idx;
                        const alreadyAnswered = qaTraining.some(
                          (item) => item.question.toLowerCase().trim() === q.toLowerCase().trim()
                        );

                        return (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-xl border transition-all ${
                              isAnswering
                                ? "border-amber-500 bg-amber-50/50"
                                : alreadyAnswered
                                ? "border-emerald-200 bg-emerald-50/30"
                                : "border-neutral-200 bg-neutral-50/60 hover:bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-bold text-neutral-800 flex items-center gap-2">
                                <span
                                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                    alreadyAnswered
                                      ? "bg-emerald-200 text-emerald-800"
                                      : "bg-amber-200 text-amber-800"
                                  }`}
                                >
                                  {alreadyAnswered ? "✓" : idx + 1}
                                </span>
                                <span>{q}</span>
                              </p>

                              <button
                                type="button"
                                onClick={() => {
                                  setAnsweringQuestionIndex(isAnswering ? null : idx);
                                  setAnsweringQuestionText("");
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer shrink-0 ${
                                  alreadyAnswered
                                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                    : "bg-amber-600 text-white hover:bg-amber-700"
                                }`}
                              >
                                {alreadyAnswered ? "Answered ✓ (Edit)" : isAnswering ? "Cancel" : "Answer Question"}
                              </button>
                            </div>

                            {isAnswering && (
                              <div className="mt-2 pt-2 border-t border-amber-200 space-y-2">
                                <label className="block text-[10px] font-bold text-neutral-600">
                                  Your Verified Answer for the Chatbot:
                                </label>
                                <textarea
                                  rows={2}
                                  value={answeringQuestionText}
                                  onChange={(e) => setAnsweringQuestionText(e.target.value)}
                                  placeholder="Type the official answer you want the chatbot to provide when asked this question..."
                                  className="w-full p-2 rounded-lg border border-amber-200 bg-white text-xs outline-hidden focus:border-amber-500 resize-none"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setAnsweringQuestionIndex(null)}
                                    className="px-2.5 py-1 rounded-lg text-xs text-neutral-600 hover:bg-neutral-200 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveAnswerToQuestion(q)}
                                    disabled={!answeringQuestionText.trim()}
                                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Save to Bot Knowledge Base</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION D: VERIFIED Q&A KNOWLEDGE BASE */}
              <div className="p-4 rounded-2xl border border-neutral-200 bg-white space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-orange-100 text-orange-600">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-900">
                        Verified Q&A Knowledge Base ({qaTraining.length} Trained)
                      </h4>
                      <p className="text-[11px] text-neutral-500">
                        Exact questions and verified answers used by Gemini when responding to inquiries
                      </p>
                    </div>
                  </div>
                </div>

                {qaTraining.length === 0 ? (
                  <div className="p-5 rounded-xl border border-dashed border-neutral-300 text-center space-y-1.5 bg-neutral-50/50">
                    <p className="text-xs text-neutral-500">
                      No question & answer pairs added yet.
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      Click "Ask Me Questions to Train Bot" above or add a custom question below.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {qaTraining.map((qa, index) => (
                      <div
                        key={qa.id || index}
                        className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs space-y-1 relative group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-neutral-900 text-[11px] flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 text-[10px] flex items-center justify-center font-black shrink-0">
                              Q
                            </span>
                            <span>{qa.question}</span>
                          </p>
                          <button
                            type="button"
                            onClick={() => handleRemoveQA(qa.id)}
                            className="text-neutral-400 hover:text-red-500 p-1 transition-colors cursor-pointer shrink-0"
                            title="Remove Q&A"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[11px] text-neutral-600 pl-5 leading-relaxed bg-white p-1.5 rounded-lg border border-neutral-100">
                          {qa.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Custom Q&A */}
                <form onSubmit={handleAddCustomQA} className="p-3 bg-neutral-50/80 rounded-xl border border-neutral-200 space-y-2">
                  <p className="text-[11px] font-bold text-neutral-700 flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5 text-orange-500" />
                    <span>Add Custom Question & Answer Pair</span>
                  </p>
                  <input
                    type="text"
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    placeholder="e.g. What is your turnaround time or refund policy?"
                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs focus:border-orange-500 outline-hidden"
                  />
                  <textarea
                    rows={2}
                    value={newAnswer}
                    onChange={(e) => setNewAnswer(e.target.value)}
                    placeholder="e.g. Turnaround is 2 business days for standard deliverables..."
                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs focus:border-orange-500 outline-hidden resize-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!newQuestion.trim() || !newAnswer.trim()}
                      className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add to Knowledge Base</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* SECTION E: ACTIVATION & TRIGGER CONFIGURATION */}
              <form onSubmit={handleSaveBotConfig} className="p-4 rounded-2xl border border-neutral-200 bg-white space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900">
                      Enable AI Chatbot Auto-Responder
                    </h4>
                    <p className="text-[11px] text-neutral-500">
                      When enabled, your bot responds to incoming messages automatically
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer" title={botEnabled ? "Click to Turn OFF" : "Click to Turn ON"}>
                    <input
                      type="checkbox"
                      checked={botEnabled}
                      disabled={!isBotApproved || togglingBotPower}
                      onChange={(e) => handleToggleBotPower(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 peer-disabled:opacity-40" />
                  </label>
                </div>

                {!isBotApproved && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    Note: Super Admin approval is required before toggling the bot on. Submit your request above.
                  </p>
                )}

                {/* Trigger Mode */}
                <div>
                  <label className="block text-xs font-bold text-neutral-800 mb-1">
                    Activation Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTriggerMode("always")}
                      className={`p-2.5 rounded-xl border text-xs font-medium text-left transition-all cursor-pointer ${
                        triggerMode === "always"
                          ? "border-orange-500 bg-orange-50/60 text-orange-950 font-bold"
                          : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5 mb-1 text-orange-600" />
                      Always Active (All Messages)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTriggerMode("phrase")}
                      className={`p-2.5 rounded-xl border text-xs font-medium text-left transition-all cursor-pointer ${
                        triggerMode === "phrase"
                          ? "border-orange-500 bg-orange-50/60 text-orange-950 font-bold"
                          : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5 mb-1 text-orange-600" />
                      Keyword / Phrase Trigger
                    </button>
                  </div>
                </div>

                {triggerMode === "phrase" && (
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                      Trigger Keyword / Phrase
                    </label>
                    <input
                      type="text"
                      value={triggerPhrase}
                      onChange={(e) => setTriggerPhrase(e.target.value)}
                      placeholder="e.g. !bot, hello, /help, inquiry"
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs outline-hidden focus:border-orange-500"
                    />
                  </div>
                )}

                {/* CHATBOT TRIGGER FILES SECTION (Upload any file with special message) */}
                <div className="p-4 rounded-2xl border border-amber-300/80 bg-gradient-to-br from-amber-50/50 via-orange-50/30 to-white space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs">
                        <FileUp className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-neutral-900">
                            Chatbot Trigger Files (File On Special Message)
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            {triggerFiles.length} {triggerFiles.length === 1 ? "File" : "Files"} Configured
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-600 mt-0.5">
                          Upload any file to your chatbot with a special message. When a user types that message, the bot automatically sends the file!
                        </p>
                      </div>
                    </div>

                    {isSuperadmin && (
                      <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-amber-200 text-[11px]">
                        <span className="text-neutral-500 font-medium">Configuring:</span>
                        <select
                          value={selectedBotScope}
                          onChange={(e) => setSelectedBotScope(e.target.value)}
                          className="font-bold text-amber-900 bg-transparent outline-hidden cursor-pointer"
                        >
                          <option value={currentUser.id}>My Personal Chatbot (@{currentUser.username})</option>
                          <option value="z_assistant_ai">Z-Assistant AI (Global Bot)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Upload New Trigger File Card */}
                  <div className="p-3.5 rounded-xl border border-amber-200 bg-white space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-neutral-800 flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5 text-amber-600" />
                        <span>Upload File & Set Trigger Message</span>
                      </span>
                      <span className="text-[10px] text-neutral-400">PDF, PNG, JPG, Docs, ZIP, Audio, any format</span>
                    </div>

                    {/* File Picker Area */}
                    <input
                      type="file"
                      ref={triggerFileInputRef}
                      onChange={handleSelectTriggerFile}
                      className="hidden"
                    />

                    {selectedUploadFile ? (
                      <div className="p-3 rounded-xl border border-amber-300 bg-amber-50/60 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-2 rounded-lg bg-amber-200 text-amber-900 shrink-0">
                            <File className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-neutral-900 truncate">
                              {selectedUploadFile.fileName}
                            </p>
                            <p className="text-[10px] text-neutral-500">
                              {(selectedUploadFile.fileSize / 1024).toFixed(1)} KB • {selectedUploadFile.fileType || "File"}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUploadFile(null);
                            if (triggerFileInputRef.current) triggerFileInputRef.current.value = "";
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => triggerFileInputRef.current?.click()}
                        className="w-full p-4 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/40 hover:bg-amber-50 text-neutral-600 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Upload className="w-5 h-5 text-amber-600" />
                        <span className="text-xs font-bold text-amber-900">
                          Click to select or upload any file to chatbot
                        </span>
                        <span className="text-[10px] text-neutral-500">
                          Supports all file types (PDF, manual, image, spreadsheet, video, etc.) up to 25MB
                        </span>
                      </button>
                    )}

                    {/* Trigger Phrase and Matching Mode */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                          Special Message / Trigger Phrase *
                        </label>
                        <input
                          type="text"
                          value={newFileTriggerPhrase}
                          onChange={(e) => setNewFileTriggerPhrase(e.target.value)}
                          placeholder="e.g. !guide, !menu, pricing, catalog, /file"
                          className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs outline-hidden focus:border-amber-500 bg-white"
                        />
                        <p className="text-[10px] text-neutral-400 mt-0.5">
                          When users type this, chatbot will reply with this file
                        </p>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                          Matching Rule
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setNewFileMatchType("contains")}
                            className={`p-2 rounded-xl border text-[11px] font-medium text-center transition-all cursor-pointer ${
                              newFileMatchType === "contains"
                                ? "border-amber-500 bg-amber-50 text-amber-900 font-bold"
                                : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                            }`}
                          >
                            Contains Keyword
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewFileMatchType("exact")}
                            className={`p-2 rounded-xl border text-[11px] font-medium text-center transition-all cursor-pointer ${
                              newFileMatchType === "exact"
                                ? "border-amber-500 bg-amber-50 text-amber-900 font-bold"
                                : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                            }`}
                          >
                            Exact Message
                          </button>
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-0.5">
                          {newFileMatchType === "contains"
                            ? "Triggers if message contains the phrase anywhere"
                            : "Triggers only if message matches exactly"}
                        </p>
                      </div>
                    </div>

                    {/* Optional Caption */}
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                        Optional Introductory Message / Caption
                      </label>
                      <input
                        type="text"
                        value={newFileCaption}
                        onChange={(e) => setNewFileCaption(e.target.value)}
                        placeholder="e.g. Here is the official document you requested! Feel free to ask any questions."
                        className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs outline-hidden focus:border-amber-500 bg-white"
                      />
                    </div>

                    {/* Status feedback */}
                    {triggerFileUploadError && (
                      <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{triggerFileUploadError}</span>
                      </div>
                    )}

                    {triggerFileUploadSuccess && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span>{triggerFileUploadSuccess}</span>
                      </div>
                    )}

                    {/* Submit Button */}
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={handleUploadTriggerFile}
                        disabled={isUploadingTriggerFile || !selectedUploadFile || !newFileTriggerPhrase.trim()}
                        className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isUploadingTriggerFile ? "Uploading File..." : "Save File with Special Message"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Active Trigger Files List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-amber-600" />
                        <span>Stored Trigger Files ({triggerFiles.length})</span>
                      </h5>
                      <span className="text-[10px] text-neutral-400">
                        Type any trigger in chat to receive the file
                      </span>
                    </div>

                    {triggerFiles.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-neutral-200 bg-white text-center text-xs text-neutral-500">
                        No files configured yet. Upload a file above and specify a special message like <code className="bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-mono">!guide</code> or <code className="bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-mono">!menu</code>.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {triggerFiles.map((tf) => (
                          <div
                            key={tf.id}
                            className="p-3 rounded-xl border border-neutral-200 bg-white hover:border-amber-300 transition-all flex items-center justify-between gap-3 shadow-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="p-2 rounded-lg bg-orange-100 text-orange-700 shrink-0">
                                <File className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-xs font-bold text-neutral-900 truncate">
                                    {tf.fileName}
                                  </p>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    Trigger: "{tf.triggerPhrase}"
                                  </span>
                                  <span className="text-[10px] text-neutral-400">
                                    ({tf.matchType === "exact" ? "exact match" : "contains phrase"})
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-neutral-500 mt-0.5">
                                  <span>{(tf.fileSize / 1024).toFixed(1)} KB</span>
                                  {tf.caption && (
                                    <>
                                      <span>•</span>
                                      <span className="truncate italic">"{tf.caption}"</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <a
                                href={tf.fileUrl}
                                download={tf.fileName}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg text-neutral-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                                title="Download / Preview file"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                              <button
                                type="button"
                                onClick={() => handleDeleteTriggerFile(tf.id)}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                title="Delete trigger file"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Interactive Live Trigger Tester Sandbox */}
                  <div className="p-3 rounded-xl border border-neutral-200 bg-neutral-50/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-neutral-700 flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-neutral-500" />
                        <span>Test Special Message Trigger in Real Time</span>
                      </span>
                      <span className="text-[10px] text-neutral-400">Sandbox simulator</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={testTriggerInput}
                        onChange={(e) => setTestTriggerInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleTestTriggerMessage();
                          }
                        }}
                        placeholder="Type any test message (e.g. '!guide' or 'can you send !shortcuts?')"
                        className="flex-1 px-3 py-1.5 rounded-xl border border-neutral-200 bg-white text-xs outline-hidden focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={handleTestTriggerMessage}
                        disabled={isTestingTrigger || !testTriggerInput.trim()}
                        className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-900 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1 shrink-0"
                      >
                        <Play className="w-3 h-3" />
                        <span>{isTestingTrigger ? "Testing..." : "Test Message"}</span>
                      </button>
                    </div>

                    {testTriggerResult && (
                      <div
                        className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                          testTriggerResult.matched
                            ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                            : "bg-amber-50 border-amber-200 text-amber-800"
                        }`}
                      >
                        {testTriggerResult.matched ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="font-bold">{testTriggerResult.message}</p>
                          {testTriggerResult.file && (
                            <div className="mt-1 flex items-center gap-2 text-[11px] opacity-90">
                              <span>Delivers: <strong>{testTriggerResult.file.fileName}</strong></span>
                              <span>•</span>
                              <a
                                href={testTriggerResult.file.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="underline font-bold hover:text-emerald-700"
                              >
                                View / Download Stored File
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Custom Personality Guidelines */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Custom Persona & Operational Instructions</span>
                  </label>
                  <textarea
                    rows={2}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Instructions on tone, etiquette, greeting style, or special notices..."
                    className="w-full p-2.5 rounded-xl border border-neutral-200 text-xs outline-hidden focus:border-orange-500 leading-relaxed resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                  <button
                    type="submit"
                    disabled={savingBot}
                    className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-60 flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>{savingBot ? "Saving Settings..." : "Save Chatbot Settings"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. DEVELOPER API & KEY TAB */}
          {/* ========================================================================= */}
          {activeTab === "developer_api" && (
            <div className="space-y-4">
              {/* API Key Card */}
              <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-900">
                        Whole Website Developer API Key
                      </h4>
                      <p className="text-[11px] text-neutral-500">
                        Authenticate programmatic requests to interact with Z-Messenger and your AI Chatbot
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                    Live API Active
                  </span>
                </div>

                {/* Key Display */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      readOnly
                      value={apiKey || "Generating API Key..."}
                      className="w-full px-3 py-2 pr-10 rounded-xl border border-neutral-200 bg-white font-mono text-xs text-neutral-800 outline-hidden select-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                      title={showApiKey ? "Hide key" : "Show key"}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (apiKey) {
                        navigator.clipboard.writeText(apiKey);
                        setCopiedApiKey(true);
                        setTimeout(() => setCopiedApiKey(false), 2000);
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    {copiedApiKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedApiKey ? "Copied!" : "Copy Key"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRegenerateApiKey}
                    disabled={isRegeneratingKey}
                    className="p-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-600 text-xs font-bold cursor-pointer transition-colors shrink-0"
                    title="Regenerate Key"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRegeneratingKey ? "animate-spin" : ""}`} />
                  </button>
                </div>

                <p className="text-[11px] text-neutral-500">
                  Header usage: <code className="text-indigo-600 font-mono bg-indigo-50 px-1 py-0.5 rounded">x-api-key: {effectiveKey.slice(0, 16)}...</code> or Bearer token authorization.
                </p>
              </div>

              {/* Endpoints Table */}
              <div className="p-4 rounded-2xl border border-neutral-200 bg-white space-y-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-neutral-700" />
                  <h4 className="text-xs font-bold text-neutral-900">
                    Whole Website API Endpoints
                  </h4>
                </div>

                <div className="space-y-2">
                  {[
                    {
                      method: "POST",
                      path: "/api/v1/bot/query",
                      desc: "Directly query your trained Gemini chatbot and get intelligent responses",
                      payload: '{"message": "What are your services?", "senderName": "Client"}',
                    },
                    {
                      method: "GET",
                      path: "/api/v1/bot/status",
                      desc: "Get your AI Chatbot status, phone number, and trained Q&A count",
                    },
                    {
                      method: "POST",
                      path: "/api/v1/bot/train",
                      desc: "Update your chatbot training prompt or knowledge base programmatically",
                      payload: '{"trainingPrompt": "...", "qaPairs": [...]}',
                    },
                    {
                      method: "GET",
                      path: "/api/v1/profile",
                      desc: "Fetch authenticated user profile details, role, and permissions",
                    },
                    {
                      method: "GET",
                      path: "/api/v1/contacts",
                      desc: "List all contacts and conversations associated with your account",
                    },
                    {
                      method: "POST",
                      path: "/api/v1/messages/send",
                      desc: "Send a message to any username in Z-Messenger on your behalf",
                      payload: '{"recipient": "username", "content": "Hello!"}',
                    },
                  ].map((ep, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl border border-neutral-100 bg-neutral-50/70 text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            ep.method === "GET"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {ep.method}
                        </span>
                        <code className="font-mono text-neutral-800 font-bold">{ep.path}</code>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-1">{ep.desc}</p>
                      {ep.payload && (
                        <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                          Payload: {ep.payload}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Code Examples */}
              <div className="p-4 rounded-2xl border border-neutral-200 bg-neutral-900 text-neutral-100 space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-neutral-200">Developer Code Snippets</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveCodeTab("curl")}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                        activeCodeTab === "curl" ? "bg-emerald-500/20 text-emerald-400" : "text-neutral-400"
                      }`}
                    >
                      cURL
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCodeTab("javascript")}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                        activeCodeTab === "javascript" ? "bg-emerald-500/20 text-emerald-400" : "text-neutral-400"
                      }`}
                    >
                      JavaScript
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCodeTab("python")}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                        activeCodeTab === "python" ? "bg-emerald-500/20 text-emerald-400" : "text-neutral-400"
                      }`}
                    >
                      Python
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <pre className="p-3 bg-neutral-950 rounded-xl font-mono text-[11px] text-emerald-300 overflow-x-auto leading-relaxed border border-neutral-800/80">
                    {activeCodeTab === "curl"
                      ? curlSnippet
                      : activeCodeTab === "javascript"
                      ? jsSnippet
                      : pythonSnippet}
                  </pre>
                  <button
                    type="button"
                    onClick={() => {
                      const text =
                        activeCodeTab === "curl"
                          ? curlSnippet
                          : activeCodeTab === "javascript"
                          ? jsSnippet
                          : pythonSnippet;
                      copyToClipboard(text, activeCodeTab);
                    }}
                    className="absolute right-3 top-3 px-2 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-white text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                  >
                    {copiedCodeSnippet === activeCodeTab ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCodeSnippet === activeCodeTab ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
              </div>

              {/* Live Test Sandbox */}
              <div className="p-4 rounded-2xl border border-neutral-200 bg-white space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold text-neutral-900">
                      Live Developer API Query Test
                    </h4>
                  </div>
                  <span className="text-[10px] text-neutral-400">Tests POST /api/v1/bot/query</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testApiMessage}
                    onChange={(e) => setTestApiMessage(e.target.value)}
                    placeholder="Enter a message to query your Gemini chatbot via API..."
                    className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs outline-hidden focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleTestApiCall}
                    disabled={isTestingApi || !testApiMessage.trim()}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{isTestingApi ? "Testing..." : "Send Request"}</span>
                  </button>
                </div>

                {testApiResult && (
                  <div className="p-3 rounded-xl bg-neutral-900 text-neutral-100 font-mono text-[11px] overflow-x-auto space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-neutral-400 border-b border-neutral-800 pb-1">
                      <span>API Response:</span>
                      <span className="text-emerald-400 font-bold">200 OK</span>
                    </div>
                    <pre className="text-emerald-300 whitespace-pre-wrap">{testApiResult}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. PRIVACY TAB */}
          {/* ========================================================================= */}
          {activeTab === "privacy" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-neutral-900 mb-1">Blocked Accounts</h4>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Blocked accounts cannot send you direct messages or interact with you.
                </p>
              </div>

              {loadingBlocked ? (
                <div className="p-8 text-center text-xs text-neutral-400">Loading blocked accounts...</div>
              ) : blockedUsers.length === 0 ? (
                <div className="p-8 border border-neutral-200 rounded-2xl bg-neutral-50/50 flex flex-col items-center justify-center text-center">
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-400 flex items-center justify-center mb-2">
                    <Shield className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-neutral-700">No Blocked Accounts</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    When you block someone, they will appear here and you can unblock them anytime.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {blockedUsers.map((u) => (
                    <div
                      key={u.id}
                      className="p-3 rounded-xl border border-neutral-200 bg-white flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={u.avatar}
                          alt={u.fullName}
                          className="w-9 h-9 rounded-full object-cover border border-neutral-200"
                        />
                        <div>
                          <p className="text-xs font-bold text-neutral-800">{u.fullName}</p>
                          <p className="text-[11px] text-neutral-400">@{u.username}</p>
                        </div>
                      </div>
                      {onUnblockUser && (
                        <button
                          type="button"
                          onClick={() => {
                            onUnblockUser(u.id);
                            setBlockedUsers((prev) => prev.filter((b) => b.id !== u.id));
                          }}
                          className="px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-xs font-semibold text-neutral-700 cursor-pointer"
                        >
                          Unblock
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 5. NOTIFICATIONS TAB */}
          {/* ========================================================================= */}
          {activeTab === "notifications" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-neutral-200 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                      {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-800">Sound Notifications</h4>
                      <p className="text-[11px] text-neutral-500">Play pleasant audio chime when receiving messages</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={(e) => handleToggleSound(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" />
                  </label>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-neutral-200 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-800">In-App Banner Banners</h4>
                      <p className="text-[11px] text-neutral-500">Show notification popup when active on screen</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bannersEnabled}
                      onChange={(e) => handleToggleBanners(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" />
                  </label>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-neutral-200 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-800">Desktop & Device Alerts</h4>
                      <p className="text-[11px] text-neutral-500">
                        Receive OS level alerts even when browser is minimized
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={desktopEnabled}
                      onChange={(e) => handleToggleDesktop(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 6. PROFILE & ABOUT TAB */}
          {/* ========================================================================= */}
          {activeTab === "profile" && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {profileSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Profile updated successfully!</span>
                </div>
              )}

              {profileError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              {/* Avatar Selector */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-2">Profile Avatar</label>
                <div className="flex items-center gap-4">
                  <img
                    src={avatar}
                    alt="Current Avatar"
                    className="w-16 h-16 rounded-full object-cover border-2 border-orange-400 shadow-xs"
                  />
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => profileFileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-xs font-bold text-neutral-700 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Upload Photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowProfileUrlInput(!showProfileUrlInput)}
                        className="px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-xs font-semibold text-neutral-600 cursor-pointer"
                      >
                        Image URL
                      </button>
                    </div>
                    <input
                      ref={profileFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleProfileFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>

                {showProfileUrlInput && (
                  <div className="mt-2.5">
                    <input
                      type="url"
                      value={avatar}
                      onChange={(e) => setAvatar(e.target.value)}
                      placeholder="Paste image URL..."
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs outline-hidden focus:border-orange-500"
                    />
                  </div>
                )}

                {/* Preset Avatars */}
                <div className="mt-3">
                  <span className="text-[11px] text-neutral-400 font-semibold block mb-1.5">Preset Avatars</span>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {PRESET_PROFILE_AVATARS.map((pUrl, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setAvatar(pUrl)}
                        className={`w-9 h-9 rounded-full overflow-hidden border-2 transition-transform cursor-pointer shrink-0 ${
                          avatar === pUrl ? "border-orange-500 scale-105" : "border-neutral-200 hover:scale-105"
                        }`}
                      >
                        <img src={pUrl} alt={`Preset ${i}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Name & Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs outline-hidden focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs outline-hidden focus:border-orange-500 font-mono"
                  />
                </div>
              </div>

              {/* About Status */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">About Status</label>
                <input
                  type="text"
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="e.g. Available, At work, Busy..."
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs outline-hidden focus:border-orange-500"
                />
              </div>

              <div className="flex justify-end pt-2 border-t border-neutral-100">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{savingProfile ? "Saving..." : "Save Profile"}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
