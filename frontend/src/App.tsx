import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  User,
  Policy,
  Memo,
  PdfDocument,
  AcknowledgementRecord,
  TelegramBotSettings,
  RolePermissions,
  UserRole,
  AuditLogEntry,
  AuditActionType,
  AuditCategory,
  Department,
} from './types';
import {
  authService,
  usersService,
  policiesService,
  memosService,
  pdfsService,
  acksService,
  botService,
  permissionsService,
  departmentsService,
  auditService,
  dataService,
} from './utils/services';
import { setSessionLostHandler } from './utils/api';
import {
  STATUS_SCHEMES,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_TELEGRAM_SETTINGS,
} from './data/mockData';
import {
  SAMPLE_USERS,
  SAMPLE_POLICIES,
  SAMPLE_MEMOS,
  SAMPLE_PDF_DOCUMENTS,
  SAMPLE_ACKNOWLEDGEMENTS,
  SAMPLE_AUDIT_LOGS,
} from './data/sampleDataset';
import { Navbar } from './components/Navbar';
import { HandbookView } from './components/HandbookView';
import { MemoBoardView } from './components/MemoBoardView';
import { HRAcknowledgementQueue } from './components/HRAcknowledgementQueue';
import { AccessControlView } from './components/AccessControlView';
import { AuditLogView } from './components/AuditLogView';
import { WorkflowExplainer } from './components/WorkflowExplainer';
import { TelegramBotConfigModal } from './components/TelegramBotConfigModal';
import { AcknowledgeModal } from './components/AcknowledgeModal';
import { CreateMemoModal } from './components/CreateMemoModal';
import { CreatePolicyModal } from './components/CreatePolicyModal';
import { UploadPdfModal } from './components/UploadPdfModal';
import { PdfViewerModal } from './components/PdfViewerModal';
import { SystemReadinessModal } from './components/SystemReadinessModal';
import { SignInModal } from './components/SignInModal';
import { EditProfileModal } from './components/EditProfileModal';
import { SignatureCaptureModal } from './components/SignatureCaptureModal';
import { TelegramConnectionTestModal } from './components/TelegramConnectionTestModal';
import { LoginScreen } from './components/LoginScreen';
import { SplashScreen } from './components/SplashScreen';
import { ForcePasswordChange } from './components/ForcePasswordChange';
import { ShieldAlert, Lock, ArrowLeft, Rocket, LogIn, History } from 'lucide-react';

export type AppTab =
  | 'handbook'
  | 'memos'
  | 'hr-queue'
  | 'workflow'
  | 'telegram-config'
  | 'access-control'
  | 'audit-log';

const PAGE_ACTIVE_KEY = 'page_active';
const DEFAULT_ACTIVE_TAB: AppTab = 'handbook';
const VALID_ACTIVE_TABS: readonly AppTab[] = [
  'handbook',
  'memos',
  'hr-queue',
  'workflow',
  'telegram-config',
  'access-control',
  'audit-log',
];

const readSavedActiveTab = (): AppTab => {
  try {
    const saved = localStorage.getItem(PAGE_ACTIVE_KEY) as AppTab | null;
    if (saved && (VALID_ACTIVE_TABS as readonly string[]).includes(saved)) return saved;
  } catch {
    // localStorage can throw in private/blocked contexts; fall through to default.
  }
  return DEFAULT_ACTIVE_TAB;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>(readSavedActiveTab);

  // Keep the last visited page across reloads (cleared back to Handbook on login/logout).
  useEffect(() => {
    try {
      localStorage.setItem(PAGE_ACTIVE_KEY, activeTab);
    } catch {
      // Ignore storage failures; the app still works without persistence.
    }
  }, [activeTab]);

  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [pdfDocuments, setPdfDocuments] = useState<PdfDocument[]>([]);
  const [acknowledgements, setAcknowledgements] = useState<AcknowledgementRecord[]>([]);
  const [botSettings, setBotSettings] = useState<TelegramBotSettings>(DEFAULT_TELEGRAM_SETTINGS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<UserRole, RolePermissions>>(
    DEFAULT_ROLE_PERMISSIONS
  );
  const [systemMode, setSystemMode] = useState<'production_clean' | 'demo'>('production_clean');
  const [searchQuery, setSearchQuery] = useState('');

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  // Modals state
  const [acknowledgingMemo, setAcknowledgingMemo] = useState<Memo | null>(null);
  const [isCreateMemoOpen, setIsCreateMemoOpen] = useState(false);
  const [isCreatePolicyOpen, setIsCreatePolicyOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [pendingPolicyDelete, setPendingPolicyDelete] = useState<Policy | null>(null);
  const [isUploadPdfOpen, setIsUploadPdfOpen] = useState(false);
  const [autoSelectedPdfId, setAutoSelectedPdfId] = useState<string | null>(null);
  const [viewingPdfDoc, setViewingPdfDoc] = useState<PdfDocument | null>(null);
  const [isReadinessModalOpen, setIsReadinessModalOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  // Electronic signature capture (draw it or upload a Canva export).
  const [isSignatureCaptureOpen, setIsSignatureCaptureOpen] = useState(false);
  // Option C — employee self-service Telegram 2FA handshake dialog.
  const [isTelegramTestOpen, setIsTelegramTestOpen] = useState(false);

  const [selectedSchemeKey, setSelectedSchemeKey] = useState<'standard' | 'formal'>('standard');

  const activeScheme = STATUS_SCHEMES[selectedSchemeKey] || STATUS_SCHEMES.standard;
  const userRole: UserRole = currentUser?.role || 'staff';
  const currentPerms = rolePermissions[userRole] || DEFAULT_ROLE_PERMISSIONS.staff;

  // The inline splash in index.html paints a dark backdrop before React boots.
  // Once the app owns the viewport, drop it so light screens don't sit on it.
  useEffect(() => {
    if (isBootstrapping) return;
    document.documentElement.style.backgroundColor = '';
    document.body.style.backgroundColor = '';
  }, [isBootstrapping]);

  // Load every entity for the signed-in user. Endpoints are already role-scoped
  // server-side, so staff only receive the rows they are permitted to see.
  const loadWorkspaceData = async () => {
    const user = currentUser;
    const role = user?.role;

    const wantsUsers = role === 'admin' || role === 'hr';
    const wantsAudit = role === 'admin' || role === 'hr';

    const [policiesRes, memosRes, pdfsRes, acksRes, botRes, permsRes, usersRes, auditRes, deptsRes] = await Promise.all([
      policiesService.list(),
      memosService.list(),
      pdfsService.list(),
      acksService.list(),
      botService.get(),
      permissionsService.get(),
      wantsUsers ? usersService.list() : Promise.resolve([] as User[]),
      wantsAudit ? auditService.list() : Promise.resolve([] as AuditLogEntry[]),
      departmentsService.list(),
    ]);

    setPolicies(policiesRes);
    setMemos(memosRes);
    setPdfDocuments(pdfsRes);
    setAcknowledgements(acksRes);
    if (botRes) setBotSettings(botRes);
    setRolePermissions((prev) => ({ ...prev, ...permsRes } as Record<UserRole, RolePermissions>));
    if (wantsUsers) setUsers(usersRes);
    if (wantsAudit) setAuditLogs(auditRes);
    setDepartments(deptsRes);
  };

  // Restore an existing session from the httpOnly cookie on first paint.
  useEffect(() => {
    let cancelled = false;

    setSessionLostHandler(() => {
      if (cancelled) return;
      setActiveTab(DEFAULT_ACTIVE_TAB);
      setCurrentUser(null);
    });

    (async () => {
      try {
        const user = await authService.restore();
        if (cancelled) return;
        if (user) {
          // Keep isBootstrapping=true: the workspace effect below finishes the
          // splash once data lands, so a valid session never flashes the login
          // page or an empty dashboard on refresh.
          setCurrentUser(user as User);
        } else {
          setIsBootstrapping(false);
        }
      } catch (err) {
        if (!cancelled) {
          setBootstrapError(err instanceof Error ? err.message : 'Failed to reach the API');
          setIsBootstrapping(false);
        }
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    })();

    return () => {
      cancelled = true;
      setSessionLostHandler(null);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setUsers([]);
      setDepartments([]);
      setPolicies([]);
      setMemos([]);
      setPdfDocuments([]);
      setAcknowledgements([]);
      setAuditLogs([]);
      // Only leave the splash once /auth/me has answered. This mount-time run
      // fires while the session restore is still in flight, and dropping the
      // splash there would show the login page to an already signed-in user.
      if (sessionChecked) setIsBootstrapping(false);
      return;
    }

    let cancelled = false;
    setIsBootstrapping(true);
    setBootstrapError(null);

    (async () => {
      try {
        await loadWorkspaceData();
      } catch (err) {
        if (!cancelled) {
          setBootstrapError(err instanceof Error ? err.message : 'Failed to load workspace data');
        }
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, currentUser?.role, sessionChecked]);

  // Central audit event logger — writes through to the server, then reflects
  // the server-assigned record locally (the server owns actor identity).
  const logAuditEvent = useCallback(
    async (
      actionType: AuditActionType,
      category: AuditCategory,
      description: string,
      targetId?: string,
      targetName?: string,
      metadata?: Record<string, any>
    ) => {
      try {
        const entry = await auditService.create({
          actionType,
          category,
          description,
          targetId,
          targetName,
          metadata,
        });
        if (currentUser?.role === 'admin' || currentUser?.role === 'hr') {
          setAuditLogs((prev) => [entry, ...prev]);
        }
      } catch (err) {
        console.warn('Audit log write failed:', err);
      }
    },
    [currentUser?.role]
  );

  const handleOpenSignIn = useCallback(() => setIsSignInOpen(true), []);
  const handleOpenEditProfile = useCallback(() => setIsEditProfileOpen(true), []);
  const handleOpenTelegramTest = useCallback(() => setIsTelegramTestOpen(true), []);
  const handleSelectMemoTab = useCallback(() => setActiveTab('memos'), []);
  const handleOpenUploadPdf = useCallback(() => setIsUploadPdfOpen(true), []);
  const handleCloseUploadPdf = useCallback(() => setIsUploadPdfOpen(false), []);
  const handleOpenPdfViewer = useCallback((doc: PdfDocument) => setViewingPdfDoc(doc), []);
  const handleOpenCreatePolicy = useCallback(() => {
    setEditingPolicy(null);
    setIsCreatePolicyOpen(true);
  }, []);
  const handleEditPolicy = useCallback((policy: Policy) => {
    setEditingPolicy(policy);
    setIsCreatePolicyOpen(true);
  }, []);

  // Handle saving an acknowledgement from employee
  const handleSaveAcknowledgement = async (draft: AcknowledgementRecord) => {
    const existing = acknowledgements.find(
      (a) => a.memoId === draft.memoId && a.staffId === currentUser?.id
    );

    try {
      let saved: AcknowledgementRecord;
      if (existing) {
        // The electronic signature option can still be changed by the owner
        // until the acknowledgement is certified by HR.
        const signatureChanged =
          existing.status !== 'HR Verified' &&
          typeof draft.signatureApplied === 'boolean' &&
          draft.signatureApplied !== existing.signatureApplied;
        saved = await acksService.update(existing.id, {
          status: draft.status,
          portalTimestamp: draft.portalTimestamp,
          telegramSentTimestamp: draft.telegramSentTimestamp || existing.telegramSentTimestamp,
          telegramMessageSnippet: draft.telegramMessageSnippet,
          signatureApplied: signatureChanged ? draft.signatureApplied : undefined,
        });
        setAcknowledgements((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
      } else {
        saved = await acksService.create({
          memoId: draft.memoId,
          memoNumber: draft.memoNumber,
          memoTitle: draft.memoTitle,
          status: draft.status || 'Submitted',
          verificationToken: draft.verificationToken,
          portalTimestamp: draft.portalTimestamp,
          telegramSentTimestamp: draft.telegramSentTimestamp,
          telegramMessageSnippet: draft.telegramMessageSnippet,
          signatureApplied: draft.signatureApplied,
          signatureUrl: draft.signatureUrl,
        });
        setAcknowledgements((prev) => [saved, ...prev.filter((a) => a.id !== saved.id)]);
      }

      await logAuditEvent(
        'ACK_STATUS_UPDATED',
        'Verification',
        `Employee ${saved.staffName} performed in-portal signature on directive ${saved.memoNumber}. Token: ${saved.verificationToken}`,
        saved.id,
        saved.staffName,
        { token: saved.verificationToken, status: saved.status }
      );
    } catch (err) {
      console.error('Failed to save acknowledgement:', err);
      throw err;
    }
  };

  // Handle updating an acknowledgement from HR queue
  const handleUpdateAcknowledgement = async (updated: AcknowledgementRecord) => {
    const saved = await acksService.update(updated.id, {
      status: updated.status,
      hrNotes: updated.hrNotes,
      telegramSentTimestamp: updated.telegramSentTimestamp,
      telegramMessageSnippet: updated.telegramMessageSnippet,
    });
    setAcknowledgements((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));

    if (saved.status === 'HR Verified') {
      await logAuditEvent(
        'ACK_VERIFIED',
        'Verification',
        `Certified and legally sealed non-repudiation acknowledgement for ${updated.staffName} on directive ${updated.memoNumber}. Token: ${updated.verificationToken}`,
        updated.id,
        updated.staffName,
        {
          token: updated.verificationToken,
          officerName: currentUser?.name || 'HR Officer',
          verifiedAt: updated.hrVerifiedTimestamp,
        }
      );
    } else {
      logAuditEvent(
        'ACK_STATUS_UPDATED',
        'Verification',
        `Updated acknowledgement status for ${updated.staffName} (${updated.memoNumber}) to '${updated.status}'`,
        updated.id,
        updated.staffName,
        { status: updated.status, token: updated.verificationToken }
      );
    }
  };

  // Handle simulated inbound Telegram ping
  const handleSimulateInboundAck = async (token: string, senderHandle: string) => {
    const match = acknowledgements.find(
      (a) => a.verificationToken === token || a.staffTelegramHandle === senderHandle
    );
    if (!match) return;

    const saved = await acksService.update(match.id, {
      status: 'In Review',
      telegramSentTimestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      telegramMessageSnippet: `Verified token ${token} received from ${senderHandle}`,
    });
    setAcknowledgements((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));

    await logAuditEvent(
      'ACK_STATUS_UPDATED',
      'Verification',
      `Simulated Telegram Bot webhook match for ${senderHandle} with token ${token}. Status advanced to 'In Review'.`,
      token,
      senderHandle,
      { token, senderHandle }
    );
  };

  // Handle creating a new memo
  const handleCreateMemo = async (draft: Memo) => {
    const { id, ...payload } = draft;
    const created = await memosService.create(payload);
    setMemos((prev) => [created, ...prev]);
    setActiveTab('memos');

    await logAuditEvent(
      'MEMO_CREATED',
      'Directives',
      `Published new policy directive ${created.memoNumber}: "${created.title}" targeting ${created.targetDepartments.join(', ')}`,
      created.id,
      created.title,
      {
        priority: created.priority,
        targetDepartments: created.targetDepartments,
        deadlineDate: created.deadlineDate,
      }
    );
  };

  // Handle creating a new policy article
  const handleCreatePolicy = async (draft: Policy) => {
    const { id, ...payload } = draft;
    const created = await policiesService.create(payload);
    setPolicies((prev) => [created, ...prev]);

    await logAuditEvent(
      'POLICY_CREATED',
      'Policies',
      `Authored and published handbook policy article ${created.code}: "${created.title}" (v${created.version})`,
      created.id,
      created.title,
      { category: created.category, version: created.version }
    );
  };

  const handleUpdatePolicy = useCallback(
    async (draft: Policy) => {
      if (currentUser?.role !== 'admin') return;
      const { id, ...payload } = draft;
      const saved = await policiesService.update(id, payload);
      setPolicies((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      setEditingPolicy(null);
      setIsCreatePolicyOpen(false);

      await logAuditEvent(
        'POLICY_UPDATED',
        'Policies',
        `Updated handbook policy article ${saved.code}: "${saved.title}" (v${saved.version})`,
        saved.id,
        saved.title,
        { category: saved.category, version: saved.version }
      );
    },
    [currentUser?.role, logAuditEvent]
  );

  const handleDeletePolicy = useCallback(
    async (policy: Policy) => {
      if (currentUser?.role !== 'admin') return;
      await policiesService.remove(policy.id);
      setPolicies((prev) => prev.filter((p) => p.id !== policy.id));
      setPendingPolicyDelete(null);
      setEditingPolicy(null);

      await logAuditEvent(
        'POLICY_DELETED',
        'Policies',
        `Permanently deleted handbook policy article ${policy.code}: "${policy.title}"`,
        policy.id,
        policy.title,
        { category: policy.category }
      );
    },
    [currentUser?.role, logAuditEvent]
  );

  // Handle uploading a new PDF document
  const handleUploadPdfSuccess = useCallback(
    async (draft: PdfDocument, file: File) => {
      const { id, fileDataUrl, s3Key, ...payload } = draft;
      const created = await pdfsService.create(payload, file);
      setPdfDocuments((prev) => [created, ...prev]);

      if (isCreateMemoOpen) {
        setAutoSelectedPdfId(created.id);
      }

      await logAuditEvent(
        'PDF_UPLOADED',
        'Policies',
        `Uploaded and bound official PDF document "${created.fileName}" (${created.fileSize})`,
        created.id,
        created.title,
        { category: created.category, fileSize: created.fileSize }
      );
    },
    [isCreateMemoOpen, logAuditEvent]
  );

  // Handle deleting a PDF document (admin only)
  const handleDeletePdf = useCallback(
    async (doc: PdfDocument) => {
      if (currentUser?.role !== 'admin') return;
      await pdfsService.remove(doc.id);
      setPdfDocuments((prev) => prev.filter((p) => p.id !== doc.id));
      setViewingPdfDoc((current) => (current?.id === doc.id ? null : current));

      await logAuditEvent(
        'PDF_DELETED',
        'Policies',
        `Permanently deleted official PDF document "${doc.fileName}"`,
        doc.id,
        doc.title,
        { category: doc.category, fileSize: doc.fileSize }
      );
    },
    [currentUser?.role, logAuditEvent]
  );

  // Handle user & permission updates
  const handleUpdateUser = async (draft: User) => {
    const { id, ...payload } = draft;
    const saved = await usersService.update(id, payload);
    setUsers((prev) => prev.map((u) => (u.id === saved.id ? saved : u)));
    if (currentUser?.id === saved.id) {
      setCurrentUser(saved);
    }

    await logAuditEvent(
      'USER_UPDATED',
      'Access & Roles',
      `Updated user account profile and role credentials for ${saved.name} (${saved.role.toUpperCase()})`,
      saved.id,
      saved.name,
      { role: saved.role, department: saved.department, telegramHandle: saved.telegramHandle }
    );
  };

  const handleAddUser = async (draft: User) => {
    const { id, ...payload } = draft;
    const created = await usersService.create(payload);
    setUsers((prev) => [...prev, created]);

    await logAuditEvent(
      'USER_ADDED',
      'Access & Roles',
      `Provisioned new user account for ${created.name} with role '${created.role.toUpperCase()}' in ${created.department}`,
      created.id,
      created.name,
      { role: created.role, email: created.email, telegramHandle: created.telegramHandle }
    );
  };

  const handleDeleteUser = async (userId: string) => {
    const userToDelete = users.find((u) => u.id === userId);
    if (!userToDelete) return;
    if (currentUser?.id === userId) return;

    await usersService.remove(userId);
    setUsers((prev) => prev.filter((u) => u.id !== userId));

    await logAuditEvent(
      'USER_UPDATED',
      'Access & Roles',
      `Permanently deleted staff credential and account profile for ${userToDelete.name} (${userToDelete.email})`,
      userToDelete.id,
      userToDelete.name,
      { role: userToDelete.role, department: userToDelete.department }
    );
  };

  const handleUpdateRolePermissions = async (newPermissions: Record<UserRole, RolePermissions>) => {
    const payload: Record<string, Partial<RolePermissions>> = {};
    for (const role of Object.keys(newPermissions) as UserRole[]) {
      const entry = newPermissions[role];
      if (!entry) continue;
      const { id, role: _role, createdAt, updatedAt, ...rest } = entry as any;
      payload[role] = rest;
    }
    const saved = await permissionsService.update(payload);
    setRolePermissions((prev) => ({ ...prev, ...saved } as Record<UserRole, RolePermissions>));

    await logAuditEvent(
      'PERMISSIONS_UPDATED',
      'Access & Roles',
      'Updated Role-Based Access Control (RBAC) permission matrix across system roles',
      'RBAC-MATRIX',
      'Permissions Configuration'
    );
  };

  const handleAddDepartment = async (name: string, isActive: boolean) => {
    const created = await departmentsService.create({ name, isActive });
    setDepartments((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    await logAuditEvent(
      'DEPARTMENT_ADDED',
      'Access & Roles',
      `Added department "${created.name}" to the department registry`,
      created.id,
      created.name
    );
  };

  const handleUpdateDepartment = async (id: string, payload: { name?: string; isActive?: boolean }) => {
    const previous = departments.find((d) => d.id === id);
    const updated = await departmentsService.update(id, payload);
    setDepartments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updated } : d)).sort((a, b) => a.name.localeCompare(b.name))
    );

    if (payload.name && previous && previous.name !== updated.name) {
      // Keep denormalised department name references on users in sync in the
      // client cache too, so no reload is needed to see the rename.
      setUsers((prev) =>
        prev.map((u) => ({
          ...u,
          department: u.department === previous.name ? updated.name : u.department,
          assignedDepartments: (Array.isArray(u.assignedDepartments) ? u.assignedDepartments : []).map((d) =>
            d === previous.name ? updated.name : d
          ),
        }))
      );
      await logAuditEvent(
        'DEPARTMENT_UPDATED',
        'Access & Roles',
        `Renamed department "${previous.name}" to "${updated.name}" (references updated across users, memos, policies and documents)`,
        updated.id,
        updated.name
      );
    } else if (payload.isActive !== undefined && payload.isActive !== previous?.isActive) {
      await logAuditEvent(
        'DEPARTMENT_UPDATED',
        'Access & Roles',
        `${payload.isActive ? 'Enabled' : 'Disabled'} department "${updated.name}"`,
        updated.id,
        updated.name
      );
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    const target = departments.find((d) => d.id === id);
    await departmentsService.remove(id);
    setDepartments((prev) => prev.filter((d) => d.id !== id));
    if (target) {
      await logAuditEvent(
        'DEPARTMENT_DELETED',
        'Access & Roles',
        `Deleted department "${target.name}" from the department registry`,
        target.id,
        target.name
      );
    }
  };

  const handleUpdateBotSettings = async (draft: TelegramBotSettings) => {
    const saved = await botService.update(draft);
    setBotSettings(saved);

    await logAuditEvent(
      'BOT_SETTINGS_UPDATED',
      'System',
      `Updated Telegram Bot settings: Bot ${saved.botUsername}, Officer ${saved.hrOfficerTelegram}, Channel ${saved.channelName}`,
      'TELEGRAM-CONFIG',
      saved.botUsername
    );
  };

  const handleReminderDispatched = async () => {
    await logAuditEvent(
      'REMINDER_DISPATCHED',
      'Directives',
      `Dispatched Telegram reminder broadcast to ${botSettings.channelName || 'the broadcast channel'} via ${botSettings.botUsername || 'the HR bot'}`,
      'TELEGRAM-CONFIG',
      botSettings.botUsername
    );
  };

  // Reset to Clean Production Workspace (Fresh Start)
  const handleResetToCleanProduction = async () => {
    await dataService.reset();
    const session = await authService.restore();
    if (session) setCurrentUser(session as User);
    await loadWorkspaceData();
    setSystemMode('production_clean');
  };

  // Load Sample Demo Workspace into MySQL
  const handleLoadSampleData = async () => {
    await dataService.importDataset({
      users: SAMPLE_USERS,
      policies: SAMPLE_POLICIES,
      memos: SAMPLE_MEMOS,
      pdfs: SAMPLE_PDF_DOCUMENTS,
      acks: SAMPLE_ACKNOWLEDGEMENTS,
      auditLogs: SAMPLE_AUDIT_LOGS,
      mode: 'merge',
    });
    await loadWorkspaceData();
    setSystemMode('demo');
  };

  const handleSignIn = async (user: User) => {
    // A fresh login always starts the user on the Handbook page. Bootstrap is
    // flagged synchronously so the first commit after sign-in is the splash
    // screen instead of one frame of the empty workspace.
    setIsBootstrapping(true);
    setActiveTab(DEFAULT_ACTIVE_TAB);
    setCurrentUser(user);
  };

  const handleSignOut = useCallback(async () => {
    await authService.logout();
    setIsEditProfileOpen(false);
    setActiveTab(DEFAULT_ACTIVE_TAB);
    setCurrentUser(null);
  }, []);

  // Persist a self-service profile edit back into the live session and staff list.
  const handleProfileSaved = useCallback((updated: User) => {
    setCurrentUser((prev) => (prev ? { ...prev, ...updated } : prev));
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
  }, []);

  // First-login / admin-reset gate: the account keeps its temporary password
  // until the forced change succeeds, then the server clears the flag.
  const handlePasswordChanged = useCallback((updated: User) => {
    setCurrentUser(updated);
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
  }, []);

  // Block the workspace entirely until a fresh account rotates its password.
  // Administrators are exempt from the first-login gate.
  if (currentUser?.mustChangePassword && currentUser.role !== 'admin') {
    return (
      <ForcePasswordChange
        user={currentUser}
        onChanged={handlePasswordChanged}
        onSignOut={handleSignOut}
      />
    );
  }

  if (isBootstrapping) {
    return <SplashScreen />;
  }

  if (bootstrapError && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h2 className="text-sm font-bold text-rose-300">Cannot reach the API</h2>
        <p className="text-xs text-slate-400 max-w-md">{bootstrapError}</p>
      </div>
    );
  }

  // If not logged in, render the dedicated production LoginScreen
  if (!currentUser) {
    return <LoginScreen onLogin={handleSignIn} />;
  }

  if (isBootstrapping || bootstrapError) {
    return bootstrapError ? (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h2 className="text-sm font-bold text-rose-300">Failed to load workspace data</h2>
        <p className="text-xs text-slate-400 max-w-md">{bootstrapError}</p>
      </div>
    ) : (
      <SplashScreen status="Loading workspace data…" />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors apa-fade-in">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        acknowledgements={acknowledgements}
        rolePermissions={rolePermissions}
        onOpenSignIn={handleOpenSignIn}
        onSignOut={handleSignOut}
        onEditProfile={handleOpenEditProfile}
        onTelegramLinked={handleProfileSaved}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenReadiness={() => setIsReadinessModalOpen(true)}
        onOpenTelegramTest={handleOpenTelegramTest}
        onOpenSignature={() => setIsSignatureCaptureOpen(true)}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
        {/* View Switcher with Access Limit Guards */}

        {/* 1. Handbook & PDF Library View (Accessible to all) */}
        {activeTab === 'handbook' && (
          <HandbookView
            policies={policies}
            memos={memos}
            pdfDocuments={pdfDocuments}
            currentUser={currentUser}
            canUploadDocuments={Boolean(currentUser && currentPerms.canUploadDocuments)}
            onSelectMemo={handleSelectMemoTab}
            onOpenUploadPdf={handleOpenUploadPdf}
            onOpenPdfViewer={handleOpenPdfViewer}
            onDeletePdf={handleDeletePdf}
            onOpenCreatePolicy={handleOpenCreatePolicy}
            onUpdatePolicy={handleEditPolicy}
            onDeletePolicy={handleDeletePolicy}
          />
        )}

        {/* 2. Memos View (Personalized & Isolated for Staff) */}
        {activeTab === 'memos' && (
          <MemoBoardView
            memos={memos}
            currentUser={currentUser}
            acknowledgements={acknowledgements}
            scheme={activeScheme}
            botSettings={botSettings}
            rolePermissions={rolePermissions}
            pdfDocuments={pdfDocuments}
            allStaffUsers={users}
            departments={departments}
            onOpenAcknowledgeModal={(memo) => setAcknowledgingMemo(memo)}
            onOpenCreateMemoModal={() => setIsCreateMemoOpen(true)}
            onNavigateToHRQueue={() => setActiveTab('hr-queue')}
            onOpenPdfViewer={(doc) => setViewingPdfDoc(doc)}
            onDispatchReminder={handleReminderDispatched}
          />
        )}

        {/* 3. HR Verification Queue (Protected by canVerifyAcknowledgements) */}
        {activeTab === 'hr-queue' && (
          currentUser && currentPerms.canVerifyAcknowledgements ? (
            <HRAcknowledgementQueue
              acknowledgements={acknowledgements}
              memos={memos}
              currentUser={currentUser}
              scheme={activeScheme}
              allStaffUsers={users}
              botSettings={botSettings}
              onUpdateAcknowledgement={handleUpdateAcknowledgement}
              onDispatchReminder={handleReminderDispatched}
            />
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-sm max-w-xl mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950 text-rose-600 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                403 &mdash; Access Restricted by Privacy Limits
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                As requested by corporate security policy, <strong>Staff members cannot view other employees' statuses, tokens, or acknowledgement records</strong>. Only authorized HR Compliance Officers and Super Administrators can access this queue.
              </p>
              <button
                onClick={() => setActiveTab('memos')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to My Memos</span>
              </button>
            </div>
          )
        )}

        {/* 4. Access Limits & Credentials View (Admin/HR) */}
        {activeTab === 'access-control' && (
          currentUser && (currentPerms.canManageUsersAndRoles || userRole === 'admin' || userRole === 'hr') ? (
            <AccessControlView
              currentUser={currentUser}
              users={users}
              departments={departments}
              acknowledgements={acknowledgements}
              rolePermissions={rolePermissions}
              onUpdateRolePermissions={handleUpdateRolePermissions}
              onUpdateUser={handleUpdateUser}
              onAddUser={handleAddUser}
              onDeleteUser={handleDeleteUser}
              onAddDepartment={handleAddDepartment}
              onUpdateDepartment={handleUpdateDepartment}
              onDeleteDepartment={handleDeleteDepartment}
            />
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-md mx-auto space-y-3">
              <Lock className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="font-bold text-slate-900 dark:text-white">Admin Privileges Required</h3>
              <p className="text-xs text-slate-500">Sign in with an Administrator account to manage credentials and access limits.</p>
            </div>
          )
        )}

        {/* 5. Audit Log Tab (Admin/HR/Audit Export) */}
        {activeTab === 'audit-log' && (
          currentUser && (currentPerms.canExportAuditLogs || userRole === 'admin' || userRole === 'hr') ? (
            <AuditLogView
              auditLogs={auditLogs}
              currentUser={currentUser}
              onClearLogs={() => setAuditLogs([])}
            />
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-sm max-w-xl mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950 text-rose-600 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                403 &mdash; Audit Log Access Restricted
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                The administrative audit ledger tracks internal governance, policy releases, and non-repudiation seals. Only authorized HR Compliance Officers and Super Administrators have permission to audit these logs.
              </p>
              <button
                onClick={() => setActiveTab('handbook')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Handbook</span>
              </button>
            </div>
          )
        )}

        {/* 6. Status Workflow Explainer (All users) */}
        {activeTab === 'workflow' && (
          <WorkflowExplainer
            currentScheme={activeScheme}
            onSelectScheme={(schemeKey) => setSelectedSchemeKey(schemeKey)}
          />
        )}

        {/* 7. Telegram Bot Settings (Protected by canManageTelegramBot) */}
        {activeTab === 'telegram-config' && (
          <TelegramBotConfigModal
            settings={botSettings}
            onUpdateSettings={handleUpdateBotSettings}
            users={users}
            acknowledgements={acknowledgements}
            onSimulateInboundAck={handleSimulateInboundAck}
          />
        )}
      </main>

      {/* Acknowledge Modal */}
      {acknowledgingMemo && currentUser && (
        <AcknowledgeModal
          memo={acknowledgingMemo}
          currentUser={currentUser}
          existingAck={acknowledgements.find(
            (a) => a.memoId === acknowledgingMemo.id && a.staffId === currentUser.id
          )}
          scheme={activeScheme}
          botSettings={botSettings}
          onClose={() => setAcknowledgingMemo(null)}
          onSaveAcknowledgement={handleSaveAcknowledgement}
          onTelegramHandleSaved={handleProfileSaved}
          onSignatureSaved={handleProfileSaved}
          onOpenTelegramTest={handleOpenTelegramTest}
        />
      )}

      {/* Create Memo Modal */}
      {isCreateMemoOpen && currentUser && (
        <CreateMemoModal
          currentUser={currentUser}
          pdfDocuments={pdfDocuments}
          departments={departments}
          onClose={() => {
            setAutoSelectedPdfId(null);
            setIsCreateMemoOpen(false);
          }}
          onCreateMemo={handleCreateMemo}
          onOpenUploadPdf={() => setIsUploadPdfOpen(true)}
          autoSelectPdfId={autoSelectedPdfId}
          onAutoSelectPdfIdConsumed={() => setAutoSelectedPdfId(null)}
        />
      )}

      {/* Create Policy Article Modal */}
      {isCreatePolicyOpen && (
        <CreatePolicyModal
          currentUser={currentUser || users[0]}
          departments={departments}
          onClose={() => {
            setIsCreatePolicyOpen(false);
            setEditingPolicy(null);
          }}
          onCreatePolicy={editingPolicy ? handleUpdatePolicy : handleCreatePolicy}
          initialPolicy={editingPolicy}
        />
      )}

      {/* Upload PDF Document Modal */}
      {isUploadPdfOpen && currentUser && (
        <UploadPdfModal
          currentUser={currentUser}
          memos={memos}
          departments={departments}
          onClose={handleCloseUploadPdf}
          onUploadSuccess={handleUploadPdfSuccess}
        />
      )}

      {/* Official PDF Document Viewer Modal */}
      {viewingPdfDoc && (
        <PdfViewerModal
          document={viewingPdfDoc}
          currentUser={currentUser || users[0]}
          onClose={() => setViewingPdfDoc(null)}
          onAcknowledge={() => {
            setViewingPdfDoc(null);
            setActiveTab('memos');
          }}
        />
      )}

      {/* System Readiness & Fresh Start Modal */}
      {isReadinessModalOpen && (
        <SystemReadinessModal
          systemMode={systemMode}
          onClose={() => setIsReadinessModalOpen(false)}
          onResetToCleanProduction={handleResetToCleanProduction}
          onResetToDemoSample={handleLoadSampleData}
        />
      )}

      {/* Sign In Modal */}
      {isSignInOpen && (
        <SignInModal
          users={users}
          onClose={() => setIsSignInOpen(false)}
          onSignIn={handleSignIn}
        />
      )}

      {/* Edit Profile Modal (self-service, non-admin accounts) */}
      {isEditProfileOpen && currentUser && currentUser.role !== 'admin' && (
        <EditProfileModal
          user={currentUser}
          departments={departments}
          onClose={() => setIsEditProfileOpen(false)}
          onSaved={handleProfileSaved}
        />
      )}

      {/* Option C — Telegram 2FA Connection Test (profile menu + Acknowledge modal) */}
      {isTelegramTestOpen && currentUser && (
        <TelegramConnectionTestModal
          currentUser={currentUser}
          botSettings={botSettings}
          onClose={() => setIsTelegramTestOpen(false)}
          onSaved={handleProfileSaved}
        />
      )}

      {/* Electronic signature capture — available to every role, including admins */}
      {isSignatureCaptureOpen && currentUser && (
        <SignatureCaptureModal
          open={isSignatureCaptureOpen}
          onClose={() => setIsSignatureCaptureOpen(false)}
          initialDataUrl={currentUser.signatureDataUrl || null}
          initialFileName={currentUser.signatureFileName || ''}
          ownerName={currentUser.name}
          onSave={async (dataUrl, fileName) => {
            const updated = await authService.updateProfile({
              signatureDataUrl: dataUrl,
              signatureFileName: fileName,
            });
            handleProfileSaved(updated as unknown as User);
          }}
        />
      )}
    </div>
  );
}
