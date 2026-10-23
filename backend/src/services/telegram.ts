import { ipv4Fetch } from './ipv4Http';

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const REQUEST_TIMEOUT_MS = 10000;

export const BOT_TOKEN_PATTERN = /^\d+:[A-Za-z0-9_-]{30,}$/;

export interface TelegramApiResponse {
  ok: boolean;
  result?: any;
  description?: string;
  error_code?: number;
}

/**
 * Keeps the stored bot token out of API responses: only the numeric bot id
 * prefix and the last four characters are ever echoed back to a client.
 */
export const maskToken = (token: string | null | undefined): string | null => {
  if (!token) return null;
  const [id, secret] = token.split(':');
  if (!secret) return `${token.slice(0, 4)}****`;
  return `${id}:${'*'.repeat(4)}${secret.slice(-4)}`;
};

export const describeTelegramError = (statusCode: number, description: string): string => {
  const text = description || `Telegram API returned HTTP ${statusCode}`;
  if (/chat not found|chat_id is empty|PEER_ID_INVALID/i.test(text)) {
    return 'Chat not found. Check the channel/username and make sure the bot is a member.';
  }
  if (/bot was blocked|bot can't initiate/i.test(text)) {
    return 'The bot was blocked by the recipient.';
  }
  if (/not enough rights|have no rights|need administrator rights|user is deactivated/i.test(text)) {
    return 'The bot lacks permission in that chat. Add it to the channel as an administrator with permission to post.';
  }
  if (/chat is deactivated|kicked/i.test(text)) {
    return 'The bot was removed from that chat.';
  }
  if (/unauthorized|Invalid token|bad request: invalid/i.test(text)) {
    return 'The bot token is invalid. Re-copy it from @BotFather.';
  }
  return text;
};

export const callTelegram = async (
  method: string,
  token: string,
  payload: Record<string, any> = {}
): Promise<TelegramApiResponse> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await ipv4Fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = (await response.json()) as TelegramApiResponse;
    if (!data.ok) {
      return {
        ok: false,
        error_code: data.error_code || response.status,
        description: describeTelegramError(response.status, data.description || ''),
      };
    }
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, description: 'Telegram API timed out. Please retry.' };
    }
    const message = error instanceof Error ? error.message : 'Unable to reach the Telegram API.';
    return { ok: false, description: message };
  } finally {
    clearTimeout(timer);
  }
};

export interface TelegramGroup {
  id: string;
  title: string;
  type: 'group' | 'supergroup';
  username: string | null;
  memberCount?: number;
}

const CHAT_TYPES = new Set(['group', 'supergroup']);

const extractChat = (update: any): any =>
  update?.message?.chat ||
  update?.edited_message?.chat ||
  update?.channel_post?.chat ||
  update?.edited_channel_post?.chat ||
  update?.my_chat_member?.chat ||
  update?.chat_member?.chat ||
  update?.left_chat_member?.chat ||
  null;

/**
 * Discovers the groups/supergroups the bot has been added to by reading its
 * pending update queue (membership changes and messages alike). Channels and
 * private chats are deliberately excluded — only group targets are surfaced.
 */
export const listBotGroups = async (token: string): Promise<{ ok: boolean; groups?: TelegramGroup[]; description?: string }> => {
  const response = await callTelegram('getUpdates', token, {
    timeout: 0,
    allowed_updates: [
      'message',
      'edited_message',
      'channel_post',
      'my_chat_member',
      'chat_member',
      'left_chat_member',
    ],
  });

  if (!response.ok) {
    return { ok: false, description: response.description || 'Unable to read the bot update queue.' };
  }

  const groups = new Map<string, TelegramGroup>();
  for (const update of Array.isArray(response.result) ? response.result : []) {
    const chat = extractChat(update);
    if (!chat?.id || !CHAT_TYPES.has(chat.type)) continue;

    const id = String(chat.id);
    groups.set(id, {
      id,
      title: chat.title || chat.username || `Group ${id}`,
      type: chat.type,
      username: chat.username ? `@${chat.username}` : null,
    });
  }

  return { ok: true, groups: Array.from(groups.values()).sort((a, b) => a.title.localeCompare(b.title)) };
};

export interface TelegramPrivateChat {
  id: string;
  name: string;
  username: string | null;
}

const PRIVATE_CHAT_ALLOWED_UPDATES = ['message', 'edited_message', 'my_chat_member', 'chat_member', 'callback_query'];

const buildPrivateChat = (chat: any): TelegramPrivateChat => ({
  id: String(chat.id),
  name: [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || `Chat ${chat.id}`,
  username: chat.username ? `@${chat.username}` : null,
});

/**
 * Reads the update queue. Telegram only serves one getUpdates at a time and
 * answers concurrent calls with 409 "Conflict", which happens whenever the
 * portal polls while another screen (or the same screen a moment ago) reads
 * the queue - so retry a couple of times instead of failing the caller.
 */
const readUpdates = async (token: string, allowedUpdates: string[]): Promise<TelegramApiResponse> => {
  const call = () => callTelegram('getUpdates', token, { timeout: 0, allowed_updates: allowedUpdates });

  let response = await call();
  for (let attempt = 0; attempt < 2 && !response.ok && /conflict/i.test(response.description || ''); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    response = await call();
  }
  return response;
};

/**
 * Reads the pending update queue for the most recent private chat that
 * contacted the bot (someone tapping the start link or sending /start).
 * The offset is deliberately not advanced so the queue stays available to
 * listBotGroups.
 */
export const findLatestPrivateChat = async (
  token: string,
  code?: string
): Promise<{ ok: boolean; chat?: TelegramPrivateChat; updateId?: number; description?: string }> => {
  const response = await readUpdates(token, PRIVATE_CHAT_ALLOWED_UPDATES);

  if (!response.ok) {
    return { ok: false, description: response.description || 'Unable to read the bot update queue.' };
  }

  const updates = Array.isArray(response.result) ? response.result : [];
  for (let i = updates.length - 1; i >= 0; i--) {
    const update = updates[i];
    const chat =
      update?.message?.chat ||
      update?.edited_message?.chat ||
      update?.my_chat_member?.chat ||
      update?.chat_member?.chat ||
      update?.callback_query?.message?.chat ||
      null;

    if (chat?.id && chat.type === 'private') {
      // With a deep-link code, only the `/start <code>` tap counts: any other
      // private message in the queue must not be mistaken for the handshake.
      if (code) {
        const text = String(
          update?.message?.text ??
            update?.edited_message?.text ??
            update?.callback_query?.message?.text ??
            ''
        ).trim();
        if (text !== `/start ${code}`) continue;
      }
      // update_id is what makes a *repeat* tap detectable: the chat id stays
      // the same, but every tap produces a fresh update_id.
      return {
        ok: true,
        chat: buildPrivateChat(chat),
        updateId: typeof update?.update_id === 'number' ? update.update_id : undefined,
      };
    }
  }

return { ok: true };
};

export interface TelegramStartLinkChat {
  id: string;
  name: string;
  username: string | null;
}

/**
 * Scans the pending update queue for a user who tapped the bot's deep link
 * `t.me/<bot>?start=<code>`. Telegram turns that into a private message whose
 * text is exactly `/start <code>`. The offset is deliberately not advanced so
 * the same queue stays readable by listBotGroups.
 */
export const findStartLinkUpdate = async (
  token: string,
  code: string
): Promise<{ ok: boolean; chat?: TelegramStartLinkChat; updateId?: number; description?: string }> => {
  const response = await readUpdates(token, ['message', 'edited_message', 'callback_query']);

  if (!response.ok) {
    return { ok: false, description: response.description || 'Unable to read the bot update queue.' };
  }

  const updates = Array.isArray(response.result) ? response.result : [];
  for (let i = updates.length - 1; i >= 0; i--) {
    const update = updates[i];
    const message = update?.message || update?.edited_message || null;
    const chat = message?.chat;
    if (chat?.id && chat.type === 'private' && String(message?.text || '').trim() === `/start ${code}`) {
      return {
        ok: true,
        // update_id is what tells a *fresh* tap apart from one left in the
        // undrained queue by an earlier attempt.
        updateId: typeof update?.update_id === 'number' ? update.update_id : undefined,
        chat: {
          id: String(chat.id),
          name: [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || `Chat ${chat.id}`,
          username: chat.username ? `@${chat.username}` : null,
        },
      };
    }
  }

  return { ok: true };
};

export const TELEGRAM_USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{2,31}$/;

export interface TelegramUsernameLookup {
  ok: boolean;
  exists?: boolean;
  displayName?: string | null;
  bio?: string | null;
  /** True when the input itself was unusable (missing/malformed) rather than unverifiable. */
  invalid?: boolean;
  description?: string;
}

/**
 * Checks whether a Telegram public username actually resolves to an account.
 *
 * The Bot API cannot look up arbitrary @usernames (getChat only knows public
 * channels/groups), so we read the public t.me landing page instead:
 *   - a real handle serves a preview page containing `tgme_page_title`
 *   - an unregistered handle serves a placeholder with no preview block
 *   - an invalid/reserved handle redirects away (HTTP 302)
 */
export const resolveTelegramUsername = async (raw: string): Promise<TelegramUsernameLookup> => {
  const username = String(raw || '').trim().replace(/^@/, '');
  if (!username) {
    return { ok: false, invalid: true, description: 'A Telegram username is required.' };
  }
  if (!TELEGRAM_USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      invalid: true,
      description: 'Telegram usernames are 3-32 characters of letters, digits and underscores and must start with a letter.',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await ipv4Fetch(`https://t.me/${username}`, {
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });

    // 302 to telegram.org: Telegram refuses to serve a page for this handle.
    if (response.status !== 200) {
      if (response.status >= 500) {
        return { ok: false, description: 'Telegram could not be reached. Please try again.' };
      }
      return { ok: true, exists: false };
    }

    const html = await response.text();
    if (!html.includes('tgme_page_title')) {
      return { ok: true, exists: false };
    }

    const titleMatch = html.match(/<div class="tgme_page_title"[\s\S]*?<span dir="auto">([^<]*)<\/span>/);
    const descMatch = html.match(/<div class="tgme_page_description"[^>]*>([\s\S]*?)<\/div>/);
    const clean = (value?: string | null) =>
      value ? value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : null;

    return {
      ok: true,
      exists: true,
      displayName: clean(titleMatch?.[1]) || null,
      bio: clean(descMatch?.[1]) || null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, description: 'Telegram took too long to respond. Please try again.' };
    }
    const message = error instanceof Error ? error.message : 'Unable to reach Telegram.';
    return { ok: false, description: `Unable to reach Telegram. ${message}` };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Confirmation sent to a chat once its /start tap has been accepted, so the
 * person sees inside Telegram that the website link actually succeeded.
 */
export const buildConnectedWelcomeText = (siteUrl?: string | null): string => {
  const lines = [
    '\u2705 Telegram connected to the APA Portal',
    '',
    'This Telegram account is now linked to your APA Portal profile. You will receive memo notifications and verification pings here.',
  ];
  if (siteUrl) lines.push('', `Portal: ${siteUrl}`);
  lines.push('', '- APA Memo Verifier Bot');
  return lines.join('\n');
};

export const sendConnectedWelcome = async (
  token: string,
  chatId: string,
  siteUrl?: string | null
): Promise<{ ok: boolean; description?: string }> => {
  const result = await callTelegram('sendMessage', token, {
    chat_id: chatId,
    text: buildConnectedWelcomeText(siteUrl),
  });
  return { ok: result.ok, description: result.description };
};
