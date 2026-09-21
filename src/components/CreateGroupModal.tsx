import React, { useState } from "react";
import { User, Contact, Group } from "../types";
import { Users, X, Check, Image as ImageIcon, AlertCircle, Upload } from "lucide-react";

interface CreateGroupModalProps {
  currentUser: User;
  contacts: Contact[];
  onClose: () => void;
  onGroupCreated: (group: Group) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  currentUser,
  contacts,
  onClose,
  onGroupCreated,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [avatar, setAvatar] = useState(
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Load registered users so groups can easily be formed even if not yet saved in contacts
  React.useEffect(() => {
    fetch(`/api/users/all?excludeUserId=${currentUser.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.users) setAllUsers(d.users);
      })
      .catch(() => {});
  }, [currentUser.id]);

  // Combine contacts and any registered users
  const candidateMap = new Map<string, { id: string; fullName: string; username: string; avatar: string }>();
  for (const c of contacts) {
    if (!c.isGroup && c.id !== currentUser.id) {
      candidateMap.set(c.id, { id: c.id, fullName: c.fullName, username: c.username, avatar: c.avatar });
    }
  }
  for (const u of allUsers) {
    if (u.id !== currentUser.id && !candidateMap.has(u.id)) {
      candidateMap.set(u.id, { id: u.id, fullName: u.fullName, username: u.username, avatar: u.avatar });
    }
  }
  const availableCandidates = Array.from(candidateMap.values());

  const toggleSelectContact = (id: string) => {
    setError(null);
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAvatarSelect = (url: string) => {
    setAvatar(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError("Image file must be smaller than 8MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatar(reader.result);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please provide a name for your group.");
      return;
    }

    // Constraint: Group must be of MORE THAN 2 PERSONS (creator + at least 2 contacts = 3+ persons)
    if (selectedContactIds.length < 2) {
      setError("A group must have more than 2 persons. Please select at least 2 contacts (total 3+ persons including you).");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim(),
          avatar,
          creatorId: currentUser.id,
          memberIds: selectedContactIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create group.");
      }

      onGroupCreated(data.group);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create group");
    } finally {
      setIsSubmitting(false);
    }
  };

  const avatarOptions = [
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=150&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=150&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=150&auto=format&fit=crop&q=80",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div
        id="create-group-modal"
        className="w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-orange-200 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-100 text-orange-600 shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">Create New Group</h2>
              <p className="text-xs text-neutral-500">Group of more than 2 persons (3+ members)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 pr-1 space-y-4 pt-3">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Group Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1.5">
              Group Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Design Team, Project Zeta, Friends Circle..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-neutral-900 text-sm outline-hidden"
            />
          </div>

          {/* Group Avatar Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1.5">
              Group Display Picture (DP)
            </label>
            <div className="flex items-center gap-3">
              <img
                src={avatar}
                alt="Group icon"
                className="w-12 h-12 rounded-2xl object-cover border-2 border-orange-500 shadow-sm shrink-0"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <label
                  htmlFor="create-group-dp-upload"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold cursor-pointer transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload DP</span>
                  <input
                    id="create-group-dp-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {avatarOptions.map((optUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAvatarSelect(optUrl)}
                    className={`w-9 h-9 rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                      avatar === optUrl ? "border-orange-500 ring-2 ring-orange-500/30 scale-105" : "border-neutral-200 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={optUrl} alt="avatar option" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Group Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1.5">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group about?"
              className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 focus:border-orange-500 text-neutral-900 text-xs outline-hidden"
            />
          </div>

          {/* Members Selection (Enforcing > 2 persons requirement) */}
          <div className="pt-2 border-t border-neutral-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                Select Members ({selectedContactIds.length} chosen)
              </label>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  selectedContactIds.length >= 2
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {selectedContactIds.length >= 2
                  ? `✓ Valid (${selectedContactIds.length + 1} total members)`
                  : `Need ${2 - selectedContactIds.length} more for a group of >2`}
              </span>
            </div>

            <p className="text-[11px] text-neutral-500 mb-2">
              Select at least 2 members. You will be included automatically, making a total of 3+ people in the group.
            </p>

            {availableCandidates.length === 0 ? (
              <div className="p-4 rounded-xl bg-neutral-50 text-neutral-500 text-center text-xs">
                No other registered users found on the platform to form a group. Register more accounts or add contacts to form a group of &gt; 2 people!
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {availableCandidates.map((c) => {
                  const isSelected = selectedContactIds.includes(c.id);

                  return (
                    <div
                      key={c.id}
                      onClick={() => toggleSelectContact(c.id)}
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "border-orange-500 bg-orange-50/70"
                          : "border-neutral-200 bg-neutral-50/50 hover:bg-neutral-100/70"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={c.avatar}
                          alt={c.fullName}
                          className="w-8 h-8 rounded-full object-cover border border-neutral-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-neutral-900 truncate">{c.fullName}</p>
                          <p className="text-[11px] text-neutral-500 truncate">@{c.username}</p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                          isSelected
                            ? "bg-orange-500 border-orange-500 text-white"
                            : "border-neutral-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedContactIds.length < 2 || !name.trim()}
              className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-md shadow-orange-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Users className="w-4 h-4" />
              <span>{isSubmitting ? "Creating Group..." : "Create Group (3+ Members)"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
