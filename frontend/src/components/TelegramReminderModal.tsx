import React, { useState } from 'react';
import { Memo, AcknowledgementRecord, User, TelegramBotSettings } from '../types';
import { botService } from '../utils/services';
import { Send, Bell, Check, Copy, X, Users, AlertTriangle, ExternalLink, Loader2, AlertCircle } from 'lucide-react';

interface TelegramReminderModalProps {
  memo: Memo;
  acknowledgements: AcknowledgementRecord[];
  allStaffUsers: User[];
  botSettings: TelegramBotSettings;
  onClose: () => void;
  onDispatched?: () => void | Promise<void>;
}

export const TelegramReminderModal: React.FC<TelegramReminderModalProps> = ({
  memo,
  acknowledgements,
  allStaffUsers,
  botSettings,
  onClose,
  onDispatched,
}) => {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Find staff who are in target departments for this memo
  const targetStaff = allStaffUsers.filter((u) => {
    if (memo.targetDepartments.includes('All Departments')) return true;
    return memo.targetDepartments.includes(u.department);
  });

  // Check acknowledgement status for each target staff
  const pendingStaff = targetStaff.filter((staff) => {
    const ack = acknowledgements.find((a) => a.memoId === memo.id && a.staffId === staff.id);
    return !ack || ack.status !== 'HR Verified';
  });

  const reminderMessage = `📢 [APA HR REMINDER] 
Attention: Policy Directive Signature Required

Directive: ${memo.memoNumber} - ${memo.title}
Deadline: ${memo.deadlineDate}

Staff pending acknowledgement: ${pendingStaff.map((s) => s.telegramHandle).join(', ') || 'All targeted staff'}

Please log into the APA Portal to sign, and dispatch your verification token to ${botSettings.botUsername || '@APA_HR_Bot'}.`;

  const handleCopy = () => {
    navigator.clipboard.writeText(reminderMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendBroadcast = async () => {
    setSending(true);
    setSendResult(null);
    try {
      await botService.send({ text: reminderMessage, chatId: botSettings.channelName });
      setSendResult({
        ok: true,
        message: `Reminder delivered to ${botSettings.channelName || 'the broadcast channel'}.`,
      });
      if (onDispatched) await onDispatched();
    } catch (err) {
      setSendResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Telegram rejected the broadcast.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden apa-fade-in zoom-in-95">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Telegram Directive Reminder
              </h3>
              <p className="text-xs text-slate-500">{memo.memoNumber} &bull; Deadline: {memo.deadlineDate}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[calc(90vh-150px)] overflow-y-auto">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 block">Pending Staff Count</span>
              <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                {pendingStaff.length} / {targetStaff.length}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 block">Target Channel</span>
              <span className="text-sm font-mono font-bold text-sky-600 dark:text-sky-400">
                {botSettings.channelName || '@APA_AllStaff'}
              </span>
            </div>
          </div>

          {/* Pending Staff Handles List */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
              Staff Pending Verification:
            </label>
            <div className="max-h-28 overflow-y-auto p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
              {pendingStaff.length === 0 ? (
                <span className="text-emerald-600 font-semibold">
                  All targeted staff have fully acknowledged and verified this directive!
                </span>
              ) : (
                pendingStaff.map((staff) => (
                  <div key={staff.id} className="flex items-center justify-between py-0.5">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{staff.name} ({staff.department})</span>
                    <span className="font-mono text-sky-600 dark:text-sky-400">{staff.telegramHandle}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pre-formatted message preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Pre-formatted Broadcast Message:
              </label>
              <button
                onClick={handleCopy}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Text'}</span>
              </button>
            </div>
            <textarea
              readOnly
              value={reminderMessage}
              rows={4}
              className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none"
            />
          </div>

          {/* Result of the actual Telegram dispatch */}
          {sendResult?.ok && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{sendResult.message}</span>
            </div>
          )}
          {sendResult && !sendResult.ok && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{sendResult.message}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Close
          </button>

          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Message</span>
          </button>

          <button
            onClick={handleSendBroadcast}
            disabled={pendingStaff.length === 0 || sending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20"
          >
            {sending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{sending ? 'Sending…' : 'Dispatch to Telegram Channel'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
