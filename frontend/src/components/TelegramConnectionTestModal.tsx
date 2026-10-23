import React, { useState } from 'react';
import { User, TelegramBotSettings } from '../types';
import { authService, botService } from '../utils/services';
import {
  Bot,
  Send,
  CheckCircle2,
  X,
  Smartphone,
  AlertCircle,
  Edit2,
  Check,
  Loader2,
} from 'lucide-react';

interface TelegramConnectionTestModalProps {
  currentUser: User;
  botSettings: TelegramBotSettings;
  onClose: () => void;
  onSaved?: (updated: User) => void;
}

interface TestOutcome {
  success: boolean;
  timestamp: string;
  message: string;
}

/**
 * Option C - Employee Self-Service "Test My Telegram Connection".
 *
 * The handshake is a real POST /bot/test-ping: the server wakes the corporate
 * bot with getMe, resolves the bound @handle against Telegram and, when the
 * employee has a linked chat, delivers an actual 2FA ping to their device.
 * A typo in the handle can be corrected and persisted in the same dialog via
 * the self-service profile route.
 */
export const TelegramConnectionTestModal: React.FC<TelegramConnectionTestModalProps> = ({
  currentUser,
  botSettings,
  onClose,
  onSaved,
}) => {
  const [handle, setHandle] = useState(currentUser.telegramHandle || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestOutcome | null>(null);

  const botHandle = (botSettings.botUsername || '@APA_HR_Bot').replace(/^@+/, '@');

  const handleSaveEdit = async () => {
    let formatted = handle.trim();
    if (formatted && !formatted.startsWith('@')) formatted = `@${formatted}`;
    if (!formatted) {
      setSaveError('Enter a Telegram username, e.g. @your_handle.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const saved = await authService.updateProfile({ telegramHandle: formatted });
      setHandle(saved.telegramHandle || formatted);
      setIsEditing(false);
      setTestResult(null);
      if (onSaved) onSaved({ ...currentUser, telegramHandle: saved.telegramHandle || formatted });
    } catch (err) {
      setSaveError(err instanceof Error && err.message ? err.message : 'Could not save your Telegram handle.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunTestPing = async () => {
    if (isTesting) return;
    setIsTesting(true);
    setTestResult(null);
    setSaveError(null);

    try {
      const result = await botService.testPing({ handle: handle.trim() });
      setTestResult({
        success: result.status !== 'unverified',
        timestamp: new Date(result.timestamp || Date.now()).toLocaleTimeString(),
        message: result.message,
      });
    } catch (err) {
      setTestResult({
        success: false,
        timestamp: new Date().toLocaleTimeString(),
        message:
          err instanceof Error && err.message
            ? err.message
            : 'The corporate bot did not answer. Please try again.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-5 text-xs animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Telegram 2FA Connection Test
              </h3>
              <p className="text-[11px] text-slate-500">
                Self-service verification for employee out-of-band policy sign-off
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

        {/* User Card & Telegram Binding */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Employee Account:</span>
            <span className="text-[11px] text-slate-500 font-mono">
              {currentUser.id} &bull; {currentUser.department}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Bound Telegram Handle:</span>

            {!isEditing ? (
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-sky-600 dark:text-sky-400 text-xs">
                  {handle || 'Not linked'}
                </span>
                <button
                  onClick={() => {
                    setSaveError(null);
                    setIsEditing(true);
                  }}
                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-md transition-colors"
                  title="Edit Telegram handle"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="@username"
                  className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-lg w-32 focus:outline-hidden"
                />
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-md transition-colors disabled:opacity-50"
                  title="Save handle"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          {saveError && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700 text-[11px]">
            <span className="text-slate-500">Corporate Compliance Bot:</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{botHandle}</span>
          </div>
        </div>

        {/* Test Result Message Box */}
        {testResult && (
          <div
            className={`p-3.5 rounded-xl border space-y-2 text-xs transition-all ${
              testResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{testResult.success ? 'Handshake Successful' : 'Verification Issue Detected'}</span>
              <span className="text-[10px] font-normal text-slate-400 ml-auto">{testResult.timestamp}</span>
            </div>

            <p className="text-[11px] font-mono leading-relaxed">{testResult.message}</p>
          </div>
        )}

        {/* Helpful Tip */}
        <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-[11px] text-sky-800 dark:text-sky-300 flex items-start gap-2">
          <Bot className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            When you sign a mandatory directive in the portal, your secret token will be verified against
            incoming messages from <strong>{handle || 'your bound handle'}</strong> to provide legally
            binding non-repudiation.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
          >
            Close
          </button>

          <button
            type="button"
            disabled={isTesting || isEditing}
            onClick={handleRunTestPing}
            title={isEditing ? 'Save your handle before running the test' : 'Run a live handshake with the bot'}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-xs transition-colors disabled:opacity-50"
          >
            {isTesting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{isTesting ? 'Sending Handshake Ping...' : 'Send Test Ping to Bot'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
