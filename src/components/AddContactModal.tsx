import React, { useState, useEffect } from "react";
import { User, Contact } from "../types";
import { Search, UserPlus, X, Check, AlertCircle, Users, CheckCircle2 } from "lucide-react";

interface AddContactModalProps {
  currentUser: User;
  contacts?: Contact[];
  onClose: () => void;
  onContactAdded: (contact: Contact) => void;
}

export const AddContactModal: React.FC<AddContactModalProps> = ({
  currentUser,
  contacts = [],
  onClose,
  onContactAdded,
}) => {
  const [usernameInput, setUsernameInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundUser, setFoundUser] = useState<any | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const existingContactIds = new Set((contacts || []).map((c) => c.id));

  useEffect(() => {
    fetchAvailableUsers();
  }, [currentUser.id]);

  const fetchAvailableUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch(`/api/users/all?excludeUserId=${currentUser.id}`);
      const data = await res.json();
      if (data.users) {
        setAvailableUsers(data.users);
      }
    } catch (e) {
      console.warn("Failed to load available users:", e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    setFoundUser(null);
    setSuccessMessage(null);

    const clean = usernameInput.trim().toLowerCase().replace(/^@+/, "");
    if (!clean) {
      setSearchError("Please enter a username or email to search.");
      return;
    }

    if (clean === currentUser.username.toLowerCase() || clean === currentUser.email.toLowerCase()) {
      setSearchError("You cannot add your own account as a contact.");
      return;
    }

    setIsSearching(true);
    try {
      const resp = await fetch(`/api/users/search?username=${encodeURIComponent(clean)}`);
      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || "User not found.");
      }

      setFoundUser(data.user);
    } catch (err: any) {
      setSearchError(err.message || "User not found. Check the spelling or select from registered users below.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddUser = async (targetUsername: string) => {
    setIsAdding(true);
    setSearchError(null);

    try {
      const cleanUsername = targetUsername.replace(/^@+/, "");
      const resp = await fetch("/api/contacts/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          targetUsername: cleanUsername,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to add contact.");
      }

      setSuccessMessage(`@${cleanUsername} successfully added to your contacts!`);
      onContactAdded(data.contact);
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setSearchError(err.message || "Failed to add contact.");
    } finally {
      setIsAdding(false);
    }
  };

  // Real-time filtered suggestions as user types
  const cleanInput = usernameInput.trim().toLowerCase().replace(/^@+/, "");
  const filteredSuggestions = availableUsers.filter((u) => {
    if (!cleanInput) return true;
    return (
      u.username.toLowerCase().includes(cleanInput) ||
      u.fullName.toLowerCase().includes(cleanInput) ||
      (u.email && u.email.toLowerCase().includes(cleanInput))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div
        id="add-contact-modal"
        className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-orange-200 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-100 text-orange-600">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">Add New Contact</h2>
              <p className="text-xs text-neutral-500">Accurate search by username or email</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pr-0.5 space-y-4 pt-3">
          {/* Search Input Form */}
          <form onSubmit={handleSearch}>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1.5">
              Exact Username or Email
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-orange-600 font-bold text-sm">@</span>
                <input
                  id="search-username-input"
                  type="text"
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameInput(e.target.value);
                    setSearchError(null);
                  }}
                  placeholder="e.g. hashir0047, or username..."
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-neutral-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-neutral-900 text-sm outline-hidden"
                />
              </div>
              <button
                id="search-username-submit"
                type="submit"
                disabled={isSearching || !usernameInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shrink-0"
              >
                {isSearching ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Search</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Search Error */}
          {searchError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Direct Search Result */}
          {foundUser && (
            <div className="p-3.5 rounded-xl border border-orange-300 bg-gradient-to-r from-orange-50/70 to-amber-50/70 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={foundUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                    alt={foundUser.fullName}
                    className="w-11 h-11 rounded-full object-cover border-2 border-orange-400"
                  />
                  <span
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                      foundUser.status === "online" ? "bg-emerald-500" : "bg-neutral-400"
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-neutral-900 truncate">{foundUser.fullName}</h4>
                  <p className="text-xs text-orange-600 font-semibold truncate">@{foundUser.username}</p>
                </div>
              </div>

              {existingContactIds.has(foundUser.id) ? (
                <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Already Added
                </span>
              ) : (
                <button
                  id="confirm-add-contact-btn"
                  onClick={() => handleAddUser(foundUser.username)}
                  disabled={isAdding || !!successMessage}
                  className="ml-2 px-3.5 py-2 rounded-xl bg-orange-500 text-white font-bold text-xs shadow-xs hover:bg-orange-600 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isAdding ? "Adding..." : "Add"}</span>
                </button>
              )}
            </div>
          )}

          {/* Registered Users Directory (Quick Add) */}
          <div className="pt-2 border-t border-neutral-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-orange-500" />
                All Registered Users ({availableUsers.length})
              </span>
              <span className="text-[10px] text-neutral-400">One-tap add</span>
            </div>

            {loadingUsers ? (
              <div className="py-4 text-center text-xs text-neutral-400">Loading registered users...</div>
            ) : filteredSuggestions.length === 0 ? (
              <div className="py-3 px-3 rounded-xl bg-neutral-50 text-[11px] text-neutral-500 text-center">
                No users found matching "{usernameInput}".
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {filteredSuggestions.map((u) => {
                  const isAlreadyAdded = existingContactIds.has(u.id);

                  return (
                    <div
                      key={u.id}
                      className="p-2.5 rounded-xl border border-neutral-100 bg-neutral-50/70 hover:bg-orange-50/50 hover:border-orange-200 transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={u.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                          alt={u.fullName}
                          className="w-9 h-9 rounded-full object-cover border border-neutral-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-neutral-900 truncate">{u.fullName}</p>
                          <p className="text-[11px] text-orange-600 font-semibold truncate">@{u.username}</p>
                        </div>
                      </div>

                      {isAlreadyAdded ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[11px] flex items-center gap-1 shrink-0">
                          <Check className="w-3 h-3" />
                          Added
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddUser(u.username)}
                          disabled={isAdding}
                          className="px-2.5 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500 hover:text-white text-orange-600 font-bold text-[11px] transition-all cursor-pointer shrink-0 flex items-center gap-1"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>Add</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
