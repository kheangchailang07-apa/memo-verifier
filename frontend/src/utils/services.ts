import { api } from './api';
import type {
  User,
  Policy,
  Memo,
  PdfDocument,
  AcknowledgementRecord,
  TelegramBotSettings,
  TelegramGroup,
  TelegramBotInfo,
  TelegramChatInfo,
  RolePermissions,
  UserRole,
  AuditLogEntry,
  Department,
} from '../types';

interface SessionUser {
  id: string;
  name: string;
  role: UserRole;
  department: string;
  jobTitle: string;
  email: string;
  username?: string | null;
  telegramHandle: string;
  avatar: string;
  status: 'active' | 'suspended';
  credentialType: string;
  lastLogin: string;
  mustChangePassword?: boolean;
  assignedDepartments?: string[] | null;
  signatureDataUrl?: string | null;
  signatureFileName?: string | null;
  signatureS3Key?: string | null;
  signatureS3Url?: string | null;
  /** URL of the signature as served by this app (/signatures_memo/<owner>/<file>). */
  signatureUrl?: string | null;
}

const listOf = async <T>(p: Promise<any>, key: string): Promise<T[]> => {
  const res = await p;
  const value = res?.[key];
  return Array.isArray(value) ? value : [];
};

export const authService = {
  // Accepts either a corporate email or a username in the same field.
  login: async (identifier: string, password: string): Promise<SessionUser> => {
    const res = await api.post('/auth/login', {
      data: { email: identifier.trim(), password },
      skipAuthRetry: true,
    });
    return res.user as SessionUser;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout', { skipAuthRetry: true });
    } catch {
      // best effort
    }
  },

  restore: async (): Promise<SessionUser | null> => {
    try {
      // The access cookie lives 15 minutes; the refresh cookie lives 7 days.
      // A plain 401 here therefore means "renew it", not "signed out".
      const res = await api.get('/auth/me');
      return res.user as SessionUser;
    } catch (err) {
      if (api.isSessionError(err)) return null;
      throw err;
    }
  },

  // Self-service profile edits; the server only accepts safe fields for this route.
  updateProfile: async (payload: {
    name?: string;
    username?: string | null;
    telegramHandle?: string;
    jobTitle?: string;
    department?: string;
    currentPassword?: string;
    newPassword?: string;
    signatureDataUrl?: string | null;
    signatureFileName?: string | null;
  }): Promise<SessionUser> => {
    const res = await api.put('/auth/profile', { data: payload });
    return res.user as SessionUser;
  },

  /** Returns the stored signature (prefers a fresh presigned URL when available). */
  getSignature: async (): Promise<{ url?: string; dataUrl?: string } | null> => {
    try {
      const res = await api.get('/auth/signature');
      if (res?.url) return { url: res.url };
      if (res?.dataUrl) return { dataUrl: res.dataUrl };
      return null;
    } catch {
      return null;
    }
  },
};

export const usersService = {
  list: () => listOf<User>(api.get('/users'), 'users'),
  revealPassword: async (id: string, adminPassword: string): Promise<string> => {
    const res = await api.post(`/users/${encodeURIComponent(id)}/reveal-password`, {
      data: { adminPassword },
    });
    return String(res.password ?? '');
  },
  create: async (payload: Partial<User> & { password?: string }) => {
    const res = await api.post('/users', { data: payload });
    return res.user as User;
  },
  update: async (id: string, payload: Partial<User> & { password?: string }) => {
    const res = await api.put(`/users/${encodeURIComponent(id)}`, { data: payload });
    return res.user as User;
  },
  remove: async (id: string) => {
    await api.delete(`/users/${encodeURIComponent(id)}`);
  },
};

export const policiesService = {
  list: () => listOf<Policy>(api.get('/policies'), 'policies'),
  create: async (payload: Partial<Policy>) => {
    const res = await api.post('/policies', { data: payload });
    return res.policy as Policy;
  },
  update: async (id: string, payload: Partial<Policy>) => {
    const res = await api.put(`/policies/${encodeURIComponent(id)}`, { data: payload });
    return res.policy as Policy;
  },
  remove: async (id: string) => {
    await api.delete(`/policies/${encodeURIComponent(id)}`);
  },
};

export const memosService = {
  list: () => listOf<Memo>(api.get('/memos'), 'memos'),
  create: async (payload: Partial<Memo>) => {
    const res = await api.post('/memos', { data: payload });
    return res.memo as Memo;
  },
  update: async (id: string, payload: Partial<Memo>) => {
    const res = await api.put(`/memos/${encodeURIComponent(id)}`, { data: payload });
    return res.memo as Memo;
  },
  remove: async (id: string) => {
    await api.delete(`/memos/${encodeURIComponent(id)}`);
  },
};

export const pdfsService = {
  list: () => listOf<PdfDocument>(api.get('/pdfs'), 'pdfs'),
  create: async (payload: Partial<PdfDocument>, file: File) => {
    const form = new FormData();
    form.append('file', file, payload.fileName || file.name);
    const scalarKeys = [
      'id',
      'code',
      'title',
      'category',
      'fileName',
      'fileSize',
      'uploadDate',
      'uploadedBy',
      'uploadedByRole',
      'departmentScope',
      'version',
      'summary',
      'isMandatory',
      'linkedMemoId',
      'pageCount',
    ] as const;
    for (const key of scalarKeys) {
      const value = (payload as any)[key];
      if (value === undefined || value === null) continue;
      form.append(key, key === 'isMandatory' ? String(value === true) : String(value));
    }
    if (payload.tags) form.append('tags', JSON.stringify(payload.tags));

    const res = await api.post('/pdfs', { body: form });
    return res.pdf as PdfDocument;
  },
  getUrl: async (id: string): Promise<string> => {
    const res = await api.get(`/pdfs/${encodeURIComponent(id)}/url`);
    if (!res?.url) throw new Error('Unable to resolve a link for this document.');
    return res.url as string;
  },
  update: async (id: string, payload: Partial<PdfDocument>) => {
    const res = await api.put(`/pdfs/${encodeURIComponent(id)}`, { data: payload });
    return res.pdf as PdfDocument;
  },
  remove: async (id: string) => {
    await api.delete(`/pdfs/${encodeURIComponent(id)}`);
  },
};

export const acksService = {
  list: () => listOf<AcknowledgementRecord>(api.get('/acks'), 'acks'),
  create: async (payload: Partial<AcknowledgementRecord>) => {
    const res = await api.post('/acks', { data: payload });
    return res.ack as AcknowledgementRecord;
  },
  update: async (id: string, payload: Partial<AcknowledgementRecord>) => {
    const res = await api.put(`/acks/${encodeURIComponent(id)}`, { data: payload });
    return res.ack as AcknowledgementRecord;
  },
};

export const botService = {
  get: async (): Promise<TelegramBotSettings | null> => {
    const res = await api.get('/bot');
    return (res.settings ?? null) as TelegramBotSettings | null;
  },
  update: async (payload: Partial<TelegramBotSettings>) => {
    const res = await api.put('/bot', { data: payload });
    return res.settings as TelegramBotSettings;
  },
  // Lists the groups/supergroups the stored bot has been added to — admin/HR only.
  groups: async (): Promise<{ groups: TelegramGroup[]; bot: TelegramBotInfo | null }> => {
    const res = await api.get('/bot/groups');
    return {
      groups: (res.groups ?? []) as TelegramGroup[],
      bot: (res.bot ?? null) as TelegramBotInfo | null,
    };
  },
  // Delivers a real Telegram message through the stored bot token.
  send: async (payload: { text: string; chatId?: string }): Promise<{ messageId: number }> => {
    const res = await api.post('/bot/send', { data: payload });
    return { messageId: res.messageId };
  },
  // Staff-side Phase-2 ping: always delivered to the configured HR receiver.
  sendAckPing: async (payload: { text: string }): Promise<{ messageId: number; chatId: string }> => {
    const res = await api.post('/bot/ack-ping', { data: payload });
    return { messageId: res.messageId, chatId: res.chatId };
  },
  // Reads the latest private chat that tapped the bot's start link.
  // Pass `code` to only match that deep-link tap, and `withBot: false` on
  // polls to skip the extra getMe round-trip.
  chatId: async (
    options?: { code?: string; withBot?: boolean }
  ): Promise<{ chat: TelegramChatInfo | null; bot: TelegramBotInfo | null; updateId: number | null }> => {
    const params = new URLSearchParams();
    if (options?.code) params.set('code', options.code);
    if (options?.withBot === false) params.set('withBot', '0');
    const qs = params.toString();
    const res = await api.get(`/bot/chat-id${qs ? `?${qs}` : ''}`);
    return {
      chat: (res.chat ?? null) as TelegramChatInfo | null,
      bot: (res.bot ?? null) as TelegramBotInfo | null,
      updateId: typeof res.updateId === 'number' ? res.updateId : null,
    };
  },
  // Sends the "Telegram connected" confirmation into a chat that tapped /start.
  sendWelcome: async (payload: { chatId?: string; siteUrl?: string }): Promise<{ chatId: string }> => {
    const res = await api.post('/bot/welcome', { data: payload });
    return { chatId: res.chatId };
  },
  // Confirms a Telegram @username belongs to a real account (admin/HR only).
  resolveUsername: async (
    username: string
  ): Promise<{ username: string; exists: boolean; displayName: string | null; bio: string | null }> => {
    const res = await api.get(`/bot/username?username=${encodeURIComponent(username)}`);
    return {
      username: res.username,
      exists: Boolean(res.exists),
      displayName: res.displayName ?? null,
      bio: res.bio ?? null,
    };
  },
  // Option B — one row of the overdue reminder broadcast (admin/HR only).
  // Returns per-recipient outcome so the modal can stream truthful delivery logs.
  broadcast: async (payload: {
    userId: string;
    memoId?: string;
    memoNumber: string;
    memoTitle?: string;
    deadlineDate?: string;
    handle?: string;
  }): Promise<{
    status: 'sent' | 'skipped' | 'failed';
    userId: string;
    name?: string;
    handle?: string;
    chatId?: string;
    messageId?: number | null;
    reason?: string;
  }> => {
    const res = await api.post('/bot/broadcast', { data: payload });
    return res as any;
  },
  // Option C — employee self-service 2FA handshake against the corporate bot.
  testPing: async (payload?: { handle?: string }): Promise<{
    status: 'sent' | 'verified' | 'unverified';
    botUsername: string;
    botId: string;
    handle: string;
    handleExists: boolean;
    displayName: string | null;
    linked: boolean;
    chatId: string | null;
    messageId: number | null;
    message: string;
    timestamp: string;
  }> => {
    const res = await api.post('/bot/test-ping', { data: payload ?? {} });
    return res as any;
  },
};

export interface LinkTelegramStatus {
  id: string;
  code: string;
  url: string;
  status: 'pending' | 'linked';
  chatId: string | null;
  telegramUsername: string | null;
  telegramName: string | null;
  linkedAt: string | null;
}

// One-click "/start <code>" Telegram linking for any signed-in user.
export const linkTelegramService = {
  me: async (): Promise<{ link: LinkTelegramStatus }> => {
    const res = await api.get('/link-telegram/me');
    return { link: res.link as LinkTelegramStatus };
  },
  check: async (): Promise<{ status: 'pending' | 'linked'; message?: string; link?: LinkTelegramStatus; user?: { telegramHandle?: string } }> => {
    const res = await api.post('/link-telegram/check', {});
    return res as { status: 'pending' | 'linked'; message?: string; link?: LinkTelegramStatus; user?: { telegramHandle?: string } };
  },
  unlink: async (): Promise<void> => {
    await api.post('/link-telegram/unlink', {});
  },
};

export const departmentsService = {
  list: () => listOf<Department>(api.get('/departments'), 'departments'),
  create: async (payload: { name: string; isActive?: boolean }) => {
    const res = await api.post('/departments', { data: payload });
    return res.department as Department;
  },
  update: async (id: string, payload: { name?: string; isActive?: boolean }) => {
    const res = await api.put(`/departments/${encodeURIComponent(id)}`, { data: payload });
    return res.department as Department;
  },
  remove: async (id: string) => {
    await api.delete(`/departments/${encodeURIComponent(id)}`);
  },
};

export const permissionsService = {
  get: async (): Promise<Partial<Record<UserRole, RolePermissions>>> => {
    const res = await api.get('/permissions');
    return res.permissions ?? {};
  },
  update: async (payload: Partial<Record<UserRole, Partial<RolePermissions>>>) => {
    const res = await api.put('/permissions', { data: { permissions: payload } });
    return res.permissions as Partial<Record<UserRole, RolePermissions>>;
  },
};

export const auditService = {
  list: () => listOf<AuditLogEntry>(api.get('/audit'), 'logs'),
  create: async (payload: Partial<AuditLogEntry>) => {
    const res = await api.post('/audit', { data: payload });
    return res.log as AuditLogEntry;
  },
};

export const dataService = {
  health: async (): Promise<Record<string, number>> => {
    const res = await api.get('/data/health');
    return res.counts as Record<string, number>;
  },
  importDataset: async (payload: {
    users?: unknown[];
    policies?: unknown[];
    memos?: unknown[];
    pdfs?: unknown[];
    acks?: unknown[];
    auditLogs?: unknown[];
    mode?: 'merge' | 'replace';
  }) => {
    const res = await api.post('/data/import', { data: payload });
    return res.imported as Record<string, any>;
  },
  reset: async (): Promise<string> => {
    const res = await api.post('/data/reset');
    return res.message as string;
  },
};
