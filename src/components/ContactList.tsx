import React, { useState } from "react";
import { User, Contact, Story } from "../types";
import { AppLogo } from "./AppLogo";
import { UserProfileModal } from "./UserProfileModal";
import {
  UserPlus,
  Search,
  LogOut,
  Users,
  ShieldAlert,
  Plus,
  MessageSquare,
  Clock,
  Settings,
  Info,
} from "lucide-react";

interface ContactListProps {
  currentUser: User;
  contacts: Contact[];
  stories: Story[];
  selectedContactId: string | null;
  onSelectContact: (contact: Contact | null) => void;
  onOpenAddContact: () => void;
  onOpenCreateGroup: () => void;
  onOpenAddStory: () => void;
  onOpenStoryViewer: (index: number) => void;
  onOpenSuperAdmin: () => void;
  onOpenSettings?: () => void;
  onLogout: () => void;
}

export const ContactList: React.FC<ContactListProps> = ({
  currentUser,
  contacts = [],
  stories = [],
  selectedContactId,
  onSelectContact,
  onOpenAddContact,
  onOpenCreateGroup,
  onOpenAddStory,
  onOpenStoryViewer,
  onOpenSuperAdmin,
  onOpenSettings,
  onLogout,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "direct" | "groups">("all");
  const [selectedUserForAbout, setSelectedUserForAbout] = useState<Contact | null>(null);

  const isSuperAdmin =
    currentUser.role === "superadmin" || currentUser.email.toLowerCase() === "hashir0047@gmail.com";

  const safeContacts = contacts || [];
  const safeStories = stories || [];

  // Filter contacts by search query
  const filteredContacts = safeContacts.filter((c) => {
    const matchesSearch =
      c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.username.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === "direct") return !c.isGroup;
    if (activeTab === "groups") return !!c.isGroup;
    return true;
  });

  const directContactsCount = safeContacts.filter((c) => !c.isGroup).length;
  const groupsCount = safeContacts.filter((c) => c.isGroup).length;

  // Group stories by author so each author appears once in the stories bar
  const myStories = safeStories.filter((s) => s.userId === currentUser.id);
  const otherStories = safeStories.filter((s) => s.userId !== currentUser.id);

  const distinctAuthorStories: Story[] = [];
  const seenAuthors = new Set<string>();

  for (const st of otherStories) {
    if (!seenAuthors.has(st.userId)) {
      seenAuthors.add(st.userId);
      distinctAuthorStories.push(st);
    }
  }

  return (
    <div
      id="contacts-sidebar"
      className="w-full h-full flex flex-col bg-white border-r border-orange-100/80 shrink-0 relative select-none"
    >
      {/* Top App Header */}
      <div className="p-3.5 border-b border-orange-100 flex items-center justify-between bg-gradient-to-r from-orange-50/80 via-amber-50/50 to-white shrink-0">
        <AppLogo size="sm" showText={true} />

        <div className="flex items-center gap-1.5">
          {/* Settings Button */}
          {onOpenSettings && (
            <button
              id="open-settings-btn"
              onClick={onOpenSettings}
              title="Settings (Add People, Create Group, Profile)"
              className="p-2 rounded-xl bg-orange-100 text-orange-800 hover:bg-orange-200 transition-all shadow-xs cursor-pointer flex items-center gap-1"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* Superadmin Button */}
          {isSuperAdmin && (
            <button
              id="open-superadmin-btn"
              onClick={onOpenSuperAdmin}
              title="Super Admin Control Center (Delete users & manage site)"
              className="p-1.5 px-2 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all shadow-xs cursor-pointer flex items-center gap-1 text-[11px] font-bold active:scale-95"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          )}

          {/* Create Group Button */}
          <button
            id="open-create-group-btn"
            onClick={onOpenCreateGroup}
            title="Create group (more than 2 persons)"
            className="p-2 rounded-xl bg-amber-100 text-amber-800 hover:bg-amber-200 transition-all shadow-xs cursor-pointer"
          >
            <Users className="w-4 h-4" />
          </button>

          {/* Add Contact Button */}
          <button
            id="open-add-contact-btn"
            onClick={onOpenAddContact}
            title="Add contact by username"
            className="p-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition-all shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Current User Profile Card */}
      <div className="px-3.5 py-2.5 bg-amber-50/40 border-b border-orange-100/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <img
              src={currentUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
              alt={currentUser.fullName}
              className="w-9 h-9 rounded-full object-cover border-2 border-orange-400 shadow-xs"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
          </div>
          <div className="leading-tight min-w-0">
            <div className="flex items-center gap-1">
              <h4 className="text-xs font-bold text-neutral-900 truncate">{currentUser.fullName}</h4>
              {isSuperAdmin && (
                <span className="px-1 py-0.2 rounded-sm bg-red-100 text-red-700 text-[9px] font-extrabold uppercase">
                  Admin
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-orange-600 truncate block">
                @{currentUser.username}
              </span>
              {(isSuperAdmin || currentUser.botAccessStatus === "approved") && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  title={
                    currentUser.botConfig?.enabled
                      ? "AI Chatbot is ON (Click to turn OFF or configure)"
                      : "AI Chatbot is OFF (Click to turn ON or configure)"
                  }
                  className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[9px] font-extrabold transition-all cursor-pointer ${
                    currentUser.botConfig?.enabled
                      ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                      : "bg-neutral-200/80 text-neutral-600 hover:bg-neutral-300"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      currentUser.botConfig?.enabled ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"
                    }`}
                  />
                  <span>Bot {currentUser.botConfig?.enabled ? "ON" : "OFF"}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenSettings && (
            <button
              id="user-settings-quick-btn"
              onClick={onOpenSettings}
              title="Settings & Profile"
              className="p-1.5 rounded-lg text-neutral-500 hover:text-orange-600 hover:bg-orange-100/60 transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Sign out Button */}
          <button
            id="logout-btn"
            onClick={() => setShowLogoutConfirm(true)}
            title="Sign out"
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-red-200/80 bg-red-50/80 hover:bg-red-100 text-red-600 hover:text-red-700 transition-all text-[11px] font-bold cursor-pointer shrink-0"
          >
            <LogOut className="w-3 h-3" />
            <span>Exit</span>
          </button>
        </div>
      </div>

      {/* 24-HOUR STORIES BAR (WhatsApp / Instagram style) */}
      <div className="px-3 py-2.5 border-b border-orange-100/70 bg-neutral-50/40 shrink-0">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-700 flex items-center gap-1">
            <Clock className="w-3 h-3 text-orange-500" />
            24h Stories
          </span>
          <button
            onClick={onOpenAddStory}
            className="text-[11px] text-orange-600 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
          >
            <Plus className="w-3 h-3" />
            <span>Add</span>
          </button>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
          {/* Your Story Node */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div
              onClick={() => {
                if (myStories.length > 0) {
                  const firstMyIndex = stories.findIndex((s) => s.userId === currentUser.id);
                  onOpenStoryViewer(firstMyIndex >= 0 ? firstMyIndex : 0);
                } else {
                  onOpenAddStory();
                }
              }}
              className="relative cursor-pointer group"
            >
              <div
                className={`w-12 h-12 rounded-full p-0.5 transition-transform group-hover:scale-105 ${
                  myStories.length > 0
                    ? "bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 ring-2 ring-orange-400"
                    : "border-2 border-dashed border-neutral-300 group-hover:border-orange-500"
                }`}
              >
                <img
                  src={currentUser.avatar}
                  alt="Your story"
                  className="w-full h-full rounded-full object-cover border border-white"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold border-2 border-white shadow-xs">
                {myStories.length > 0 ? myStories.length : "+"}
              </div>
            </div>
            <span className="text-[10px] font-bold text-neutral-700 truncate w-14 text-center">
              Your Story
            </span>
          </div>

          {/* Contact Stories Nodes */}
          {distinctAuthorStories.map((story) => {
            const storyIndex = stories.findIndex((s) => s.id === story.id);

            return (
              <div
                key={story.id}
                onClick={() => onOpenStoryViewer(storyIndex >= 0 ? storyIndex : 0)}
                className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-amber-500 via-orange-500 to-pink-500 shadow-xs group-hover:scale-105 transition-transform">
                  <img
                    src={story.userAvatar}
                    alt={story.userFullName}
                    className="w-full h-full rounded-full object-cover border-2 border-white"
                  />
                </div>
                <span className="text-[10px] font-semibold text-neutral-800 truncate w-14 text-center">
                  {story.userFullName.split(" ")[0]}
                </span>
              </div>
            );
          })}

          {distinctAuthorStories.length === 0 && myStories.length === 0 && (
            <div
              onClick={onOpenAddStory}
              className="flex items-center gap-2 py-1 px-3 rounded-xl bg-orange-50/80 border border-dashed border-orange-200 text-orange-700 text-xs cursor-pointer hover:bg-orange-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">Post your first 24h story</span>
            </div>
          )}
        </div>
      </div>

      {/* Search Contacts Bar */}
      <div className="p-2.5 border-b border-orange-50 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
              <input
                id="filter-contacts-input"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search contacts & groups..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-neutral-50 border border-neutral-200 focus:bg-white focus:border-orange-500 text-xs text-neutral-900 outline-hidden transition-all"
              />
            </div>

            {/* Tab Filters */}
            <div className="flex items-center gap-1 mt-2">
              <button
                onClick={() => setActiveTab("all")}
                className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  activeTab === "all"
                    ? "bg-orange-500 text-white shadow-xs"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                All ({contacts.length})
              </button>
              <button
                onClick={() => setActiveTab("direct")}
                className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  activeTab === "direct"
                    ? "bg-orange-500 text-white shadow-xs"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                Direct ({directContactsCount})
              </button>
              <button
                onClick={() => setActiveTab("groups")}
                className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  activeTab === "groups"
                    ? "bg-orange-500 text-white shadow-xs"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                Groups ({groupsCount})
              </button>
            </div>
          </div>

          {/* Contacts & Groups Stream */}
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-2">
            {filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 px-6 text-center text-neutral-500">
                <div className="w-12 h-12 rounded-2xl bg-orange-100/60 text-orange-600 flex items-center justify-center mb-3">
                  {activeTab === "groups" ? <Users className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
                </div>
                <p className="text-xs font-bold text-neutral-700">
                  {activeTab === "groups" ? "No groups yet" : "No contacts found"}
                </p>
                <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                  {activeTab === "groups"
                    ? "Create a group of more than 2 persons to talk together!"
                    : "Add friends by username or select from registered users!"}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  {activeTab === "groups" ? (
                    <button
                      onClick={onOpenCreateGroup}
                      className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Create Group</span>
                    </button>
                  ) : (
                    <button
                      onClick={onOpenAddContact}
                      className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add Contact</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* GROUPS SECTION (shown in "groups" tab or when groups exist in "all" tab) */}
                {(activeTab === "groups" || (activeTab === "all" && filteredContacts.some((c) => c.isGroup))) && (
                  <div className="space-y-1">
                    <div className="px-2 pt-1 pb-0.5 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-50/60 rounded-lg">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-amber-600" />
                        <span>Groups ({filteredContacts.filter((c) => c.isGroup).length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={onOpenCreateGroup}
                        title="Create new group"
                        className="text-[10px] font-bold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
                      >
                        + Create
                      </button>
                    </div>

                    {filteredContacts
                      .filter((c) => c.isGroup)
                      .map((contact) => {
                        const isSelected = selectedContactId === contact.id;
                        return (
                          <div
                            key={contact.id}
                            onClick={() => onSelectContact(contact)}
                            className={`w-full p-2.5 rounded-xl flex items-center justify-between transition-all cursor-pointer text-left group ${
                              isSelected
                                ? "bg-orange-500/10 border border-orange-300 shadow-xs"
                                : "hover:bg-neutral-100/80 border border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative shrink-0">
                                <img
                                  src={contact.avatar || "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100"}
                                  alt={contact.fullName}
                                  className="w-11 h-11 object-cover rounded-2xl border border-orange-400"
                                />
                                <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-orange-500 text-white border-2 border-white">
                                  <Users className="w-2.5 h-2.5" />
                                </span>
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-xs font-bold text-neutral-900 truncate">{contact.fullName}</h4>
                                  <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 text-[9px] font-extrabold uppercase shrink-0">
                                    Group
                                  </span>
                                </div>
                                <p className="text-[11px] font-semibold text-orange-600 truncate">
                                  {contact.groupData?.memberIds?.length || 3} members
                                </p>
                                {contact.lastMessage ? (
                                  <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                                    {contact.lastMessage}
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-neutral-400 italic mt-0.5">
                                    Group conversation ready
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Right side indicators */}
                            <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                              {contact.lastMessageTime && (
                                <span className="text-[10px] text-neutral-400">
                                  {new Date(contact.lastMessageTime).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                              {contact.unreadCount ? (
                                <span className="w-5 h-5 rounded-full bg-orange-500 text-white font-bold text-[10px] flex items-center justify-center">
                                  {contact.unreadCount}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* DIRECT MESSAGES SECTION (shown in "direct" tab or when direct contacts exist in "all" tab) */}
                {(activeTab === "direct" || (activeTab === "all" && filteredContacts.some((c) => !c.isGroup))) && (
                  <div className="space-y-1">
                    {activeTab === "all" && filteredContacts.some((c) => c.isGroup) && (
                      <div className="px-2 pt-2 pb-0.5 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">
                        <span>Direct Messages ({filteredContacts.filter((c) => !c.isGroup).length})</span>
                        <button
                          type="button"
                          onClick={onOpenAddContact}
                          title="Add new contact"
                          className="text-[10px] font-bold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
                        >
                          + Add
                        </button>
                      </div>
                    )}

                    {filteredContacts
                      .filter((c) => !c.isGroup)
                      .map((contact) => {
                        const isSelected = selectedContactId === contact.id;
                        return (
                          <div
                            key={contact.id}
                            onClick={() => onSelectContact(contact)}
                            className={`w-full p-2.5 rounded-xl flex items-center justify-between transition-all cursor-pointer text-left group ${
                              isSelected
                                ? "bg-orange-500/10 border border-orange-300 shadow-xs"
                                : "hover:bg-neutral-100/80 border border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className="relative shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedUserForAbout(contact);
                                }}
                                title="Click to view profile and About"
                              >
                                <img
                                  src={contact.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                                  alt={contact.fullName}
                                  className="w-11 h-11 rounded-full object-cover border border-neutral-200 group-hover:border-orange-400 transition-colors"
                                />
                                <span
                                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                                    contact.status === "online"
                                      ? "bg-emerald-500"
                                      : contact.status === "in-call"
                                      ? "bg-amber-500"
                                      : "bg-neutral-300"
                                  }`}
                                />
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-xs font-bold text-neutral-900 truncate">{contact.fullName}</h4>
                                </div>
                                <p className="text-[11px] font-semibold text-orange-600 truncate">
                                  @{contact.username}
                                </p>
                                {contact.lastMessage ? (
                                  <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                                    {contact.lastMessage}
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-neutral-400 italic mt-0.5">
                                    {contact.status === "online" ? "Active now" : "Offline"}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Right action and badges */}
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              {/* About / Info Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedUserForAbout(contact);
                                }}
                                title="Click to see person profile and About"
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer"
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>

                              <div className="flex flex-col items-end gap-1">
                                {contact.lastMessageTime && (
                                  <span className="text-[10px] text-neutral-400">
                                    {new Date(contact.lastMessageTime).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                )}
                                {contact.unreadCount ? (
                                  <span className="w-5 h-5 rounded-full bg-orange-500 text-white font-bold text-[10px] flex items-center justify-center">
                                    {contact.unreadCount}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </>
            )}
          </div>

      {/* User Profile / About Modal */}
      {selectedUserForAbout && (
        <UserProfileModal
          user={selectedUserForAbout}
          currentUser={currentUser}
          onClose={() => setSelectedUserForAbout(null)}
          onStartChat={(u) => {
            onSelectContact(u as Contact);
            setSelectedUserForAbout(null);
          }}
        />
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            id="logout-confirm-dialog"
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-orange-200 text-center animate-in zoom-in-95 duration-150"
          >
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 border border-red-200 flex items-center justify-center mx-auto mb-4">
              <LogOut className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-bold text-neutral-900 font-['Outfit',sans-serif]">
              Log out of Z-messenger?
            </h3>
            <p className="mt-1.5 text-xs text-neutral-600 leading-relaxed">
              Are you sure you want to sign out of <span className="font-bold text-orange-600">@{currentUser.username}</span>?
            </p>

            <div className="mt-6 flex items-center gap-2.5 justify-center">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-neutral-300 text-neutral-700 font-semibold text-xs hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-logout-btn"
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-red-600/20 transition-all cursor-pointer"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
