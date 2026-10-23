export type AckStatus = 'Unacknowledged' | 'Submitted' | 'In Review' | 'HR Verified';

export type UserRole = 'admin' | 'hr' | 'manager' | 'staff';

export interface Department {
  id: string;
  name: string;
  isActive: boolean;
  /** Number of users currently assigned to this department. */
  userCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RolePermissions {
  canViewHandbook: boolean;
  canViewAllStaffStatus: boolean; // false for staff so they only see their own
  canVerifyAcknowledgements: boolean; // HR/Admin only
  canCreateMemos: boolean; // HR/Admin only
  canUploadDocuments: boolean; // HR/Admin only: upload PDF policies & directives
  canManageTelegramBot: boolean; // Admin only
  canManageUsersAndRoles: boolean; // Admin only
  canExportAuditLogs: boolean; // HR/Admin only
}

export interface PdfDocument {
  id: string;
  code: string;
  title: string;
  category: 'Conduct & Ethics' | 'Leave & Attendance' | 'IT & Security' | 'Workplace & Remote' | 'Compensation & Benefits' | 'General';
  fileName: string;
  fileSize: string;
  /** @deprecated Legacy base64 payload. Superseded by s3Key; retained for rollback only. */
  fileDataUrl?: string | null;
  /** S3 object key. Resolve to a viewable URL via pdfsService.getUrl(id). */
  s3Key?: string | null;
  uploadDate: string;
  uploadedBy: string;
  uploadedByRole: string;
  departmentScope: string;
  version: string;
  summary: string;
  tags: string[];
  isMandatory: boolean;
  linkedMemoId?: string;
  pageCount?: number;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  department: string;
  jobTitle: string;
  email: string;
  username?: string | null; // login handle, alternative to email
  password?: string;
  telegramHandle: string;
  avatar: string;
  status: 'active' | 'suspended';
  credentialType: string;
  lastLogin: string;
  /** True when the account still holds an initial/reset password. */
  mustChangePassword?: boolean;
  assignedDepartments?: string[];
  /** Data URL of the staff member's electronic signature image (PNG/JPEG). */
  signatureDataUrl?: string | null;
  /** Original file name of the uploaded signature image, for display only. */
  signatureFileName?: string | null;
  /** S3 object key of the signature (backend-only; client uses signatureDataUrl). */
  signatureS3Key?: string | null;
  /** URL of the signature as served by this app, e.g. /signatures_memo/USR-000/<uuid>.png */
  signatureUrl?: string | null;
  /** S3 URL of the signature. */
  signatureS3Url?: string | null;
  /** True when a signature is stored for this account (roster payloads omit the artwork). */
  hasSignature?: boolean;
}

export interface PolicySection {
  id: string;
  heading: string;
  content: string;
  keyPoints?: string[];
}

export interface Policy {
  id: string;
  code: string;
  title: string;
  category: 'Conduct & Ethics' | 'Leave & Attendance' | 'IT & Security' | 'Workplace & Remote' | 'Compensation & Benefits';
  departmentScope: string;
  version: string;
  lastUpdated: string;
  effectiveDate: string;
  summary: string;
  tags: string[];
  sections: PolicySection[];
  isMandatoryReading: boolean;
  attachedPdfId?: string;
  attachedPdfName?: string;
}

export type MemoPriority = 'Urgent' | 'Mandatory' | 'Standard';

export interface Memo {
  id: string;
  memoNumber: string;
  title: string;
  releaseDate: string;
  effectiveDate: string;
  deadlineDate: string;
  category: string;
  priority: MemoPriority;
  summary: string;
  content: string;
  issuerName: string;
  issuerTitle: string;
  issuerTelegram: string;
  targetDepartments: string[];
  totalRecipients: number;
  attachedPdfId?: string;
  attachedPdfName?: string;
}

export interface AcknowledgementRecord {
  id: string;
  memoId: string;
  memoNumber: string;
  memoTitle: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  department: string;
  staffTelegramHandle: string;
  status: AckStatus;
  verificationToken: string; // e.g., ACK-2026-X981
  portalTimestamp?: string;
  telegramSentTimestamp?: string;
  telegramMessageSnippet?: string;
  hrVerifiedTimestamp?: string;
  hrOfficerName?: string;
  hrNotes?: string;
  ipAddress?: string;
  /** S3 object key of the signature snapshot taken at acknowledgement time. */
  signatureS3Key?: string | null;
  /** URL of the applied signature as served by this app (never an AWS link). */
  signatureUrl?: string | null;
  /** True when the memo was signed with the electronic signature. */
  signatureApplied?: boolean;
}

export interface TelegramGroup {
  id: string;
  title: string;
  type: 'group' | 'supergroup';
  username: string | null;
}

// Identity of the configured bot, resolved via Telegram's getMe.
export interface TelegramBotInfo {
  id: string;
  username: string | null; // e.g. @Duty_t_bot
  firstName: string | null;
}

// A private chat that has contacted the bot (tapped /start).
export interface TelegramChatInfo {
  id: string; // numeric chat id, e.g. 48920182
  name: string;
  username: string | null;
}

export interface TelegramBotSettings {
  botName: string;
  botUsername: string; // e.g. @OmniCorpHRBot
  hrOfficerTelegram: string; // e.g. @Elena_HR_Compliance
  hrOfficerUsername?: string | null; // captured @username of the HR officer's private chat
  channelName: string; // e.g. @OmniCorp_Announcements
  botTokenSet?: boolean; // whether a token is stored server-side
  botTokenMasked?: string | null; // e.g. 123456789:****wxyz
  botToken?: string | null; // write-only: sent on save, stripped from every response
  botTokenRaw?: string | null; // stored token, returned for prefilling the edit field
  autoVerifyWithBotToken: boolean;
  activeStatusScheme: 'standard' | 'formal';
}

export interface StatusScheme {
  id: 'standard' | 'formal';
  name: string;
  description: string;
  labels: {
    unacknowledged: string;
    submitted: string;
    inReview: string;
    hrVerified: string;
  };
  descriptions: {
    unacknowledged: string;
    submitted: string;
    inReview: string;
    hrVerified: string;
  };
}

export type AuditActionType =
  | 'MEMO_CREATED' | 'MEMO_UPDATED' | 'MEMO_DELETED'
  | 'POLICY_CREATED' | 'POLICY_UPDATED' | 'POLICY_DELETED'
  | 'PDF_UPLOADED' | 'PDF_UPDATED' | 'PDF_DELETED'
  | 'USER_UPDATED' | 'USER_ADDED' | 'USER_CREATED' | 'USER_DELETED' | 'USER_BULK_CREATED' | 'USER_BULK_UPDATED'
  | 'PERMISSIONS_UPDATED' | 'ROLE_PERMISSIONS_UPDATED'
  | 'DEPARTMENT_ADDED' | 'DEPARTMENT_UPDATED' | 'DEPARTMENT_DELETED'
  | 'ACK_STATUS_UPDATED' | 'ACK_VERIFIED'
  | 'BOT_SETTINGS_UPDATED'
  | 'REMINDER_DISPATCHED' | 'REMINDER_SENT'
  | 'DATA_RESET' | 'DATA_LOADED' | 'DATA_IMPORTED'
  | 'LOGIN' | 'LOGOUT';

export type AuditCategory =
  | 'Directives'
  | 'Policies'
  | 'Access & Roles'
  | 'Verification'
  | 'System';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  actorRole: UserRole;
  actionType: AuditActionType;
  category: AuditCategory;
  description: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}
