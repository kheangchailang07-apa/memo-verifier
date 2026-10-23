import { Response } from 'express';
import { randomBytes } from 'crypto';
import { LinkTelegram, TelegramBotSettings, User } from '../models';
import type { AuthRequest } from '../middlewares/auth';
import { findStartLinkUpdate, sendConnectedWelcome } from '../services/telegram';

export interface LinkTelegramView {
  id: string;
  code: string;
  url: string;
  status: 'pending' | 'linked';
  chatId: string | null;
  telegramUsername: string | null;
  telegramName: string | null;
  linkedAt: Date | null;
}

const loadBot = async (): Promise<{ token: string; username: string } | null> => {
  const settings = await TelegramBotSettings.findOne({ order: [['id', 'ASC']] });
  const token = settings?.botToken || null;
  if (!token) return null;
  return {
    token,
    username: String(settings?.botUsername || '').trim().replace(/^@/, ''),
  };
};

const toView = (link: LinkTelegram, botUsername: string): LinkTelegramView => ({
  id: link.id,
  code: link.code,
  url: `https://t.me/${botUsername}?start=${link.code}`,
  status: link.status,
  chatId: link.chatId,
  telegramUsername: link.telegramUsername,
  telegramName: link.telegramName,
  linkedAt: link.linkedAt,
});

const requireUserId = (req: AuthRequest, res: Response): string | null => {
  if (!req.user?.id) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return null;
  }
  return req.user.id;
};

// Records the newest /start <code> tap currently sitting in the update queue.
// The queue is never drained, so taps left over from an earlier attempt must be
// below this watermark - otherwise polling reconnects the user instantly, with
// no scan or START of their own.
const refreshBaseline = async (link: LinkTelegram, token: string): Promise<void> => {
  try {
    const seen = await findStartLinkUpdate(token, link.code);
    if (!seen.ok || seen.updateId == null) return;
    const baseline = Number(seen.updateId);
    if (baseline > Number(link.baselineUpdateId || 0)) {
      await link.update({ baselineUpdateId: baseline });
    }
  } catch (error) {
    // A failed queue read just leaves the old watermark in place.
    console.error('refreshBaseline error:', error);
  }
};

// Creates (or returns) the caller's one-click Telegram link row + deep link URL.
export const getMyLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const bot = await loadBot();
    if (!bot) {
      res.status(400).json({
        success: false,
        message: 'No Telegram bot is configured yet. Ask HR/Admin to set it up in Bot Setup first.',
      });
      return;
    }

    let link = await LinkTelegram.findOne({ where: { userId } });
    if (!link) {
      const code = `lnk-${randomBytes(8).toString('hex')}`;
      link = await LinkTelegram.create({
        id: `LNK-${Date.now()}-${randomBytes(4).toString('hex')}`,
        userId,
        code,
        status: 'pending',
        requestedAt: new Date(),
      });
    }

    // Fresh watermark on every request: only a tap made from here on counts.
    await refreshBaseline(link, bot.token);

    res.json({ success: true, link: toView(link, bot.username) });
  } catch (error) {
    console.error('getMyLink error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Polls the bot update queue for the caller's /start <code> tap and, when found,
// stores the Telegram chat + username and marks the link done.
export const checkMyLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const bot = await loadBot();
    if (!bot) {
      res.status(400).json({
        success: false,
        message: 'No Telegram bot is configured yet. Ask HR/Admin to set it up in Bot Setup first.',
      });
      return;
    }

    const link = await LinkTelegram.findOne({ where: { userId } });
    if (!link) {
      res.status(404).json({ success: false, message: 'No pending Telegram link. Open LINK Telegram first.' });
      return;
    }

    const result = await findStartLinkUpdate(bot.token, link.code);
    if (!result.ok) {
      res.json({ success: true, status: 'pending', message: result.description || 'Waiting for Telegram…' });
      return;
    }

    // Only a tap newer than the watermark is this attempt's handshake - older
    // ones are leftovers from a previous click sitting in the update queue.
    const baseline = Number(link.baselineUpdateId || 0);
    const isFresh = Boolean(result.updateId != null && Number(result.updateId) > baseline);

    if (!result.chat || !isFresh) {
      res.json({
        success: true,
        status: link.status === 'linked' ? 'linked' : 'pending',
        link: toView(link, bot.username),
      });
      return;
    }

    const linkedAt = new Date();
    const wasPending = link.status !== 'linked';
    await link.update({
      chatId: result.chat.id,
      telegramUsername: result.chat.username,
      telegramName: result.chat.name,
      status: 'linked',
      linkedAt,
    });

    // Confirm the connection inside Telegram itself - only on the actual
    // pending -> linked transition, since checkMyLink is polled repeatedly.
    if (wasPending) {
      sendConnectedWelcome(bot.token, result.chat.id).catch((error) => {
        console.error('linkTelegram welcome error:', error);
      });
    }

    // If the account has no self-service Telegram handle yet, adopt the one
    // Telegram reports for the linked chat.
    const user = await User.findByPk(userId);
    if (user && !String(user.telegramHandle || '').trim()) {
      await user.update({ telegramHandle: result.chat.username || '' });
    }

    res.json({
      success: true,
      status: 'linked',
      link: toView(link, bot.username),
      user: { telegramHandle: result.chat.username },
    });
  } catch (error) {
    console.error('checkMyLink error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Clears a completed link so the user can re-run the one-click flow (e.g. wrong
// account tapped the link, or they want to switch Telegram accounts).
export const unlinkMyLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const link = await LinkTelegram.findOne({ where: { userId } });
    if (!link) {
      res.json({ success: true, link: null });
      return;
    }

    // Move the watermark past any tap made before the re-link attempt.
    const bot = await loadBot();
    if (bot) await refreshBaseline(link, bot.token);

    await link.update({
      chatId: null,
      telegramUsername: null,
      telegramName: null,
      status: 'pending',
      linkedAt: null,
      requestedAt: new Date(),
    });

    // Unlinking also clears the Telegram handle the account had adopted, so the
    // handle no longer shows anywhere in the UI.
    const user = await User.findByPk(userId);
    if (user && String(user.telegramHandle || '').trim()) {
      await user.update({ telegramHandle: '' });
    }

    res.json({ success: true, link: null, user: { telegramHandle: '' } });
  } catch (error) {
    console.error('unlinkMyLink error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};