import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import { initializeApp, getApps, getApp } from "firebase/app";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  getDocFromServer,
  setDoc,
  deleteDoc,
  Firestore,
} from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// In-memory data structures for fast real-time operation in container
interface BotTrainingQA {
  id: string;
  question: string;
  answer: string;
}

interface BotTriggerFile {
  id: string;
  triggerPhrase: string; // The special message e.g. "!catalog", "price list", "menu"
  matchType: "contains" | "exact";
  fileName: string;
  fileUrl: string; // /uploads/... or data url
  fileSize: number;
  fileType: string;
  caption?: string; // Optional accompanying reply text
  createdAt: number;
  botOwnerId?: string;
}

interface ChatbotAccessRequest {
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

interface UserRecord {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatar: string;
  password: string;
  role: "user" | "superadmin";
  createdAt: number;
  lastSeen: number;
  status: "online" | "offline";
  about?: string;
  disabled?: boolean;
  blockedUserIds?: string[];
  phoneNumber?: string;
  botAccessStatus?: "none" | "requested" | "approved" | "rejected";
  botAccessRequestedAt?: number;
  botAccessNotes?: string;
  botConfig?: {
    enabled: boolean;
    triggerPhrase: string;
    triggerMode: "phrase" | "always";
    trainingPrompt?: string;
    instructions: string;
    qaTraining?: BotTrainingQA[];
    triggerFiles?: BotTriggerFile[];
    businessMode?: "general" | "customer_support" | "sales_store" | "custom";
    avoidRepetition?: boolean;
    phoneNumber?: string;
    geminiConnected?: boolean;
    connectedAt?: number;
    websiteUrl?: string;
    externalApiUrl?: string;
    apiKey?: string;
  };
  apiKey?: string;
}

interface ReportRecord {
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

interface GroupRecord {
  id: string;
  name: string;
  description?: string;
  avatar: string;
  creatorId: string;
  memberIds: string[];
  createdAt: number;
  lastMessage?: string;
  lastMessageTime?: number;
  lastMessageSenderName?: string;
}

interface MessageRecord {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  type: "text" | "voice" | "video" | "file" | "location";
  content: string;
  metadata?: {
    duration?: number;
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    latitude?: number;
    longitude?: number;
    address?: string;
    thumbnail?: string;
    isAiAutoReply?: boolean;
    isSystemReport?: boolean;
    systemSoftwareName?: string;
    recordTitle?: string;
    dispatchedAt?: number;
    sentViaApi?: boolean;
    caption?: string;
    triggerMatched?: string;
  };
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

interface StoryRecord {
  id: string;
  userId: string;
  userFullName: string;
  userUsername: string;
  userAvatar: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption?: string;
  createdAt: number;
  expiresAt: number; // 24 hours after creation
  restrictedUserIds: string[]; // User IDs restricted from viewing
  viewers: string[]; // User IDs who viewed the story
}

// Databases in memory (backed by Firestore)
const users = new Map<string, UserRecord>(); // key: userId
const userByEmail = new Map<string, string>(); // email.toLowerCase() -> userId
const userByUsername = new Map<string, string>(); // username.toLowerCase() -> userId
const contactsByUser = new Map<string, Set<string>>(); // userId -> Set of contactUserIds
const groups = new Map<string, GroupRecord>(); // key: groupId
const messages: MessageRecord[] = [];
const stories = new Map<string, StoryRecord>(); // key: storyId
const reports = new Map<string, ReportRecord>(); // key: reportId
const botAccessRequests = new Map<string, ChatbotAccessRequest>(); // key: userId


// Initialize Firestore
let firestoreDb: Firestore | null = null;
try {
  const cfgPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(cfgPath)) {
    const rawCfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
    const fbApp = getApps().length > 0 ? getApp() : initializeApp(rawCfg);
    firestoreDb = rawCfg.firestoreDatabaseId
      ? getFirestore(fbApp, rawCfg.firestoreDatabaseId)
      : getFirestore(fbApp);
    console.log("Firebase Firestore initialized with database:", rawCfg.firestoreDatabaseId || "(default)");
  }
} catch (err) {
  console.warn("Firebase Firestore initialization notice:", err);
}

// Firestore Persistence Helpers
function cleanForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj
      .filter((v) => v !== undefined)
      .map((v) => cleanForFirestore(v));
  }
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = cleanForFirestore(val);
    }
  }
  return clean;
}

async function persistUserToFirestore(user: UserRecord, retries = 1) {
  if (!firestoreDb) return;
  try {
    await setDoc(doc(firestoreDb, "users", user.id), cleanForFirestore(user));
  } catch (e: any) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 600));
      return persistUserToFirestore(user, retries - 1);
    }
    console.warn("Firestore persistUser notice:", e?.message || e);
  }
}

async function deleteUserFromFirestore(userId: string) {
  if (!firestoreDb) return;
  try {
    await deleteDoc(doc(firestoreDb, "users", userId));
    await deleteDoc(doc(firestoreDb, "contacts", userId));
  } catch (e: any) {
    console.warn("Firestore deleteUser notice:", e?.message || e);
  }
}

async function persistContactsToFirestore(userId: string, contactIds: string[], retries = 1) {
  if (!firestoreDb) return;
  try {
    await setDoc(doc(firestoreDb, "contacts", userId), cleanForFirestore({ userId, contactIds }));
  } catch (e: any) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 600));
      return persistContactsToFirestore(userId, contactIds, retries - 1);
    }
    console.warn("Firestore persistContacts notice:", e?.message || e);
  }
}

async function persistGroupToFirestore(group: GroupRecord, retries = 1) {
  if (!firestoreDb) return;
  try {
    await setDoc(doc(firestoreDb, "groups", group.id), cleanForFirestore(group));
  } catch (e: any) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 600));
      return persistGroupToFirestore(group, retries - 1);
    }
    console.warn("Firestore persistGroup notice:", e?.message || e);
  }
}

async function deleteGroupFromFirestore(groupId: string) {
  if (!firestoreDb) return;
  try {
    await deleteDoc(doc(firestoreDb, "groups", groupId));
  } catch (e: any) {
    console.warn("Firestore deleteGroup notice:", e?.message || e);
  }
}

async function persistMessageToFirestore(msg: MessageRecord, retries = 1) {
  if (!firestoreDb) return;
  try {
    const rawJson = JSON.stringify(msg);
    const sizeBytes = Buffer.byteLength(rawJson, "utf8");
    if (sizeBytes > 900000) {
      console.warn(`Message ${msg.id} size (${sizeBytes} bytes) exceeds Firestore 1MB limit. Storing compact version.`);
      const compactMsg = {
        ...msg,
        content: msg.type === "text" ? msg.content.substring(0, 500) : "[File attached]",
      };
      await setDoc(doc(firestoreDb, "messages", msg.id), cleanForFirestore(compactMsg));
      return;
    }
    await setDoc(doc(firestoreDb, "messages", msg.id), cleanForFirestore(msg));
  } catch (e: any) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 600));
      return persistMessageToFirestore(msg, retries - 1);
    }
    console.warn("Firestore persistMessage notice:", e?.message || e);
  }
}

async function persistStoryToFirestore(story: StoryRecord, retries = 1) {
  if (!firestoreDb) return;
  try {
    const rawJson = JSON.stringify(story);
    const sizeBytes = Buffer.byteLength(rawJson, "utf8");
    if (sizeBytes > 900000) {
      console.warn(`Story ${story.id} size (${sizeBytes} bytes) exceeds Firestore 1MB limit. Storing compact version.`);
      const compactStory = {
        ...story,
        mediaUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
        caption: (story.caption ? story.caption + " " : "") + "[Media stored in active session]",
      };
      await setDoc(doc(firestoreDb, "stories", story.id), cleanForFirestore(compactStory));
      return;
    }
    await setDoc(doc(firestoreDb, "stories", story.id), cleanForFirestore(story));
  } catch (e: any) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 600));
      return persistStoryToFirestore(story, retries - 1);
    }
    console.warn("Firestore persistStory notice:", e?.message || e);
  }
}

async function persistReportToFirestore(report: ReportRecord, retries = 1) {
  if (!firestoreDb) return;
  try {
    await setDoc(doc(firestoreDb, "reports", report.id), cleanForFirestore(report));
  } catch (e: any) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 600));
      return persistReportToFirestore(report, retries - 1);
    }
    console.warn("Firestore persistReport notice:", e?.message || e);
  }
}

async function persistBotRequestToFirestore(req: ChatbotAccessRequest, retries = 1) {
  if (!firestoreDb) return;
  try {
    await setDoc(doc(firestoreDb, "bot_requests", req.userId), cleanForFirestore(req));
  } catch (e: any) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 600));
      return persistBotRequestToFirestore(req, retries - 1);
    }
    console.warn("Firestore persistBotRequest notice:", e?.message || e);
  }
}

// Gemini AI Client Helper (Server-side only)
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// Candidate models in fallback sequence per gemini-api SKILL
const GEMINI_TEXT_MODELS = [
  "gemini-3.8-flash",       // Primary high-quality model for text tasks
  "gemini-3.1-flash-lite",  // Ultra-fast, high-capacity model designed for low latency & reliability
  "gemini-flash-latest",    // Dynamic pointer to latest stable flash model
];

async function callGeminiWithResilience(params: {
  contents: any;
  systemInstruction?: string;
  temperature?: number;
}): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  const ai = getGemini();

  for (const model of GEMINI_TEXT_MODELS) {
    // Up to 2 attempts per model for transient errors (503 UNAVAILABLE, 429 RESOURCE_EXHAUSTED)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const resp = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: {
            systemInstruction: params.systemInstruction,
            temperature: params.temperature ?? 0.7,
          },
        });

        if (resp && resp.text && resp.text.trim()) {
          return resp.text.trim();
        }
      } catch (err: any) {
        const errString = (err?.message || String(err) || "").toLowerCase();
        const isUnavailableOrHighDemand =
          errString.includes("503") ||
          errString.includes("unavailable") ||
          errString.includes("high demand") ||
          errString.includes("temporary") ||
          errString.includes("overloaded");
        const isRateLimited =
          errString.includes("429") ||
          errString.includes("resource_exhausted") ||
          errString.includes("quota");

        if ((isUnavailableOrHighDemand || isRateLimited) && attempt === 1) {
          // Brief pause before retry attempt
          await new Promise((resolve) => setTimeout(resolve, 350));
          continue;
        }

        console.warn(`[Gemini Info] Model '${model}' transient state: switching to next fallback model...`);
        break; // break inner loop to try next model in GEMINI_TEXT_MODELS
      }
    }
  }

  return null;
}

// Generate intelligent responses for built-in Z-Assistant AI
async function generateZAssistantResponse(
  userPrompt: string,
  history: Array<{ role: string; content: string }>
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return "Hello! I am Z-Assistant AI. To enable full real-time Gemini generation, please ensure your GEMINI_API_KEY is configured in Settings > Secrets.";
  }

  const systemPrompt = `You are Z-Assistant AI, the built-in, friendly, highly intelligent AI assistant in Z-Messenger.
You assist users with answers to any question, programming help, creative ideas, travel tips, translations, problem solving, summarization, and daily advice.
Format your responses cleanly for a mobile/desktop messenger screen using bullet points, bold headers, and concise paragraphs when appropriate.`;

  const contents: any[] = [];
  for (const h of history.slice(-6)) {
    contents.push({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    });
  }
  contents.push({
    role: "user",
    parts: [{ text: userPrompt }],
  });

  const generated = await callGeminiWithResilience({
    contents,
    systemInstruction: systemPrompt,
    temperature: 0.7,
  });

  if (generated) {
    return generated;
  }

  return "Hello! I am currently experiencing high network demand across AI services. Your message has been received! Please feel free to ask me again in just a moment.";
}

// Helper to find a matching file trigger based on special message keyword
function findMatchingTriggerFile(
  triggerFiles: BotTriggerFile[] | undefined,
  incomingContent: string
): BotTriggerFile | null {
  if (!triggerFiles || !Array.isArray(triggerFiles) || triggerFiles.length === 0) return null;
  const clean = (incomingContent || "").trim().toLowerCase();
  if (!clean) return null;

  for (const tf of triggerFiles) {
    const tp = (tf.triggerPhrase || "").trim().toLowerCase();
    if (!tp) continue;
    if (tf.matchType === "exact") {
      if (clean === tp) return tf;
    } else {
      if (clean.includes(tp)) return tf;
    }
  }
  return null;
}

// Generate automated responses for a user's personal AI Chatbot (Auto-Responder)
async function generateUserBotResponse(
  botOwner: UserRecord,
  incomingMessage: string,
  senderName: string,
  recentHistory: Array<{ sender: "user" | "bot"; text: string }> = []
): Promise<string> {
  const botCfg = botOwner.botConfig;
  if (!botCfg || !botCfg.enabled) return "";

  const qaPairs = Array.isArray(botCfg.qaTraining) ? botCfg.qaTraining : [];
  const incomingClean = incomingMessage.trim().toLowerCase();

  // 1. Foundational Training Prompt
  let trainingPromptContext = "";
  if (botCfg.trainingPrompt && botCfg.trainingPrompt.trim()) {
    trainingPromptContext = `
FOUNDATIONAL TRAINING PROMPT (CORE KNOWLEDGE & BUSINESS IDENTITY):
"""
${botCfg.trainingPrompt.trim()}
"""
`;
  }

  // 2. Verified Question & Answer Knowledge Base (Questions asked and answered by owner)
  let qaTrainingContext = "";
  if (qaPairs.length > 0) {
    qaTrainingContext = `
OFFICIALLY VERIFIED QUESTIONS & ANSWERS (TRAINED KNOWLEDGE BASE):
${qaPairs
  .map(
    (qa, idx) =>
      `[Trained Q&A #${idx + 1}]\nQuestion: "${qa.question}"\nVerified Answer: "${qa.answer}"`
  )
  .join("\n\n")}

KNOWLEDGE ADHERENCE DIRECTIVES:
- If the visitor's question matches or relates to any trained Q&A topic above, base your answer strictly on the verified facts and details provided in the answer.
- Ensure accuracy while integrating the answer smoothly and naturally into conversation.
`;
  }

  // 3. Official Contact Phone Number
  const contactPhone = botCfg.phoneNumber || botOwner.phoneNumber || "";
  let phoneContext = "";
  if (contactPhone) {
    phoneContext = `Official Contact Phone Number: ${contactPhone} (Share this when visitors ask for a phone number, call, or urgent direct contact).`;
  }

  // 4. Conversational History & Anti-Repetition
  let historyContext = "";
  if (recentHistory.length > 0) {
    historyContext = `
RECENT MESSAGES IN THIS CONVERSATION:
${recentHistory
  .slice(-6)
  .map((m) => `${m.sender === "bot" ? "Your previous reply" : `${senderName}`}: "${m.text}"`)
  .join("\n")}

CRITICAL CONVERSATIONAL RULES:
- DO NOT repeat identical boilerplate greetings or phrasing from previous messages.
- Respond wisely, thoughtfully, and keep dialog moving forward efficiently.
`;
  }

  let externalContext = "";
  if (botCfg.websiteUrl) {
    externalContext += `\nConnected Website / Documentation URL: ${botCfg.websiteUrl}`;
  }

  const systemPrompt = `You are the automated AI Chatbot representing ${botOwner.fullName} (@${botOwner.username}) on Z-Messenger.
You are powered by Google Gemini to respond wisely, intelligently, courteously, and helpfully to incoming queries.
${phoneContext}
${trainingPromptContext}

Owner's Custom Personality & Operational Guidelines:
"""
${botCfg.instructions || "Be welcoming, polite, intelligent, and informative. Ensure visitors receive clear, helpful guidance."}
"""
${qaTrainingContext}
${externalContext}
${historyContext}

Key Directives:
- Reply directly and respectfully to ${senderName}.
- Respond wisely, demonstrating good judgment, factual accuracy, and helpfulness.
- Keep responses concise, well-structured, and easy to read.
- When the query relates to the training prompt or trained Q&As, provide that verified information directly.
- If phone contact or direct calling is requested, provide the official phone number: ${contactPhone || "available upon request"}.
- If information is not known and not found in the training prompt or Q&A base, politely inform the visitor that their message has been recorded and ${botOwner.fullName} will follow up directly.`;

  const generated = await callGeminiWithResilience({
    contents: incomingMessage,
    systemInstruction: systemPrompt,
    temperature: 0.7,
  });

  if (generated) {
    return generated;
  }

  // Fast offline match: Check trained Q&A knowledge base
  for (const qa of qaPairs) {
    const qClean = qa.question.toLowerCase().trim();
    if (
      incomingClean.includes(qClean) ||
      (qClean.length > 6 && incomingClean.includes(qClean.slice(0, 25)))
    ) {
      return `Hello ${senderName}! Here is the verified information regarding your question:\n\n${qa.answer}\n\n(I have recorded your inquiry for ${botOwner.fullName} as well!)`;
    }
  }

  // Fallback if model is temporarily unavailable
  const customNote = botCfg.instructions
    ? `\n\nNotice from ${botOwner.fullName}: "${botCfg.instructions.slice(0, 180)}${botCfg.instructions.length > 180 ? "..." : ""}"`
    : "";

  return `Hello ${senderName}! This is an automated response from ${botOwner.fullName}'s AI Chatbot. I have securely recorded your message and notified ${botOwner.fullName}, who will get back to you shortly.${customNote}`;
}

// Sync stored data from Cloud Firestore on start
async function loadDataFromFirestore(retries = 2) {
  if (!firestoreDb) return;
  try {
    // 1. Users
    const usersSnap = await getDocs(collection(firestoreDb, "users"));
    usersSnap.forEach((d) => {
      const u = d.data() as UserRecord;
      if (u && u.id) {
        users.set(u.id, u);
        if (u.email) userByEmail.set(u.email.toLowerCase(), u.id);
        if (u.username) userByUsername.set(u.username.toLowerCase(), u.id);
      }
    });

    // 2. Contacts
    const contactsSnap = await getDocs(collection(firestoreDb, "contacts"));
    contactsSnap.forEach((d) => {
      const data = d.data() as { userId: string; contactIds: string[] };
      if (data && data.userId && Array.isArray(data.contactIds)) {
        contactsByUser.set(data.userId, new Set(data.contactIds));
      }
    });

    // 3. Groups
    const groupsSnap = await getDocs(collection(firestoreDb, "groups"));
    groupsSnap.forEach((d) => {
      const g = d.data() as GroupRecord;
      if (g && g.id) {
        groups.set(g.id, g);
      }
    });

    // 4. Messages
    const messagesSnap = await getDocs(collection(firestoreDb, "messages"));
    messagesSnap.forEach((d) => {
      const m = d.data() as MessageRecord;
      if (m && m.id && !messages.some((existing) => existing.id === m.id)) {
        messages.push(m);
      }
    });

    // 5. Stories (ignore expired > 24 hours)
    const now = Date.now();
    const storiesSnap = await getDocs(collection(firestoreDb, "stories"));
    storiesSnap.forEach((d) => {
      const s = d.data() as StoryRecord;
      if (s && s.id && s.expiresAt > now) {
        stories.set(s.id, s);
      }
    });

    // 6. Reports
    const reportsSnap = await getDocs(collection(firestoreDb, "reports"));
    reportsSnap.forEach((d) => {
      const r = d.data() as ReportRecord;
      if (r && r.id) {
        reports.set(r.id, r);
      }
    });

    // 7. Bot Access Requests
    const botReqSnap = await getDocs(collection(firestoreDb, "bot_requests"));
    botReqSnap.forEach((d) => {
      const req = d.data() as ChatbotAccessRequest;
      if (req && req.userId) {
        botAccessRequests.set(req.userId, req);
      }
    });

    console.log(`Firestore loaded: ${users.size} users, ${groups.size} groups, ${messages.length} messages, ${reports.size} reports, ${botAccessRequests.size} bot requests.`);
  } catch (err: any) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return loadDataFromFirestore(retries - 1);
    }
    console.warn("Notice: Firestore initial sync note:", err?.message || err);
  }
}

// Initialize Superadmin Account and load Cloud Firestore data
async function initializeServerData() {
  const adminEmail = "hashir0047@gmail.com";
  const adminUser = "hashir0047";
  const adminId = "u_superadmin";

  // Ensure superadmin exists with fresh credentials
  const superadmin: UserRecord = {
    id: adminId,
    email: adminEmail,
    username: adminUser,
    fullName: "Hashir",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    password: "Hashir@56",
    role: "superadmin",
    createdAt: Date.now(),
    lastSeen: Date.now(),
    status: "offline",
  };
  users.set(adminId, superadmin);
  userByEmail.set(adminEmail, adminId);
  userByUsername.set(adminUser, adminId);
  if (!contactsByUser.has(adminId)) {
    contactsByUser.set(adminId, new Set<string>());
  }

  // Ensure uploads directory and sample demo trigger files exist for Z-Assistant AI
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const sampleGuidePdfPath = path.join(uploadsDir, "Z_Messenger_User_Manual.pdf");
  if (!fs.existsSync(sampleGuidePdfPath)) {
    const minimalPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 235 >> stream
BT
/F1 22 Tf
50 720 Td
(Z-Messenger Official QuickStart Guide) Tj
0 -36 Td
/F1 12 Tf
(Welcome to Z-Messenger!) Tj
0 -20 Td
(Features include:) Tj
0 -18 Td
(- Real-time direct & group encrypted chats) Tj
0 -18 Td
(- WebRTC Voice & Video calling with screen sharing) Tj
0 -18 Td
(- AI Chatbot with Special Message Trigger File Dispatch) Tj
ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000530 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
607
%%EOF`;
    fs.writeFileSync(sampleGuidePdfPath, minimalPdf, "utf8");
  }

  const sampleShortcutsPath = path.join(uploadsDir, "Keyboard_Shortcuts_Reference.png");
  if (!fs.existsSync(sampleShortcutsPath)) {
    const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAEeQHzHlWqFAAAAABJRU5ErkJggg==";
    fs.writeFileSync(sampleShortcutsPath, Buffer.from(pngBase64, "base64"));
  }

  // Ensure Z-Assistant AI exists as built-in virtual contact
  const zAssistantId = "z_assistant_ai";
  const zAssistantUser: UserRecord = {
    id: zAssistantId,
    email: "assistant@zmessenger.ai",
    username: "zassistant",
    fullName: "Z-Assistant AI",
    avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80",
    password: "ai_bot_protected_key",
    role: "user",
    createdAt: Date.now(),
    lastSeen: Date.now(),
    status: "online",
    about: "Verified Smart AI Assistant powered by Google Gemini 3.8. Ask me anything!",
    botConfig: {
      enabled: true,
      triggerPhrase: "!bot",
      triggerMode: "always",
      instructions: "Friendly, intelligent assistant with special file trigger capabilities",
      triggerFiles: [
        {
          id: "tf_guide",
          triggerPhrase: "!guide",
          matchType: "contains",
          fileName: "Z_Messenger_User_Manual.pdf",
          fileUrl: "/uploads/Z_Messenger_User_Manual.pdf",
          fileSize: 18450,
          fileType: "application/pdf",
          caption: "Here is your official Z-Messenger User Guide & QuickStart Handbook! Feel free to ask if you have any questions.",
          createdAt: Date.now(),
          botOwnerId: zAssistantId,
        },
        {
          id: "tf_shortcuts",
          triggerPhrase: "!shortcuts",
          matchType: "contains",
          fileName: "Keyboard_Shortcuts_Reference.png",
          fileUrl: "/uploads/Keyboard_Shortcuts_Reference.png",
          fileSize: 12500,
          fileType: "image/png",
          caption: "Here is the Z-Messenger Shortcuts & Command Reference Sheet! Type any special message to retrieve files.",
          createdAt: Date.now(),
          botOwnerId: zAssistantId,
        },
      ],
    },
  };
  users.set(zAssistantId, zAssistantUser);
  userByUsername.set("zassistant", zAssistantId);
  userByEmail.set("assistant@zmessenger.ai", zAssistantId);

  // Load persistent records from Cloud Firestore
  await loadDataFromFirestore();

  // Make sure superadmin is safely stored in Firestore
  await persistUserToFirestore(superadmin);
}

initializeServerData().catch((err) => {
  console.error("Failed in initializeServerData:", err);
});

// Real-time connections: SSE and native WebSocket
const sseClients = new Map<string, express.Response[]>();
const userSockets = new Map<string, Set<WebSocket>>();

function notifyUser(userId: string, event: string, payload: any) {
  // 1. Broadcast via WebSocket if client socket is open
  const sockets = userSockets.get(userId);
  if (sockets && sockets.size > 0) {
    const wsPayload = JSON.stringify({ type: event, ...payload, event, data: payload });
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(wsPayload);
        } catch (e) {}
      }
    }
  }

  // 2. Broadcast via SSE for dual connection redundancy
  const clients = sseClients.get(userId);
  if (clients && clients.length > 0) {
    const dataString = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of clients) {
      try {
        res.write(dataString);
      } catch (e) {
        // Connection may have closed
      }
    }
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // Initialize native WebSocket server on the same HTTP port
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    let currentUserId: string | null = null;
    try {
      const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
      const qUid = url.searchParams.get("userId");
      if (qUid) {
        currentUserId = qUid;
        if (!userSockets.has(qUid)) userSockets.set(qUid, new Set());
        userSockets.get(qUid)!.add(ws);
      }
    } catch (e) {}

    ws.on("message", (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        if (payload.type === "register" && payload.userId) {
          currentUserId = payload.userId;
          if (!userSockets.has(payload.userId)) userSockets.set(payload.userId, new Set());
          userSockets.get(payload.userId)!.add(ws);
          ws.send(JSON.stringify({ type: "registered", userId: payload.userId }));
        } else if (payload.type === "webrtc_signal" && payload.targetUserId) {
          notifyUser(payload.targetUserId, "webrtc_signal", payload.payload || payload);
        } else if (payload.type === "incoming_call" && payload.targetUserId) {
          notifyUser(payload.targetUserId, "incoming_call", payload.payload || payload);
        } else if (payload.type === "call_accepted" && payload.targetUserId) {
          notifyUser(payload.targetUserId, "call_accepted", payload.payload || payload);
        } else if (payload.type === "call_declined" && payload.targetUserId) {
          notifyUser(payload.targetUserId, "call_declined", payload.payload || payload);
        } else if (payload.type === "call_cancelled" && payload.targetUserId) {
          notifyUser(payload.targetUserId, "call_cancelled", payload.payload || payload);
        } else if (payload.type === "call_ended" && payload.targetUserId) {
          notifyUser(payload.targetUserId, "call_ended", payload.payload || payload);
        } else if (payload.type === "typing_start" || payload.type === "typing_stop") {
          const senderId = payload.userId || currentUserId;
          const targetUserId = payload.targetUserId;
          const targetGroupId = payload.targetGroupId;
          const eventType = payload.type;
          const typingData = {
            type: eventType,
            userId: senderId,
            username: payload.username || "",
            fullName: payload.fullName || "",
            targetUserId,
            targetGroupId,
            conversationId: payload.conversationId,
            timestamp: Date.now(),
          };

          if (targetGroupId) {
            const grp = groups.get(targetGroupId);
            if (grp && Array.isArray(grp.memberIds)) {
              for (const mId of grp.memberIds) {
                if (mId !== senderId) {
                  notifyUser(mId, eventType, typingData);
                }
              }
            }
          } else if (targetUserId) {
            notifyUser(targetUserId, eventType, typingData);
          }
        } else if (payload.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", time: Date.now() }));
        }
      } catch (err) {}
    });

    ws.on("close", () => {
      if (currentUserId && userSockets.has(currentUserId)) {
        const set = userSockets.get(currentUserId)!;
        set.delete(ws);
        if (set.size === 0) userSockets.delete(currentUserId);
      }
    });
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // CORS for development compatibility
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "Z-messenger", time: Date.now() });
  });

  // Database status and live connectivity verification
  app.get("/api/db-status", async (_req, res) => {
    if (!firestoreDb) {
      res.status(503).json({
        connected: false,
        error: "Firestore database not initialized or configuration missing",
      });
      return;
    }

    try {
      const testDocRef = doc(firestoreDb, "_system", "connection_test");
      await setDoc(testDocRef, {
        lastChecked: Date.now(),
        status: "healthy",
      });
      const snapshot = await getDocFromServer(testDocRef);

      res.json({
        connected: true,
        database: "Google Cloud Firestore",
        databaseId: "ai-studio-zmessenger-34763b82-27cd-4a3f-9971-54aabd5646ba",
        status: "online",
        verified: snapshot.exists(),
        stats: {
          users: users.size,
          groups: groups.size,
          messages: messages.length,
          stories: stories.size,
        },
      });
    } catch (err: any) {
      console.error("Firestore connectivity test error:", err);
      res.status(500).json({
        connected: false,
        database: "Google Cloud Firestore",
        error: err?.message || String(err),
      });
    }
  });

  // Local static file directory for uploaded chatbot files and attachments
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsDir));

  // -------------------------------------------------------------
  // CHATBOT SPECIAL MESSAGE FILE UPLOAD & DISPATCH
  // -------------------------------------------------------------

  // Upload any file to chatbot with a special message trigger
  app.post("/api/bot/upload-file", (req, res) => {
    try {
      const { userId, triggerPhrase, matchType, caption, fileName, fileType, fileSize, fileData } = req.body;
      if (!triggerPhrase || !fileName || !fileData) {
        res.status(400).json({ error: "triggerPhrase, fileName, and fileData are required" });
        return;
      }

      const targetId = userId || "z_assistant_ai";
      const targetUser = users.get(targetId);
      if (!targetUser) {
        res.status(404).json({ error: "Target user or chatbot not found" });
        return;
      }

      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Save file cleanly to disk
      let fileUrl = "";
      const fileExt = path.extname(fileName) || (fileType?.includes("pdf") ? ".pdf" : fileType?.includes("png") ? ".png" : fileType?.includes("jpeg") ? ".jpg" : "");
      const baseName = path.basename(fileName, fileExt).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "file";
      const uniqueId = "bf_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
      const diskFileName = `${uniqueId}_${baseName}${fileExt}`;
      const diskPath = path.join(uploadsDir, diskFileName);

      try {
        if (typeof fileData === "string" && fileData.startsWith("data:")) {
          const commaIdx = fileData.indexOf(",");
          const base64Data = commaIdx !== -1 ? fileData.slice(commaIdx + 1) : fileData;
          fs.writeFileSync(diskPath, Buffer.from(base64Data, "base64"));
          fileUrl = `/uploads/${diskFileName}`;
        } else if (typeof fileData === "string") {
          fs.writeFileSync(diskPath, Buffer.from(fileData, "utf8"));
          fileUrl = `/uploads/${diskFileName}`;
        } else {
          fileUrl = `/uploads/${diskFileName}`;
        }
      } catch (err: any) {
        console.warn("Could not save to disk, falling back to raw dataUrl:", err);
        fileUrl = fileData;
      }

      const newTriggerFile: BotTriggerFile = {
        id: "tf_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        triggerPhrase: triggerPhrase.trim(),
        matchType: matchType === "exact" ? "exact" : "contains",
        fileName: fileName.trim(),
        fileUrl,
        fileSize: Number(fileSize) || 0,
        fileType: fileType || "application/octet-stream",
        caption: caption?.trim() || undefined,
        createdAt: Date.now(),
        botOwnerId: targetUser.id,
      };

      if (!targetUser.botConfig) {
        targetUser.botConfig = {
          enabled: true,
          triggerPhrase: "!bot",
          triggerMode: "always",
          instructions: "",
          qaTraining: [],
          triggerFiles: [],
        };
      }
      if (!Array.isArray(targetUser.botConfig.triggerFiles)) {
        targetUser.botConfig.triggerFiles = [];
      }

      targetUser.botConfig.triggerFiles.push(newTriggerFile);
      persistUserToFirestore(targetUser);

      res.status(201).json({
        success: true,
        message: `File '${fileName}' successfully registered with trigger '${triggerPhrase}'!`,
        triggerFile: newTriggerFile,
        triggerFiles: targetUser.botConfig.triggerFiles,
      });
    } catch (err: any) {
      console.error("Error in /api/bot/upload-file:", err);
      res.status(500).json({ error: err?.message || "Failed to upload chatbot trigger file" });
    }
  });

  // Get configured trigger files for a chatbot
  app.get("/api/bot/trigger-files", (req, res) => {
    const userId = (req.query.userId as string) || "z_assistant_ai";
    const targetUser = users.get(userId);
    if (!targetUser) {
      res.json({ success: true, triggerFiles: [] });
      return;
    }
    const files = targetUser.botConfig?.triggerFiles || [];
    res.json({ success: true, triggerFiles: files, botOwner: targetUser.username });
  });

  // Delete a trigger file from chatbot
  app.delete("/api/bot/trigger-files/:fileId", (req, res) => {
    const fileId = req.params.fileId;
    const userId = (req.query.userId as string) || (req.body?.userId as string) || "z_assistant_ai";
    const targetUser = users.get(userId);
    if (!targetUser || !targetUser.botConfig || !Array.isArray(targetUser.botConfig.triggerFiles)) {
      res.status(404).json({ error: "Chatbot or trigger files not found" });
      return;
    }

    const initialLen = targetUser.botConfig.triggerFiles.length;
    targetUser.botConfig.triggerFiles = targetUser.botConfig.triggerFiles.filter((f) => f.id !== fileId);

    if (targetUser.botConfig.triggerFiles.length < initialLen) {
      persistUserToFirestore(targetUser);
      res.json({
        success: true,
        message: "Trigger file deleted successfully",
        triggerFiles: targetUser.botConfig.triggerFiles,
      });
    } else {
      res.status(404).json({ error: "File trigger not found" });
    }
  });

  // Test special message matching against configured files
  app.post("/api/bot/trigger-files/test", (req, res) => {
    const { userId, message } = req.body;
    const targetId = userId || "z_assistant_ai";
    const targetUser = users.get(targetId);
    const files = targetUser?.botConfig?.triggerFiles || [];
    const matched = findMatchingTriggerFile(files, message);
    if (matched) {
      res.json({
        success: true,
        matched: true,
        file: matched,
        message: `Matched trigger: "${matched.triggerPhrase}". The chatbot will automatically send "${matched.fileName}"!`,
      });
    } else {
      res.json({
        success: true,
        matched: false,
        message: `No file trigger matched for message: "${message}".`,
      });
    }
  });



  // -------------------------------------------------------------
  // AUTH & USER MANAGEMENT
  // -------------------------------------------------------------

  // Check availability of email or username
  app.get("/api/auth/check-availability", (req, res) => {
    const { email, username, excludeUserId } = req.query;
    let emailTaken = false;
    let usernameTaken = false;

    if (email && typeof email === "string") {
      const cleanEmail = email.trim().toLowerCase();
      const existingId = userByEmail.get(cleanEmail);
      if (existingId && existingId !== excludeUserId) {
        emailTaken = true;
      }
    }
    if (username && typeof username === "string") {
      const cleanUsername = username.trim().toLowerCase().replace(/^@/, "");
      const existingId = userByUsername.get(cleanUsername);
      if (existingId && existingId !== excludeUserId) {
        usernameTaken = true;
      }
    }

    res.json({ emailTaken, usernameTaken });
  });

  // Helper to ensure consistent user output with complete botConfig and apiKey
  function createSafeUser(user: UserRecord) {
    const rawBot = user.botConfig;
    const isSuper = user.role === "superadmin" || user.email.toLowerCase() === "hashir0047@gmail.com";
    const accessStatus = user.botAccessStatus || (isSuper ? "approved" : "none");
    const userPhone = user.phoneNumber || rawBot?.phoneNumber || "";

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      avatar: user.avatar,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lastSeen: user.lastSeen,
      about: user.about || "Available",
      disabled: !!user.disabled,
      blockedUserIds: user.blockedUserIds || [],
      phoneNumber: userPhone,
      botAccessStatus: accessStatus,
      botAccessRequestedAt: user.botAccessRequestedAt,
      botAccessNotes: user.botAccessNotes,
      botConfig: {
        enabled: Boolean(rawBot?.enabled),
        triggerPhrase: rawBot?.triggerPhrase || "!bot",
        triggerMode: rawBot?.triggerMode === "always" ? "always" : "phrase",
        trainingPrompt: rawBot?.trainingPrompt || "",
        instructions: rawBot?.instructions || "",
        qaTraining: Array.isArray(rawBot?.qaTraining) ? rawBot.qaTraining : [],
        businessMode: rawBot?.businessMode || "general",
        avoidRepetition: rawBot?.avoidRepetition !== false,
        phoneNumber: userPhone,
        geminiConnected: Boolean(rawBot?.geminiConnected),
        connectedAt: rawBot?.connectedAt,
        websiteUrl: rawBot?.websiteUrl || "",
        externalApiUrl: rawBot?.externalApiUrl || "",
        apiKey: user.apiKey || rawBot?.apiKey || "",
      },
      apiKey: user.apiKey || user.botConfig?.apiKey || "",
    };
  }

  // User Registration
  app.post("/api/auth/register", (req, res) => {
    try {
      const { email, password, username, fullName, avatar } = req.body;

      if (!email || !password || !username || !fullName) {
        res.status(400).json({ error: "Missing required fields (email, password, username, fullName)" });
        return;
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanUsername = username.trim().toLowerCase().replace(/^@/, "");

      if (userByEmail.has(cleanEmail)) {
        res.status(409).json({ error: "An account with this email address already exists. Please log in." });
        return;
      }

      // STRICT USERNAME UNIQUENESS CHECK
      if (userByUsername.has(cleanUsername)) {
        res.status(409).json({ error: "This username is already taken. Please choose a unique username." });
        return;
      }

      const userId = "u_" + Math.random().toString(36).substring(2, 11);
      const isSuperadmin = cleanEmail === "hashir0047@gmail.com";

      const newUser: UserRecord = {
        id: userId,
        email: cleanEmail,
        username: cleanUsername,
        fullName: fullName.trim(),
        avatar: avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        password: password, // In memory secure storage
        role: isSuperadmin ? "superadmin" : "user",
        createdAt: Date.now(),
        lastSeen: Date.now(),
        status: "online",
      };

      users.set(userId, newUser);
      userByEmail.set(cleanEmail, userId);
      userByUsername.set(cleanUsername, userId);
      contactsByUser.set(userId, new Set<string>());

      // Persist to Cloud Firestore
      persistUserToFirestore(newUser);

      res.status(201).json({ success: true, user: createSafeUser(newUser) });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to register account" });
    }
  });

  // User Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { identifier, password } = req.body || {};

      if (!identifier || !password) {
        res.status(400).json({ error: "Please enter your email or username and password." });
        return;
      }

      const cleanId = String(identifier).trim().toLowerCase().replace(/^@/, "");
      let userId = userByEmail.get(cleanId);
      if (!userId) {
        userId = userByUsername.get(cleanId);
      }

      // If user wasn't in memory map, query Firestore users directly as fallback
      if (!userId && firestoreDb) {
        try {
          const usersSnap = await getDocs(collection(firestoreDb, "users"));
          usersSnap.forEach((d) => {
            const u = d.data() as UserRecord;
            if (u && u.id) {
              users.set(u.id, u);
              if (u.email) userByEmail.set(u.email.toLowerCase(), u.id);
              if (u.username) userByUsername.set(u.username.toLowerCase(), u.id);
            }
          });
          userId = userByEmail.get(cleanId) || userByUsername.get(cleanId);
        } catch (fsErr) {
          console.warn("Firestore lookup fallback error in /api/auth/login:", fsErr);
        }
      }

      if (!userId) {
        res.status(401).json({ error: "Account does not exist with this email or username." });
        return;
      }

      const user = users.get(userId);
      if (!user || user.password !== password) {
        res.status(401).json({ error: "Incorrect password. Please verify and try again." });
        return;
      }

      if (user.disabled) {
        res.status(403).json({ error: "Your account has been disabled by the administrator. Please contact support." });
        return;
      }

      // Mark user as online
      user.status = "online";
      user.lastSeen = Date.now();

      // Check superadmin grant
      const userRole = user.role || (user.email === "hashir0047@gmail.com" ? "superadmin" : "user");
      user.role = userRole;

      persistUserToFirestore(user);

      res.json({ success: true, user: createSafeUser(user) });
    } catch (err: any) {
      console.error("Error in /api/auth/login:", err);
      res.status(500).json({ error: err.message || "Login failed" });
    }
  });

  // Update profile with unique username check and about/bio
  app.post("/api/users/profile", (req, res) => {
    const { userId, fullName, avatar, username, about } = req.body;
    if (!userId || !users.has(userId)) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const user = users.get(userId)!;
    if (fullName) user.fullName = fullName.trim();
    if (avatar !== undefined) user.avatar = avatar;
    if (about !== undefined) user.about = typeof about === "string" ? about.trim() : user.about;

    if (username) {
      const cleanUsername = username.trim().toLowerCase().replace(/^@/, "");
      if (cleanUsername !== user.username) {
        if (userByUsername.has(cleanUsername)) {
          res.status(409).json({ error: "This username is already taken by another account." });
          return;
        }
        userByUsername.delete(user.username);
        user.username = cleanUsername;
        userByUsername.set(cleanUsername, user.id);
      }
    }

    persistUserToFirestore(user);

    res.json({
      success: true,
      user: createSafeUser(user),
    });
  });

  // Get all users (for creating groups or contact discovery)
  app.get("/api/users/all", (req, res) => {
    const excludeUserId = req.query.excludeUserId as string;
    const allUsers = Array.from(users.values())
      .filter((u) => !excludeUserId || u.id !== excludeUserId)
      .map((u) => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        avatar: u.avatar,
        status: u.status,
        role: u.role || (u.email === "hashir0047@gmail.com" ? "superadmin" : "user"),
      }));
    res.json({ users: allUsers });
  });

  // Get user details by ID (for person profile / about card)
  app.get("/api/users/:id", (req, res) => {
    const user = users.get(req.params.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      user: createSafeUser(user),
    });
  });

  // Search User by exact Unique Username
  app.get("/api/users/search", (req, res) => {
    const query = req.query.username;
    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "Username query parameter required" });
      return;
    }

    const raw = query.trim().toLowerCase();
    const cleanUsername = raw.replace(/^@+/, "");

    // 1. Direct username lookup
    let targetUserId = userByUsername.get(cleanUsername) || userByUsername.get(raw);

    // 2. Direct email lookup
    if (!targetUserId) {
      targetUserId = userByEmail.get(raw) || userByEmail.get(cleanUsername);
    }

    // 3. Fallback scan through users for case-insensitive or email match
    if (!targetUserId) {
      for (const u of users.values()) {
        const uClean = u.username.trim().toLowerCase().replace(/^@+/, "");
        const eClean = u.email.trim().toLowerCase();
        if (uClean === cleanUsername || eClean === raw || uClean === raw) {
          targetUserId = u.id;
          break;
        }
      }
    }

    // 4. Fuzzy / partial match scan if still not found
    if (!targetUserId) {
      for (const u of users.values()) {
        const uClean = u.username.trim().toLowerCase().replace(/^@+/, "");
        if (uClean.includes(cleanUsername) || u.fullName.toLowerCase().includes(cleanUsername)) {
          targetUserId = u.id;
          break;
        }
      }
    }

    if (!targetUserId) {
      res.status(404).json({ error: `User with username '@${cleanUsername}' not found. Make sure the username is registered.` });
      return;
    }

    const targetUser = users.get(targetUserId);
    if (!targetUser) {
      res.status(404).json({ error: "User record missing" });
      return;
    }

    res.json({
      user: {
        id: targetUser.id,
        username: targetUser.username,
        fullName: targetUser.fullName,
        avatar: targetUser.avatar,
        status: targetUser.status,
        lastSeen: targetUser.lastSeen,
      },
    });
  });

  // User presence heartbeat
  app.post("/api/users/presence", (req, res) => {
    const { userId, status } = req.body;
    if (userId && users.has(userId)) {
      const user = users.get(userId)!;
      if (status) user.status = status;
      user.lastSeen = Date.now();
    }
    res.json({ success: true });
  });

  // -------------------------------------------------------------
  // CONTACTS MANAGEMENT (Strict Isolation: Contacts of one user never mixed)
  // -------------------------------------------------------------

  app.get("/api/contacts", (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) {
      res.status(400).json({ error: "userId required" });
      return;
    }

    const currentUser = users.get(userId);

    // Built-in Smart Z-Assistant AI contact
    const zAssistantUser = users.get("z_assistant_ai");
    const zKey = getConversationKey(userId, "z_assistant_ai");
    const zMsgs = messages.filter(
      (m) =>
        (m.conversationId === zKey ||
          (!m.groupId &&
            ((m.senderId === userId && m.receiverId === "z_assistant_ai") ||
              (m.senderId === "z_assistant_ai" && m.receiverId === userId)))) &&
        !m.deletedFor?.includes(userId)
    );
    const lastZMsg = zMsgs.length > 0 ? zMsgs[zMsgs.length - 1] : null;

    const zAssistantContact = {
      id: "z_assistant_ai",
      username: "zassistant",
      fullName: "Z-Assistant AI",
      avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80",
      status: "online" as const,
      lastSeen: Date.now(),
      about: "Smart AI Assistant powered by Google Gemini 3.8. Ask me anything!",
      isAiAssistant: true,
      lastMessage: lastZMsg
        ? lastZMsg.type === "text"
          ? lastZMsg.content
          : `[${lastZMsg.type}]`
        : zMsgs.length === 0 && messages.some((m) => m.conversationId === zKey && m.deletedFor?.includes(userId))
        ? ""
        : "Hi! I'm Z-Assistant AI. How can I help you today?",
      lastMessageTime: lastZMsg ? lastZMsg.timestamp : Date.now(),
      botConfig: zAssistantUser?.botConfig,
      triggerFiles: zAssistantUser?.botConfig?.triggerFiles || [],
    };

    // Direct 1-on-1 contacts
    const contactIds = contactsByUser.get(userId) || new Set<string>();
    const contactList = Array.from(contactIds).map((cid) => {
      const u = users.get(cid);
      if (!u) return null;
      const convKey = getConversationKey(userId, u.id);
      const userMsgs = messages.filter(
        (m) =>
          (m.conversationId === convKey ||
            (!m.groupId &&
              ((m.senderId === userId && m.receiverId === u.id) ||
                (m.senderId === u.id && m.receiverId === userId)))) &&
          !m.deletedFor?.includes(userId)
      );
      const lastMsg = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1] : null;

      return {
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        avatar: u.avatar,
        status: u.status,
        lastSeen: u.lastSeen,
        about: u.about || "Available",
        email: u.email,
        createdAt: u.createdAt,
        isBlocked: currentUser?.blockedUserIds?.includes(u.id) || false,
        botConfig: u.botConfig,
        triggerFiles: u.botConfig?.triggerFiles || [],
        lastMessage: lastMsg ? (lastMsg.type === "text" ? lastMsg.content : `[${lastMsg.type}]`) : undefined,
        lastMessageTime: lastMsg ? lastMsg.timestamp : undefined,
      };
    }).filter(Boolean);

    // Multi-member Groups where user is a participant
    const userGroups = Array.from(groups.values())
      .filter((g) => g.memberIds.includes(userId))
      .map((g) => {
        const groupMsgs = messages.filter(
          (m) => (m.groupId === g.id || m.conversationId === g.id) && !m.deletedFor?.includes(userId)
        );
        const lastGroupMsg = groupMsgs.length > 0 ? groupMsgs[groupMsgs.length - 1] : null;

        return {
          id: g.id,
          username: "group_" + g.id.substring(0, 6),
          fullName: g.name,
          avatar: g.avatar,
          status: "online" as const,
          isGroup: true,
          groupData: formatGroup(g),
          lastMessage: lastGroupMsg
            ? lastGroupMsg.type === "text"
              ? lastGroupMsg.content
              : `[${lastGroupMsg.type}]`
            : undefined,
          lastMessageTime: lastGroupMsg ? lastGroupMsg.timestamp : undefined,
          lastMessageSenderName: lastGroupMsg ? lastGroupMsg.senderName : undefined,
        };
      });

    res.json({ contacts: [zAssistantContact, ...userGroups, ...contactList] });
  });

  app.post("/api/contacts/add", (req, res) => {
    const { userId, targetUsername } = req.body;
    if (!userId || !targetUsername) {
      res.status(400).json({ error: "Missing userId or targetUsername" });
      return;
    }

    const raw = targetUsername.trim().toLowerCase();
    const cleanTarget = raw.replace(/^@+/, "");

    // 1. Direct username map lookup
    let targetUserId = userByUsername.get(cleanTarget) || userByUsername.get(raw);

    // 2. Direct email map lookup
    if (!targetUserId) {
      targetUserId = userByEmail.get(raw) || userByEmail.get(cleanTarget);
    }

    // 3. Fallback scan through users for match
    if (!targetUserId) {
      for (const u of users.values()) {
        const uClean = u.username.trim().toLowerCase().replace(/^@+/, "");
        const eClean = u.email.trim().toLowerCase();
        if (uClean === cleanTarget || eClean === raw || uClean === raw) {
          targetUserId = u.id;
          break;
        }
      }
    }

    // 4. Partial fallback
    if (!targetUserId) {
      for (const u of users.values()) {
        const uClean = u.username.trim().toLowerCase().replace(/^@+/, "");
        if (uClean.includes(cleanTarget) || u.fullName.toLowerCase().includes(cleanTarget)) {
          targetUserId = u.id;
          break;
        }
      }
    }

    if (!targetUserId) {
      res.status(404).json({ error: `No user found with username '@${cleanTarget}'. Check the spelling or ask them for their registered username.` });
      return;
    }

    if (targetUserId === userId) {
      res.status(400).json({ error: "You cannot add yourself to your own contacts." });
      return;
    }

    let userContacts = contactsByUser.get(userId);
    if (!userContacts) {
      userContacts = new Set<string>();
      contactsByUser.set(userId, userContacts);
    }

    if (userContacts.has(targetUserId)) {
      res.status(400).json({ error: `@${targetUsername} is already in your contacts.` });
      return;
    }

    userContacts.add(targetUserId);

    // Also reciprocally link so both users can chat naturally
    let targetContacts = contactsByUser.get(targetUserId);
    if (!targetContacts) {
      targetContacts = new Set<string>();
      contactsByUser.set(targetUserId, targetContacts);
    }
    targetContacts.add(userId);

    // Save contact links to Firestore
    persistContactsToFirestore(userId, Array.from(userContacts));
    persistContactsToFirestore(targetUserId, Array.from(targetContacts));

    const targetUser = users.get(targetUserId)!;
    const addedContact = {
      id: targetUser.id,
      username: targetUser.username,
      fullName: targetUser.fullName,
      avatar: targetUser.avatar,
      status: targetUser.status,
      lastSeen: targetUser.lastSeen,
    };

    // Notify target that someone added them
    notifyUser(targetUserId, "contact_added", {
      from: {
        id: userId,
        username: users.get(userId)?.username,
        fullName: users.get(userId)?.fullName,
        avatar: users.get(userId)?.avatar,
      },
    });

    res.json({ success: true, contact: addedContact });
  });

  // Remove / delete contact
  const handleRemoveContact = (req: any, res: any) => {
    const userId = (req.body?.userId || req.query?.userId) as string;
    const contactId = (req.body?.contactId || req.query?.contactId) as string;
    if (userId && contactId && contactsByUser.has(userId)) {
      contactsByUser.get(userId)!.delete(contactId);
      persistContactsToFirestore(userId, Array.from(contactsByUser.get(userId)!));
    }
    res.json({ success: true });
  };
  app.delete("/api/contacts", handleRemoveContact);
  app.post("/api/contacts/delete", handleRemoveContact);

  // Block or Unblock user
  app.post("/api/users/block", (req, res) => {
    const { userId, targetUserId, action } = req.body;
    if (!userId || !targetUserId) {
      res.status(400).json({ error: "Missing userId or targetUserId" });
      return;
    }
    const user = users.get(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (!user.blockedUserIds) {
      user.blockedUserIds = [];
    }

    if (action === "block") {
      if (!user.blockedUserIds.includes(targetUserId)) {
        user.blockedUserIds.push(targetUserId);
      }
    } else {
      user.blockedUserIds = user.blockedUserIds.filter((id) => id !== targetUserId);
    }

    persistUserToFirestore(user);
    res.json({ success: true, blockedUserIds: user.blockedUserIds });
  });

  // Get list of blocked users for current user
  app.get("/api/users/blocked", (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) {
      res.status(400).json({ error: "userId required" });
      return;
    }
    const user = users.get(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const blockedList = (user.blockedUserIds || []).map((bid) => {
      const u = users.get(bid);
      return u ? { id: u.id, username: u.username, fullName: u.fullName, avatar: u.avatar, about: u.about } : null;
    }).filter(Boolean);

    res.json({ blockedUsers: blockedList });
  });

  // Submit report against a user
  app.post("/api/reports", (req, res) => {
    const { reporterId, reportedUserId, reason, details } = req.body;
    if (!reporterId || !reportedUserId || !reason) {
      res.status(400).json({ error: "Missing reporterId, reportedUserId, or reason" });
      return;
    }

    const reporter = users.get(reporterId);
    const reported = users.get(reportedUserId);
    if (!reported) {
      res.status(404).json({ error: "Reported user does not exist" });
      return;
    }

    const reportId = "rep_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const newReport: ReportRecord = {
      id: reportId,
      reporterId,
      reporterName: reporter?.fullName || "Z-Messenger User",
      reporterUsername: reporter?.username || "user",
      reportedUserId,
      reportedUserName: reported.fullName,
      reportedUserUsername: reported.username,
      reportedUserAvatar: reported.avatar,
      reason,
      details: details || "",
      timestamp: Date.now(),
      status: "pending",
    };

    reports.set(reportId, newReport);
    persistReportToFirestore(newReport);

    // Notify super admin in real time
    const superadminId = "u_superadmin";
    notifyUser(superadminId, "new_report", newReport);

    res.status(201).json({ success: true, report: newReport });
  });

  // Get all reports (Super Admin only)
  app.get("/api/reports", (req, res) => {
    const userId = req.query.userId as string;
    const user = users.get(userId);
    const isSuperAdmin = user && (user.role === "superadmin" || user.email.toLowerCase() === "hashir0047@gmail.com");

    if (!isSuperAdmin) {
      res.status(403).json({ error: "Unauthorized. Super Admin access required." });
      return;
    }

    const list = Array.from(reports.values()).sort((a, b) => b.timestamp - a.timestamp);
    res.json({ reports: list });
  });

  // Resolve or act on a report (Super Admin only)
  app.post("/api/reports/resolve", (req, res) => {
    const { adminId, reportId, action } = req.body;
    const admin = users.get(adminId);
    const isSuperAdmin = admin && (admin.role === "superadmin" || admin.email.toLowerCase() === "hashir0047@gmail.com");

    if (!isSuperAdmin) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }

    const report = reports.get(reportId);
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    if (action === "disable_user") {
      const targetUser = users.get(report.reportedUserId);
      if (targetUser) {
        targetUser.disabled = true;
        persistUserToFirestore(targetUser);

        // Terminate any active sockets for the disabled user
        const sockets = userSockets.get(targetUser.id);
        if (sockets) {
          for (const ws of sockets) {
            try {
              ws.send(JSON.stringify({ type: "account_disabled", message: "Your account has been disabled by the Super Admin due to user reports." }));
              ws.close();
            } catch (e) {}
          }
        }
      }
      report.status = "resolved";
    } else if (action === "dismiss") {
      report.status = "dismissed";
    }

    persistReportToFirestore(report);
    res.json({ success: true, report });
  });

  // Configure user's personal AI Chatbot auto-responder
  app.post("/api/users/bot-config", (req, res) => {
    const { userId, botConfig } = req.body;
    if (!userId || !botConfig) {
      res.status(400).json({ error: "userId and botConfig are required" });
      return;
    }

    const user = users.get(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const isSuper = user.role === "superadmin" || user.email.toLowerCase() === "hashir0047@gmail.com";
    const isApproved = isSuper || user.botAccessStatus === "approved";

    if (botConfig.enabled && !isApproved) {
      res.status(403).json({
        error: "Only Super Admin approved users can enable the chatbot. Please submit an access request.",
      });
      return;
    }

    if (!user.apiKey) {
      user.apiKey = "zmsg_key_" + Math.random().toString(36).substring(2, 8) + Date.now().toString(36);
    }

    const userPhone = botConfig.phoneNumber || user.phoneNumber || "";
    if (botConfig.phoneNumber) {
      user.phoneNumber = botConfig.phoneNumber;
    }

    user.botConfig = {
      enabled: isApproved ? Boolean(botConfig.enabled) : false,
      triggerPhrase: botConfig.triggerPhrase || "!bot",
      triggerMode: botConfig.triggerMode === "always" ? "always" : "phrase",
      trainingPrompt: botConfig.trainingPrompt || "",
      instructions: botConfig.instructions || "",
      qaTraining: Array.isArray(botConfig.qaTraining) ? botConfig.qaTraining : [],
      triggerFiles: Array.isArray(botConfig.triggerFiles) ? botConfig.triggerFiles : (user.botConfig?.triggerFiles || []),
      businessMode: botConfig.businessMode || "general",
      avoidRepetition: botConfig.avoidRepetition !== false,
      phoneNumber: userPhone,
      geminiConnected: Boolean(botConfig.geminiConnected ?? user.botConfig?.geminiConnected),
      connectedAt: botConfig.connectedAt ?? user.botConfig?.connectedAt,
      websiteUrl: botConfig.websiteUrl || "",
      externalApiUrl: botConfig.externalApiUrl || "",
      apiKey: user.apiKey,
    };

    persistUserToFirestore(user);
    res.json({ success: true, botConfig: user.botConfig, apiKey: user.apiKey, user: createSafeUser(user) });
  });

  // Quick Master Toggle for AI Chatbot (Turn ON / Turn OFF instantly)
  app.post("/api/bot/toggle", (req, res) => {
    try {
      const { userId, enabled } = req.body;
      if (!userId || typeof enabled !== "boolean") {
        res.status(400).json({ error: "userId and boolean 'enabled' are required" });
        return;
      }

      const user = users.get(userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const isSuper = user.role === "superadmin" || user.email.toLowerCase() === "hashir0047@gmail.com";
      const isApproved = isSuper || user.botAccessStatus === "approved";

      if (enabled && !isApproved) {
        res.status(403).json({
          error: "Only Super Admin approved users can enable the chatbot. Please submit an access request.",
        });
        return;
      }

      if (!user.botConfig) {
        user.botConfig = {
          enabled: false,
          triggerPhrase: "!bot",
          triggerMode: "always",
          trainingPrompt: "",
          instructions: "",
          qaTraining: [],
          avoidRepetition: true,
          apiKey: user.apiKey || "",
        };
      }

      user.botConfig.enabled = enabled;
      persistUserToFirestore(user);

      res.json({
        success: true,
        enabled: user.botConfig.enabled,
        botConfig: user.botConfig,
        user: createSafeUser(user),
        message: enabled ? "AI Chatbot turned ON" : "AI Chatbot turned OFF",
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to toggle bot status" });
    }
  });

  // External Website or Database Webhook integration for user's chatbot
  app.post("/api/bot/webhook", async (req, res) => {
    const key = (req.query.key as string) || (req.headers["x-zmsg-key"] as string) || (req.body?.apiKey as string);
    const { message, senderName, history, botOwner, userId } = req.body;

    if (!message) {
      res.status(400).json({ error: "Missing message body" });
      return;
    }

    let owner: UserRecord | undefined;
    if (key) {
      for (const u of users.values()) {
        if (u.apiKey === key || u.botConfig?.apiKey === key) {
          owner = u;
          break;
        }
      }
    } else if (botOwner) {
      const clean = String(botOwner).trim().toLowerCase().replace(/^@/, "");
      const matchedId = userByUsername.get(clean);
      if (matchedId) {
        owner = users.get(matchedId);
      } else {
        for (const u of users.values()) {
          if (
            u.username.toLowerCase() === clean ||
            u.email.toLowerCase() === clean ||
            u.fullName.toLowerCase() === clean
          ) {
            owner = u;
            break;
          }
        }
      }
    } else if (userId) {
      owner = users.get(userId);
    }

    if (!owner) {
      owner = users.get("user-1") || Array.from(users.values())[0];
    }

    if (!owner) {
      res.status(401).json({ error: "No user account found for chatbot." });
      return;
    }

    const matchedFile = findMatchingTriggerFile(owner.botConfig?.triggerFiles, message);
    if (matchedFile) {
      res.json({
        success: true,
        reply: matchedFile.caption || `Here is the requested file: ${matchedFile.fileName}`,
        file: matchedFile,
        owner: owner.username,
        matchedTrigger: matchedFile.triggerPhrase,
        businessMode: owner.botConfig?.businessMode || "general",
        timestamp: Date.now(),
      });
      return;
    }

    const recentHistory = Array.isArray(history) ? history : [];
    const reply = await generateUserBotResponse(
      owner,
      message,
      senderName || "Website Guest",
      recentHistory
    );
    res.json({
      success: true,
      reply,
      owner: owner.username,
      businessMode: owner.botConfig?.businessMode || "general",
      timestamp: Date.now(),
    });
  });

  // Standalone embeddable website widget script for external sites (School / Store / Custom)
  app.get("/api/bot/embed.js", (req, res) => {
    const apiKey = (req.query.key as string) || "";
    let targetOwner: UserRecord | undefined;
    if (apiKey) {
      for (const u of users.values()) {
        if (u.apiKey === apiKey || u.botConfig?.apiKey === apiKey) {
          targetOwner = u;
          break;
        }
      }
    }

    const botTitle = targetOwner ? `${targetOwner.fullName}'s Assistant` : "Z-Messenger Chatbot";
    const welcomeMsg = targetOwner?.botConfig?.trainingPrompt
      ? "Hello! How can I assist you today?"
      : "Hello! Ask any question and our AI assistant will help you right away.";

    res.setHeader("Content-Type", "application/javascript");
    res.send(`
(function() {
  var apiKey = "${apiKey}";
  if (document.getElementById("zmsg-widget-container")) return;

  var container = document.createElement("div");
  container.id = "zmsg-widget-container";
  container.style.position = "fixed";
  container.style.bottom = "20px";
  container.style.right = "20px";
  container.style.zIndex = "999999";
  container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  var btn = document.createElement("button");
  btn.innerHTML = "&#128172;";
  btn.style.width = "56px";
  btn.style.height = "56px";
  btn.style.borderRadius = "28px";
  btn.style.backgroundColor = "#ea580c";
  btn.style.color = "#ffffff";
  btn.style.border = "none";
  btn.style.boxShadow = "0 8px 24px rgba(234, 88, 12, 0.35)";
  btn.style.cursor = "pointer";
  btn.style.fontSize = "24px";
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";

  var box = document.createElement("div");
  box.style.display = "none";
  box.style.flexDirection = "column";
  box.style.width = "340px";
  box.style.height = "460px";
  box.style.backgroundColor = "#ffffff";
  box.style.borderRadius = "16px";
  box.style.boxShadow = "0 12px 32px rgba(0,0,0,0.18)";
  box.style.border = "1px solid #fed7aa";
  box.style.overflow = "hidden";
  box.style.marginBottom = "12px";

  box.innerHTML = '<div style="background:#ea580c;color:#fff;padding:14px;font-size:14px;font-weight:bold;display:flex;justify-content:space-between;align-items:center;"><span>' + ${JSON.stringify(botTitle)} + '</span><span id="zmsg-close-btn" style="cursor:pointer;font-size:16px;">&times;</span></div><div id="zmsg-chat-logs" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13px;background:#fffaf5;"></div><div style="padding:10px;border-top:1px solid #fee2e2;display:flex;gap:6px;background:#fff;"><input id="zmsg-chat-input" placeholder="Type your message..." style="flex:1;padding:8px 12px;border:1px solid #fdba74;border-radius:20px;font-size:13px;outline:none;" /><button id="zmsg-send-btn" style="background:#ea580c;color:#fff;border:none;padding:8px 14px;border-radius:20px;cursor:pointer;font-weight:bold;font-size:12px;">Send</button></div>';

  container.appendChild(box);
  container.appendChild(btn);
  document.body.appendChild(container);

  var logs = box.querySelector("#zmsg-chat-logs");
  var input = box.querySelector("#zmsg-chat-input");
  var sendBtn = box.querySelector("#zmsg-send-btn");
  var closeBtn = box.querySelector("#zmsg-close-btn");
  var history = [];

  function addMsg(text, isBot) {
    var d = document.createElement("div");
    d.style.maxWidth = "85%";
    d.style.padding = "8px 12px";
    d.style.borderRadius = "14px";
    d.style.lineHeight = "1.4";
    d.style.whiteSpace = "pre-wrap";
    if (isBot) {
      d.style.alignSelf = "flex-start";
      d.style.backgroundColor = "#fff";
      d.style.border = "1px solid #fed7aa";
      d.style.color = "#1c1917";
    } else {
      d.style.alignSelf = "flex-end";
      d.style.backgroundColor = "#ea580c";
      d.style.color = "#fff";
    }
    d.textContent = text;
    logs.appendChild(d);
    logs.scrollTop = logs.scrollHeight;
  }

  addMsg(${JSON.stringify(welcomeMsg)}, true);

  btn.onclick = function() {
    box.style.display = box.style.display === "none" ? "flex" : "none";
    if (box.style.display === "flex") input.focus();
  };
  closeBtn.onclick = function() { box.style.display = "none"; };

  function send() {
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    addMsg(text, false);
    history.push({ sender: "user", text: text });
    sendBtn.disabled = true;

    fetch("${req.protocol}://${req.get("host")}/api/bot/webhook?key=" + encodeURIComponent(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, senderName: "Website Visitor", history: history.slice(-6) })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      sendBtn.disabled = false;
      if (data && data.reply) {
        addMsg(data.reply, true);
        history.push({ sender: "bot", text: data.reply });
      }
    })
    .catch(function() {
      sendBtn.disabled = false;
      addMsg("Thank you for reaching out! We have received your query and will reply shortly.", true);
    });
  }

  sendBtn.onclick = send;
  input.onkeydown = function(e) { if (e.key === "Enter") send(); };
})();
`);
  });

  // -------------------------------------------------------------
  // CHATBOT ACCESS REQUEST & APPROVAL SYSTEM (Super Admin controlled)
  // -------------------------------------------------------------

  // User submits request for Super Admin to enable chatbot access
  app.post("/api/bot/request-access", (req, res) => {
    try {
      const { userId, phoneNumber, notes } = req.body;
      if (!userId) {
        res.status(400).json({ error: "userId is required" });
        return;
      }

      const user = users.get(userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const cleanPhone = (phoneNumber || user.phoneNumber || user.botConfig?.phoneNumber || "").trim();
      if (!cleanPhone) {
        res.status(400).json({ error: "Phone number is required to request chatbot access." });
        return;
      }

      user.phoneNumber = cleanPhone;
      user.botAccessStatus = "requested";
      user.botAccessRequestedAt = Date.now();
      user.botAccessNotes = notes || "User requested AI chatbot access.";

      if (user.botConfig) {
        user.botConfig.phoneNumber = cleanPhone;
      }

      const accessReq: ChatbotAccessRequest = {
        id: "req_" + user.id,
        userId: user.id,
        username: user.username,
        fullName: user.fullName,
        avatar: user.avatar,
        email: user.email,
        phoneNumber: cleanPhone,
        notes: notes || "User requested AI chatbot access.",
        requestedAt: Date.now(),
        status: "pending",
      };

      botAccessRequests.set(user.id, accessReq);
      persistBotRequestToFirestore(accessReq);
      persistUserToFirestore(user);

      // Notify Super Admin if online
      for (const u of users.values()) {
        if (u.role === "superadmin" || u.email.toLowerCase() === "hashir0047@gmail.com") {
          notifyUser(u.id, "bot_access_request_received", accessReq);
        }
      }

      res.json({
        success: true,
        message: "Your request for chatbot access has been sent to Super Admin. You will be notified once approved.",
        user: createSafeUser(user),
        request: accessReq,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to submit chatbot access request" });
    }
  });

  // Connect Chatbot to Gemini using user's phone number
  app.post("/api/bot/connect-gemini", async (req, res) => {
    try {
      const { userId, phoneNumber } = req.body;
      if (!userId || !phoneNumber) {
        res.status(400).json({ error: "userId and phoneNumber are required" });
        return;
      }

      const user = users.get(userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const isSuper = user.role === "superadmin" || user.email.toLowerCase() === "hashir0047@gmail.com";
      if (!isSuper && user.botAccessStatus !== "approved") {
        res.status(403).json({
          error: "Super Admin approval is required before connecting your chatbot to Gemini.",
        });
        return;
      }

      const cleanPhone = String(phoneNumber).trim();
      user.phoneNumber = cleanPhone;

      if (!user.botConfig) {
        user.botConfig = {
          enabled: true,
          triggerPhrase: "!bot",
          triggerMode: "always",
          instructions: "",
          qaTraining: [],
          businessMode: "general",
          avoidRepetition: true,
        };
      }

      user.botConfig.phoneNumber = cleanPhone;
      user.botConfig.geminiConnected = true;
      user.botConfig.connectedAt = Date.now();

      // Test Gemini availability
      let geminiStatus = "verified";
      if (process.env.GEMINI_API_KEY) {
        try {
          const testReply = await callGeminiWithResilience({
            contents: "Acknowledge connection verification test with 'OK'.",
            temperature: 0.2,
          });
          if (!testReply) {
            geminiStatus = "ready_with_fallback";
          }
        } catch {
          geminiStatus = "ready_with_fallback";
        }
      }

      persistUserToFirestore(user);

      res.json({
        success: true,
        message: "Chatbot successfully connected to Gemini AI with your contact number.",
        geminiStatus,
        user: createSafeUser(user),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to connect chatbot to Gemini" });
    }
  });

  // AI Assistant generates training questions based on the user's training prompt
  app.post("/api/bot/generate-training-questions", async (req, res) => {
    try {
      const { userId, trainingPrompt } = req.body;
      if (!trainingPrompt || !trainingPrompt.trim()) {
        res.status(400).json({ error: "trainingPrompt is required" });
        return;
      }

      let generatedQuestions: string[] = [];

      if (process.env.GEMINI_API_KEY) {
        const prompt = `You are an expert AI Bot Trainer. A user is training an AI Chatbot for their business/profile.
Here is the user's Foundational Training Prompt:
"""
${trainingPrompt.trim()}
"""

TASK:
Analyze this training prompt thoroughly. Formulate 4 to 5 critical, highly relevant questions that customers or visitors are most likely to ask about this business, service, or profile.
These questions will be asked to the user so they can provide official, verified answers for the chatbot's knowledge base.

OUTPUT FORMAT REQUIREMENTS:
- Return ONLY a valid JSON array of 4-5 questions as strings.
- Example format: ["What are your business hours?", "What is the return policy?", "How can I schedule an appointment?", "What are the payment options?"]
- Do not include markdown codeblocks or extra text outside the JSON array.`;

        const responseText = await callGeminiWithResilience({
          contents: prompt,
          temperature: 0.6,
        });

        if (responseText) {
          try {
            const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(cleanJson);
            if (Array.isArray(parsed) && parsed.length > 0) {
              generatedQuestions = parsed.map((q) => String(q).trim()).filter(Boolean);
            }
          } catch (e) {
            // Regex fallback for bulleted or numbered lines
            const lines = responseText
              .split("\n")
              .map((l) => l.replace(/^[-*•\d.]+\s*/, "").replace(/^["']|["']$/g, "").trim())
              .filter((l) => l.length > 5 && l.includes("?"));
            if (lines.length > 0) {
              generatedQuestions = lines.slice(0, 5);
            }
          }
        }
      }

      // Fallback sensible questions if model is busy
      if (generatedQuestions.length === 0) {
        generatedQuestions = [
          "What services, products, or assistance does your business offer?",
          "What are your official operational hours, location, or availability?",
          "What is your pricing, consultation fee, or order payment policy?",
          "How can visitors contact you urgently or schedule a direct consultation?",
          "What is your refund, cancellation, or customer support procedure?",
        ];
      }

      res.json({ success: true, questions: generatedQuestions });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to generate training questions" });
    }
  });

  // Regenerate Developer Website API Key
  app.post("/api/user/regenerate-api-key", (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        res.status(400).json({ error: "userId is required" });
        return;
      }

      const user = users.get(userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const newKey = "zmsg_key_" + Math.random().toString(36).substring(2, 8) + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      user.apiKey = newKey;
      if (user.botConfig) {
        user.botConfig.apiKey = newKey;
      }

      persistUserToFirestore(user);
      res.json({ success: true, apiKey: newKey, user: createSafeUser(user) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to regenerate API key" });
    }
  });

  // -------------------------------------------------------------
  // WHOLE WEBSITE DEVELOPER REST API (Authenticated with user's apiKey)
  // -------------------------------------------------------------

  function authenticateApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
    const rawKey =
      (req.headers["x-api-key"] as string) ||
      (req.headers["authorization"]?.replace(/^Bearer\s+/i, "")) ||
      (req.query.key as string) ||
      (req.body?.apiKey as string);

    if (!rawKey) {
      res.status(401).json({
        error: "Missing API Key. Provide your key via 'x-api-key' header, 'Authorization: Bearer <key>', or '?key=<key>' parameter.",
      });
      return;
    }

    let authenticatedUser: UserRecord | undefined;
    for (const u of users.values()) {
      if (u.apiKey === rawKey || u.botConfig?.apiKey === rawKey) {
        authenticatedUser = u;
        break;
      }
    }

    if (!authenticatedUser) {
      res.status(401).json({ error: "Invalid API Key. Check your key in Settings > Developer API Key." });
      return;
    }

    (req as any).apiUser = authenticatedUser;
    next();
  }

  // Developer API: Current authenticated profile & bot status
  app.get("/api/v1/profile", authenticateApiKey, (req, res) => {
    const user = (req as any).apiUser as UserRecord;
    res.json({
      success: true,
      user: createSafeUser(user),
      apiDocumentation: {
        endpoints: [
          { method: "GET", path: "/api/v1/profile", description: "Get your profile and bot status" },
          { method: "GET", path: "/api/v1/contacts", description: "Get list of your messenger contacts" },
          { method: "GET", path: "/api/v1/messages", description: "Fetch messages with query '?contactId=...' or '?limit=50'" },
          { method: "POST", path: "/api/v1/messages/send", description: "Send a message '{ recipientUsername, content }'" },
          { method: "GET", path: "/api/v1/bot/status", description: "Get your AI Chatbot status, training, and phone number" },
          { method: "POST", path: "/api/v1/bot/query", description: "Query your trained Gemini Chatbot '{ message, senderName }'" },
          { method: "POST", path: "/api/v1/bot/train", description: "Update training prompt or Q&A pairs programmatically" },
        ],
      },
    });
  });

  // Developer API: Contacts
  app.get("/api/v1/contacts", authenticateApiKey, (req, res) => {
    const user = (req as any).apiUser as UserRecord;
    const contactIds = contactsByUser.get(user.id) || new Set();
    const contactList = Array.from(contactIds)
      .map((cId) => users.get(cId))
      .filter(Boolean)
      .map((c) => createSafeUser(c!));
    res.json({ success: true, count: contactList.length, contacts: contactList });
  });

  // Developer API: Query AI Chatbot
  app.post("/api/v1/bot/query", authenticateApiKey, async (req, res) => {
    const user = (req as any).apiUser as UserRecord;
    const { message, senderName, history } = req.body;

    if (!message) {
      res.status(400).json({ error: "Missing required 'message' in request body" });
      return;
    }

    const matchedFile = findMatchingTriggerFile(user.botConfig?.triggerFiles, String(message));
    if (matchedFile) {
      res.json({
        success: true,
        reply: matchedFile.caption || `Here is the requested file: ${matchedFile.fileName}`,
        file: matchedFile,
        botOwner: user.username,
        matchedTrigger: matchedFile.triggerPhrase,
        poweredBy: "Chatbot File Dispatch",
      });
      return;
    }

    const reply = await generateUserBotResponse(
      user,
      String(message),
      senderName || "API Client",
      Array.isArray(history) ? history : []
    );

    res.json({
      success: true,
      reply,
      botOwner: user.username,
      poweredBy: user.botConfig?.geminiConnected ? "Gemini AI" : "Knowledge Base",
    });
  });

  // Developer API: Chatbot Status
  app.get("/api/v1/bot/status", authenticateApiKey, (req, res) => {
    const user = (req as any).apiUser as UserRecord;
    const bot = user.botConfig;
    res.json({
      success: true,
      bot: {
        enabled: Boolean(bot?.enabled),
        accessStatus: user.botAccessStatus || (user.role === "superadmin" ? "approved" : "none"),
        geminiConnected: Boolean(bot?.geminiConnected),
        phoneNumber: user.phoneNumber || bot?.phoneNumber || "",
        trainingPrompt: bot?.trainingPrompt || "",
        trainedQACount: Array.isArray(bot?.qaTraining) ? bot.qaTraining.length : 0,
        triggerFilesCount: Array.isArray(bot?.triggerFiles) ? bot.triggerFiles.length : 0,
        triggerMode: bot?.triggerMode || "always",
        triggerPhrase: bot?.triggerPhrase || "!bot",
      },
    });
  });

  // Developer API: Update Bot Training
  app.post("/api/v1/bot/train", authenticateApiKey, (req, res) => {
    const user = (req as any).apiUser as UserRecord;
    const { trainingPrompt, qaPairs, instructions } = req.body;

    if (!user.botConfig) {
      user.botConfig = {
        enabled: false,
        triggerPhrase: "!bot",
        triggerMode: "always",
        instructions: "",
        qaTraining: [],
        businessMode: "general",
        avoidRepetition: true,
      };
    }

    if (typeof trainingPrompt === "string") {
      user.botConfig.trainingPrompt = trainingPrompt.trim();
    }
    if (typeof instructions === "string") {
      user.botConfig.instructions = instructions.trim();
    }
    if (Array.isArray(qaPairs)) {
      user.botConfig.qaTraining = qaPairs;
    }

    persistUserToFirestore(user);
    res.json({
      success: true,
      message: "Chatbot training updated successfully.",
      botConfig: user.botConfig,
    });
  });

  // Developer API: Send Message
  app.post("/api/v1/messages/send", authenticateApiKey, (req, res) => {
    const user = (req as any).apiUser as UserRecord;
    const { recipient, content } = req.body;

    if (!recipient || !content) {
      res.status(400).json({ error: "Missing 'recipient' (username, email, or userId) or 'content'" });
      return;
    }

    const cleanTarget = String(recipient).trim().toLowerCase().replace(/^@/, "");
    let targetUser: UserRecord | undefined =
      users.get(cleanTarget) ||
      (userByUsername.get(cleanTarget) ? users.get(userByUsername.get(cleanTarget)!) : undefined) ||
      (userByEmail.get(cleanTarget) ? users.get(userByEmail.get(cleanTarget)!) : undefined);

    if (!targetUser) {
      res.status(404).json({ error: `Recipient '${recipient}' not found in Z-Messenger.` });
      return;
    }

    const convKey = getConversationKey(user.id, targetUser.id);
    const msgId = "m_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

    const newMsg: MessageRecord = {
      id: msgId,
      conversationId: convKey,
      senderId: user.id,
      receiverId: targetUser.id,
      type: "text",
      content: String(content),
      timestamp: Date.now(),
      read: false,
      senderName: user.fullName,
      senderAvatar: user.avatar,
      senderUsername: user.username,
      metadata: { sentViaApi: true },
    };

    messages.push(newMsg);
    persistMessageToFirestore(newMsg);
    notifyUser(targetUser.id, "new_message", newMsg);

    res.json({ success: true, message: newMsg });
  });

  // -------------------------------------------------------------
  // SUPERADMIN MANAGEMENT (hashir0047@gmail.com / Hashir@56)
  // -------------------------------------------------------------

  function checkSuperadmin(requesterId: string | undefined): boolean {
    if (!requesterId) return false;
    const u = users.get(requesterId);
    if (!u) return false;
    return u.role === "superadmin" || u.email.toLowerCase() === "hashir0047@gmail.com";
  }

  // Superadmin: Get all Chatbot Access Requests
  app.get("/api/admin/bot-requests", (req, res) => {
    const requesterId = req.query.requesterId as string;
    if (!checkSuperadmin(requesterId)) {
      res.status(403).json({ error: "Access denied. Superadmin privileges required." });
      return;
    }

    // Combine botAccessRequests map with any users that have botAccessStatus = "requested"
    const reqList: ChatbotAccessRequest[] = Array.from(botAccessRequests.values());

    for (const u of users.values()) {
      if (u.botAccessStatus === "requested" && !botAccessRequests.has(u.id)) {
        const item: ChatbotAccessRequest = {
          id: "req_" + u.id,
          userId: u.id,
          username: u.username,
          fullName: u.fullName,
          avatar: u.avatar,
          email: u.email,
          phoneNumber: u.phoneNumber || u.botConfig?.phoneNumber || "",
          notes: u.botAccessNotes || "User requested AI chatbot access.",
          requestedAt: u.botAccessRequestedAt || Date.now(),
          status: "pending",
        };
        botAccessRequests.set(u.id, item);
        reqList.push(item);
      }
    }

    // Sort newest first
    reqList.sort((a, b) => b.requestedAt - a.requestedAt);

    res.json({ requests: reqList });
  });

  // Superadmin: Approve or Reject Chatbot Access Request
  app.post("/api/admin/bot-requests/action", (req, res) => {
    const requesterId = req.body?.requesterId || req.body?.adminId || (req.query.requesterId as string);
    const { action, notes } = req.body || {};
    let targetUserId = req.body?.targetUserId || req.body?.userId;
    const requestId = req.body?.requestId;

    if (!checkSuperadmin(requesterId)) {
      res.status(403).json({ error: "Access denied. Superadmin privileges required." });
      return;
    }

    // If targetUserId was not directly supplied, resolve from requestId
    if (!targetUserId && requestId) {
      const found = Array.from(botAccessRequests.values()).find(
        (r) => r.id === requestId || r.userId === requestId
      );
      if (found) {
        targetUserId = found.userId;
      } else if (typeof requestId === "string" && requestId.startsWith("req_")) {
        targetUserId = requestId.replace("req_", "");
      } else {
        targetUserId = requestId;
      }
    }

    const targetUser = targetUserId ? users.get(targetUserId) : null;
    if (!targetUser) {
      res.status(404).json({ error: "Target user not found" });
      return;
    }

    if (action === "approve") {
      targetUser.botAccessStatus = "approved";
      if (!targetUser.botConfig) {
        targetUser.botConfig = {
          enabled: true,
          triggerPhrase: "!bot",
          triggerMode: "always",
          trainingPrompt: "",
          instructions: "",
          qaTraining: [],
          avoidRepetition: true,
          apiKey: targetUser.apiKey || "",
        };
      } else {
        targetUser.botConfig.enabled = true;
      }
    } else if (action === "reject") {
      targetUser.botAccessStatus = "rejected";
      if (targetUser.botConfig) {
        targetUser.botConfig.enabled = false;
      }
    }

    // Update request record in memory and Firestore
    let reqRecord = botAccessRequests.get(targetUser.id);
    if (!reqRecord) {
      reqRecord = {
        id: "req_" + targetUser.id,
        userId: targetUser.id,
        username: targetUser.username,
        fullName: targetUser.fullName,
        avatar: targetUser.avatar,
        email: targetUser.email,
        phoneNumber: targetUser.phoneNumber || targetUser.botConfig?.phoneNumber || "",
        requestedAt: targetUser.botAccessRequestedAt || Date.now(),
        status: action === "approve" ? "approved" : "rejected",
      };
    }
    reqRecord.status = action === "approve" ? "approved" : "rejected";
    reqRecord.reviewedAt = Date.now();
    reqRecord.reviewedBy = "Super Admin";
    botAccessRequests.set(targetUser.id, reqRecord);

    persistUserToFirestore(targetUser);
    persistBotRequestToFirestore(reqRecord);

    // Notify user in real-time
    notifyUser(targetUser.id, "bot_access_status_changed", {
      status: targetUser.botAccessStatus,
      user: createSafeUser(targetUser),
    });

    res.json({
      success: true,
      message: `Chatbot access has been ${action}d for ${targetUser.fullName}.`,
      user: createSafeUser(targetUser),
      request: reqRecord,
    });
  });

  // Superadmin: Toggle Chatbot Access directly for any user
  app.post("/api/admin/users/:targetUserId/toggle-bot-access", (req, res) => {
    const requesterId = (req.query.requesterId as string) || req.body?.requesterId || req.body?.adminId;
    const { targetUserId } = req.params;
    let { status, allow } = req.body || {}; // "approved" | "rejected" | "none" or allow: boolean

    if (!checkSuperadmin(requesterId)) {
      res.status(403).json({ error: "Access denied. Superadmin privileges required." });
      return;
    }

    const targetUser = users.get(targetUserId);
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (allow !== undefined) {
      status = allow ? "approved" : "none";
    }

    targetUser.botAccessStatus = status || (targetUser.botAccessStatus === "approved" ? "none" : "approved");

    if (targetUser.botAccessStatus === "approved") {
      if (!targetUser.botConfig) {
        targetUser.botConfig = {
          enabled: true,
          triggerPhrase: "!bot",
          triggerMode: "always",
          trainingPrompt: "",
          instructions: "",
          qaTraining: [],
          avoidRepetition: true,
          apiKey: targetUser.apiKey || "",
        };
      } else {
        targetUser.botConfig.enabled = true;
      }

      // Sync request record if exists
      let reqRecord = botAccessRequests.get(targetUserId);
      if (reqRecord) {
        reqRecord.status = "approved";
        reqRecord.reviewedAt = Date.now();
        reqRecord.reviewedBy = "Super Admin";
        persistBotRequestToFirestore(reqRecord);
      }
    } else {
      if (targetUser.botConfig) {
        targetUser.botConfig.enabled = false;
      }
      let reqRecord = botAccessRequests.get(targetUserId);
      if (reqRecord) {
        reqRecord.status = "rejected";
        reqRecord.reviewedAt = Date.now();
        persistBotRequestToFirestore(reqRecord);
      }
    }

    persistUserToFirestore(targetUser);
    notifyUser(targetUser.id, "bot_access_status_changed", {
      status: targetUser.botAccessStatus,
      user: createSafeUser(targetUser),
    });

    res.json({
      success: true,
      botAccessStatus: targetUser.botAccessStatus,
      message: targetUser.botAccessStatus === "approved"
        ? `Chatbot access granted for ${targetUser.fullName}.`
        : `Chatbot access revoked for ${targetUser.fullName}.`,
      user: createSafeUser(targetUser),
    });
  });

  // Superadmin: Direct Allow Bot for any user
  app.post("/api/admin/users/:targetUserId/allow-bot", (req, res) => {
    const requesterId = (req.query.requesterId as string) || req.body?.requesterId || req.body?.adminId;
    const { targetUserId } = req.params;

    if (!checkSuperadmin(requesterId)) {
      res.status(403).json({ error: "Access denied. Superadmin privileges required." });
      return;
    }

    const targetUser = users.get(targetUserId);
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    targetUser.botAccessStatus = "approved";
    if (!targetUser.botConfig) {
      targetUser.botConfig = {
        enabled: true,
        triggerPhrase: "!bot",
        triggerMode: "always",
        trainingPrompt: "",
        instructions: "",
        qaTraining: [],
        avoidRepetition: true,
        apiKey: targetUser.apiKey || "",
      };
    } else {
      targetUser.botConfig.enabled = true;
    }

    let reqRecord = botAccessRequests.get(targetUserId);
    if (!reqRecord) {
      reqRecord = {
        id: "req_" + targetUser.id,
        userId: targetUser.id,
        username: targetUser.username,
        fullName: targetUser.fullName,
        avatar: targetUser.avatar,
        email: targetUser.email,
        phoneNumber: targetUser.phoneNumber || targetUser.botConfig?.phoneNumber || "",
        requestedAt: Date.now(),
        status: "approved",
        reviewedAt: Date.now(),
        reviewedBy: "Super Admin",
      };
      botAccessRequests.set(targetUserId, reqRecord);
    } else {
      reqRecord.status = "approved";
      reqRecord.reviewedAt = Date.now();
      reqRecord.reviewedBy = "Super Admin";
    }

    persistUserToFirestore(targetUser);
    persistBotRequestToFirestore(reqRecord);

    notifyUser(targetUser.id, "bot_access_status_changed", {
      status: "approved",
      user: createSafeUser(targetUser),
    });

    res.json({
      success: true,
      botAccessStatus: "approved",
      message: `Chatbot access has been officially granted to ${targetUser.fullName} (@${targetUser.username}).`,
      user: createSafeUser(targetUser),
    });
  });

  // Get all accounts (Superadmin only)
  app.get("/api/admin/users", (req, res) => {
    const requesterId = req.query.requesterId as string;
    if (!checkSuperadmin(requesterId)) {
      res.status(403).json({ error: "Access denied. Superadmin privileges required." });
      return;
    }

    const accounts = Array.from(users.values()).map((u) => {
      const isSuper = u.role === "superadmin" || u.email.toLowerCase() === "hashir0047@gmail.com";
      return {
        id: u.id,
        email: u.email,
        username: u.username,
        fullName: u.fullName,
        avatar: u.avatar,
        role: isSuper ? "superadmin" : "user",
        status: u.status,
        createdAt: u.createdAt,
        lastSeen: u.lastSeen,
        contactsCount: contactsByUser.get(u.id)?.size || 0,
        messagesCount: messages.filter((m) => m.senderId === u.id).length,
        password: u.password,
        disabled: !!u.disabled,
        about: u.about || "Available",
        phoneNumber: u.phoneNumber || u.botConfig?.phoneNumber || "",
        botAccessStatus: u.botAccessStatus || (isSuper ? "approved" : "none"),
        botAccessRequestedAt: u.botAccessRequestedAt,
        botAccessNotes: u.botAccessNotes,
      };
    });

    res.json({ users: accounts });
  });

  // Admin stats
  app.get("/api/admin/stats", (req, res) => {
    const requesterId = req.query.requesterId as string;
    if (!checkSuperadmin(requesterId)) {
      res.status(403).json({ error: "Access denied. Superadmin privileges required." });
      return;
    }

    const allU = Array.from(users.values());
    res.json({
      totalUsers: allU.length,
      onlineUsers: allU.filter((u) => u.status === "online").length,
      totalGroups: groups.size,
      totalMessages: messages.length,
    });
  });

  // Delete user account (Superadmin only)
  app.delete("/api/admin/users/:id", (req, res) => {
    const requesterId = (req.query.requesterId || req.body?.requesterId) as string;
    if (!checkSuperadmin(requesterId)) {
      res.status(403).json({ error: "Access denied. Superadmin privileges required." });
      return;
    }

    const targetId = req.params.id;
    const target = users.get(targetId);

    if (!target) {
      res.status(404).json({ error: "User account not found." });
      return;
    }

    // Protection: superadmin account cannot be deleted
    if (target.email.toLowerCase() === "hashir0047@gmail.com" || target.role === "superadmin") {
      res.status(400).json({ error: "Cannot delete the superadmin account." });
      return;
    }

    // Remove from in-memory maps
    users.delete(targetId);
    userByEmail.delete(target.email);
    userByUsername.delete(target.username);

    // Remove from all users' contact sets
    for (const [_uid, cSet] of contactsByUser.entries()) {
      cSet.delete(targetId);
    }
    contactsByUser.delete(targetId);

    // Remove from any groups
    for (const [_gid, group] of groups.entries()) {
      group.memberIds = group.memberIds.filter((mId) => mId !== targetId);
    }

    // Disconnect and notify the target user via SSE
    notifyUser(targetId, "account_deleted", {
      reason: "Your account has been permanently deleted by the superadmin.",
    });

    // Remove user from Cloud Firestore
    deleteUserFromFirestore(targetId);

    res.json({
      success: true,
      message: `Account @${target.username} (${target.fullName}) was deleted successfully.`,
    });
  });

  // Change user account password (Superadmin only)
  app.post("/api/admin/users/:id/password", (req, res) => {
    const requesterId = (req.query.requesterId || req.body?.requesterId) as string;
    if (!checkSuperadmin(requesterId)) {
      res.status(403).json({ error: "Access denied. Superadmin privileges required." });
      return;
    }

    const targetId = req.params.id;
    const { newPassword } = req.body;
    if (!newPassword || typeof newPassword !== "string" || newPassword.trim().length < 4) {
      res.status(400).json({ error: "New password must be at least 4 characters long." });
      return;
    }

    const target = users.get(targetId);
    if (!target) {
      res.status(404).json({ error: "User account not found." });
      return;
    }

    target.password = newPassword.trim();
    persistUserToFirestore(target);

    res.json({
      success: true,
      message: `Password for account @${target.username} (${target.fullName}) updated successfully.`,
    });
  });

  // Enable or Disable user account (Superadmin only)
  app.post("/api/admin/users/:id/toggle-disabled", (req, res) => {
    const requesterId = (req.query.requesterId || req.body?.requesterId) as string;
    if (!checkSuperadmin(requesterId)) {
      res.status(403).json({ error: "Access denied. Superadmin privileges required." });
      return;
    }

    const targetId = req.params.id;
    const target = users.get(targetId);
    if (!target) {
      res.status(404).json({ error: "User account not found." });
      return;
    }

    if (target.email.toLowerCase() === "hashir0047@gmail.com" || target.role === "superadmin") {
      res.status(400).json({ error: "Cannot disable the superadmin account." });
      return;
    }

    const nextState = req.body.disabled !== undefined ? !!req.body.disabled : !target.disabled;
    target.disabled = nextState;

    if (target.disabled) {
      target.status = "offline";
      notifyUser(targetId, "account_disabled", {
        reason: "Your account has been disabled by the super administrator.",
      });
    }

    persistUserToFirestore(target);

    res.json({
      success: true,
      disabled: target.disabled,
      message: target.disabled
        ? `Account @${target.username} (${target.fullName}) has been disabled.`
        : `Account @${target.username} (${target.fullName}) has been enabled.`,
    });
  });

  // Wipe all data from the website (Messages, groups, contacts, and reset state)
  app.post("/api/admin/reset-all-data", async (req, res) => {
    messages.length = 0;
    groups.clear();
    stories.clear();
    for (const [uid] of users.entries()) {
      contactsByUser.set(uid, new Set<string>());
    }
    await initializeServerData();
    res.json({
      success: true,
      message: "All data from the website has been deleted and the platform reset to an empty, clean state.",
    });
  });

  app.post("/api/system/reset-all-data", async (req, res) => {
    messages.length = 0;
    groups.clear();
    stories.clear();
    for (const [uid] of users.entries()) {
      contactsByUser.set(uid, new Set<string>());
    }
    await initializeServerData();
    res.json({
      success: true,
      message: "All website data wiped.",
    });
  });

  // -------------------------------------------------------------
  // STORIES (24-Hour Expiration & Restrict Specific Persons)
  // -------------------------------------------------------------

  // Periodic story cleanup every minute (Delete stories after 24 hours)
  setInterval(() => {
    const now = Date.now();
    for (const [sId, story] of stories.entries()) {
      if (story.expiresAt <= now) {
        stories.delete(sId);
      }
    }
  }, 60 * 1000);

  // Get active stories visible to viewer (excludes expired & restricted stories)
  app.get("/api/stories", (req, res) => {
    const viewerId = req.query.viewerId as string;
    const now = Date.now();

    // Clean expired
    for (const [sId, story] of stories.entries()) {
      if (story.expiresAt <= now) {
        stories.delete(sId);
      }
    }

    const visibleStories: StoryRecord[] = [];
    for (const story of stories.values()) {
      // Author always sees their own story
      if (story.userId === viewerId) {
        visibleStories.push(story);
        continue;
      }

      // Check if they are added contacts (either author has added viewer or viewer has added author)
      const authorContacts = contactsByUser.get(story.userId);
      const viewerContacts = viewerId ? contactsByUser.get(viewerId) : null;
      const isAddedContact = Boolean(
        (authorContacts && viewerId && authorContacts.has(viewerId)) ||
        (viewerContacts && viewerContacts.has(story.userId))
      );

      // Story will not share to everyone, only to contacts that are added
      if (!isAddedContact) {
        continue;
      }

      // If restricted persons list includes viewerId, hide it
      const isRestricted = Array.isArray(story.restrictedUserIds) && story.restrictedUserIds.includes(viewerId);
      if (!isRestricted) {
        visibleStories.push(story);
      }
    }

    visibleStories.sort((a, b) => b.createdAt - a.createdAt);
    res.json({ stories: visibleStories });
  });

  // Post a new story (Valid for 24 hours, optional restrictedUserIds)
  app.post("/api/stories", (req, res) => {
    const { userId, mediaUrl, mediaType, caption, restrictedUserIds } = req.body;

    if (!userId || !mediaUrl) {
      res.status(400).json({ error: "Missing userId or mediaUrl" });
      return;
    }

    const user = users.get(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const storyId = "story_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours from creation

    const restrictedList = Array.isArray(restrictedUserIds) ? restrictedUserIds : [];

    const newStory: StoryRecord = {
      id: storyId,
      userId,
      userFullName: user.fullName,
      userUsername: user.username,
      userAvatar: user.avatar,
      mediaUrl,
      mediaType: mediaType || "image",
      caption: caption || "",
      createdAt: now,
      expiresAt,
      restrictedUserIds: restrictedList,
      viewers: [],
    };

    stories.set(storyId, newStory);
    persistStoryToFirestore(newStory);

    // Notify contacts who are not restricted via SSE
    const userContacts = contactsByUser.get(userId) || new Set<string>();
    for (const cId of userContacts) {
      if (!restrictedList.includes(cId)) {
        notifyUser(cId, "new_story", newStory);
      }
    }

    res.json({ success: true, story: newStory });
  });

  // Mark story as viewed
  app.post("/api/stories/:id/view", (req, res) => {
    const { viewerId } = req.body;
    const story = stories.get(req.params.id);
    if (!story) {
      res.status(404).json({ error: "Story not found or expired." });
      return;
    }

    if (viewerId && !story.viewers.includes(viewerId)) {
      story.viewers.push(viewerId);
      // Notify author of view
      notifyUser(story.userId, "story_viewed", {
        storyId: story.id,
        viewerId,
        viewersCount: story.viewers.length,
      });
    }

    res.json({ success: true, viewers: story.viewers });
  });

  // Delete story
  app.delete("/api/stories/:id", (req, res) => {
    const requesterId = (req.query.requesterId || req.body?.requesterId) as string;
    const story = stories.get(req.params.id);
    if (!story) {
      res.status(404).json({ error: "Story not found." });
      return;
    }

    if (story.userId !== requesterId && !checkSuperadmin(requesterId)) {
      res.status(403).json({ error: "Unauthorized to delete this story." });
      return;
    }

    stories.delete(req.params.id);
    if (firestoreDb) {
      deleteDoc(doc(firestoreDb, "stories", req.params.id)).catch((err) => {
        console.warn("Firestore delete story error:", err);
      });
    }
    res.json({ success: true, message: "Story deleted." });
  });

  // -------------------------------------------------------------
  // GROUP CHAT MANAGEMENT (More than 2 people can communicate)
  // -------------------------------------------------------------

  function formatGroup(group: GroupRecord) {
    const members = group.memberIds
      .map((mId) => {
        const u = users.get(mId);
        if (!u) return null;
        return {
          id: u.id,
          username: u.username,
          fullName: u.fullName,
          avatar: u.avatar,
          status: u.status,
          role: mId === group.creatorId ? ("admin" as const) : ("member" as const),
        };
      })
      .filter(Boolean);

    return {
      ...group,
      members,
    };
  }

  // Create a group (Requires > 2 people => at least 3 members total)
  app.post("/api/groups", (req, res) => {
    const { name, description, avatar, creatorId, memberIds } = req.body;

    if (!name || !creatorId) {
      res.status(400).json({ error: "Group name and creatorId are required." });
      return;
    }

    const rawMembers = Array.isArray(memberIds) ? memberIds : [];
    const distinctMemberIds = Array.from(new Set([creatorId, ...rawMembers]));

    // Constraint: "where more than 2 person can communicate"
    if (distinctMemberIds.length < 3) {
      res.status(400).json({
        error: "A group must include more than 2 people (at least 3 members total including you). Please select at least 2 other people.",
      });
      return;
    }

    const groupId = "g_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const defaultAvatar =
      avatar ||
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80";

    const newGroup: GroupRecord = {
      id: groupId,
      name: name.trim(),
      description: description ? description.trim() : "",
      avatar: defaultAvatar,
      creatorId,
      memberIds: distinctMemberIds,
      createdAt: Date.now(),
      lastMessage: "Group created",
      lastMessageTime: Date.now(),
      lastMessageSenderName: users.get(creatorId)?.fullName || "Admin",
    };

    groups.set(groupId, newGroup);
    persistGroupToFirestore(newGroup);

    const formatted = formatGroup(newGroup);

    // Notify all members via SSE
    for (const mId of distinctMemberIds) {
      notifyUser(mId, "group_created", formatted);
    }

    res.status(201).json({ success: true, group: formatted });
  });

  // Get all groups for a user
  app.get("/api/groups", (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) {
      res.status(400).json({ error: "userId required" });
      return;
    }

    const userGroups: any[] = [];
    for (const group of groups.values()) {
      if (group.memberIds.includes(userId)) {
        userGroups.push(formatGroup(group));
      }
    }

    userGroups.sort((a, b) => (b.lastMessageTime || b.createdAt) - (a.lastMessageTime || a.createdAt));

    res.json({ groups: userGroups });
  });

  // Get single group
  app.get("/api/groups/:id", (req, res) => {
    const group = groups.get(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    res.json({ group: formatGroup(group) });
  });

  // Add member(s) to group
  // Add member(s) to group (Group admin can add anyone after making the group)
  app.post("/api/groups/:id/members", (req, res) => {
    const group = groups.get(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    const { memberIds, userId, username, identifier, requesterId } = req.body;

    // Check admin authority if requesterId is supplied
    if (requesterId) {
      const isCreator = group.creatorId === requesterId;
      const isAdmin = isCreator; // Creator is primary group admin
      if (!isAdmin && !group.memberIds.includes(requesterId)) {
        res.status(403).json({ error: "Only group admins can add new members to this group." });
        return;
      }
    }

    // Determine target users to add
    const toAddIds: string[] = [];

    // 1. Direct IDs array or single ID
    if (Array.isArray(memberIds)) {
      toAddIds.push(...memberIds);
    } else if (typeof memberIds === "string" && memberIds) {
      toAddIds.push(memberIds);
    }

    if (userId && typeof userId === "string") {
      toAddIds.push(userId);
    }

    // 2. Lookup by username or identifier
    const targetUsername = username || identifier;
    if (targetUsername && typeof targetUsername === "string") {
      const clean = targetUsername.trim().toLowerCase().replace(/^@+/, "");
      let foundId = userByUsername.get(clean) || userByEmail.get(clean);
      if (!foundId) {
        for (const u of users.values()) {
          const uClean = u.username.trim().toLowerCase().replace(/^@+/, "");
          if (uClean === clean || u.email.trim().toLowerCase() === clean) {
            foundId = u.id;
            break;
          }
        }
      }
      if (foundId) {
        toAddIds.push(foundId);
      } else {
        res.status(404).json({ error: `User '@${clean}' not found. Please verify the username.` });
        return;
      }
    }

    const newlyAdded: UserRecord[] = [];
    const requester = requesterId ? users.get(requesterId) : null;
    const adderName = requester?.fullName || "Group Admin";

    for (const id of toAddIds) {
      if (id && users.has(id)) {
        if (!group.memberIds.includes(id)) {
          group.memberIds.push(id);
          const targetUser = users.get(id)!;
          newlyAdded.push(targetUser);

          // Add system event message in group conversation
          const sysMsgId = "m_sys_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
          const sysMsg: MessageRecord = {
            id: sysMsgId,
            conversationId: group.id,
            senderId: "system",
            senderName: "System",
            receiverId: group.id,
            groupId: group.id,
            isGroup: true,
            type: "text",
            content: `${adderName} added ${targetUser.fullName} (@${targetUser.username}) to the group.`,
            timestamp: Date.now(),
            read: false,
            reactions: {},
          };
          messages.push(sysMsg);
          persistMessageToFirestore(sysMsg);

          // Notify existing group members of the new system message
          for (const mId of group.memberIds) {
            notifyUser(mId, "new_message", sysMsg);
          }

          // Notify the newly added user that they've been added
          notifyUser(id, "group_created", formatGroup(group));
        }
      }
    }

    if (newlyAdded.length === 0 && toAddIds.length > 0) {
      res.status(400).json({ error: "The selected user is already a member of this group." });
      return;
    }

    // Persist updated group to Cloud Firestore
    persistGroupToFirestore(group);

    const formatted = formatGroup(group);
    for (const mId of group.memberIds) {
      notifyUser(mId, "group_updated", formatted);
    }

    res.json({
      success: true,
      group: formatted,
      addedMembers: newlyAdded.map((u) => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        avatar: u.avatar,
      })),
    });
  });

  // Leave or remove member from group (Admin can remove members, or member can leave)
  app.delete("/api/groups/:id/members/:memberId", (req, res) => {
    const group = groups.get(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    const memberToRemove = req.params.memberId;
    const requesterId = (req.query.requesterId || req.body?.requesterId) as string;

    // Check authority: user can remove themselves (leave), or group admin can remove anyone
    if (requesterId && requesterId !== memberToRemove && group.creatorId !== requesterId) {
      res.status(403).json({ error: "Only the group admin can remove members from this group." });
      return;
    }

    const removedUser = users.get(memberToRemove);
    const remover = requesterId ? users.get(requesterId) : null;
    const isSelfLeave = requesterId === memberToRemove;

    group.memberIds = group.memberIds.filter((m) => m !== memberToRemove);

    if (group.memberIds.length === 0) {
      groups.delete(group.id);
      deleteGroupFromFirestore(group.id);
      res.json({ success: true, deleted: true });
      return;
    }

    // If creator left, reassign admin/creator to next remaining member
    if (group.creatorId === memberToRemove && group.memberIds.length > 0) {
      group.creatorId = group.memberIds[0];
    }

    // Persist updated group to Firestore
    persistGroupToFirestore(group);

    // Announce departure/removal in chat
    if (removedUser) {
      const sysMsgId = "m_sys_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
      const actionText = isSelfLeave
        ? `${removedUser.fullName} left the group.`
        : `${remover?.fullName || "Group Admin"} removed ${removedUser.fullName} from the group.`;

      const sysMsg: MessageRecord = {
        id: sysMsgId,
        conversationId: group.id,
        senderId: "system",
        senderName: "System",
        receiverId: group.id,
        groupId: group.id,
        isGroup: true,
        type: "text",
        content: actionText,
        timestamp: Date.now(),
        read: false,
        reactions: {},
      };
      messages.push(sysMsg);
      persistMessageToFirestore(sysMsg);

      for (const mId of group.memberIds) {
        notifyUser(mId, "new_message", sysMsg);
      }
    }

    const formatted = formatGroup(group);
    for (const mId of group.memberIds) {
      notifyUser(mId, "group_updated", formatted);
    }
    notifyUser(memberToRemove, "group_left", { groupId: group.id });

    res.json({ success: true, group: formatted });
  });

  // Update group details (Change group DP / avatar, name, description)
  app.patch("/api/groups/:id", (req, res) => {
    const group = groups.get(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    const { avatar, name, description } = req.body;
    if (avatar && typeof avatar === "string") {
      group.avatar = avatar;
    }
    if (name && typeof name === "string" && name.trim()) {
      group.name = name.trim();
    }
    if (description !== undefined && typeof description === "string") {
      group.description = description.trim();
    }

    // Persist to Cloud Firestore
    persistGroupToFirestore(group);

    const formatted = formatGroup(group);

    // Notify all group members of the updated DP / info
    for (const mId of group.memberIds) {
      notifyUser(mId, "group_updated", formatted);
    }

    res.json({ success: true, group: formatted });
  });

  // Delete a group or leave/remove it
  app.delete("/api/groups/:id", (req, res) => {
    const groupId = req.params.id;
    const group = groups.get(groupId);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    const userId = (req.query.userId as string) || req.body?.userId;
    const isCreator = group.creatorId === userId;

    if (isCreator || !userId) {
      // Creator deleted group -> permanently delete group
      const allMembers = [...group.memberIds];
      groups.delete(groupId);
      if (firestoreDb) {
        deleteDoc(doc(firestoreDb, "groups", groupId)).catch((err) => {
          console.warn("Firestore group delete error:", err);
        });
      }

      for (const mId of allMembers) {
        notifyUser(mId, "group_deleted", { groupId, name: group.name });
      }
      res.json({ success: true, action: "deleted" });
      return;
    }

    // Member left / removed group
    group.memberIds = group.memberIds.filter((m) => m !== userId);
    persistGroupToFirestore(group);
    notifyUser(userId, "group_deleted", { groupId, name: group.name });
    for (const mId of group.memberIds) {
      notifyUser(mId, "group_updated", formatGroup(group));
    }
    res.json({ success: true, action: "left" });
  });

  // -------------------------------------------------------------
  // REAL-TIME MESSAGING (1-on-1 & Multi-Person Groups)

  // -------------------------------------------------------------

  function getConversationKey(u1: string, u2: string) {
    return [u1, u2].sort().join("::");
  }

  app.get("/api/messages", (req, res) => {
    const { userId, contactId, groupId } = req.query;

    if (groupId && typeof groupId === "string") {
      let chatMsgs = messages.filter((m) => m.conversationId === groupId || m.groupId === groupId);
      if (userId && typeof userId === "string") {
        chatMsgs = chatMsgs.filter((m) => !m.deletedFor?.includes(userId));
      }
      res.json({ messages: chatMsgs });
      return;
    }

    if (!userId || !contactId || typeof userId !== "string" || typeof contactId !== "string") {
      res.status(400).json({ error: "Missing userId, contactId, or groupId" });
      return;
    }

    // Check if contactId is actually a group
    if (contactId.startsWith("g_")) {
      let chatMsgs = messages.filter((m) => m.conversationId === contactId || m.groupId === contactId);
      chatMsgs = chatMsgs.filter((m) => !m.deletedFor?.includes(userId));
      res.json({ messages: chatMsgs });
      return;
    }

    const convKey = getConversationKey(userId, contactId);
    let chatMsgs = messages.filter((m) => m.conversationId === convKey);
    chatMsgs = chatMsgs.filter((m) => !m.deletedFor?.includes(userId));

    // Mark received messages as read
    for (const m of chatMsgs) {
      if (m.receiverId === userId && !m.read) {
        m.read = true;
      }
    }

    res.json({ messages: chatMsgs });
  });

  app.post("/api/messages", (req, res) => {
    const { senderId, receiverId, groupId, type, content, metadata } = req.body;

    if (!senderId || (!receiverId && !groupId) || !type || content === undefined) {
      res.status(400).json({ error: "Missing required message parameters" });
      return;
    }

    const targetGroupId = groupId || (receiverId && receiverId.startsWith("g_") ? receiverId : null);
    const sender = users.get(senderId);

    // GROUP MESSAGE DISPATCH
    if (targetGroupId) {
      const group = groups.get(targetGroupId);
      if (!group) {
        res.status(404).json({ error: "Group does not exist" });
        return;
      }

      const msgId = "m_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
      const newMsg: MessageRecord = {
        id: msgId,
        conversationId: targetGroupId,
        groupId: targetGroupId,
        senderId,
        receiverId: targetGroupId,
        type,
        content,
        ...(metadata !== undefined ? { metadata } : {}),
        timestamp: Date.now(),
        read: true,
        isGroup: true,
        senderName: sender?.fullName || "Group Member",
        senderAvatar: sender?.avatar || "",
        senderUsername: sender?.username || "",
      };

      messages.push(newMsg);
      persistMessageToFirestore(newMsg);

      // Update group's preview info
      group.lastMessage = content;
      group.lastMessageTime = Date.now();
      group.lastMessageSenderName = newMsg.senderName;

      // Broadcast to every member of the group (except sender)
      for (const memberId of group.memberIds) {
        if (memberId !== senderId) {
          notifyUser(memberId, "new_message", newMsg);
        }
      }

      res.status(201).json({ success: true, message: newMsg });
      return;
    }

    // 1-on-1 DIRECT MESSAGE
    const receiver = users.get(receiverId);

    // Block enforcement
    if (receiver?.blockedUserIds?.includes(senderId)) {
      res.status(403).json({ error: "You cannot message this user because they have blocked you." });
      return;
    }
    if (sender?.blockedUserIds?.includes(receiverId)) {
      res.status(403).json({ error: "You have blocked this contact. Unblock them first to send messages." });
      return;
    }

    const convKey = getConversationKey(senderId, receiverId);
    const msgId = "m_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

    const newMsg: MessageRecord = {
      id: msgId,
      conversationId: convKey,
      senderId,
      receiverId,
      type,
      content,
      ...(metadata !== undefined ? { metadata } : {}),
      timestamp: Date.now(),
      read: false,
      senderName: sender?.fullName || "User",
      senderAvatar: sender?.avatar || "",
      senderUsername: sender?.username || "",
    };

    messages.push(newMsg);
    persistMessageToFirestore(newMsg);

    // Notify receiver via SSE
    notifyUser(receiverId, "new_message", newMsg);

    res.status(201).json({ success: true, message: newMsg });

    // Asynchronous AI Handling (Z-Assistant AI or Personal Bot Auto-Responder)
    if (receiverId === "z_assistant_ai") {
      (async () => {
        try {
          const zUser = users.get("z_assistant_ai");
          const matchedFile = findMatchingTriggerFile(zUser?.botConfig?.triggerFiles, content);

          if (matchedFile) {
            // Immediate special message trigger matched for Z-Assistant AI!
            notifyUser(senderId, "typing_start", {
              type: "typing_start",
              userId: "z_assistant_ai",
              username: "zassistant",
              fullName: "Z-Assistant AI",
              targetUserId: senderId,
              timestamp: Date.now(),
            });

            await new Promise((r) => setTimeout(r, 450));

            // If caption exists, send introductory caption text first
            if (matchedFile.caption) {
              const captionMsg: MessageRecord = {
                id: "m_c_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
                conversationId: convKey,
                senderId: "z_assistant_ai",
                receiverId: senderId,
                type: "text",
                content: matchedFile.caption,
                timestamp: Date.now(),
                read: false,
                senderName: "Z-Assistant AI",
                senderAvatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80",
                senderUsername: "zassistant",
                metadata: { isAiAutoReply: true },
              };
              messages.push(captionMsg);
              persistMessageToFirestore(captionMsg);
              notifyUser(senderId, "new_message", captionMsg);
            }

            // Send requested file to the user
            const fileMsg: MessageRecord = {
              id: "m_f_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
              conversationId: convKey,
              senderId: "z_assistant_ai",
              receiverId: senderId,
              type: "file",
              content: matchedFile.fileUrl,
              timestamp: Date.now() + 20,
              read: false,
              senderName: "Z-Assistant AI",
              senderAvatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80",
              senderUsername: "zassistant",
              metadata: {
                fileName: matchedFile.fileName,
                fileSize: matchedFile.fileSize,
                fileType: matchedFile.fileType,
                isAiAutoReply: true,
                caption: matchedFile.caption,
                triggerMatched: matchedFile.triggerPhrase,
              },
            };
            messages.push(fileMsg);
            persistMessageToFirestore(fileMsg);

            notifyUser(senderId, "typing_stop", {
              type: "typing_stop",
              userId: "z_assistant_ai",
              targetUserId: senderId,
              timestamp: Date.now(),
            });

            notifyUser(senderId, "new_message", fileMsg);
            return;
          }

          notifyUser(senderId, "typing_start", {
            type: "typing_start",
            userId: "z_assistant_ai",
            username: "zassistant",
            fullName: "Z-Assistant AI",
            targetUserId: senderId,
            timestamp: Date.now(),
          });

          const chatHistory = messages
            .filter((m) => m.conversationId === convKey)
            .slice(-8)
            .map((m) => ({
              role: m.senderId === "z_assistant_ai" ? "assistant" : "user",
              content: m.content,
            }));

          const replyText = await generateZAssistantResponse(content, chatHistory);
          const aiMsgId = "m_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
          const aiMsg: MessageRecord = {
            id: aiMsgId,
            conversationId: convKey,
            senderId: "z_assistant_ai",
            receiverId: senderId,
            type: "text",
            content: replyText,
            timestamp: Date.now(),
            read: false,
            senderName: "Z-Assistant AI",
            senderAvatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80",
            senderUsername: "zassistant",
            metadata: { isAiAutoReply: true },
          };
          messages.push(aiMsg);
          persistMessageToFirestore(aiMsg);

          notifyUser(senderId, "typing_stop", {
            type: "typing_stop",
            userId: "z_assistant_ai",
            targetUserId: senderId,
            timestamp: Date.now(),
          });

          notifyUser(senderId, "new_message", aiMsg);
        } catch (e) {
          notifyUser(senderId, "typing_stop", {
            type: "typing_stop",
            userId: "z_assistant_ai",
            targetUserId: senderId,
            timestamp: Date.now(),
          });
          console.error("Z-Assistant response error:", e);
        }
      })();
    } else if (receiver && receiver.botConfig && receiver.botConfig.enabled) {
      const botCfg = receiver.botConfig;
      // First check if incoming message matches any of the bot's special message trigger files!
      const matchedFile = findMatchingTriggerFile(botCfg.triggerFiles, content);

      if (matchedFile) {
        (async () => {
          try {
            notifyUser(senderId, "typing_start", {
              type: "typing_start",
              userId: receiver.id,
              username: receiver.username,
              fullName: receiver.fullName,
              targetUserId: senderId,
              timestamp: Date.now(),
            });

            await new Promise((r) => setTimeout(r, 450));

            // If caption exists, send introductory caption text first
            if (matchedFile.caption) {
              const captionMsg: MessageRecord = {
                id: "m_c_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
                conversationId: convKey,
                senderId: receiver.id,
                receiverId: senderId,
                type: "text",
                content: matchedFile.caption,
                timestamp: Date.now(),
                read: false,
                senderName: receiver.fullName,
                senderAvatar: receiver.avatar,
                senderUsername: receiver.username,
                metadata: { isAiAutoReply: true },
              };
              messages.push(captionMsg);
              persistMessageToFirestore(captionMsg);
              notifyUser(senderId, "new_message", captionMsg);
              notifyUser(receiver.id, "new_message", captionMsg);
            }

            // Send requested file to the user
            const fileMsg: MessageRecord = {
              id: "m_f_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
              conversationId: convKey,
              senderId: receiver.id,
              receiverId: senderId,
              type: "file",
              content: matchedFile.fileUrl,
              timestamp: Date.now() + 20,
              read: false,
              senderName: receiver.fullName,
              senderAvatar: receiver.avatar,
              senderUsername: receiver.username,
              metadata: {
                fileName: matchedFile.fileName,
                fileSize: matchedFile.fileSize,
                fileType: matchedFile.fileType,
                isAiAutoReply: true,
                caption: matchedFile.caption,
                triggerMatched: matchedFile.triggerPhrase,
              },
            };
            messages.push(fileMsg);
            persistMessageToFirestore(fileMsg);

            notifyUser(senderId, "typing_stop", {
              type: "typing_stop",
              userId: receiver.id,
              targetUserId: senderId,
              timestamp: Date.now(),
            });

            notifyUser(senderId, "new_message", fileMsg);
            notifyUser(receiver.id, "new_message", fileMsg);
          } catch (err) {
            notifyUser(senderId, "typing_stop", {
              type: "typing_stop",
              userId: receiver.id,
              targetUserId: senderId,
              timestamp: Date.now(),
            });
            console.error("Bot trigger file send error:", err);
          }
        })();
        return;
      }

      const isAlways = botCfg.triggerMode === "always";
      const trigger = (botCfg.triggerPhrase || "").trim().toLowerCase();
      const contentLower = (content || "").toLowerCase();

      let shouldReply = false;
      if (isAlways) {
        shouldReply = true;
      } else if (trigger && contentLower.includes(trigger)) {
        shouldReply = true;
      }

      if (shouldReply) {
        (async () => {
          try {
            notifyUser(senderId, "typing_start", {
              type: "typing_start",
              userId: receiver.id,
              username: receiver.username,
              fullName: receiver.fullName,
              targetUserId: senderId,
              timestamp: Date.now(),
            });

            await new Promise((r) => setTimeout(r, 600));
            // Gather recent conversation messages for context & anti-repetition
            const recentMsgs = messages
              .filter((m) => m.conversationId === convKey)
              .slice(-6)
              .map((m) => ({
                sender: (m.senderId === receiver.id ? "bot" : "user") as "user" | "bot",
                text: m.content || "",
              }));

            const botReplyText = await generateUserBotResponse(
              receiver,
              content,
              sender?.fullName || "User",
              recentMsgs
            );
            const botMsgId = "m_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
            const botMsg: MessageRecord = {
              id: botMsgId,
              conversationId: convKey,
              senderId: receiver.id,
              receiverId: senderId,
              type: "text",
              content: botReplyText,
              timestamp: Date.now(),
              read: false,
              senderName: receiver.fullName,
              senderAvatar: receiver.avatar,
              senderUsername: receiver.username,
              metadata: { isAiAutoReply: true },
            };
            messages.push(botMsg);
            persistMessageToFirestore(botMsg);

            notifyUser(senderId, "typing_stop", {
              type: "typing_stop",
              userId: receiver.id,
              targetUserId: senderId,
              timestamp: Date.now(),
            });

            notifyUser(senderId, "new_message", botMsg);
            notifyUser(receiver.id, "new_message", botMsg);
          } catch (e) {
            notifyUser(senderId, "typing_stop", {
              type: "typing_stop",
              userId: receiver.id,
              targetUserId: senderId,
              timestamp: Date.now(),
            });
            console.error("Personal bot auto-response error:", e);
          }
        })();
      }
    }
  });

  // Clear conversation chat history for user
  app.post("/api/messages/clear", (req, res) => {
    const { userId, contactId, targetUserId, groupId } = req.body;
    const rawTarget = (contactId || targetUserId || req.body.receiverId) as string | undefined;
    const isGroup = !!groupId || (rawTarget && rawTarget.startsWith("g_"));
    const effectiveGroupId = groupId || (rawTarget && rawTarget.startsWith("g_") ? rawTarget : undefined);
    const effectiveContactId = isGroup ? undefined : rawTarget;

    if (!userId || (!effectiveContactId && !effectiveGroupId)) {
      res.status(400).json({ error: "userId and (contactId, targetUserId, or groupId) are required" });
      return;
    }

    const convKey = effectiveGroupId ? effectiveGroupId : getConversationKey(userId, effectiveContactId!);
    let count = 0;
    for (const m of messages) {
      const isTargetGroup = effectiveGroupId && (m.groupId === effectiveGroupId || m.conversationId === effectiveGroupId);
      const isTargetDirect = !effectiveGroupId && (
        m.conversationId === convKey ||
        (!m.groupId && (
          (m.senderId === userId && m.receiverId === effectiveContactId) ||
          (m.senderId === effectiveContactId && m.receiverId === userId)
        ))
      );

      if (isTargetGroup || isTargetDirect) {
        if (!m.deletedFor) {
          m.deletedFor = [];
        }
        if (!m.deletedFor.includes(userId)) {
          m.deletedFor.push(userId);
          persistMessageToFirestore(m);
          count++;
        }
      }
    }

    // Broadcast realtime event so any open instances or tabs update
    notifyUser(userId, "chat_cleared", {
      conversationId: convKey,
      contactId: effectiveContactId,
      groupId: effectiveGroupId,
    });

    res.json({ success: true, clearedCount: count });
  });

  // React to a message (Emoji reaction toggle)
  app.post("/api/messages/:id/react", (req, res) => {
    const msgId = req.params.id;
    const { userId, emoji } = req.body;
    if (!userId || !emoji) {
      res.status(400).json({ error: "userId and emoji are required" });
      return;
    }

    const msg = messages.find((m) => m.id === msgId);
    if (!msg) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    if (!msg.reactions) {
      msg.reactions = {};
    }

    const currentList = msg.reactions[emoji] || [];
    if (currentList.includes(userId)) {
      // Toggle off
      msg.reactions[emoji] = currentList.filter((u) => u !== userId);
      if (msg.reactions[emoji].length === 0) {
        delete msg.reactions[emoji];
      }
    } else {
      // Add reaction
      msg.reactions[emoji] = [...currentList, userId];
    }

    persistMessageToFirestore(msg);

    const reactionPayload = { messageId: msg.id, reactions: msg.reactions, conversationId: msg.conversationId };
    if (msg.groupId) {
      const grp = groups.get(msg.groupId);
      if (grp) {
        for (const mId of grp.memberIds) {
          notifyUser(mId, "message_reaction", reactionPayload);
        }
      }
    } else {
      notifyUser(msg.senderId, "message_reaction", reactionPayload);
      notifyUser(msg.receiverId, "message_reaction", reactionPayload);
    }

    res.json({ success: true, reactions: msg.reactions });
  });

  // Delete message for myself
  app.post("/api/messages/:id/delete-me", (req, res) => {
    const msgId = req.params.id;
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    const msg = messages.find((m) => m.id === msgId);
    if (msg) {
      if (!msg.deletedFor) {
        msg.deletedFor = [];
      }
      if (!msg.deletedFor.includes(userId)) {
        msg.deletedFor.push(userId);
        persistMessageToFirestore(msg);
      }
    }
    res.json({ success: true, messageId: msgId });
  });

  // Delete message for everyone
  app.delete("/api/messages/:id", (req, res) => {
    const msgId = req.params.id;
    const index = messages.findIndex((m) => m.id === msgId);
    if (index !== -1) {
      const msg = messages[index];
      msg.isDeletedForEveryone = true;
      msg.content = "This message was deleted";
      msg.type = "text";
      delete msg.metadata;
      msg.reactions = {};

      persistMessageToFirestore(msg);

      const deletePayload = { messageId: msgId, isDeletedForEveryone: true, conversationId: msg.conversationId };
      if (msg.groupId) {
        const grp = groups.get(msg.groupId);
        if (grp) {
          for (const mId of grp.memberIds) {
            notifyUser(mId, "message_deleted", deletePayload);
          }
        }
      } else {
        notifyUser(msg.senderId, "message_deleted", deletePayload);
        notifyUser(msg.receiverId, "message_deleted", deletePayload);
      }
    }
    res.json({ success: true, messageId: msgId });
  });

  // Forward message to another contact or group
  app.post("/api/messages/forward", (req, res) => {
    const { senderId, targetId, isGroup, originalMessageId } = req.body;
    const orig = messages.find((m) => m.id === originalMessageId);
    if (!orig || !senderId || !targetId) {
      res.status(400).json({ error: "Missing required parameters" });
      return;
    }

    const sender = users.get(senderId);
    const msgId = "m_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

    if (isGroup) {
      const newMsg: MessageRecord = {
        id: msgId,
        conversationId: targetId,
        groupId: targetId,
        senderId,
        receiverId: targetId,
        type: orig.type,
        content: orig.content,
        metadata: orig.metadata ? { ...orig.metadata } : undefined,
        timestamp: Date.now(),
        read: true,
        isGroup: true,
        isForwarded: true,
        senderName: sender?.fullName || "Group Member",
        senderAvatar: sender?.avatar || "",
        senderUsername: sender?.username || "",
      };
      messages.push(newMsg);
      persistMessageToFirestore(newMsg);
      const group = groups.get(targetId);
      if (group) {
        group.lastMessage = orig.content;
        group.lastMessageTime = Date.now();
        for (const mId of group.memberIds) {
          if (mId !== senderId) notifyUser(mId, "new_message", newMsg);
        }
      }
      res.json({ success: true, message: newMsg });
      return;
    }

    // Direct message forward
    const convKey = getConversationKey(senderId, targetId);
    const newMsg: MessageRecord = {
      id: msgId,
      conversationId: convKey,
      senderId,
      receiverId: targetId,
      type: orig.type,
      content: orig.content,
      metadata: orig.metadata ? { ...orig.metadata } : undefined,
      timestamp: Date.now(),
      read: false,
      isForwarded: true,
      senderName: sender?.fullName || "User",
      senderAvatar: sender?.avatar || "",
      senderUsername: sender?.username || "",
    };
    messages.push(newMsg);
    persistMessageToFirestore(newMsg);
    notifyUser(targetId, "new_message", newMsg);
    res.json({ success: true, message: newMsg });
  });

  // SSE Stream for Real-time events
  app.get("/api/events", (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) {
      res.status(400).end("userId required");
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    // Send initial handshake
    res.write(`event: connected\ndata: ${JSON.stringify({ userId, time: Date.now() })}\n\n`);

    if (!sseClients.has(userId)) {
      sseClients.set(userId, []);
    }
    sseClients.get(userId)!.push(res);

    // Keep-alive ping every 25 seconds
    const pingInterval = setInterval(() => {
      try {
        res.write(": keepalive\n\n");
      } catch (e) {
        clearInterval(pingInterval);
      }
    }, 25000);

    req.on("close", () => {
      clearInterval(pingInterval);
      const list = sseClients.get(userId) || [];
      const idx = list.indexOf(res);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
      if (list.length === 0) {
        sseClients.delete(userId);
      }
    });
  });

  // -------------------------------------------------------------
  // API 404 & ERROR HANDLING (Guarantees JSON, NEVER HTML for /api/*)
  // -------------------------------------------------------------

  // Fallback for any unhandled /api/* endpoint
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });

  // API error handler catching JSON parse errors, syntax errors, and uncaught API exceptions
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith("/api")) {
      console.error("API error handler caught:", err);
      if (res.headersSent) {
        return next(err);
      }
      const statusCode = typeof err.status === "number" ? err.status : (typeof err.statusCode === "number" ? err.statusCode : 500);
      res.status(statusCode).json({
        error: err.message || "An unexpected server error occurred",
      });
      return;
    }
    next(err);
  });

  // -------------------------------------------------------------
  // VITE & STATIC SERVING
  // -------------------------------------------------------------

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Z-messenger server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
