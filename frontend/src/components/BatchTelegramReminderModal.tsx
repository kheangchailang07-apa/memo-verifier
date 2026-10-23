import React, { useRef, useState } from 'react';
import { User, Memo, AcknowledgementRecord, TelegramBotSettings } from '../types';
import { botService } from '../utils/services';
import {
  Bot,
  Send,
  AlertTriangle,
  CheckCircle2,
  X,
  Clock,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface PendingStaffItem {
  staff: User;
  memo: Memo;
  ack?: AcknowledgementRecord;
  isOverdue?: boolean;
}

interface BatchTelegramReminderModalProps {
  pendingStaffList: PendingStaffItem[];
  botSettings: TelegramBotSettings;
  onClose: () => void;
  onConfirmBroadcast: (count: number, memoTitles: string[]) => void;
}

type DispatchOutcome = 'sent' | 'skipped' | 'failed';

/**
 * Option B - One-Click Batch Telegram Reminder Broadcast.
 *
 * Every recipient is dispatched through POST /bot/broadcast one at a time, so the
 * progress bar and the transmission log always mirror a real Telegram API
 * response rather than a pre-recorded animation. Recipients without a linked
 * Telegram chat are reported as skipped instead of being counted as delivered.
 */
export const BatchTelegramReminderModal: React.FC<BatchTelegramReminderModalProps> = ({
  pendingStaffList,
  botSettings,
  onClose,
  onConfirmBroadcast,
}) => {
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sentLogs, setSentLogs] = useState<string[]>([]);
  const [isDone, setIsDone] = useState(false);
  const [counts, setCounts] = useState<Record<DispatchOutcome, number>>({ sent: 0, skipped: 0, failed: 0 });
  const runRef = useRef(false);

  const totalRecipients = pendingStaffList.length;
  const botHandle = (botSettings.botUsername || '@APA_HR_Bot').replace(/^@+/, '@');

  const appendLog = (line: string) => setSentLogs((prev) => [...prev, line]);

  const handleStartBroadcast = async () => {
    if (runRef.current || totalRecipients === 0) return;
    runRef.current = true;

    setIsSending(true);
    setSendProgress(2);
    setCounts({ sent: 0, skipped: 0, failed: 0 });
    setSentLogs([`[Initiating] Authenticating connection to ${botHandle}...`]);

    const tally: Record<DispatchOutcome, number> = { sent: 0, skipped: 0, failed: 0 };
    const memoTitles: string[] = [];

    for (let i = 0; i < pendingStaffList.length; i++) {
      const item = pendingStaffList[i];
      const label = `${item.staff.telegramHandle || item.staff.name} (${item.staff.department})`;

      try {
        const result = await botService.broadcast({
          userId: item.staff.id,
          memoId: item.memo.id,
          memoNumber: item.memo.memoNumber,
          memoTitle: item.memo.title,
          deadlineDate: item.memo.deadlineDate,
          handle: item.staff.telegramHandle,
        });

        if (result.status === 'sent') {
          tally.sent += 1;
          appendLog(
            `[Dispatched] -> ${label}: Directive ${item.memo.memoNumber} reminder sent. Status: Delivered 200 OK (msg #${result.messageId})`
          );
        } else if (result.status === 'skipped') {
          tally.skipped += 1;
          appendLog(`[Skipped] -> ${label}: Directive ${item.memo.memoNumber} - ${result.reason}`);
        } else {
          tally.failed += 1;
          appendLog(`[Failed] -> ${label}: Directive ${item.memo.memoNumber} - ${result.reason}`);
        }
      } catch (err) {
        tally.failed += 1;
        const reason = err instanceof Error && err.message ? err.message : 'Gateway error';
        appendLog(`[Failed] -> ${label}: Directive ${item.memo.memoNumber} - ${reason}`);
      }

      if (!memoTitles.includes(item.memo.title)) memoTitles.push(item.memo.title);
      setCounts({ ...tally });
      setSendProgress(Math.round(((i + 1) / totalRecipients) * 100));
    }

    appendLog(
      `[Completed] ${tally.sent}/${totalRecipients} Telegram notification(s) delivered via corporate bot ${botHandle}` +
        `${tally.skipped ? ` - ${tally.skipped} skipped (no linked Telegram chat)` : ''}` +
        `${tally.failed ? ` - ${tally.failed} failed` : ''}.`
    );

    setSendProgress(100);
    setIsSending(false);
    setIsDone(true);
    runRef.current = false;

    onConfirmBroadcast(tally.sent, memoTitles);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 space-y-5 text-xs animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Batch Telegram Reminder Broadcast
              </h3>
              <p className="text-[11px] text-slate-500">
                Ping all overdue and unacknowledged staff members via corporate bot{' '}
                <span className="font-mono text-sky-600 dark:text-sky-400 font-semibold">{botHandle}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Recipients Summary Banner */}
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold text-xs">
              {totalRecipients} Pending Sign-Off{totalRecipients !== 1 ? 's' : ''} Requiring Immediate
              Notification
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-bold">
            Action Required
          </span>
        </div>

        {/* Recipients List Preview */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium">
            <span>Target Employee Telegram Directory:</span>
            <span>{totalRecipients} Recipient(s)</span>
          </div>

          <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            {pendingStaffList.map((item, idx) => (
              <div key={`${item.staff.id}-${item.memo.id}-${idx}`} className="p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-600 to-cyan-500 text-white text-[9px] font-bold flex items-center justify-center ring-1 ring-slate-200 dark:ring-slate-700 shrink-0 select-none"
                  >
                    {item.staff.name
                      .trim()
                      .split(/\s+/)
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </span>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{item.staff.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {item.staff.department} &bull; {item.memo.memoNumber}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono text-sky-600 dark:text-sky-400 font-semibold text-[11px]">
                    {item.staff.telegramHandle || 'Not linked'}
                  </div>
                  <div className="text-[9px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 justify-end">
                    <Clock className="w-2.5 h-2.5" />
                    <span>Due: {item.memo.deadlineDate}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Message Preview Box */}
        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
          <div className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-sky-500" />
            <span>Automated Telegram Bot Template:</span>
          </div>
          <p className="text-[11px] font-mono text-slate-700 dark:text-slate-300 leading-relaxed">
            &quot;⚠️ [APA HR Policy Notice] Hello @username, you have a mandatory corporate directive awaiting
            your non-repudiation signature. Please sign via the portal or message {botHandle} before the
            deadline.&quot;
          </p>
        </div>

        {/* Live Dispatch Logs (when sending or done) */}
        {(isSending || isDone) && (
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] font-medium text-slate-600 dark:text-slate-300">
              <span>Broadcast Progress:</span>
              <span>{sendProgress}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${sendProgress}%` }}
              />
            </div>

            {isDone && (
              <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {counts.sent} Delivered
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {counts.skipped} Skipped
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                  {counts.failed} Failed
                </span>
              </div>
            )}

            <div className="max-h-24 overflow-y-auto bg-slate-900 text-sky-400 p-2.5 rounded-xl font-mono text-[10px] space-y-1">
              {sentLogs.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={isSending}
            onClick={onClose}
            className="px-3.5 py-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
          >
            {isDone ? 'Close' : 'Cancel'}
          </button>

          {!isDone ? (
            <button
              type="button"
              disabled={isSending || totalRecipients === 0}
              onClick={handleStartBroadcast}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>
                {isSending ? `Broadcasting... ${sendProgress}%` : `Broadcast to ${totalRecipients} Staff`}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Finished</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
