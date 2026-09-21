export interface BotTrainingQA {
  id: string;
  question: string;
  answer: string;
}

export interface BotTriggerFile {
  id: string;
  triggerPhrase: string; // The special message e.g. "!catalog", "price list", "menu", "download app"
  matchType: "contains" | "exact"; // "contains": fires if user message contains phrase; "exact": fires only if message matches phrase
  fileName: string;
  fileUrl: string; // Stored URL (/uploads/...) or data URL
  fileSize: number;
  fileType: string;
  caption?: string; // Optional accompanying reply text sent with the file
  createdAt: number;
  botOwnerId?: string;
}

export interface ChatbotAccessRequest {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  avatar: string;
  email: string;
  phoneNumber: string;
  notes?: string;
  requestedAt: number;
  status: "pending" | "approved" | "rejected";
  reviewedAt?: number;
  reviewedBy?: string;
}

export interface UserBotConfig {
  enabled: boolean;
  triggerPhrase: string; // e.g. "!bot", "hello", or custom keyword
  triggerMode: "phrase" | "always";
  trainingPrompt?: string; // Core foundational training prompt for the chatbot
  instructions: string; // Custom personality / operational guidelines
  qaTraining?: BotTrainingQA[]; // Trained Question & Answer pairs
  triggerFiles?: BotTriggerFile[]; // Uploaded files that the chatbot automatically sends on special messages
  businessMode?: "general" | "customer_support" | "sales_store" | "custom";
  avoidRepetition?: boolean; // Don't repeat the exact same response
  phoneNumber?: string; // Phone number required to activate
  geminiConnected?: boolean; // True when connected to Gemini AI
  connectedAt?: number; // Timestamp of Gemini connection
  websiteUrl?: string; // Website URL or knowledge base URL
  externalApiUrl?: string; // External API or Webhook URL
  apiKey?: string; // Generated Website & Chatbot API key
}

export interface UserReport {
  id: string;
  reporterId: string;
  reporterName: string;
  reporterUsername: string;
  reportedUserId: string;
  reportedUserName: string;
  reportedUserUsername: string;
  reportedUserAvatar?: string;
  reason: string;
  details?: string;
  timestamp: number;
  status: "pending" | "resolved" | "dismissed";
}

export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatar: string;
  role?: "user" | "superadmin";
  status: "online" | "offline";
  createdAt?: number;
  lastSeen?: number;
  about?: string;
  disabled?: boolean;
  blockedUserIds?: string[];
  botConfig?: UserBotConfig;
  apiKey?: string;
  botAccessStatus?: "none" | "requested" | "approved" | "rejected";
  botAccessRequestedAt?: number;
  botAccessNotes?: string;
  phoneNumber?: string;
}

export interface GroupMember {
  id: string;
  username: string;
  fullName: string;
  avatar: string;
  status: "online" | "offline";
  role?: "admin" | "member";
  about?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  avatar: string;
  creatorId: string;
  memberIds: string[];
  members?: GroupMember[];
  createdAt: number;
  lastMessage?: string;
  lastMessageTime?: number;
  lastMessageSenderName?: string;
  unreadCount?: number;
}

export interface Contact {
  id: string;
  username: string;
  fullName: string;
  avatar: string;
  status: "online" | "offline";
  lastSeen?: number;
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount?: number;
  isGroup?: boolean;
  groupData?: Group;
  about?: string;
  email?: string;
  createdAt?: number;
  isBlocked?: boolean;
  isAiAssistant?: boolean;
  botConfig?: UserBotConfig;
  triggerFiles?: BotTriggerFile[];
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatar: string;
  role: "user" | "superadmin";
  status: "online" | "offline";
  createdAt: number;
  lastSeen: number;
  contactsCount?: number;
  messagesCount?: number;
  password?: string;
  disabled?: boolean;
  about?: string;
  blockedUserIds?: string[];
  botConfig?: UserBotConfig;
  apiKey?: string;
  botAccessStatus?: "none" | "requested" | "approved" | "rejected";
  botAccessRequestedAt?: number;
  botAccessNotes?: string;
  phoneNumber?: string;
}

export interface Story {
  id: string;
  userId: string;
  userFullName: string;
  userUsername: string;
  userAvatar: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption?: string;
  createdAt: number;
  expiresAt: number;
  restrictedUserIds: string[];
  viewers: string[];
}

export type MessageType = "text" | "voice" | "video" | "file" | "location";

export interface MessageMetadata {
  duration?: number;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  thumbnail?: string;
  isAiAutoReply?: boolean;
  sentViaApi?: boolean;
  triggerMatched?: string;
  caption?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  type: MessageType;
  content: string;
  metadata?: MessageMetadata;
  timestamp: number;
  read: boolean;
  isGroup?: boolean;
  groupId?: string;
  senderName?: string;
  senderAvatar?: string;
  senderUsername?: string;
  reactions?: Record<string, string[]>;
  deletedFor?: string[];
  isDeletedForEveryone?: boolean;
  isForwarded?: boolean;
}

export interface TypingUser {
  userId: string;
  username?: string;
  fullName?: string;
  timestamp: number;
}

