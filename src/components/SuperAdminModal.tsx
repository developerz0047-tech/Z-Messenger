import React, { useState, useEffect } from "react";
import { User, AdminUser, UserReport, ChatbotAccessRequest } from "../types";
import {
  ShieldAlert,
  Users,
  MessageSquare,
  Radio,
  Trash2,
  X,
  Search,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  UserX,
  Eye,
  EyeOff,
  KeyRound,
  Ban,
  Lock,
  Flag,
  ShieldCheck,
  Check,
  Bot,
  Sparkles,
  Phone,
  XCircle,
  Clock,
  Send,
} from "lucide-react";

interface SuperAdminModalProps {
  currentUser: User;
  onClose: () => void;
  onUserDeleted?: (deletedUserId: string) => void;
}

export const SuperAdminModal: React.FC<SuperAdminModalProps> = ({
  currentUser,
  onClose,
  onUserDeleted,
}) => {
  const [activeTab, setActiveTab] = useState<"users" | "bot_requests" | "reports">("users");
  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [reportsList, setReportsList] = useState<UserReport[]>([]);
  const [botRequests, setBotRequests] = useState<ChatbotAccessRequest[]>([]);
  const [botRequestFilter, setBotRequestFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [stats, setStats] = useState<{
    totalUsers: number;
    onlineUsers: number;
    totalGroups: number;
    totalMessages: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<AdminUser | null>(null);
  const [changePasswordUser, setChangePasswordUser] = useState<AdminUser | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [userBotFilter, setUserBotFilter] = useState<"all" | "approved" | "requested" | "none">("all");
  const [directAllowUserId, setDirectAllowUserId] = useState<string>("");
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [usersRes, statsRes, reportsRes, botReqRes] = await Promise.all([
        fetch(`/api/admin/users?requesterId=${currentUser.id}`),
        fetch(`/api/admin/stats?requesterId=${currentUser.id}`),
        fetch(`/api/reports?userId=${currentUser.id}`),
        fetch(`/api/admin/bot-requests?requesterId=${currentUser.id}`),
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsersList(usersData.users || []);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        setReportsList(reportsData.reports || []);
      }
      if (botReqRes.ok) {
        const botReqData = await botReqRes.json();
        setBotRequests(botReqData.requests || []);
      }
    } catch (err: any) {
      console.error("Admin fetch error:", err);
      setNotification({ type: "error", text: "Failed to load admin data. Verify superadmin access." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [currentUser.id]);

  // Handle Approve or Reject Chatbot Access Request
  const handleBotRequestAction = async (requestId: string, action: "approve" | "reject", targetUserId?: string) => {
    try {
      setActionInProgressId(requestId);
      const res = await fetch("/api/admin/bot-requests/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: currentUser.id,
          requesterId: currentUser.id,
          requestId,
          targetUserId,
          action,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process chatbot access request");
      }

      // Update local requests list
      setBotRequests((prev) =>
        prev.map((r) =>
          r.id === requestId || r.userId === targetUserId
            ? { ...r, status: action === "approve" ? "approved" : "rejected", reviewedAt: Date.now() }
            : r
        )
      );

      // Also update user in usersList if matching
      const resolvedUserId = targetUserId || data.request?.userId;
      if (resolvedUserId) {
        setUsersList((prev) =>
          prev.map((u) =>
            u.id === resolvedUserId
              ? { ...u, botAccessStatus: action === "approve" ? "approved" : "rejected" }
              : u
          )
        );
      }

      setNotification({
        type: "success",
        text:
          action === "approve"
            ? `Chatbot access granted for user.`
            : `Chatbot access request rejected.`,
      });
    } catch (err: any) {
      setNotification({ type: "error", text: err?.message || "Failed to process request" });
    } finally {
      setActionInProgressId(null);
    }
  };

  // Directly Toggle a User's Chatbot Access on the Users Table or Anywhere
  const handleToggleUserBotAccess = async (targetUser: AdminUser, allow: boolean) => {
    try {
      setActionInProgressId(targetUser.id);
      const res = await fetch(`/api/admin/users/${targetUser.id}/toggle-bot-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: currentUser.id,
          requesterId: currentUser.id,
          allow,
          status: allow ? "approved" : "none",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to toggle bot access");
      }

      // Update usersList
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === targetUser.id
            ? { ...u, botAccessStatus: allow ? "approved" : "none" }
            : u
        )
      );

      // Also update botRequests if this user had a request entry
      setBotRequests((prev) =>
        prev.map((r) =>
          r.userId === targetUser.id
            ? { ...r, status: allow ? "approved" : "rejected", reviewedAt: Date.now() }
            : r
        )
      );

      setNotification({
        type: "success",
        text: allow
          ? `Chatbot access granted to @${targetUser.username} (${targetUser.fullName}).`
          : `Chatbot access revoked from @${targetUser.username}.`,
      });
    } catch (err: any) {
      setNotification({ type: "error", text: err?.message || "Failed to update bot access" });
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleResolveReport = async (reportId: string, action: "disable_user" | "dismiss") => {
    try {
      setActionInProgressId(reportId);
      const res = await fetch("/api/reports/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: currentUser.id,
          reportId,
          action,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to resolve report");
      }

      setReportsList((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, status: action === "disable_user" ? "resolved" : "dismissed" }
            : r
        )
      );

      if (action === "disable_user" && data.reportedUserId) {
        setUsersList((prev) =>
          prev.map((u) => (u.id === data.reportedUserId ? { ...u, disabled: true, status: "offline" } : u))
        );
      }

      setNotification({
        type: "success",
        text:
          action === "disable_user"
            ? "Report resolved and violator account has been immediately disabled."
            : "Report has been dismissed.",
      });
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to process report" });
    } finally {
      setActionInProgressId(null);
    }
  };

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const handleToggleDisabled = async (target: AdminUser) => {
    try {
      setActionInProgressId(target.id);
      const nextDisabled = !target.disabled;
      const res = await fetch(`/api/admin/users/${target.id}/toggle-disabled?requesterId=${currentUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: nextDisabled, requesterId: currentUser.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update account status");
      }

      setUsersList((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, disabled: nextDisabled, status: nextDisabled ? "offline" : u.status } : u))
      );

      setNotification({
        type: "success",
        text: nextDisabled
          ? `Account @${target.username} has been disabled.`
          : `Account @${target.username} has been enabled.`,
      });
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to update account state" });
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changePasswordUser || !newPasswordInput.trim()) return;

    try {
      setActionInProgressId(changePasswordUser.id);
      const res = await fetch(`/api/admin/users/${changePasswordUser.id}/password?requesterId=${currentUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword: newPasswordInput.trim(),
          requesterId: currentUser.id,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to change password");
      }

      setUsersList((prev) =>
        prev.map((u) => (u.id === changePasswordUser.id ? { ...u, password: newPasswordInput.trim() } : u))
      );

      setNotification({
        type: "success",
        text: `Password for @${changePasswordUser.username} was updated successfully.`,
      });
      setChangePasswordUser(null);
      setNewPasswordInput("");
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to change password" });
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleDeleteAccount = async (target: AdminUser) => {
    try {
      setDeletingId(target.id);
      const res = await fetch(`/api/admin/users/${target.id}?requesterId=${currentUser.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete account");
      }

      setUsersList((prev) => prev.filter((u) => u.id !== target.id));
      setNotification({
        type: "success",
        text: `Account for @${target.username} (${target.fullName}) was completely wiped.`,
      });
      setConfirmDeleteUser(null);
      if (onUserDeleted) {
        onUserDeleted(target.id);
      }
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to delete account" });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredUsers = usersList.filter((u) => {
    const q = searchTerm.toLowerCase().trim();
    const matchesQuery =
      !q ||
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phoneNumber && u.phoneNumber.toLowerCase().includes(q));

    if (!matchesQuery) return false;

    if (userBotFilter === "approved") {
      return u.role === "superadmin" || u.botAccessStatus === "approved";
    }
    if (userBotFilter === "requested") {
      return u.botAccessStatus === "requested";
    }
    if (userBotFilter === "none") {
      return u.role !== "superadmin" && u.botAccessStatus !== "approved" && u.botAccessStatus !== "requested";
    }
    return true;
  });

  const pendingBotRequestsCount = botRequests.filter((r) => r.status === "pending").length;

  const filteredBotRequests = botRequests.filter((r) => {
    if (botRequestFilter === "all") return true;
    return r.status === botRequestFilter;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="superadmin-modal"
        className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl border border-red-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-red-700 via-rose-700 to-amber-700 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-md shadow-inner">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-wide">
                  Superadmin Control Center
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-white/25 border border-white/40">
                  Full Authority
                </span>
              </div>
              <p className="text-xs text-white/80">
                Logged in as <span className="font-bold underline">{currentUser.fullName}</span> ({currentUser.email})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications Toast */}
        {notification && (
          <div
            className={`px-4 py-2.5 flex items-center justify-between text-xs font-bold shrink-0 transition-all ${
              notification.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-b border-emerald-200"
                : "bg-red-50 text-red-800 border-b border-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{notification.text}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-neutral-500 hover:text-neutral-800 cursor-pointer text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Overview Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 pb-0 shrink-0">
            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[11px] font-bold uppercase">Total Users</span>
                <Users className="w-4 h-4 text-orange-500" />
              </div>
              <p className="text-xl font-black text-neutral-900">{stats.totalUsers}</p>
            </div>
            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[11px] font-bold uppercase">Online Now</span>
                <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
              </div>
              <p className="text-xl font-black text-emerald-600">{stats.onlineUsers}</p>
            </div>
            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[11px] font-bold uppercase">Pending Bot Requests</span>
                <Bot className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="text-xl font-black text-indigo-600">{pendingBotRequestsCount}</p>
            </div>
            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[11px] font-bold uppercase">Active Reports</span>
                <Flag className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-xl font-black text-neutral-900">
                {reportsList.filter((r) => r.status === "pending").length}
              </p>
            </div>
          </div>
        )}

        {/* Admin Navigation Tabs */}
        <div className="flex border-b border-neutral-200 px-4 gap-4 pt-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`pb-2 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "users"
                ? "text-red-600 border-b-2 border-red-600"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User Accounts & Passwords</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-neutral-100 text-neutral-600 font-bold">
              {usersList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("bot_requests")}
            className={`pb-2 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 relative ${
              activeTab === "bot_requests"
                ? "text-red-600 border-b-2 border-red-600"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-indigo-500" />
            <span>Chatbot Access Requests</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                pendingBotRequestsCount > 0
                  ? "bg-indigo-600 text-white animate-pulse"
                  : "bg-neutral-100 text-neutral-600"
              }`}
            >
              {pendingBotRequestsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("reports")}
            className={`pb-2 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 relative ${
              activeTab === "reports"
                ? "text-red-600 border-b-2 border-red-600"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Flag className="w-3.5 h-3.5 text-red-500" />
            <span>User Reports</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                reportsList.filter((r) => r.status === "pending").length > 0
                  ? "bg-red-600 text-white animate-pulse"
                  : "bg-neutral-100 text-neutral-600"
              }`}
            >
              {reportsList.filter((r) => r.status === "pending").length}
            </span>
          </button>
        </div>

        {/* ===================================================================== */}
        {/* TAB 1: USERS MANAGEMENT */}
        {/* ===================================================================== */}
        {activeTab === "users" && (
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            {/* Search and Refresh Bar */}
            <div className="flex items-center justify-between gap-3 pb-2.5 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search users by name, username (@), email, or phone number..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200 focus:bg-white focus:border-red-500 text-xs text-neutral-900 outline-hidden transition-all"
                />
              </div>
              <button
                onClick={fetchAdminData}
                disabled={loading}
                className="px-3 py-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Quick Status & Bot Filter Pills */}
            <div className="flex items-center gap-1.5 pb-3 overflow-x-auto shrink-0">
              <span className="text-[10px] font-extrabold text-neutral-400 mr-1 shrink-0 uppercase tracking-wider">
                Filter:
              </span>
              {(
                [
                  { id: "all", label: "All Accounts", count: usersList.length, activeClass: "bg-neutral-900 text-white shadow-xs" },
                  {
                    id: "approved",
                    label: "Bot Allowed",
                    count: usersList.filter((u) => u.role === "superadmin" || u.botAccessStatus === "approved").length,
                    activeClass: "bg-emerald-600 text-white shadow-xs",
                  },
                  {
                    id: "requested",
                    label: "Bot Requested",
                    count: usersList.filter((u) => u.botAccessStatus === "requested").length,
                    activeClass: "bg-amber-600 text-white shadow-xs",
                  },
                  {
                    id: "none",
                    label: "No Bot Access",
                    count: usersList.filter(
                      (u) => u.role !== "superadmin" && u.botAccessStatus !== "approved" && u.botAccessStatus !== "requested"
                    ).length,
                    activeClass: "bg-neutral-700 text-white shadow-xs",
                  },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setUserBotFilter(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    userBotFilter === f.id
                      ? f.activeClass
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  <span>{f.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      userBotFilter === f.id ? "bg-white/25 text-white" : "bg-neutral-200/80 text-neutral-700"
                    }`}
                  >
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            {/* User Accounts Management List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {loading ? (
                <div className="py-12 text-center text-xs text-neutral-400">Loading user accounts...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-500">No users match your search query.</div>
              ) : (
                filteredUsers.map((user) => {
                  const isSelf = user.id === currentUser.id || user.email === "hashir0047@gmail.com";
                  const isPasswordVisible = !!visiblePasswords[user.id];
                  const hasBotAccess = user.role === "superadmin" || user.botAccessStatus === "approved";

                  return (
                    <div
                      key={user.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        user.disabled
                          ? "border-red-200 bg-red-50/40"
                          : "border-neutral-200/80 bg-neutral-50/50 hover:bg-neutral-50"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <img
                            src={user.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                            alt={user.fullName}
                            className={`w-11 h-11 rounded-full object-cover border ${
                              user.disabled ? "opacity-60 grayscale border-red-300" : "border-neutral-300"
                            }`}
                          />
                          <span
                            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                              user.disabled
                                ? "bg-red-500"
                                : user.status === "online"
                                ? "bg-emerald-500"
                                : "bg-neutral-400"
                            }`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold text-neutral-900 truncate">{user.fullName}</p>
                            {user.role === "superadmin" && (
                              <span className="px-1.5 py-0.2 rounded-md bg-red-100 text-red-700 text-[10px] font-extrabold uppercase">
                                Superadmin
                              </span>
                            )}
                            {user.disabled ? (
                              <span className="px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1">
                                <Ban className="w-2.5 h-2.5" />
                                Disabled
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                Active
                              </span>
                            )}

                            {/* Chatbot Permission Badge */}
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                                hasBotAccess
                                  ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                                  : user.botAccessStatus === "requested"
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : "bg-neutral-100 text-neutral-500"
                              }`}
                            >
                              <Bot className="w-3 h-3" />
                              <span>
                                {hasBotAccess
                                  ? "Bot: Approved"
                                  : user.botAccessStatus === "requested"
                                  ? "Bot: Requested"
                                  : "Bot: None"}
                              </span>
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-neutral-500 truncate mt-0.5 flex-wrap">
                            <span className="text-orange-600 font-semibold">@{user.username}</span>
                            <span>•</span>
                            <span className="truncate">{user.email}</span>
                            {user.phoneNumber && (
                              <>
                                <span>•</span>
                                <span className="text-indigo-600 font-medium flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {user.phoneNumber}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Password Viewer for Superadmin */}
                          <div className="flex items-center gap-2 mt-1 text-[11px] bg-white/80 p-1 px-2 rounded-md border border-neutral-200/70 inline-flex">
                            <span className="font-semibold text-neutral-500 flex items-center gap-1">
                              <Lock className="w-3 h-3 text-neutral-400" />
                              Password:
                            </span>
                            <code className="font-mono text-neutral-900 font-bold bg-neutral-100 px-1.5 py-0.5 rounded">
                              {isPasswordVisible ? user.password || "No password set" : "••••••••"}
                            </code>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(user.id)}
                              title={isPasswordVisible ? "Hide password" : "Show password"}
                              className="text-neutral-500 hover:text-neutral-800 cursor-pointer p-0.5"
                            >
                              {isPasswordVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Actions Area */}
                      <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-200">
                        {/* Toggle Bot Access Direct Button */}
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => handleToggleUserBotAccess(user, !hasBotAccess)}
                            disabled={actionInProgressId === user.id}
                            title={hasBotAccess ? "Revoke chatbot access from this user" : "Allow chatbot access for this user"}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                              hasBotAccess
                                ? "bg-neutral-100 hover:bg-rose-50 text-neutral-700 hover:text-rose-700 border border-neutral-300 hover:border-rose-300"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-95"
                            }`}
                          >
                            <Bot className="w-3.5 h-3.5" />
                            <span>{hasBotAccess ? "Revoke Bot" : "Allow Bot"}</span>
                          </button>
                        )}

                        {/* Change Password Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setChangePasswordUser(user);
                            setNewPasswordInput("");
                          }}
                          title="Change account password"
                          className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                          <span>Change Pass</span>
                        </button>

                        {/* Disable / Enable Toggle Button */}
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => handleToggleDisabled(user)}
                            disabled={actionInProgressId === user.id}
                            title={user.disabled ? "Enable user account" : "Disable user account"}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                              user.disabled
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                : "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300"
                            }`}
                          >
                            {user.disabled ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Enable</span>
                              </>
                            ) : (
                              <>
                                <Ban className="w-3.5 h-3.5" />
                                <span>Disable</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Delete User Account Button */}
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteUser(user)}
                            title="Delete user account and all data"
                            className="p-1.5 rounded-lg bg-white hover:bg-red-50 text-neutral-400 hover:text-red-600 border border-neutral-200 hover:border-red-300 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 2: CHATBOT ACCESS REQUESTS */}
        {/* ===================================================================== */}
        {activeTab === "bot_requests" && (
          <div className="flex-1 flex flex-col p-4 overflow-hidden space-y-3">
            <div className="flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  Chatbot Permission & Access Requests ({botRequests.length})
                </h3>
                <p className="text-xs text-neutral-500">
                  Review users who entered their phone number and requested to enable the AI Chatbot
                </p>
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5">
                {(["all", "pending", "approved", "rejected"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setBotRequestFilter(filter)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                      botRequestFilter === filter
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Action: Directly Allow Bot for Any User */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-purple-50/50 to-emerald-50/30 border border-indigo-200/80 shadow-2xs shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 rounded-md bg-indigo-600 text-white">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-black text-indigo-950 uppercase tracking-wide">
                      Super Admin Direct Override
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-600">
                    Select any registered user to instantly allow or revoke their personal AI chatbot without waiting for a request.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <select
                    value={directAllowUserId}
                    onChange={(e) => setDirectAllowUserId(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-neutral-300 text-xs font-semibold text-neutral-800 outline-hidden focus:border-indigo-500 max-w-xs"
                  >
                    <option value="">-- Select User to Allow / Manage --</option>
                    {usersList
                      .filter((u) => u.id !== currentUser.id && u.email !== "hashir0047@gmail.com")
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} (@{u.username}) {u.botAccessStatus === "approved" ? "✓ [Allowed]" : u.botAccessStatus === "requested" ? "⏳ [Requested]" : "✗ [No Bot]"}
                        </option>
                      ))}
                  </select>

                  {directAllowUserId && (() => {
                    const selectedUser = usersList.find((u) => u.id === directAllowUserId);
                    if (!selectedUser) return null;
                    const isApproved = selectedUser.botAccessStatus === "approved";
                    return (
                      <button
                        type="button"
                        onClick={() => handleToggleUserBotAccess(selectedUser, !isApproved)}
                        disabled={actionInProgressId === selectedUser.id}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs disabled:opacity-50 ${
                          isApproved
                            ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        }`}
                      >
                        <Bot className="w-3.5 h-3.5" />
                        <span>{isApproved ? "Revoke Bot" : "Allow Bot for User"}</span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {filteredBotRequests.length === 0 ? (
                <div className="py-12 border border-dashed border-neutral-300 rounded-2xl text-center space-y-1 bg-neutral-50/50">
                  <Bot className="w-8 h-8 text-neutral-400 mx-auto mb-1" />
                  <p className="text-xs font-bold text-neutral-700">No Chatbot Requests Found</p>
                  <p className="text-[11px] text-neutral-400">
                    When users submit requests from their Chatbot settings tab, they will appear here.
                  </p>
                </div>
              ) : (
                filteredBotRequests.map((req) => (
                  <div
                    key={req.id}
                    className={`p-4 rounded-xl border transition-all space-y-2.5 ${
                      req.status === "pending"
                        ? "border-amber-300 bg-amber-50/40"
                        : req.status === "approved"
                        ? "border-emerald-200 bg-emerald-50/30"
                        : "border-neutral-200 bg-neutral-50/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={req.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                          alt={req.fullName}
                          className="w-11 h-11 rounded-full object-cover border border-neutral-300 shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-neutral-900">{req.fullName}</h4>
                            <span className="text-[11px] font-semibold text-orange-600">
                              @{req.username}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                req.status === "pending"
                                  ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
                                  : req.status === "approved"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : "bg-neutral-200 text-neutral-600"
                              }`}
                            >
                              {req.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-500 mt-0.5">
                            {req.email} • Requested {new Date(req.requestedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Phone Number Display */}
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-bold text-neutral-400 block uppercase">
                          Contact Phone Number
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md mt-0.5">
                          <Phone className="w-3 h-3" />
                          {req.phoneNumber}
                        </span>
                      </div>
                    </div>

                    {/* Notes from user */}
                    {req.notes && (
                      <div className="p-2.5 rounded-lg bg-white border border-neutral-200 text-xs text-neutral-700 space-y-0.5">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                          User's Stated Reason / Note:
                        </span>
                        <p className="leading-relaxed italic">"{req.notes}"</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-neutral-200/60">
                      {req.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleBotRequestAction(req.id, "reject", req.userId)}
                            disabled={actionInProgressId === req.id}
                            className="px-3 py-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5 text-neutral-400" />
                            <span>Reject Request</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBotRequestAction(req.id, "approve", req.userId)}
                            disabled={actionInProgressId === req.id}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve Chatbot Access</span>
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-neutral-500 italic">
                            Request was {req.status}
                          </span>
                          {req.status === "approved" && (
                            <button
                              type="button"
                              onClick={() => handleBotRequestAction(req.id, "reject", req.userId)}
                              disabled={actionInProgressId === req.id}
                              className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold cursor-pointer"
                            >
                              Revoke Access
                            </button>
                          )}
                          {req.status === "rejected" && (
                            <button
                              type="button"
                              onClick={() => handleBotRequestAction(req.id, "approve", req.userId)}
                              disabled={actionInProgressId === req.id}
                              className="px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold cursor-pointer"
                            >
                              Re-Approve
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 3: USER REPORTS */}
        {/* ===================================================================== */}
        {activeTab === "reports" && (
          <div className="flex-1 flex flex-col p-4 overflow-hidden space-y-3">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  User Moderation Reports ({reportsList.length})
                </h3>
                <p className="text-xs text-neutral-500">
                  Submitted flags and safety violations reported by community members
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {reportsList.length === 0 ? (
                <div className="py-12 border border-dashed border-neutral-300 rounded-2xl text-center space-y-1 bg-neutral-50/50">
                  <Flag className="w-8 h-8 text-neutral-400 mx-auto mb-1" />
                  <p className="text-xs font-bold text-neutral-700">No User Reports Found</p>
                  <p className="text-[11px] text-neutral-400">The platform is running clean with 0 open flags.</p>
                </div>
              ) : (
                reportsList.map((rep) => {
                  const reportedUser = usersList.find((u) => u.id === rep.reportedUserId);
                  const isUserDisabled = reportedUser?.disabled;

                  return (
                    <div
                      key={rep.id}
                      className={`p-4 rounded-xl border transition-all space-y-2.5 ${
                        rep.status === "pending"
                          ? "border-red-300 bg-red-50/40"
                          : rep.status === "resolved"
                          ? "border-emerald-200 bg-emerald-50/30"
                          : "border-neutral-200 bg-neutral-50/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={rep.reportedUserAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                            alt={rep.reportedUserName}
                            className="w-11 h-11 rounded-full object-cover border border-neutral-200"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-neutral-900">{rep.reportedUserName}</h4>
                              <span className="text-[11px] font-semibold text-orange-600">
                                @{rep.reportedUserUsername}
                              </span>
                              {isUserDisabled && (
                                <span className="px-1.5 py-0.2 rounded-md bg-red-600 text-white text-[9px] font-extrabold uppercase">
                                  Disabled
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-neutral-500 mt-0.5">
                              Reported by <span className="font-bold text-neutral-700">{rep.reporterName}</span> (@
                              {rep.reporterUsername}) on {new Date(rep.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            rep.status === "pending"
                              ? "bg-red-100 text-red-700 border border-red-200"
                              : rep.status === "resolved"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-neutral-200 text-neutral-600"
                          }`}
                        >
                          {rep.status}
                        </span>
                      </div>

                      {/* Report Reason & Details */}
                      <div className="p-2.5 rounded-lg bg-white border border-neutral-200/80 space-y-1">
                        <div className="flex items-center gap-1.5 text-red-700 font-bold text-xs">
                          <Flag className="w-3.5 h-3.5" />
                          <span>Reason: {rep.reason}</span>
                        </div>
                        {rep.details && (
                          <p className="text-xs text-neutral-600 italic bg-neutral-50 p-2 rounded-md">
                            "{rep.details}"
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        {rep.status === "pending" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleResolveReport(rep.id, "dismiss")}
                              disabled={actionInProgressId === rep.id}
                              className="px-3 py-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Dismiss Report
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolveReport(rep.id, "disable_user")}
                              disabled={actionInProgressId === rep.id || isUserDisabled}
                              className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>{isUserDisabled ? "Account Already Disabled" : "Disable Account"}</span>
                            </button>
                          </>
                        )}
                        {rep.status !== "pending" && (
                          <span className="text-[11px] text-neutral-400 italic">
                            Case {rep.status === "resolved" ? "resolved (violator disabled)" : "dismissed"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Change Password Dialog Modal */}
        {changePasswordUser && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-amber-300">
              <div className="flex items-center gap-3 text-amber-600 mb-3">
                <div className="p-3 rounded-full bg-amber-100">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">Change Account Password</h3>
                  <p className="text-xs text-neutral-500">
                    For user <span className="font-semibold text-neutral-900">@{changePasswordUser.username}</span>
                  </p>
                </div>
              </div>

              <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Current Password:
                  </label>
                  <div className="text-xs font-mono font-bold bg-neutral-100 p-2 rounded-lg text-neutral-800">
                    {changePasswordUser.password || "None set"}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Enter New Password:
                  </label>
                  <input
                    type="text"
                    required
                    minLength={4}
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Enter new password (min 4 characters)..."
                    className="w-full p-2.5 rounded-xl border border-neutral-300 focus:border-amber-500 text-sm font-semibold outline-hidden"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setChangePasswordUser(null);
                      setNewPasswordInput("");
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionInProgressId === changePasswordUser.id || !newPasswordInput.trim()}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {actionInProgressId === changePasswordUser.id ? (
                      <span>Saving...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Update Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Confirmation Modal to Delete Account */}
        {confirmDeleteUser && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-red-300">
              <div className="flex items-center gap-3 text-red-600 mb-3">
                <div className="p-3 rounded-full bg-red-100">
                  <UserX className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">Confirm Account Deletion</h3>
                  <p className="text-xs text-neutral-500">This action is irreversible</p>
                </div>
              </div>

              <p className="text-xs text-neutral-700 leading-relaxed mb-4">
                Are you sure you want to permanently delete the account for{" "}
                <span className="font-bold text-neutral-900">@{confirmDeleteUser.username}</span> (
                {confirmDeleteUser.fullName})? All of their messages, contact relationships, and personal data will be completely wiped from the platform immediately.
              </p>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  onClick={() => setConfirmDeleteUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteAccount(confirmDeleteUser)}
                  disabled={deletingId === confirmDeleteUser.id}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {deletingId === confirmDeleteUser.id ? (
                    <span>Deleting...</span>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Yes, Delete Account</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
