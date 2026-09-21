import React, { useState, useEffect, useRef } from "react";
import { User, Contact, GroupMember } from "../types";
import {
  Users,
  X,
  Check,
  Image as ImageIcon,
  Camera,
  Edit2,
  Shield,
  UserPlus,
  Search,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Upload,
} from "lucide-react";

interface GroupDetailsModalProps {
  currentUser: User;
  activeContact: Contact;
  onClose: () => void;
  onGroupUpdated: (updatedGroup: any) => void;
}

const PRESET_GROUP_AVATARS = [
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=150&auto=format&fit=crop&q=80",
];

export const GroupDetailsModal: React.FC<GroupDetailsModalProps> = ({
  currentUser,
  activeContact,
  onClose,
  onGroupUpdated,
}) => {
  const group = activeContact.groupData;
  const [avatar, setAvatar] = useState(group?.avatar || activeContact.avatar);
  const [name, setName] = useState(group?.name || activeContact.fullName);
  const [description, setDescription] = useState(group?.description || "");
  const [members, setMembers] = useState<GroupMember[]>(group?.members || []);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);

  // Group Admin Add Member State
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isCreator = group ? group.creatorId === currentUser.id : false;

  // Load registered users to allow admin to add any user
  useEffect(() => {
    if (isAddingMember) {
      setIsLoadingUsers(true);
      fetch(`/api/users/all?excludeUserId=${currentUser.id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.users) {
            setAvailableUsers(d.users);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingUsers(false));
    }
  }, [isAddingMember, currentUser.id]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (< 8MB)
    if (file.size > 8 * 1024 * 1024) {
      setError("Image file must be smaller than 8MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatar(reader.result);
        setError(null);
        setSuccessMessage("Custom DP loaded! Click 'Save Changes' to apply.");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleApplyCustomUrl = () => {
    if (!customUrlInput.trim()) return;
    setAvatar(customUrlInput.trim());
    setShowUrlInput(false);
    setCustomUrlInput("");
    setSuccessMessage("Custom URL set! Click 'Save Changes' to apply.");
  };

  const handleSave = async () => {
    if (!activeContact.id) return;
    if (!name.trim()) {
      setError("Group name cannot be empty.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const resp = await fetch(`/api/groups/${activeContact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          avatar,
          name: name.trim(),
          description: description.trim(),
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to update group DP");
      }

      onGroupUpdated(data.group);
      setSuccessMessage("Group details and DP updated successfully!");
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || "Failed to update group");
    } finally {
      setIsSaving(false);
    }
  };

  // Group Admin: Add Member to Group
  const handleAddMember = async (targetUser: { id: string; username: string; fullName: string }) => {
    setIsSubmittingAdd(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const resp = await fetch(`/api/groups/${activeContact.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUser.id,
          requesterId: currentUser.id,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to add member to group");
      }

      if (data.group) {
        setMembers(data.group.members || []);
        onGroupUpdated(data.group);
      }
      setSuccessMessage(`Added ${targetUser.fullName} (@${targetUser.username}) to the group!`);
      setIsAddingMember(false);
      setMemberSearchQuery("");
    } catch (err: any) {
      setError(err.message || "Could not add user to group");
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Group Admin: Add Member by custom typed username
  const handleAddByTypedUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberSearchQuery.trim()) return;

    setIsSubmittingAdd(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const resp = await fetch(`/api/groups/${activeContact.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: memberSearchQuery.trim(),
          requesterId: currentUser.id,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to add member to group");
      }

      if (data.group) {
        setMembers(data.group.members || []);
        onGroupUpdated(data.group);
      }
      setSuccessMessage(`User added to the group successfully!`);
      setIsAddingMember(false);
      setMemberSearchQuery("");
    } catch (err: any) {
      setError(err.message || "User not found or already in group");
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Group Admin: Remove member from group
  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this group?`)) return;

    setError(null);
    try {
      const resp = await fetch(
        `/api/groups/${activeContact.id}/members/${memberId}?requesterId=${currentUser.id}`,
        { method: "DELETE" }
      );
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to remove member");
      }

      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      if (data.group) {
        onGroupUpdated(data.group);
      }
      setSuccessMessage(`Removed ${memberName} from group.`);
    } catch (err: any) {
      setError(err.message || "Could not remove member");
    }
  };

  // Filter candidates who are not already in the group
  const existingMemberIds = new Set(members.map((m) => m.id));
  const candidateUsers = availableUsers.filter(
    (u) =>
      !existingMemberIds.has(u.id) &&
      (u.fullName.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(memberSearchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="group-details-dialog"
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-orange-200 animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-orange-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 font-['Outfit',sans-serif]">
                Group Information
              </h3>
              <p className="text-xs text-neutral-500">
                {members.length} active members {isCreator && "• You are Group Admin"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-3 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Group Display Picture (DP) Section */}
        <div className="mt-5 flex flex-col items-center p-4 rounded-2xl bg-orange-50/50 border border-orange-100">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <img
              src={avatar}
              alt="Group DP"
              className="w-24 h-24 rounded-3xl object-cover border-4 border-white shadow-md transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 rounded-3xl bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <Camera className="w-6 h-6" />
            </div>
            <button
              type="button"
              title="Upload custom DP"
              className="absolute -bottom-2 -right-2 p-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg cursor-pointer hover:scale-110 active:scale-95 transition-all"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              id="group-dp-file-upload"
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <div className="mt-3 text-center">
            <span className="text-xs font-bold text-neutral-800 block">Group Display Picture (DP)</span>
            <span className="text-[11px] text-neutral-500">
              Upload any image from device or choose a preset
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap justify-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-orange-200 hover:bg-orange-50 text-orange-700 text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Custom DP</span>
            </button>
            <button
              type="button"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-600 text-xs font-medium shadow-xs cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>URL</span>
            </button>
          </div>

          {/* Preset DPs */}
          <div className="flex items-center gap-2 mt-3 overflow-x-auto p-1 max-w-full">
            {PRESET_GROUP_AVATARS.map((url, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setAvatar(url)}
                className={`relative w-9 h-9 rounded-xl overflow-hidden shrink-0 border-2 transition-transform cursor-pointer hover:scale-110 ${
                  avatar === url ? "border-orange-500 ring-2 ring-orange-400 scale-105" : "border-transparent"
                }`}
              >
                <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                {avatar === url && (
                  <div className="absolute inset-0 bg-orange-500/30 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white stroke-[3]" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Custom URL Option */}
          {showUrlInput && (
            <div className="w-full mt-3 flex items-center gap-1.5">
              <input
                type="url"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder="https://example.com/group-dp.jpg"
                className="flex-1 px-3 py-1.5 rounded-xl border border-neutral-200 text-xs outline-hidden focus:border-orange-500 bg-white"
              />
              <button
                type="button"
                onClick={handleApplyCustomUrl}
                className="px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 cursor-pointer"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => setShowUrlInput(false)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Group Info Section */}
        <div className="mt-4 space-y-3 pt-3 border-t border-neutral-100">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider">
                Group Name
              </label>
              {!isEditingInfo && (
                <button
                  type="button"
                  onClick={() => setIsEditingInfo(true)}
                  className="text-[11px] font-semibold text-orange-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit Name</span>
                </button>
              )}
            </div>
            {isEditingInfo ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 focus:border-orange-500 outline-hidden text-xs font-semibold text-neutral-900"
                placeholder="Group Name"
              />
            ) : (
              <p className="text-sm font-bold text-neutral-900">{name}</p>
            )}
          </div>

          <div>
            <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider block mb-1">
              Description
            </label>
            {isEditingInfo ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 focus:border-orange-500 outline-hidden text-xs text-neutral-800 resize-none"
                placeholder="What is this group about?"
              />
            ) : (
              <p className="text-xs text-neutral-600 italic">
                {description || "No description set"}
              </p>
            )}
          </div>
        </div>

        {/* Members Management Section (Group Admin Can Add Anyone) */}
        <div className="mt-5 pt-4 border-t border-neutral-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider">
              Group Members ({members.length})
            </span>
            {isCreator && (
              <button
                type="button"
                onClick={() => setIsAddingMember(!isAddingMember)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200 transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isAddingMember ? "Close" : "+ Add Member"}</span>
              </button>
            )}
          </div>

          {/* Group Admin: Add Member Form */}
          {isCreator && isAddingMember && (
            <div className="mb-3 p-3.5 rounded-2xl bg-orange-50/60 border border-orange-200 animate-in fade-in duration-150">
              <h4 className="text-xs font-bold text-neutral-900 mb-1 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-orange-600" />
                <span>Admin: Add Member to Group</span>
              </h4>
              <p className="text-[11px] text-neutral-500 mb-2">
                Search anyone in Z-Messenger by name or username:
              </p>

              <form onSubmit={handleAddByTypedUsername} className="flex gap-1.5 mb-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Type @username or name..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-neutral-300 text-xs focus:border-orange-500 bg-white outline-hidden"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!memberSearchQuery.trim() || isSubmittingAdd}
                  className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                >
                  {isSubmittingAdd ? "Adding..." : "Add"}
                </button>
              </form>

              {/* Candidate Search Results */}
              {isLoadingUsers ? (
                <p className="text-[11px] text-neutral-400 text-center py-2">Loading users...</p>
              ) : candidateUsers.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {candidateUsers.slice(0, 6).map((cand) => (
                    <div
                      key={cand.id}
                      className="flex items-center justify-between p-1.5 rounded-xl bg-white border border-neutral-200 hover:border-orange-300"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={cand.avatar}
                          alt={cand.fullName}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-neutral-800 truncate">{cand.fullName}</p>
                          <p className="text-[10px] text-neutral-400 truncate">@{cand.username}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddMember(cand)}
                        disabled={isSubmittingAdd}
                        className="px-2 py-0.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold cursor-pointer disabled:opacity-50"
                      >
                        + Add
                      </button>
                    </div>
                  ))}
                </div>
              ) : memberSearchQuery ? (
                <p className="text-[11px] text-neutral-500 text-center py-1">
                  No matching user found in directory. You can press "Add" to query directly by username.
                </p>
              ) : null}
            </div>
          )}

          {/* Member List */}
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {members.map((m) => {
              const memberIsAdmin = m.id === group?.creatorId;
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={m.avatar}
                      alt={m.fullName}
                      className="w-8 h-8 rounded-full object-cover border border-neutral-200"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-neutral-800 truncate">{m.fullName}</p>
                      <p className="text-[10px] text-neutral-400 truncate">@{m.username}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {memberIsAdmin && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-bold flex items-center gap-1 border border-amber-200">
                        <Shield className="w-2.5 h-2.5" />
                        Admin
                      </span>
                    )}
                    {/* If current user is group admin, allow removing other members */}
                    {isCreator && !memberIsAdmin && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.id, m.fullName)}
                        title="Remove member"
                        className="p-1 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center gap-2.5 justify-end pt-3 border-t border-neutral-100">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl border border-neutral-300 text-neutral-700 font-semibold text-xs hover:bg-neutral-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="py-2 px-5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};
