import React, { useState, useEffect, useRef } from "react";
import {
  User,
  Contact,
  Message,
  MessageType,
  Story,
} from "./types";
import { SplashScreen } from "./components/SplashScreen";
import { AuthModal } from "./components/AuthModal";
import { ContactList } from "./components/ContactList";
import { ChatArea } from "./components/ChatArea";
import { AddContactModal } from "./components/AddContactModal";
import { CreateGroupModal } from "./components/CreateGroupModal";
import { CreateStoryModal } from "./components/CreateStoryModal";
import { StoryViewerModal } from "./components/StoryViewerModal";
import { SuperAdminModal } from "./components/SuperAdminModal";
import { SettingsModal } from "./components/SettingsModal";
import { ReportUserModal } from "./components/ReportUserModal";
import { NotificationBanner, ActiveNotification } from "./components/NotificationBanner";
import { playMessageChime, showDesktopNotification } from "./utils/notifications";

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("z_user_session");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [stories, setStories] = useState<Story[]>([]);

  // Modals & Panels
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [isSuperAdminOpen, setIsSuperAdminOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null);
  const [reportingContact, setReportingContact] = useState<Contact | User | null>(null);
  const [activeNotification, setActiveNotification] = useState<ActiveNotification | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const webSocketRef = useRef<WebSocket | null>(null);
  const [showContactsSidebar, setShowContactsSidebar] = useState(false);

  // Listen for test notification trigger from settings
  useEffect(() => {
    const handleTestNotification = (e: any) => {
      const detail = e.detail;
      playMessageChime();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate([100, 50, 100]);
        } catch (err) {}
      }
      setActiveNotification({
        id: "test_" + Date.now(),
        message: {
          id: "test_m_" + Date.now(),
          conversationId: "test",
          senderId: "test_bot",
          type: "text",
          content: detail?.message || "This is how on-screen notifications appear on mobile & APK screens!",
          timestamp: Date.now(),
          read: true,
          senderName: detail?.senderName || "Z-Messenger APK Alert",
          senderAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100",
        },
        senderName: detail?.senderName || "Z-Messenger APK Alert",
        senderAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100",
        preview: detail?.message || "This is how on-screen notifications appear on mobile & APK screens!",
        timestamp: Date.now(),
      });
    };

    window.addEventListener("zmsg_test_notification", handleTestNotification);
    return () => {
      window.removeEventListener("zmsg_test_notification", handleTestNotification);
    };
  }, []);

  // Fetch stories from server / firestore
  const fetchStories = async (userId: string) => {
    try {
      const resp = await fetch(`/api/stories?userId=${userId}`);
      if (!resp.ok) return;
      const text = await resp.text();
      const data = text ? JSON.parse(text) : null;
      if (data?.stories) {
        setStories(data.stories);
      }
    } catch (e) {
      console.warn("Error fetching stories:", e);
    }
  };

  // Fetch contact list
  const fetchContacts = async (userId: string) => {
    try {
      const resp = await fetch(`/api/contacts?userId=${userId}`);
      if (!resp.ok) return;
      const text = await resp.text();
      const data = text ? JSON.parse(text) : null;
      if (data?.contacts) {
        setContacts(data.contacts);
      }
    } catch (e) {
      console.warn("Error fetching contacts:", e);
    }
  };

  // Initialize BroadcastChannel for cross-tab real-time testing
  useEffect(() => {
    try {
      const bc = new BroadcastChannel("z_messenger_p2p_channel");
      broadcastChannelRef.current = bc;

      bc.onmessage = (event) => {
        const { targetUserId, type, payload } = event.data;
        if (currentUser && targetUserId === currentUser.id) {
          handleIncomingRealtimeEvent(type, payload);
        }
      };
    } catch (e) {
      // BroadcastChannel fallback
    }

    return () => {
      broadcastChannelRef.current?.close();
    };
  }, [currentUser]);

  // Handle real-time updates for messages, presence, stories
  const handleIncomingRealtimeEvent = (type: string, payload: any) => {
    if (type === "new_message") {
      const msg: Message = payload;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      // Update contact's last message in sidebar
      setContacts((prev) =>
        prev.map((c) => {
          if (c.id === (msg.groupId || msg.senderId)) {
            return {
              ...c,
              lastMessage: msg.type === "text" ? msg.content : `[${msg.type} message]`,
              lastMessageTime: msg.timestamp,
              unreadCount: activeContact?.id === c.id ? 0 : (c.unreadCount || 0) + 1,
            };
          }
          return c;
        })
      );

      // Trigger on-screen banner, chime, and mobile vibration for incoming messages & AI bot replies
      if (currentUser && msg.senderId !== currentUser.id) {
        playMessageChime();

        const isBannersEnabled = localStorage.getItem("zmsg_banners_enabled") !== "false";
        if (isBannersEnabled) {
          const senderContact = contacts.find((c) => c.id === (msg.groupId || msg.senderId));
          const previewText = msg.type === "text"
            ? (msg.content || "")
            : `Sent a ${msg.type} message`;

          setActiveNotification({
            id: msg.id || "m_" + Date.now(),
            message: msg,
            senderName: msg.senderName || senderContact?.fullName || "Incoming Message",
            senderAvatar: msg.senderAvatar || senderContact?.avatar || "",
            groupName: msg.groupId ? (senderContact?.fullName || "Group") : undefined,
            preview: previewText,
            timestamp: msg.timestamp || Date.now(),
          });
        }

        showDesktopNotification(msg.senderName || "New Message", {
          body: msg.type === "text" ? msg.content : `[${msg.type}]`,
          icon: msg.senderAvatar,
          onClick: () => {
            const targetId = msg.groupId || msg.senderId;
            const target = contacts.find((c) => c.id === targetId);
            if (target) setActiveContact(target);
          },
        });
      }
    } else if (type === "contact_added" || type === "group_created") {
      if (currentUser) {
        fetchContacts(currentUser.id);
      }
    } else if (type === "new_story") {
      if (currentUser) {
        fetchStories(currentUser.id);
      }
    } else if (type === "chat_cleared") {
      const targetId = payload?.groupId || payload?.contactId;
      if (activeContact && (activeContact.id === targetId || activeContact.id === payload?.conversationId)) {
        setMessages([]);
      }
      if (targetId) {
        setContacts((prev) =>
          prev.map((c) => {
            if (c.id === targetId) {
              return {
                ...c,
                lastMessage: "",
                lastMessageTime: undefined,
                unreadCount: 0,
              };
            }
            return c;
          })
        );
      }
    }
  };

  // SSE setup when user is logged in
  useEffect(() => {
    if (!currentUser) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    fetchContacts(currentUser.id);
    fetchStories(currentUser.id);

    // Heartbeat presence
    const heartbeat = setInterval(() => {
      fetch("/api/users/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, status: "online" }),
      }).catch(() => {});
    }, 20000);

    // SSE connection
    const es = new EventSource(`/api/events?userId=${currentUser.id}`);
    eventSourceRef.current = es;

    // Native WebSocket connection for real-time events
    let ws: WebSocket | null = null;
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws?userId=${currentUser.id}`;
      ws = new WebSocket(wsUrl);
      webSocketRef.current = ws;

      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: "register", userId: currentUser.id }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const eventType = data.type || data.event;
          const payload = data.data || data.payload || data;

          if (eventType === "new_message") {
            handleIncomingRealtimeEvent("new_message", payload);
          } else if (eventType === "contact_added" || eventType === "group_created") {
            fetchContacts(currentUser.id);
          } else if (eventType === "new_story") {
            fetchStories(currentUser.id);
          } else if (eventType === "bot_access_status_changed" && payload) {
            const newStatus = payload.status;
            const updated = payload.user || {
              ...currentUser,
              botAccessStatus: newStatus,
            };
            setCurrentUser(updated);
            try {
              localStorage.setItem("z_user_session", JSON.stringify(updated));
            } catch (e) {}

            playMessageChime();
            const isApproved = newStatus === "approved";
            showDesktopNotification("Super Admin", {
              body: isApproved
                ? "AI Chatbot access APPROVED! You can now use your chatbot."
                : `AI Chatbot status updated: ${newStatus}`,
            });

            setActiveNotification({
              id: "bot_stat_" + Date.now(),
              message: {
                id: "m_bot_" + Date.now(),
                conversationId: "system",
                senderId: "superadmin",
                senderName: "Super Admin",
                senderAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100",
                receiverId: currentUser.id,
                type: "text",
                content: isApproved
                  ? "🎉 Super Admin granted you full access to the AI Chatbot! Head to Settings -> AI Chatbot to configure it."
                  : `Your AI Chatbot access was updated by Super Admin to: ${newStatus}`,
                timestamp: Date.now(),
              },
              senderName: "Super Admin",
              senderAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100",
              preview: isApproved
                ? "🎉 AI Chatbot Access Approved by Super Admin!"
                : `AI Chatbot status: ${newStatus}`,
              timestamp: Date.now(),
            });
          }
        } catch (e) {}
      };
    } catch (err) {}

    es.addEventListener("new_message", (e: any) => {
      try {
        const msg = JSON.parse(e.data);
        handleIncomingRealtimeEvent("new_message", msg);
      } catch (err) {}
    });

    es.addEventListener("contact_added", () => {
      fetchContacts(currentUser.id);
    });

    es.addEventListener("group_created", () => {
      fetchContacts(currentUser.id);
    });

    es.addEventListener("new_story", () => {
      fetchStories(currentUser.id);
    });

    es.addEventListener("chat_cleared", (e: any) => {
      try {
        const payload = JSON.parse(e.data);
        handleIncomingRealtimeEvent("chat_cleared", payload);
      } catch (err) {}
    });

    es.addEventListener("bot_access_status_changed", (e: any) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload) {
          const newStatus = payload.status;
          const updated = payload.user || {
            ...currentUser,
            botAccessStatus: newStatus,
          };
          setCurrentUser(updated);
          try {
            localStorage.setItem("z_user_session", JSON.stringify(updated));
          } catch (err) {}
          playMessageChime();
        }
      } catch (err) {}
    });

    return () => {
      clearInterval(heartbeat);
      es.close();
      eventSourceRef.current = null;
      if (ws) ws.close();
      webSocketRef.current = null;
    };
  }, [currentUser]);

  // Fetch messages when active contact changes
  useEffect(() => {
    if (!currentUser || !activeContact) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        const resp = await fetch(
          `/api/messages?userId=${currentUser.id}&contactId=${activeContact.id}`
        );
        if (!resp.ok) return;
        const text = await resp.text();
        const data = text ? JSON.parse(text) : null;
        if (data?.messages) {
          setMessages(data.messages);
        }
      } catch (e) {
        console.warn("Error loading messages:", e);
      }
    };

    loadMessages();
  }, [currentUser, activeContact]);

  // Send Message handler (Direct & Group)
  const handleSendMessage = async (
    type: MessageType,
    content: string,
    metadata?: any
  ) => {
    if (!currentUser || !activeContact) return;

    try {
      const isGroup = !!activeContact.isGroup;
      const resp = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: currentUser.id,
          receiverId: isGroup ? undefined : activeContact.id,
          groupId: isGroup ? activeContact.id : undefined,
          type,
          content,
          metadata,
        }),
      });

      const data = await resp.json();
      if (data.success && data.message) {
        setMessages((prev) => [...prev, data.message]);

        // Cross-tab broadcast notification for direct chat
        if (!isGroup) {
          broadcastChannelRef.current?.postMessage({
            targetUserId: activeContact.id,
            type: "new_message",
            payload: data.message,
          });
        }

        // Update contacts preview
        setContacts((prev) =>
          prev.map((c) =>
            c.id === activeContact.id
              ? {
                  ...c,
                  lastMessage: type === "text" ? content : `[${type} message]`,
                  lastMessageTime: Date.now(),
                }
              : c
          )
        );
      }
    } catch (e) {
      console.error("Failed to send message:", e);
    }
  };

  // Clear Chat History for current user
  const handleClearChat = async () => {
    if (!currentUser || !activeContact) return;
    try {
      const isGroup = !!activeContact.isGroup || activeContact.id.startsWith("g_");
      const targetId = activeContact.id;
      const res = await fetch("/api/messages/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          contactId: !isGroup ? targetId : undefined,
          targetUserId: !isGroup ? targetId : undefined,
          groupId: isGroup ? targetId : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessages([]);
        setContacts((prev) =>
          prev.map((c) => {
            if (c.id === targetId) {
              return {
                ...c,
                lastMessage: "",
                lastMessageTime: undefined,
                unreadCount: 0,
              };
            }
            return c;
          })
        );
      } else {
        console.error("Failed to clear chat:", data?.error || res.statusText);
      }
    } catch (e) {
      console.error("Failed to clear chat:", e);
    }
  };

  // Block or Unblock Contact
  const handleToggleBlockContact = async (contact: Contact | User) => {
    if (!currentUser) return;
    const isCurrentlyBlocked = currentUser.blockedUserIds?.includes(contact.id);
    const action = isCurrentlyBlocked ? "unblock" : "block";

    try {
      const res = await fetch("/api/users/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          targetUserId: contact.id,
          action,
        }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        try {
          localStorage.setItem("z_user_session", JSON.stringify(data.user));
        } catch (e) {}
        fetchContacts(currentUser.id);
      }
    } catch (e) {
      console.error("Failed to toggle block:", e);
    }
  };

  // Delete / Remove Contact
  const handleDeleteContact = async (contact: Contact | User) => {
    if (!currentUser) return;
    try {
      const res = await fetch("/api/contacts/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          contactId: contact.id,
        }),
      });
      if (res.ok) {
        setContacts((prev) => prev.filter((c) => c.id !== contact.id));
        if (activeContact?.id === contact.id) {
          setActiveContact(null);
        }
      }
    } catch (e) {
      console.error("Failed to delete contact:", e);
    }
  };

  // Delete Group (Creator deletes for all, or member leaves)
  const handleDeleteGroup = async (groupId: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/groups/${groupId}?userId=${currentUser.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setContacts((prev) => prev.filter((c) => c.id !== groupId));
        if (activeContact?.id === groupId) {
          setActiveContact(null);
        }
        fetchContacts(currentUser.id);
      }
    } catch (e) {
      console.error("Failed to delete group:", e);
    }
  };

  // User Authentication Success
  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    try {
      localStorage.setItem("z_user_session", JSON.stringify(user));
    } catch (e) {}
  };

  // Auto-dismiss splash screen after exactly 3 seconds failsafe
  useEffect(() => {
    if (showSplash) {
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  // User Logout
  const handleLogout = () => {
    if (currentUser) {
      fetch("/api/users/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, status: "offline" }),
      }).catch(() => {});
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      localStorage.removeItem("z_user_session");
    } catch (e) {}

    setCurrentUser(null);
    setActiveContact(null);
    setMessages([]);
    setContacts([]);
    setStories([]);
  };

  // Update User Profile handler
  const handleUpdateProfile = async (updated: Partial<User>): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const resp = await fetch("/api/users/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          fullName: updated.fullName,
          avatar: updated.avatar,
          username: updated.username,
          about: updated.about,
        }),
      });
      const data = await resp.json();
      if (resp.ok && data.success && data.user) {
        const mergedUser: User = { ...currentUser, ...data.user };
        setCurrentUser(mergedUser);
        try {
          localStorage.setItem("z_user_session", JSON.stringify(mergedUser));
        } catch (e) {}
        fetchContacts(currentUser.id);
        return true;
      } else {
        throw new Error(data.error || "Failed to update profile");
      }
    } catch (err: any) {
      console.error("Profile update error:", err);
      throw err;
    }
  };

  // Render Splash Screen First
  if (showSplash) {
    return <SplashScreen onContinue={() => setShowSplash(false)} />;
  }

  // Render Auth Modal if not logged in
  if (!currentUser) {
    return <AuthModal onSuccess={handleAuthSuccess} />;
  }

  const handleOpenChatFromNotification = (targetChatId: string) => {
    const target = contacts.find((c) => c.id === targetChatId);
    if (target) {
      setActiveContact(target);
      setShowContactsSidebar(false);
    } else {
      fetch(`/api/users/${targetChatId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            setActiveContact(data.user);
            setShowContactsSidebar(false);
          }
        })
        .catch(() => {});
    }
  };

  return (
    <div id="z-messenger-root" className="flex h-screen w-screen bg-neutral-100 overflow-hidden font-['Plus_Jakarta_Sans',sans-serif] relative">
      {/* On-screen Notification Banner (Visible on Desktop, Mobile, and Android APK) */}
      <NotificationBanner
        notification={activeNotification}
        onOpenChat={handleOpenChatFromNotification}
        onDismiss={() => setActiveNotification(null)}
      />
      {/* Left Contacts Sidebar */}
      <div
        className={`h-full ${
          activeContact ? "hidden md:flex" : "flex"
        } w-full md:w-80 lg:w-96 shrink-0 transition-all`}
      >
        <ContactList
          currentUser={currentUser}
          contacts={contacts}
          stories={stories}
          selectedContactId={activeContact?.id || null}
          onSelectContact={(c) => {
            setActiveContact(c);
            setShowContactsSidebar(false);
          }}
          onOpenAddContact={() => setIsAddContactOpen(true)}
          onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
          onOpenAddStory={() => setIsCreateStoryOpen(true)}
          onOpenStoryViewer={(idx) => setStoryViewerIndex(idx)}
          onOpenSuperAdmin={() => setIsSuperAdminOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLogout={handleLogout}
        />
      </div>

      {/* Main Chat Area */}
      <div
        className={`h-full ${
          activeContact ? "flex" : "hidden md:flex"
        } flex-1 overflow-hidden transition-all`}
      >
        <ChatArea
          currentUser={currentUser}
          activeContact={activeContact}
          contacts={contacts}
          messages={messages}
          onSendMessage={handleSendMessage}
          onBack={() => {
            setActiveContact(null);
            setShowContactsSidebar(true);
          }}
          onRefreshMessages={() => {
            if (activeContact && currentUser) {
              fetch(`/api/messages?userId=${currentUser.id}&contactId=${activeContact.id}`)
                .then((r) => r.json())
                .then((d) => {
                  if (d.messages) setMessages(d.messages);
                })
                .catch(() => {});
            }
          }}
          onToggleContactsSidebar={() => setShowContactsSidebar((prev) => !prev)}
          onGroupUpdated={(updatedGroup) => {
            if (currentUser) {
              fetchContacts(currentUser.id);
            }
            if (activeContact && activeContact.id === updatedGroup.id) {
              setActiveContact((prev) =>
                prev
                  ? {
                      ...prev,
                      fullName: updatedGroup.name || prev.fullName,
                      avatar: updatedGroup.avatar || prev.avatar,
                      groupData: updatedGroup,
                    }
                  : null
              );
            }
          }}
          onClearChat={handleClearChat}
          onToggleBlockContact={handleToggleBlockContact}
          onReportContact={(contact) => setReportingContact(contact)}
          onDeleteContact={handleDeleteContact}
          onDeleteGroup={handleDeleteGroup}
        />
      </div>

      {/* Report User Modal */}
      {reportingContact && currentUser && (
        <ReportUserModal
          currentUser={currentUser}
          targetUser={reportingContact}
          onClose={() => setReportingContact(null)}
          onReportSubmitted={() => {
            setReportingContact(null);
          }}
        />
      )}

      {/* Add Contact Modal */}
      {isAddContactOpen && (
        <AddContactModal
          currentUser={currentUser}
          contacts={contacts}
          onClose={() => setIsAddContactOpen(false)}
          onContactAdded={(contact) => {
            setContacts((prev) => {
              if (prev.some((c) => c.id === contact.id)) return prev;
              return [contact, ...prev];
            });
            setActiveContact(contact);
          }}
        />
      )}

      {/* Create Group Modal (> 2 members) */}
      {isCreateGroupOpen && (
        <CreateGroupModal
          currentUser={currentUser}
          contacts={contacts}
          onClose={() => setIsCreateGroupOpen(false)}
          onGroupCreated={(newGroup) => {
            setIsCreateGroupOpen(false);
            fetchContacts(currentUser.id);
            const groupContact: Contact = {
              id: newGroup.id,
              username: "group_" + newGroup.id.substring(0, 6),
              fullName: newGroup.name,
              avatar: newGroup.avatar,
              status: "online",
              isGroup: true,
              groupData: newGroup,
            };
            setActiveContact(groupContact);
          }}
        />
      )}

      {/* Create Story Modal (24h expiry & custom privacy restriction) */}
      {isCreateStoryOpen && (
        <CreateStoryModal
          currentUser={currentUser}
          contacts={contacts}
          onClose={() => setIsCreateStoryOpen(false)}
          onStoryCreated={(story) => {
            setStories((prev) => [story, ...prev]);
            setIsCreateStoryOpen(false);
          }}
        />
      )}

      {/* 24h Story Viewer Modal */}
      {storyViewerIndex !== null && stories.length > 0 && (
        <StoryViewerModal
          currentUser={currentUser}
          stories={stories}
          initialIndex={storyViewerIndex}
          onClose={() => setStoryViewerIndex(null)}
          onStoryDeleted={(deletedId) => {
            setStories((prev) => prev.filter((s) => s.id !== deletedId));
          }}
        />
      )}

      {/* Super Admin Control Modal (hashir0047@gmail.com) */}
      {isSuperAdminOpen && (
        <SuperAdminModal
          currentUser={currentUser}
          onClose={() => setIsSuperAdminOpen(false)}
          onUserDeleted={() => {
            fetchContacts(currentUser.id);
          }}
        />
      )}

      {/* Settings Modal (Add People, Create Group, Profile, About) */}
      {isSettingsOpen && (
        <SettingsModal
          currentUser={currentUser}
          onClose={() => setIsSettingsOpen(false)}
          onOpenAddContact={() => {
            setIsSettingsOpen(false);
            setIsAddContactOpen(true);
          }}
          onOpenCreateGroup={() => {
            setIsSettingsOpen(false);
            setIsCreateGroupOpen(true);
          }}
          onOpenSuperAdmin={() => {
            setIsSettingsOpen(false);
            setIsSuperAdminOpen(true);
          }}
          onLogout={() => {
            setIsSettingsOpen(false);
            handleLogout();
          }}
          onUpdateProfile={handleUpdateProfile}
          onUpdateCurrentUser={(updated) => {
            setCurrentUser(updated);
            try {
              localStorage.setItem("z_user_session", JSON.stringify(updated));
            } catch (e) {}
          }}
        />
      )}
    </div>
  );
}
