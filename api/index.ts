import { VercelRequest, VercelResponse } from "@vercel/node";
import { getApps, getApp, initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  Firestore,
} from "firebase/firestore";
import fs from "fs";
import path from "path";

// Initialize Firestore
let firestoreDb: Firestore | null = null;
try {
  let rawCfg: any = null;
  const cfgPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(cfgPath)) {
    rawCfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
  } else if (process.env.FIREBASE_CONFIG) {
    rawCfg = JSON.parse(process.env.FIREBASE_CONFIG);
  }

  if (rawCfg) {
    const fbApp = getApps().length > 0 ? getApp() : initializeApp(rawCfg);
    firestoreDb = rawCfg.firestoreDatabaseId
      ? getFirestore(fbApp, rawCfg.firestoreDatabaseId)
      : getFirestore(fbApp);
  }
} catch (err) {
  console.warn("Vercel API Firestore initialization notice:", err);
}

function cleanForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.filter((v) => v !== undefined).map((v) => cleanForFirestore(v));
  }
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = cleanForFirestore(val);
    }
  }
  return clean;
}

function createSafeUser(user: any) {
  const rawBot = user.botConfig;
  const isSuper = user.role === "superadmin" || (user.email && user.email.toLowerCase() === "hashir0047@gmail.com");
  const accessStatus = user.botAccessStatus || (isSuper ? "approved" : "none");
  const userPhone = user.phoneNumber || rawBot?.phoneNumber || "";

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    avatar: user.avatar,
    role: user.role,
    status: user.status || "online",
    createdAt: user.createdAt,
    lastSeen: user.lastSeen || Date.now(),
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Normalize path
  const urlObj = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = urlObj.pathname.replace(/^\/api/, "");

  try {
    // 1. Health check
    if (pathname === "/health" || pathname === "") {
      return res.status(200).json({ status: "ok", app: "Z-messenger", platform: "vercel" });
    }

    // 2. Check Availability
    if (pathname === "/auth/check-availability" && req.method === "GET") {
      const email = String(req.query.email || "").trim().toLowerCase();
      const username = String(req.query.username || "").trim().toLowerCase().replace(/^@/, "");
      const excludeUserId = String(req.query.excludeUserId || "");

      let emailTaken = false;
      let usernameTaken = false;

      if (firestoreDb && (email || username)) {
        const usersSnap = await getDocs(collection(firestoreDb, "users"));
        usersSnap.forEach((d) => {
          const u = d.data();
          if (u && u.id !== excludeUserId) {
            if (email && u.email && u.email.toLowerCase() === email) {
              emailTaken = true;
            }
            if (username && u.username && u.username.toLowerCase() === username) {
              usernameTaken = true;
            }
          }
        });
      }

      return res.status(200).json({ emailTaken, usernameTaken });
    }

    // 3. Register
    if (pathname === "/auth/register" && req.method === "POST") {
      const { email, password, username, fullName, avatar } = req.body || {};

      if (!email || !password || !username || !fullName) {
        return res.status(400).json({ error: "Missing required fields (email, password, username, fullName)" });
      }

      const cleanEmail = String(email).trim().toLowerCase();
      const cleanUsername = String(username).trim().toLowerCase().replace(/^@/, "");

      if (!firestoreDb) {
        return res.status(503).json({ error: "Database not connected. Please check configuration." });
      }

      // Check unique email and username
      const usersSnap = await getDocs(collection(firestoreDb, "users"));
      let emailExists = false;
      let usernameExists = false;

      usersSnap.forEach((d) => {
        const u = d.data();
        if (u) {
          if (u.email && u.email.toLowerCase() === cleanEmail) emailExists = true;
          if (u.username && u.username.toLowerCase() === cleanUsername) usernameExists = true;
        }
      });

      if (emailExists) {
        return res.status(409).json({ error: "An account with this email address already exists. Please log in." });
      }
      if (usernameExists) {
        return res.status(409).json({ error: "This username is already taken. Please choose a unique username." });
      }

      const userId = "u_" + Math.random().toString(36).substring(2, 11);
      const isSuperadmin = cleanEmail === "hashir0047@gmail.com";

      const newUser = {
        id: userId,
        email: cleanEmail,
        username: cleanUsername,
        fullName: String(fullName).trim(),
        avatar: avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        password: password,
        role: isSuperadmin ? "superadmin" : "user",
        createdAt: Date.now(),
        lastSeen: Date.now(),
        status: "online",
      };

      await setDoc(doc(firestoreDb, "users", userId), cleanForFirestore(newUser));
      await setDoc(doc(firestoreDb, "contacts", userId), { userId, contactIds: [] });

      return res.status(201).json({ success: true, user: createSafeUser(newUser) });
    }

    // 4. Login
    if (pathname === "/auth/login" && req.method === "POST") {
      const { identifier, password } = req.body || {};

      if (!identifier || !password) {
        return res.status(400).json({ error: "Please enter your email or username and password." });
      }

      if (!firestoreDb) {
        return res.status(503).json({ error: "Database not connected. Please check configuration." });
      }

      const cleanId = String(identifier).trim().toLowerCase().replace(/^@/, "");

      let matchedUser: any = null;
      const usersSnap = await getDocs(collection(firestoreDb, "users"));
      usersSnap.forEach((d) => {
        const u = d.data();
        if (u) {
          if ((u.email && u.email.toLowerCase() === cleanId) || (u.username && u.username.toLowerCase() === cleanId)) {
            matchedUser = u;
          }
        }
      });

      // Also support superadmin fallback if database is empty
      if (!matchedUser && (cleanId === "hashir0047@gmail.com" || cleanId === "hashir0047")) {
        matchedUser = {
          id: "u_superadmin",
          email: "hashir0047@gmail.com",
          username: "hashir0047",
          fullName: "Hashir",
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
          password: "Hashir@56",
          role: "superadmin",
          createdAt: Date.now(),
          lastSeen: Date.now(),
          status: "online",
        };
        await setDoc(doc(firestoreDb, "users", "u_superadmin"), cleanForFirestore(matchedUser));
      }

      if (!matchedUser) {
        return res.status(401).json({ error: "Account does not exist with this email or username." });
      }

      if (matchedUser.password !== password) {
        return res.status(401).json({ error: "Incorrect password. Please verify and try again." });
      }

      if (matchedUser.disabled) {
        return res.status(403).json({ error: "Your account has been disabled by the administrator. Please contact support." });
      }

      matchedUser.status = "online";
      matchedUser.lastSeen = Date.now();
      const userRole = matchedUser.role || (matchedUser.email === "hashir0047@gmail.com" ? "superadmin" : "user");
      matchedUser.role = userRole;

      await setDoc(doc(firestoreDb, "users", matchedUser.id), cleanForFirestore(matchedUser));

      return res.status(200).json({ success: true, user: createSafeUser(matchedUser) });
    }

    // 5. Contacts listing
    if (pathname === "/contacts" && req.method === "GET") {
      const userId = String(req.query.userId || "");
      if (!userId || !firestoreDb) {
        return res.status(200).json({ contacts: [] });
      }

      const contactDoc = await getDoc(doc(firestoreDb, "contacts", userId));
      const contactIds: string[] = contactDoc.exists() ? (contactDoc.data()?.contactIds || []) : [];

      const usersSnap = await getDocs(collection(firestoreDb, "users"));
      const allUsersMap = new Map<string, any>();
      usersSnap.forEach((d) => {
        const u = d.data();
        if (u?.id) allUsersMap.set(u.id, u);
      });

      const contactList = contactIds.map((cId) => {
        const u = allUsersMap.get(cId);
        return {
          id: cId,
          fullName: u?.fullName || "User",
          username: u?.username || cId,
          avatar: u?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
          status: u?.status || "offline",
          about: u?.about || "",
          isGroup: false,
          isAiBot: cId === "z_assistant_ai",
        };
      });

      return res.status(200).json({ contacts: contactList });
    }

    // 6. Messages listing & sending
    if (pathname === "/messages" && req.method === "GET") {
      const userId = String(req.query.userId || "");
      const contactId = String(req.query.contactId || "");
      if (!userId || !contactId || !firestoreDb) {
        return res.status(200).json({ messages: [] });
      }

      const snap = await getDocs(collection(firestoreDb, "messages"));
      const msgs: any[] = [];
      snap.forEach((d) => {
        const m = d.data();
        if (
          (m.senderId === userId && m.receiverId === contactId) ||
          (m.senderId === contactId && m.receiverId === userId) ||
          (m.groupId && m.groupId === contactId)
        ) {
          msgs.push(m);
        }
      });
      msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      return res.status(200).json({ messages: msgs });
    }

    if (pathname === "/messages" && req.method === "POST") {
      const msg = req.body;
      if (!msg || !firestoreDb) {
        return res.status(400).json({ error: "Missing message payload" });
      }
      const msgId = msg.id || "m_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
      const toSave = { ...msg, id: msgId, timestamp: msg.timestamp || Date.now() };
      await setDoc(doc(firestoreDb, "messages", msgId), cleanForFirestore(toSave));
      return res.status(201).json({ success: true, message: toSave });
    }

    // 7. Stories listing & creation
    if (pathname === "/stories" && req.method === "GET") {
      if (!firestoreDb) return res.status(200).json({ stories: [] });
      const snap = await getDocs(collection(firestoreDb, "stories"));
      const now = Date.now();
      const list: any[] = [];
      snap.forEach((d) => {
        const s = d.data();
        if (s && s.expiresAt > now) list.push(s);
      });
      return res.status(200).json({ stories: list });
    }

    // 8. Presence
    if (pathname === "/users/presence" && req.method === "POST") {
      const { userId, status } = req.body || {};
      if (userId && firestoreDb) {
        const userRef = doc(firestoreDb, "users", userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          await setDoc(userRef, { status: status || "online", lastSeen: Date.now() }, { merge: true });
        }
      }
      return res.status(200).json({ success: true });
    }

    // 9. All users
    if (pathname === "/users/all" && req.method === "GET") {
      if (!firestoreDb) return res.status(200).json({ users: [] });
      const excludeUserId = String(req.query.excludeUserId || "");
      const snap = await getDocs(collection(firestoreDb, "users"));
      const all: any[] = [];
      snap.forEach((d) => {
        const u = d.data();
        if (u && u.id !== excludeUserId) {
          all.push({
            id: u.id,
            username: u.username,
            fullName: u.fullName,
            avatar: u.avatar,
            status: u.status,
            role: u.role || "user",
          });
        }
      });
      return res.status(200).json({ users: all });
    }

    // 10. Update Profile
    if (pathname === "/users/profile" && req.method === "POST") {
      const { userId, fullName, avatar, username, about } = req.body || {};
      if (!userId || !firestoreDb) {
        return res.status(404).json({ error: "User not found" });
      }
      const userRef = doc(firestoreDb, "users", userId);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        return res.status(404).json({ error: "User not found" });
      }
      const user = snap.data();
      if (fullName) user.fullName = String(fullName).trim();
      if (avatar !== undefined) user.avatar = avatar;
      if (about !== undefined) user.about = String(about).trim();
      if (username) {
        const cleanUsername = String(username).trim().toLowerCase().replace(/^@/, "");
        user.username = cleanUsername;
      }
      await setDoc(userRef, cleanForFirestore(user));
      return res.status(200).json({ success: true, user: createSafeUser(user) });
    }

    // Catch-all 404 JSON for unknown API endpoints
    return res.status(404).json({ error: `API endpoint not found: ${req.method} ${pathname}` });
  } catch (err: any) {
    console.error("Vercel Serverless Function Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
