import React, { useEffect, useRef, useState } from 'react';
import { TelegramBotSettings, TelegramGroup, User, AcknowledgementRecord, TelegramChatInfo } from '../types';
import { botService } from '../utils/services';
import { TelegramLinkModes } from './TelegramLinkModes';
import {
  Bot,
  Send,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Terminal,
  BellRing,
  Smartphone,
  Play,
  Zap,
  Check,
  AlertCircle,
  Users,
  Loader2,
  Link2,
  Unlink,
  X,
} from 'lucide-react';

const SHOW_BOT_SIMULATOR = false;

interface TelegramBotConfigModalProps {
  settings: TelegramBotSettings;
  onUpdateSettings: (newSettings: TelegramBotSettings) => void | Promise<void>;
  users?: User[];
  acknowledgements?: AcknowledgementRecord[];
  onSimulateInboundAck?: (token: string, senderHandle: string) => void;
}

interface WebhookLog {
  id: string;
  time: string;
  sender: string;
  memoCode: string;
  token: string;
  status: 'Received' | 'Verified' | 'Broadcast' | 'Error';
  rawPayload: string;
}

export const TelegramBotConfigModal: React.FC<TelegramBotConfigModalProps> = ({
  settings,
  onUpdateSettings,
  users = [],
  acknowledgements = [],
  onSimulateInboundAck,
}) => {
  const [botUsername, setBotUsername] = useState(settings.botUsername);
  const [hrOfficerTelegram, setHrOfficerTelegram] = useState(settings.hrOfficerTelegram);
  const [hrOfficerUsername, setHrOfficerUsername] = useState(settings.hrOfficerUsername || '');
  const [channelName, setChannelName] = useState(settings.channelName);
  const [botTokenInput, setBotTokenInput] = useState(settings.botTokenRaw || '');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isFetchingChatId, setIsFetchingChatId] = useState(false);
  // Lets the waiting loop be abandoned without letting a late poll answer
  // overwrite the cancellation notice.
  const cancelLinkRef = useRef(false);
  const [chatIdError, setChatIdError] = useState<string | null>(null);
  const [chatIdInfo, setChatIdInfo] = useState<string | null>(null);
  const [groups, setGroups] = useState<TelegramGroup[]>([]);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Simulator controls
  const staffUsers = users.filter((u) => u.role === 'staff');
  const trimmedBotUsername = botUsername.trim();
  const groupStartCommand = `/start${trimmedBotUsername ? (trimmedBotUsername.startsWith('@') ? trimmedBotUsername : `@${trimmedBotUsername}`) : '@your_bot_username'}`;
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staffUsers[0]?.id || '');
  const [customToken, setCustomToken] = useState<string>('');
  const [simulatedFeedback, setSimulatedFeedback] = useState<string | null>(null);

  // Live simulated webhook feed
  const [logs, setLogs] = useState<WebhookLog[]>([
    {
      id: 'WH-1',
      time: '14:23:05 UTC',
      sender: '@sophea_kim_ops',
      memoCode: 'HR-MEMO/2026/04',
      token: 'ACK-2026-7821',
      status: 'Received',
      rawPayload: '{"update_id":901827,"message":{"from":{"username":"sophea_kim_ops"},"text":"ACK-2026-7821"}}',
    },
    {
      id: 'WH-2',
      time: '11:06:15 UTC',
      sender: '@dara_sokha_dev',
      memoCode: 'HR-MEMO/2026/04',
      token: 'ACK-2026-4419',
      status: 'Verified',
      rawPayload: '{"update_id":901815,"message":{"from":{"username":"dara_sokha_dev"},"text":"ACK-2026-4419"}}',
    },
  ]);

  // Keep the token field in sync with whatever the server has stored.
  useEffect(() => {
    setBotTokenInput(settings.botTokenRaw || '');
  }, [settings.botTokenRaw]);

  useEffect(() => {
    setHrOfficerUsername(settings.hrOfficerUsername || '');
  }, [settings.hrOfficerUsername]);

  // The settings exactly as typed right now. Overrides let a single field be
  // persisted (e.g. right after a Link Telegram handshake) without dropping
  // any other edit that has not been saved yet.
  const buildDraft = (overrides: Partial<TelegramBotSettings> = {}): TelegramBotSettings => {
    const draft: TelegramBotSettings = {
      ...settings,
      botUsername,
      hrOfficerTelegram,
      hrOfficerUsername: hrOfficerUsername.trim() || null,
      channelName,
      ...overrides,
    };
    // The field is prefilled with the stored token, so whatever is present
    // here (typed or loaded) is what gets written back.
    draft.botToken = botTokenInput.trim() || null;
    return draft;
  };

  // Returns null on success, or the failure message for the caller to show.
  const persistDraft = async (overrides: Partial<TelegramBotSettings> = {}): Promise<string | null> => {
    try {
      await onUpdateSettings(buildDraft(overrides));
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Failed to save Telegram settings.';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    const error = await persistDraft();
    if (error) {
      setSaveError(error);
      return;
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleFetchGroups = async () => {
    setIsLoadingGroups(true);
    setGroupsError(null);
    try {
      // The token field is editable locally; persist it before asking the
      // backend to query Telegram, otherwise a freshly entered token is ignored.
      const saveError = await persistDraft();
      if (saveError) {
        setGroupsError(saveError);
        return;
      }
      const { groups: list, bot } = await botService.groups();
      setGroups(list);
      const match = list.find((g) => g.id === channelName || g.username === channelName);
      setSelectedGroupId(match?.id ?? '');
      if (bot?.username) setBotUsername(bot.username);
      if (list.length === 0) {
        const startCommand = bot?.username ? `/start${bot.username}` : groupStartCommand;
        setGroupsError(`Bot ${bot?.username || ''} connected, but Telegram sent no group update during the fetch. In the target group, send ${startCommand}, then try again.`);
      }
    } catch (err) {
      setGroups([]);
      setGroupsError(err instanceof Error ? err.message : 'Unable to list bot groups.');
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const handleSelectGroup = (group: TelegramGroup) => {
    setSelectedGroupId(group.id);
    setChannelName(group.id);
  };

  // Confirms the connection inside Telegram itself. Best-effort: a failed
  // delivery never breaks the chat id / username capture above.
  const deliverWelcome = async (chatId: string): Promise<string> => {
    try {
      await botService.sendWelcome({ chatId, siteUrl: window.location.origin });
      return ' \u2705 Welcome message sent to this chat.';
    } catch {
      return ' (Welcome message could not be sent - try again after saving.)';
    }
  };

  const code = 'hr_setup';

  /** The t.me deep link encoded by the QR code. */
  const resolveStartUrl = async (): Promise<string> => {
    const handle = (botUsername || '').replace('@', '').trim();
    if (!handle) {
      throw new Error('Enter the bot username first (or run Get Groups) so the start link can open.');
    }
    return `https://t.me/${handle}?start=${code}`;
  };

  // openTab: false is the QR path - the phone scans the code instead of the
  // desktop opening a Telegram tab.
  const handleGetChatId = async (opts: { openTab?: boolean } = {}) => {
    const { openTab = true } = opts;
    cancelLinkRef.current = false;
    setIsFetchingChatId(true);
    setChatIdError(null);
    setChatIdInfo(null);

    const pollMs = 1000;
    const attempts = 25;

    try {
      const before = await botService.chatId({ code });
      const handle = (before.bot?.username || botUsername || '').replace('@', '').trim();

      if (!handle) {
        setChatIdError('Enter the bot username first (or run Get Groups) so the start link can open.');
        return;
      }

      // Deep link opens a private chat with the bot and sends /start automatically.
      if (openTab) window.open(`https://t.me/${handle}?start=${code}`, '_blank', 'noopener');
      setChatIdInfo(
        openTab
          ? 'Telegram opened — press START (or send /start), then wait…'
          : 'Scan the QR code above, then press START in Telegram…'
      );

      for (let i = 0; i < attempts; i++) {
        // Check first, then sleep: a quick tap resolves on the very first pass
        // instead of always paying one full poll interval up front.
        // A transient Telegram conflict must not abort the whole wait.
        if (cancelLinkRef.current) return;

        let chat: TelegramChatInfo | null = null;
        let updateId: number | null = null;
        try {
          ({ chat, updateId } = await botService.chatId({ code, withBot: false }));
        } catch {
          await new Promise((resolve) => setTimeout(resolve, pollMs));
          continue;
        }

        // Cancelled while the request was in flight: stay quiet, the cancel
        // handler already reported it.
        if (cancelLinkRef.current) return;

        // A repeat tap keeps the same chat id, so the chat id alone can never
        // tell "already known" from "just tapped". The update id can.
        const alreadySeen = Boolean(
          chat &&
            before.chat &&
            chat.id === before.chat.id &&
            before.updateId != null &&
            updateId != null &&
            updateId === before.updateId
        );

        if (chat && !alreadySeen) {
          setHrOfficerTelegram(chat.id);
          // Only overwrite when Telegram reports a username, so a saved
          // handle is never blanked by a username-less account.
          if (chat.username) setHrOfficerUsername(chat.username);
          const captured = chat.username || hrOfficerUsername.trim();
          // Persist right away so the link survives a reload even if
          // "Save Telegram Settings" is never pressed.
          const saveError = await persistDraft({
            hrOfficerTelegram: chat.id,
            hrOfficerUsername: captured || null,
          });
          const welcomeNote = await deliverWelcome(chat.id);
          setChatIdInfo(
            (captured
              ? `Chat ID ${chat.id} and username ${captured} captured from ${chat.name}.`
              : `Chat ID ${chat.id} captured from ${chat.name} (no Telegram username on this account) - enter it manually.`) +
              (saveError ? ` Auto-save failed: ${saveError}` : ' Saved to the database.') +
              welcomeNote
          );
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }

      // Nothing new arrived. The update queue is never drained, so before.chat
      // only holds taps from *earlier* attempts - adopting them would claim a
      // link the admin never just made and fire the welcome message every time.
      // Only a fresh update id counts as a handshake.
      setChatIdError(
        'No new /start received. Press START in the Telegram chat (scan the QR code first if you use it), then wait for this line to turn green.'
      );
    } catch (err) {
      setChatIdError(err instanceof Error ? err.message : 'Unable to read the chat id.');
    } finally {
      setIsFetchingChatId(false);
    }
  };

  const handleCancelLink = () => {
    cancelLinkRef.current = true;
    setIsFetchingChatId(false);
    setChatIdInfo('Link cancelled — click Link Telegram to try again.');
  };

  const handleUnlinkHrOfficer = async () => {
    setChatIdError(null);
    setChatIdInfo(null);
    setHrOfficerTelegram('');
    setHrOfficerUsername('');
    const saveError = await persistDraft({ hrOfficerTelegram: '', hrOfficerUsername: null });
    if (saveError) setChatIdError(`Unlink failed: ${saveError}`);
    else setChatIdInfo('HR officer Telegram link removed.');
  };

  const handleTestBroadcast = async () => {
    const target = channelName.trim() || settings.channelName;
    const text = [
      `👋 Welcome to the APA Portal!`,
      '',
      'This channel is now linked to your memo and policy hub.',
      '• New memos and policy updates are posted here.',
      '• Open a memo in the portal and send your verification token to this bot to acknowledge it.',
      '• Need help? Contact your HR officer in the portal.',
      '',
      `— ${botUsername.trim() || settings.botUsername}`,
    ].join('\n');
    const stamp = new Date().toISOString().replace('T', ' ').slice(11, 19) + ' UTC';

    setIsBroadcasting(true);
    setBroadcastResult(null);

    try {
      const { messageId } = await botService.send({ text, chatId: target });
      setBroadcastResult({
        ok: true,
        message: `Delivered to ${target} (message #${messageId}).`,
      });
      setLogs((prev) => [
        {
          id: `WH-${Date.now()}`,
          time: stamp,
          sender: botUsername,
          memoCode: 'WELCOME-BROADCAST',
          token: 'WELCOME',
          status: 'Broadcast',
          rawPayload: `{"method":"sendMessage","chat_id":"${target}","message_id":${messageId},"text":"👋 Welcome to the APA Portal! ..."}`,
        },
        ...prev,
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Telegram rejected the message.';
      setBroadcastResult({ ok: false, message });
      setLogs((prev) => [
        {
          id: `WH-${Date.now()}`,
          time: stamp,
          sender: botUsername,
          memoCode: 'WELCOME-BROADCAST',
          token: 'WELCOME',
          status: 'Error',
          rawPayload: `{"method":"sendMessage","chat_id":"${target}","error":${JSON.stringify(message)}}`,
        },
        ...prev,
      ]);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleSimulateInboundPing = () => {
    const staff = users.find((u) => u.id === selectedStaffId) || users[0];
    const sender = staff?.telegramHandle || '@employee_telegram';
    
    // Find matching unverified or submitted ack token if not custom
    let tokenToSend = customToken.trim();
    if (!tokenToSend) {
      const pendingAck = acknowledgements.find((a) => a.staffId === staff?.id && a.status === 'Submitted');
      tokenToSend = pendingAck?.verificationToken || 'ACK-2026-7821';
    }

    // Call app-level state updater if provided
    if (onSimulateInboundAck) {
      onSimulateInboundAck(tokenToSend, sender);
    }

    const newLog: WebhookLog = {
      id: `WH-${Date.now()}`,
      time: new Date().toISOString().replace('T', ' ').slice(11, 19) + ' UTC',
      sender: sender,
      memoCode: 'INBOUND-ACK',
      token: tokenToSend,
      status: 'Received',
      rawPayload: JSON.stringify({
        update_id: Math.floor(100000 + Math.random() * 900000),
        message: {
          from: { id: 48920182, username: sender.replace('@', ''), first_name: staff?.name || 'Staff' },
          chat: { id: 48920182, type: 'private' },
          text: `I confirm policy acknowledgement with token: ${tokenToSend}`,
          date: Math.floor(Date.now() / 1000),
        },
      }),
    };

    setLogs((prev) => [newLog, ...prev]);
    setSimulatedFeedback(`Inbound message received from ${sender} with token ${tokenToSend}. Status transitioned to 'In Review' in HR Queue.`);
    setTimeout(() => setSimulatedFeedback(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
          <Bot className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Telegram Bot Bridge &amp; Webhook Integration
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Configure the official HR Telegram Bot parameters and target HR Officer Telegram handle. Staff members dispatch their automated verification tokens to this endpoint to prove personal device identity.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Column: Settings Form + Simulator (5 cols) */}
        <div className="md:col-span-5 space-y-6">
          {/* Settings Form */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-sky-500" />
              <span>Telegram Channel &amp; Handles</span>
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Bot Token (from @BotFather):
                </label>
                <input
                  type="password"
                  value={botTokenInput}
                  onChange={(e) => setBotTokenInput(e.target.value)}
                  placeholder={
                    settings.botTokenSet
                      ? `Stored token ${settings.botTokenMasked || ''}`
                      : '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw'
                  }
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {settings.botTokenSet
                    ? 'Loaded from the saved settings. Replace it and save to update.'
                    : 'Required for real sends. Created by messaging @BotFather → /newbot.'}
                </span>

                <button
                  type="button"
                  onClick={handleFetchGroups}
                  disabled={isLoadingGroups}
                  className="mt-2 w-full py-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {isLoadingGroups ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500" />
                  ) : (
                    <Users className="w-3.5 h-3.5 text-sky-500" />
                  )}
                  <span>{isLoadingGroups ? 'Waiting for group update…' : 'Get Groups'}</span>
                </button>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Click Get Groups, then send {groupStartCommand} in the target group while it is waiting. You can also send the command first, then fetch.
                </span>

                {groupsError && (
                  <div className="mt-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex items-start gap-1.5 text-[11px] font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{groupsError}</span>
                  </div>
                )}

                {groups.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                    {groups.map((group) => {
                      const isSelected = group.id === selectedGroupId || group.id === channelName;
                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => handleSelectGroup(group)}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors ${
                            isSelected
                              ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span className="truncate">
                            <span className="font-semibold">{group.title}</span>
                            {group.username && (
                              <span className="ml-1.5 font-mono text-slate-400">{group.username}</span>
                            )}
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                              {group.type}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-sky-500" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Official HR Dispatch Bot:
                </label>
                <input
                  type="text"
                  value={botUsername}
                  onChange={(e) => setBotUsername(e.target.value)}
                  placeholder="@APA_HR_Bot"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Bot username used for automated broadcasts &amp; verification matching.
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Staff Broadcast Channel:
                </label>

                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs">
                  <span className="truncate text-slate-700 dark:text-slate-300">
                    {channelName || 'Not selected'}
                  </span>
                  {channelName && (
                    <button
                      type="button"
                      onClick={() => {
                        setChannelName('');
                        setSelectedGroupId('');
                      }}
                      className="text-slate-400 hover:text-rose-500 shrink-0"
                      title="Clear target"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Groups only. Pick the group that should receive new memos and broadcast reminders.
                </span>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <span>Save Telegram Settings</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestBroadcast}
                  disabled={isBroadcasting}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {isBroadcasting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                  ) : (
                    <BellRing className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <span>{isBroadcasting ? 'Sending…' : 'Test Channel Broadcast Relay'}</span>
                </button>

                {broadcastResult && (
                  <div
                    className={`p-2.5 rounded-lg text-[11px] font-medium flex items-start gap-1.5 ${
                      broadcastResult.ok
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {broadcastResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <span>{broadcastResult.message}</span>
                  </div>
                )}
              </div>

              {saveError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex items-start gap-1.5 text-[11px] font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{saveError}</span>
                </div>
              )}

              {savedSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 text-[11px] font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Settings updated successfully!</span>
                </div>
              )}
            </form>
          </div>

          {/* HR Officer linkage card: chat id + @username, both filled by the Link Telegram handshake */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Link2 className="w-4 h-4 text-sky-500" />
              <span>HR Officer Telegram</span>
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                {/* Link / QR Code: two ways to complete the same handshake. */}
                <TelegramLinkModes
                  layout="stack"
                  className="mb-3"
                  resolveUrl={resolveStartUrl}
                      onQrActive={() => void handleGetChatId({ openTab: false })}
                      resetSignal={Boolean(hrOfficerTelegram.trim())}
                      hideQr={Boolean(hrOfficerTelegram.trim())}
                  qrCaption="Scan with your phone camera, then press START in Telegram."
                >
                  {/* One slot for both states: while linked the button reads Unlink. */}
                  {hrOfficerTelegram.trim() ? (
                    <button
                      type="button"
                      onClick={handleUnlinkHrOfficer}
                      className="w-full py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/70 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span>Unlink Telegram</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleGetChatId()}
                      disabled={isFetchingChatId}
                      className="w-full py-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                      {isFetchingChatId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500" />
                      ) : (
                        <Send className="w-3.5 h-3.5 text-sky-500" />
                      )}
                      <span>{isFetchingChatId ? 'Waiting for Telegram…' : 'Link Telegram'}</span>
                    </button>
                  )}
                </TelegramLinkModes>

                {/* Shown in both modes so a wait can always be abandoned. */}
                {isFetchingChatId && (
                  <button
                    type="button"
                    onClick={handleCancelLink}
                    className="mt-2 mb-3 w-full py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/70 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                )}

                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  HR Officer Telegram Chat ID:
                </label>
                <input
                  type="text"
                  value={hrOfficerTelegram}
                  onChange={(e) => setHrOfficerTelegram(e.target.value)}
                  placeholder="48920182 or @elena_vance_hr"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Chat ID of the HR officer's private chat with the bot — where acknowledgement messages are delivered.
                </span>

                {chatIdError && (
                  <div className="mt-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex items-start gap-1.5 text-[11px] font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{chatIdError}</span>
                  </div>
                )}

                {chatIdInfo && (
                  <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-start gap-1.5 text-[11px] font-medium">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{chatIdInfo}</span>
                  </div>
                )}
              </div>

              {/* Filled automatically by "Link Telegram", stored on save */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  HR Officer Telegram Username:
                </label>
                <input
                  type="text"
                  value={hrOfficerUsername}
                  onChange={(e) => setHrOfficerUsername(e.target.value)}
                  placeholder="@elena_vance_hr"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Telegram @username of the HR officer who sent /start. Auto-filled and saved to
                  the database the moment Link Telegram succeeds.
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Telegram Bot Simulator & Webhook Tester */}
          {SHOW_BOT_SIMULATOR && (
          <div className="bg-indigo-50/50 dark:bg-indigo-950/30 p-6 rounded-2xl border border-indigo-200 dark:border-indigo-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200 font-bold text-sm">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Interactive Inbound Bot Simulator</span>
            </div>
            <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
              Test what happens when a staff member sends their token to Telegram. Simulates incoming webhook payloads and updates the HR Queue in real time.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Select Staff Sender:
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.telegramHandle}) - {u.role.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Verification Token (Optional / Auto-detect):
                </label>
                <input
                  type="text"
                  value={customToken}
                  onChange={(e) => setCustomToken(e.target.value)}
                  placeholder="e.g. ACK-2026-7821"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs"
                />
              </div>

              <button
                type="button"
                onClick={handleSimulateInboundPing}
                className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Simulate Inbound Telegram Ping</span>
              </button>

              {simulatedFeedback && (
                <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-[11px] font-medium apa-fade-in flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{simulatedFeedback}</span>
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        {/* Right Column: Live Simulated Webhook Log Stream (7 cols) */}
        <div className="md:col-span-7 bg-slate-900 rounded-2xl border border-slate-800 shadow-md p-5 text-white space-y-3 font-mono">
          <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-slate-300">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="font-bold">LIVE TELEGRAM BOT WEBHOOK STREAM</span>
            </div>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              LISTENING
            </span>
          </div>

          <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1 text-xs">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-[11px] space-y-1.5"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-sky-400 font-bold">{log.sender}</span>
                  <span>{log.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      log.status === 'Verified'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : log.status === 'Received'
                        ? 'bg-purple-950 text-purple-400 border border-purple-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}
                  >
                    {log.status.toUpperCase()}
                  </span>
                  <span className="text-slate-300">{log.memoCode}</span>
                  <span className="text-indigo-400 font-bold ml-auto">{log.token}</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono truncate">
                  {log.rawPayload}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
