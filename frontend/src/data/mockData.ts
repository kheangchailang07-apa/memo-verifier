import { Policy, Memo, User, AcknowledgementRecord, StatusScheme, TelegramBotSettings, RolePermissions, UserRole, PdfDocument } from '../types';

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    canViewHandbook: true,
    canViewAllStaffStatus: true,
    canVerifyAcknowledgements: true,
    canCreateMemos: true,
    canUploadDocuments: true, // can upload policy PDFs & directives
    canManageTelegramBot: true,
    canManageUsersAndRoles: true,
    canExportAuditLogs: true,
  },
  hr: {
    canViewHandbook: true,
    canViewAllStaffStatus: true,
    canVerifyAcknowledgements: true,
    canCreateMemos: true,
    canUploadDocuments: true, // can upload policy PDFs & directives
    canManageTelegramBot: true,
    canManageUsersAndRoles: false,
    canExportAuditLogs: true,
  },
  manager: {
    canViewHandbook: true,
    canViewAllStaffStatus: true, // can view team status
    canVerifyAcknowledgements: false,
    canCreateMemos: false,
    canUploadDocuments: false,
    canManageTelegramBot: false,
    canManageUsersAndRoles: false,
    canExportAuditLogs: false,
  },
  staff: {
    canViewHandbook: true,
    canViewAllStaffStatus: false, // strictly restricted: staff only see their own records!
    canVerifyAcknowledgements: false,
    canCreateMemos: false,
    canUploadDocuments: false,
    canManageTelegramBot: false,
    canManageUsersAndRoles: false,
    canExportAuditLogs: false,
  },
};

export const SAMPLE_BASE64_PDF = 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFsgMSAwIFIgXQovQ291bnQgMQo+PgplbmRvYmoKMSAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDQgMCBSCi9NZWRpYUJveCBbMCAwIDYxMiA3OTJdCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0YxIDIgMCBSCj4+Cj4+Ci9Db250ZW50cyBbIDMgMCBSIF0KPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iagozIDAgb2JqCjw8Ci9MZW5ndGggMTIwCj4+CnN0YXJ0cmVhbQpCVAovRjEgMjAgVGYKMTAwIDcwMCBUZAooQVBBIENvcnBvcmF0ZSBQb2xpY3kgJiBEaXJlY3RpdmUpIFRqCjAgLTMwIFRkCihPZmZpY2lhbCBQb2xpY3kgRG9jdW1lbnQgLSBWZXJzaW9uIDIwMjYuNCkgVGoKMCAtMzAgVGYKMTAwIDYyMCBUZgooQWxsIFN0YWZmIEFyZSBSZXF1aXJlZCBUbyBBY2tub3dsZWRnZSBWaWEgVGVsZWdyYW0pIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDkwIDAwMDAwIG4gCjAwMDAwMDAyMDQgMDAwMDAgbiAKMDAwMDAwMDI3NSAwMDAwMCBuIAowMDAwMDAwMDE4IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNQovUm9vdCA0IDAgUgo+PgpzdGFydHhyZWYKIDQ0NQolJUVPRg==';

// All dummy PDF documents cleared to a completely clean slate
export const MOCK_PDF_DOCUMENTS: PdfDocument[] = [];

export const STATUS_SCHEMES: Record<string, StatusScheme> = {
  standard: {
    id: 'standard',
    name: 'Audit-Proof Verification Scheme (User Proposed)',
    description: 'Two-party independent verification separating portal submission from out-of-band Telegram receipt.',
    labels: {
      unacknowledged: 'Action Required',
      submitted: 'Submitted',
      inReview: 'In Review (Telegram Received)',
      hrVerified: 'HR Verified',
    },
    descriptions: {
      unacknowledged: 'Employee has not yet acknowledged the memo in the portal.',
      submitted: 'Acknowledged in portal; cryptographic token issued. Awaiting staff Telegram message.',
      inReview: 'Telegram confirmation message received by HR officer / bot; matching token.',
      hrVerified: 'HR verified identity against employee records. Acknowledgement sealed and legally locked.',
    },
  },
  formal: {
    id: 'formal',
    name: 'Corporate Compliance Scheme',
    description: 'Clear legal distinction between portal signature and two-party receipt confirmation.',
    labels: {
      unacknowledged: 'Pending Signature',
      submitted: 'Token Issued (Pending HR Ping)',
      inReview: 'Receipt Recorded',
      hrVerified: 'Processed & Certified',
    },
    descriptions: {
      unacknowledged: 'Document requires employee review and electronic acknowledgement.',
      submitted: 'Employee signed in portal; verification message must be sent from verified Telegram.',
      inReview: 'Personal Telegram message confirmed by HR team.',
      hrVerified: 'Two-factor confirmation completed and permanently filed in compliance archive.',
    },
  },
};

export const DEFAULT_TELEGRAM_SETTINGS: TelegramBotSettings = {
  botName: 'APA HR Dispatch Bot',
  botUsername: '@APA_HR_Bot',
  hrOfficerTelegram: '@elena_vance_hr',
  hrOfficerUsername: null,
  channelName: '@APA_AllStaff',
  autoVerifyWithBotToken: false,
  activeStatusScheme: 'standard',
};

// Clean administrative baseline accounts (no dummy employees)
export const MOCK_USERS: User[] = [
  {
    id: 'USR-000',
    name: 'Alex Chen',
    role: 'admin',
    department: 'IT & Security Governance',
    jobTitle: 'Super Administrator & Security Lead',
    email: 'admin@apa.internal',
    username: 'admin',
    password: 'password123',
    telegramHandle: '@alex_chen_sec',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    credentialType: 'Hardware FIDO2 + Telegram Key',
    lastLogin: 'Active Now',
    assignedDepartments: ['All Departments'],
  },
  {
    id: 'USR-001',
    name: 'Elena Vance',
    role: 'hr',
    department: 'Human Resources & Compliance',
    jobTitle: 'Head of People & Compliance',
    email: 'hr@apa.internal',
    username: 'hr',
    password: 'password123',
    telegramHandle: '@elena_vance_hr',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    credentialType: 'Corporate SSO + Verified Telegram',
    lastLogin: 'Active Now',
    assignedDepartments: ['All Departments'],
  },
];

// All dummy policies cleared to a completely clean slate
export const MOCK_POLICIES: Policy[] = [];

// All dummy memos cleared to a completely clean slate
export const MOCK_MEMOS: Memo[] = [];

// All dummy acknowledgements cleared to a completely clean slate
export const INITIAL_ACKNOWLEDGEMENTS: AcknowledgementRecord[] = [];
