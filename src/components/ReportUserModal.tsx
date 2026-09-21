import React, { useState } from "react";
import { User, Contact } from "../types";
import { X, AlertTriangle, ShieldAlert, CheckCircle2, Flag } from "lucide-react";

interface ReportUserModalProps {
  currentUser: User;
  targetUser: Contact | User | null;
  onClose: () => void;
  onReportSubmitted?: () => void;
}

const REPORT_REASONS = [
  "Spam or unsolicited advertising",
  "Harassment or abusive behavior",
  "Scam, fraud, or impersonation",
  "Inappropriate or explicit content",
  "Threats, violence, or dangerous behavior",
  "Other policy violation",
];

export const ReportUserModal: React.FC<ReportUserModalProps> = ({
  currentUser,
  targetUser,
  onClose,
  onReportSubmitted,
}) => {
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!targetUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporterId: currentUser.id,
          reportedUserId: targetUser.id,
          reason: selectedReason,
          details: details.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit report");
      }

      setSubmitted(true);
      setTimeout(() => {
        if (onReportSubmitted) onReportSubmitted();
        onClose();
      }, 1800);
    } catch (err: any) {
      setErrorMsg(err?.message || "An error occurred while reporting.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="report-user-modal"
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-neutral-200 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-red-100 bg-red-50/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-100 text-red-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">Report Account</h2>
              <p className="text-xs text-neutral-500">Sent to Super Admin for investigation</p>
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

        {submitted ? (
          <div className="p-8 flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-neutral-900">Report Submitted</h3>
            <p className="text-xs text-neutral-600 max-w-xs leading-relaxed">
              Thank you for keeping Z-Messenger safe. The Super Admin has received your report and
              can disable this account if violations are detected.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Target Profile Summary */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
              <img
                src={targetUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                alt={targetUser.fullName}
                className="w-10 h-10 rounded-full object-cover border border-neutral-200"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-neutral-900 truncate">{targetUser.fullName}</p>
                <p className="text-[11px] text-neutral-500 truncate">@{targetUser.username}</p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Reason selection */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                Why are you reporting this user?
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {REPORT_REASONS.map((r) => (
                  <label
                    key={r}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      selectedReason === r
                        ? "bg-red-50/70 border-red-300 text-red-900 font-semibold"
                        : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={r}
                      checked={selectedReason === r}
                      onChange={() => setSelectedReason(r)}
                      className="text-red-600 focus:ring-red-500 w-3.5 h-3.5"
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Details textarea */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Additional Details (Optional)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                placeholder="Explain what happened or paste relevant message context..."
                className="w-full text-xs p-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Flag className="w-3.5 h-3.5" />
                {submitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
