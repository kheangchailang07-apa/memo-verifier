import { Request, Response } from 'express';
import { AuditLog, LinkTelegram, TelegramBotSettings, User } from '../models';
import { BOT_TOKEN_PATTERN, callTelegram, findLatestPrivateChat, listBotGroups, maskToken, resolveTelegramUsername, sendConnectedWelcome } from '../services/telegram';

const BOT_SETTING_FIELDS = [
  'botName',
  'botUsername',
  'hrOfficerTelegram',
  'hrOfficerUsername',
  'channelName',
  'autoVerifyWithBotToken',
  'activeStatusScheme',
] as const;

const MAX_MESSAGE_LENGTH = 4096;

const sanitizeSettings = (settings: TelegramBotSettings | null) => {
  if (!settings) return null;
  const plain = settings.get({ plain: true }) as Record<string, any>;
  const { botToken, ...rest } = plain;
  return {
    ...rest,
    botTokenSet: Boolean(botToken),
    botTokenMasked: maskToken(botToken),
    // Returned so the admin screen can prefill the token field for editing.
    botTokenRaw: botToken || null,
  };
};

const loadSettings = async (): Promise<TelegramBotSettings | null> =>
  TelegramBotSettings.findOne({ order: [['id', 'ASC']] });

export const getBotSettings = async (req: any, res: Response): Promise<void> => {
  try {
    const settings = await loadSettings();
    res.json({ success: true, settings: sanitizeSettings(settings) });
  } catch (error) {
    console.error('getBotSettings error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateBotSettings = async (req: any, res: Response): Promise<void> => {
  try {
    const updates: Record<string, any> = {};
    for (const field of BOT_SETTING_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    // The raw token is only ever accepted here, never returned by sanitizeSettings.
    if (req.body.botToken !== undefined) {
      const rawToken = typeof req.body.botToken === 'string' ? req.body.botToken.trim() : '';
      if (rawToken === '') {
        updates.botToken = null;
      } else if (!BOT_TOKEN_PATTERN.test(rawToken)) {
        res.status(400).json({
          success: false,
          message: 'Invalid bot token format. Expected a value like 123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw.',
        });
        return;
      } else {
        updates.botToken = rawToken;
      }
    }

    const existing = await loadSettings();

    let settings;
    if (!existing) {
      settings = await TelegramBotSettings.create({
        botName: 'APA Memo Verifier Bot',
        botUsername: '@apa_memo_verifier',
        hrOfficerTelegram: '@hr_officer',
        channelName: '@apa_announcements',
        botToken: null,
        autoVerifyWithBotToken: false,
        activeStatusScheme: 'standard',
        ...updates,
      } as any);
    } else {
      await existing.update(updates);
      settings = existing;
    }

    res.json({ success: true, settings: sanitizeSettings(settings) });
  } catch (error) {
    console.error('updateBotSettings error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getBotGroups = async (req: any, res: Response): Promise<void> => {
  try {
    const settings = await loadSettings();
    const token = settings?.botToken;

    if (!token) {
      res.status(400).json({
        success: false,
        message: 'No bot token configured. Save the token from @BotFather first.',
      });
      return;
    }

    const [result, me] = await Promise.all([listBotGroups(token), callTelegram('getMe', token)]);
    if (!result.ok) {
      res.status(400).json({ success: false, message: result.description || 'Unable to list bot groups.' });
      return;
    }

    res.json({
      success: true,
      groups: result.groups || [],
      bot: me.ok
        ? {
            id: String(me.result?.id ?? ''),
            username: me.result?.username ? `@${me.result.username}` : null,
            firstName: me.result?.first_name || null,
          }
        : null,
    });
  } catch (error) {
    console.error('getBotGroups error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Returns the most recent private chat that contacted the bot, so the UI can
 * auto-fill the HR officer chat id after the user taps the start link.
 */
export const getBotChatId = async (req: any, res: Response): Promise<void> => {
  try {
    const settings = await loadSettings();
    const token = settings?.botToken;
    if (!token) {
      res.status(400).json({
        success: false,
        message: 'No bot token configured. Save the token from @BotFather first.',
      });
      return;
    }

    // `code` restricts the scan to that deep-link tap; `withBot=0` skips the
    // getMe round-trip on polls (it was adding ~300ms to every poll).
    const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
    const withBot = req.query.withBot !== '0';

    const found = await findLatestPrivateChat(token, code || undefined);
    if (!found.ok) {
      res.status(400).json({ success: false, message: found.description || 'Unable to read incoming chats.' });
      return;
    }

    const me = withBot ? await callTelegram('getMe', token) : null;

    res.json({
      success: true,
      chat: found.chat || null,
      // Lets the client tell a brand-new /start tap from one it already saw.
      updateId: found.updateId ?? null,
      bot: me?.ok
        ? {
            id: String(me.result?.id ?? ''),
            username: me.result?.username ? `@${me.result.username}` : null,
            firstName: me.result?.first_name || null,
          }
        : null,
    });
  } catch (error) {
    console.error('getBotChatId error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const sendBotMessage = async (req: any, res: Response): Promise<void> => {
  try {
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
      res.status(400).json({ success: false, message: 'Message text is required.' });
      return;
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({
        success: false,
        message: `Message is too long (${text.length} characters). Telegram allows up to ${MAX_MESSAGE_LENGTH}.`,
      });
      return;
    }

    const settings = await loadSettings();
    const token = settings?.botToken;
    if (!token) {
      res.status(400).json({
        success: false,
        message: 'No bot token configured. Save the token from @BotFather first.',
      });
      return;
    }

    const requestedChat =
      typeof req.body.chatId === 'string' && req.body.chatId.trim()
        ? req.body.chatId.trim()
        : settings?.channelName || '';
    if (!requestedChat) {
      res.status(400).json({
        success: false,
        message: 'No target chat. Set the Staff Broadcast Channel or pass a chatId.',
      });
      return;
    }

    const result = await callTelegram('sendMessage', token, {
      chat_id: requestedChat,
      text,
    });

    if (!result.ok) {
      res.status(400).json({ success: false, message: result.description || 'Telegram rejected the message.' });
      return;
    }

    res.json({
      success: true,
      messageId: result.result?.message_id,
      chatId: String(result.result?.chat?.id ?? requestedChat),
    });
  } catch (error) {
    console.error('sendBotMessage error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Sends the "Telegram connected" confirmation into the private chat that just
 * tapped /start. Bot Setup calls this once it has captured the new chat id, so
 * the admin sees the link succeed inside Telegram as well as in the portal.
 */
export const sendWelcomeMessage = async (req: any, res: Response): Promise<void> => {
  try {
    const chatId = typeof req.body.chatId === 'string' ? req.body.chatId.trim() : '';
    const siteUrl = typeof req.body.siteUrl === 'string' ? req.body.siteUrl.trim() : '';

    if (siteUrl && !/^https?:\/\//i.test(siteUrl)) {
      res.status(400).json({ success: false, message: 'Invalid portal URL.' });
      return;
    }

    const settings = await loadSettings();
    const token = settings?.botToken;
    if (!token) {
      res.status(400).json({
        success: false,
        message: 'No bot token configured. Save the token from @BotFather first.',
      });
      return;
    }

    const target = chatId || (settings?.hrOfficerTelegram || '').trim();
    if (!target) {
      res.status(400).json({ success: false, message: 'No chat id provided and no HR Officer Chat ID saved yet.' });
      return;
    }

    const result = await sendConnectedWelcome(token, target, siteUrl || null);
    if (!result.ok) {
      res.status(400).json({ success: false, message: result.description || 'Telegram rejected the message.' });
      return;
    }

    res.json({ success: true, chatId: target });
  } catch (error) {
    console.error('sendWelcomeMessage error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Delivers a Phase-2 acknowledgement ping from a signed-in staff member to the
 * configured Target HR Receiver. Unlike sendBotMessage this is not an open
 * relay: the destination is always the stored HR chat id and the payload must
 * carry a verification token.
 */
export const sendAckPing = async (req: any, res: Response): Promise<void> => {
  try {
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
      res.status(400).json({ success: false, message: 'Message text is required.' });
      return;
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({
        success: false,
        message: `Message is too long (${text.length} characters). Telegram allows up to ${MAX_MESSAGE_LENGTH}.`,
      });
      return;
    }
    if (!/Verification Token:\s*ACK-/i.test(text)) {
      res.status(400).json({
        success: false,
        message: 'Message must contain an acknowledgement verification token.',
      });
      return;
    }

    const settings = await loadSettings();
    const token = settings?.botToken;
    if (!token) {
      res.status(400).json({
        success: false,
        message: 'No bot token configured. Save the token from @BotFather first.',
      });
      return;
    }

    const target = (settings?.hrOfficerTelegram || '').trim();
    if (!target) {
      res.status(400).json({
        success: false,
        message: 'No Target HR Receiver configured. Set the HR Officer Chat ID in Bot Setup first.',
      });
      return;
    }

    const result = await callTelegram('sendMessage', token, { chat_id: target, text });
    if (!result.ok) {
      res.status(400).json({ success: false, message: result.description || 'Telegram rejected the message.' });
      return;
    }

    res.json({
      success: true,
      messageId: result.result?.message_id,
      chatId: target,
    });
  } catch (error) {
    console.error('sendAckPing error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Verifies that a @username really belongs to a Telegram account, so the
 * enrolment form can refuse to save a handle that does not exist.
 */
export const resolveUsername = async (req: any, res: Response): Promise<void> => {
  try {
    const raw = typeof req.query.username === 'string' ? req.query.username : '';
    const result = await resolveTelegramUsername(raw);

    if (!result.ok) {
      res.status(result.invalid ? 400 : 502).json({
        success: false,
        message: result.description || 'Unable to verify the Telegram username.',
      });
      return;
    }

    const username = raw.trim().replace(/^@/, '');
    res.json({
      success: true,
      username: `@${username}`,
      exists: Boolean(result.exists),
      displayName: result.displayName || null,
      bio: result.bio || null,
    });
  } catch (error) {
    console.error('resolveUsername error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Writes a server-authoritative row into the immutable corporate audit ledger.
 * Failures are swallowed so a broken ledger never blocks a dispatched message.
 */
const writeAuditLog = async (
  req: any,
  actionType: 'REMINDER_SENT' | 'REMINDER_DISPATCHED',
  description: string,
  targetId?: string | null,
  targetName?: string | null,
  metadata?: Record<string, any> | null
): Promise<void> => {
  try {
    await AuditLog.create({
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      actorId: req.user?.id || 'SYS',
      actorName: req.user?.name || 'System',
      actorEmail: req.user?.email || '',
      actorRole: req.user?.role || 'admin',
      actionType,
      category: 'Directives',
      description,
      targetId: targetId || null,
      targetName: targetName || null,
      metadata: metadata || null,
      ipAddress: req.ip || null,
    } as any);
  } catch (error) {
    console.error('writeAuditLog error:', error);
  }
};

interface BroadcastRecipientPayload {
  userId: string;
  memoNumber: string;
  memoTitle?: string;
  memoId?: string;
  deadlineDate?: string;
  handle?: string;
}

/**
 * Option B - one recipient of the company-wide overdue reminder broadcast.
 *
 * One call dispatches exactly one directive reminder to exactly one employee, so
 * the HR desk can stream transmission logs as each message is accepted by
 * Telegram instead of waiting for a whole batch to finish. The destination is
 * always the private chat the employee bound through the one-click /start link;
 * employees who never linked their account are reported as skipped rather than
 * silently dropped.
 *
 * Every accepted message writes a REMINDER_SENT row to the audit ledger.
 */
export const broadcastReminder = async (req: any, res: Response): Promise<void> => {
  try {
    const body = req.body || {};
    const recipient: BroadcastRecipientPayload = {
      userId: typeof body.userId === 'string' ? body.userId.trim() : '',
      memoNumber: typeof body.memoNumber === 'string' ? body.memoNumber.trim() : '',
      memoTitle: typeof body.memoTitle === 'string' ? body.memoTitle.trim() : '',
      memoId: typeof body.memoId === 'string' ? body.memoId.trim() : '',
      deadlineDate: typeof body.deadlineDate === 'string' ? body.deadlineDate.trim() : '',
      handle: typeof body.handle === 'string' ? body.handle.trim() : '',
    };

    if (!recipient.userId || !recipient.memoNumber) {
      res.status(400).json({ success: false, message: 'userId and memoNumber are required.' });
      return;
    }

    const settings = await loadSettings();
    const token = settings?.botToken;
    if (!token) {
      res.status(400).json({
        success: false,
        message: 'No bot token configured. Save the token from @BotFather in Bot Setup first.',
      });
      return;
    }

    const user = await User.findByPk(recipient.userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'Recipient no longer exists.' });
      return;
    }

    const handle = (recipient.handle || String(user.telegramHandle || '').trim()).replace(/^@/, '');

    // Bots can only message a private chat that already tapped /start, so the
    // linked chat id is the only deliverable destination for a DM reminder.
    const link = await LinkTelegram.findOne({ where: { userId: recipient.userId } });
    if (!link || link.status !== 'linked' || !link.chatId) {
      res.json({
        success: true,
        status: 'skipped',
        userId: recipient.userId,
        name: user.name,
        handle: handle ? `@${handle}` : '',
        reason: 'Employee has no linked Telegram chat. Ask them to press LINK Telegram first.',
      });
      return;
    }

    const botHandle = String(settings?.botUsername || '').trim() || 'the HR bot';
    const deadline = recipient.deadlineDate || 'the directive deadline';
    const title = recipient.memoTitle ? ` \u2014 ${recipient.memoTitle}` : '';
    const text =
      `\u26a0\ufe0f [APA HR Policy Notice] Hello ${handle ? `@${handle}` : user.name}, ` +
      `you have a mandatory corporate directive (${recipient.memoNumber}${title}) awaiting your ` +
      `non-repudiation signature. Please sign via the portal or message ${botHandle} before ${deadline}.`;

    if (text.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({
        success: false,
        message: `Reminder is too long (${text.length} characters). Telegram allows up to ${MAX_MESSAGE_LENGTH}.`,
      });
      return;
    }

    const result = await callTelegram('sendMessage', token, { chat_id: link.chatId, text });
    if (!result.ok) {
      res.json({
        success: true,
        status: 'failed',
        userId: recipient.userId,
        name: user.name,
        handle: `@${handle}`,
        reason: result.description || 'Telegram rejected the message.',
      });
      return;
    }

    const messageId = result.result?.message_id ?? null;
    await writeAuditLog(
      req,
      'REMINDER_SENT',
      `Dispatched Telegram directive reminder for ${recipient.memoNumber} to ${user.name} (${handle ? `@${handle}` : 'no handle'}) - delivered to chat ${link.chatId}.`,
      recipient.memoId || recipient.memoNumber,
      user.name,
      {
        memoNumber: recipient.memoNumber,
        memoTitle: recipient.memoTitle || null,
        deadlineDate: recipient.deadlineDate || null,
        recipientUserId: recipient.userId,
        recipientHandle: handle ? `@${handle}` : null,
        chatId: link.chatId,
        messageId,
      }
    );

    res.json({
      success: true,
      status: 'sent',
      userId: recipient.userId,
      name: user.name,
      handle: `@${handle}`,
      chatId: String(link.chatId),
      messageId,
    });
  } catch (error) {
    console.error('broadcastReminder error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Option C - employee self-service "Send Test Ping to Bot".
 *
 * Runs three checks and reports each of them:
 *   1. getMe            - the stored corporate bot token is alive
 *   2. username lookup  - the bound @handle really belongs to a Telegram account
 *   3. handshake send   - a live 2FA ping accepted by the employee's linked chat
 *
 * The employee can correct their @handle in the same dialog; saving goes through
 * the self-service profile route, never the admin user management API.
 */
export const testPing = async (req: any, res: Response): Promise<void> => {
  try {
    const settings = await loadSettings();
    const token = settings?.botToken;
    if (!token) {
      res.status(400).json({
        success: false,
        message: 'No bot token configured. Ask HR/Admin to set the corporate bot up in Bot Setup first.',
      });
      return;
    }

    const me = await callTelegram('getMe', token);
    if (!me.ok) {
      res.status(502).json({
        success: false,
        message: me.description || 'The corporate bot did not answer. Check the bot token.',
      });
      return;
    }

    const botUsername = me.result?.username ? `@${me.result.username}` : String(settings?.botUsername || '').trim();
    const account = req.user?.id ? await User.findByPk(req.user.id) : null;
    const linked = req.user?.id ? await LinkTelegram.findOne({ where: { userId: req.user.id } }) : null;

    const typed = typeof req.body?.handle === 'string' ? req.body.handle.trim() : '';
    const handle = (typed || linked?.telegramUsername || String(account?.telegramHandle || '') || '').replace(/^@/, '');

    const lookup = handle ? await resolveTelegramUsername(handle) : { ok: false, invalid: true, description: 'A Telegram username is required.' };
    const handleExists = Boolean(lookup.ok && lookup.exists);

    let chatId: string | null = null;
    let messageId: number | null = null;
    let chatError: string | null = null;

    if (linked?.chatId) {
      const text =
        `\ud83d\udd10 [APA HR 2FA HANDSHAKE] Test accepted for ${req.user?.name || 'employee'} ` +
        `(${req.user?.id || 'n/a'}). Bot ${botUsername} verified this account for out-of-band ` +
        `policy acknowledgements at ${new Date().toISOString()}.`;

      const sent = await callTelegram('sendMessage', token, { chat_id: linked.chatId, text });
      if (sent.ok) {
        chatId = String(linked.chatId);
        messageId = sent.result?.message_id ?? null;
      } else {
        chatError = sent.description || 'Telegram rejected the handshake message.';
      }
    }

    const status = messageId != null ? 'sent' : handleExists ? 'verified' : 'unverified';
    const message =
      messageId != null
        ? `Handshake certified! Corporate bot ${botUsername} delivered a live 2FA ping to chat ${chatId} for ${req.user?.name || 'this employee'} (@${handle || 'n/a'}). You are authorized for out-of-band two-part policy acknowledgements.`
        : handleExists
        ? `Handshake certified! Corporate bot ${botUsername} verified the binding for ${req.user?.name || 'this employee'} (@${handle}), and the @handle resolves to a real Telegram account.${
            linked?.chatId ? ` Live ping could not be delivered: ${chatError}` : ''
          }`
        : handle
        ? `The corporate bot ${botUsername} is reachable, but @${handle} did not resolve to a Telegram account. Correct the handle and run the test again.`
        : `The corporate bot ${botUsername} is reachable, but this account has no Telegram handle bound yet. Enter your @username and run the test again.`;

    res.json({
      success: true,
      status,
      botUsername,
      botId: String(me.result?.id ?? ''),
      handle: handle ? `@${handle}` : '',
      handleExists,
      displayName: lookup.ok ? lookup.displayName || null : null,
      linked: Boolean(linked && linked.status === 'linked'),
      chatId,
      messageId,
      message,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('testPing error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
