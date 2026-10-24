import React, { useState } from 'react';
import { User, UserRole, RolePermissions, AcknowledgementRecord, Department } from '../types';
import { botService, usersService } from '../utils/services';
import { formatPhnomPenhTime } from '../utils/format';
import { normalizeSignatureImage } from '../utils/signature';
import {
  Shield,
  Key,
  Users,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Smartphone,
  Sparkles,
  Building2,
  PenLine,
  Upload,
  Loader2,
} from 'lucide-react';

interface AccessControlViewProps {
  currentUser: User;
  users: User[];
  departments: Department[];
  acknowledgements?: AcknowledgementRecord[];
  rolePermissions: Record<UserRole, RolePermissions>;
  onUpdateRolePermissions: (newPerms: Record<UserRole, RolePermissions>) => void;
  onUpdateUser: (updatedUser: User) => void;
  onAddUser: (newUser: User) => void;
  onDeleteUser: (userId: string) => void;
  onAddDepartment: (name: string, isActive: boolean) => Promise<void> | void;
  onUpdateDepartment: (id: string, payload: { name?: string; isActive?: boolean }) => Promise<void> | void;
  onDeleteDepartment: (id: string) => Promise<void> | void;
}

export const AccessControlView: React.FC<AccessControlViewProps> = ({
  currentUser,
  users,
  departments,
  acknowledgements = [],
  rolePermissions,
  onUpdateRolePermissions,
  onUpdateUser,
  onAddUser,
  onDeleteUser,
  onAddDepartment,
  onUpdateDepartment,
  onDeleteDepartment,
}) => {
  // Default to 'users' directory so credentials are immediately visible
  const [activeSubTab, setActiveSubTab] = useState<'matrix' | 'users'>('users');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [passwordRevealUser, setPasswordRevealUser] = useState<User | null>(null);
  const [adminPasswordForReveal, setAdminPasswordForReveal] = useState('');
  const [revealedUserPassword, setRevealedUserPassword] = useState<string | null>(null);
  const [passwordRevealError, setPasswordRevealError] = useState<string | null>(null);
  const [isRevealingPassword, setIsRevealingPassword] = useState(false);
  // Electronic signature upload inside the admin "Edit Profile" dialog.
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const [isProcessingSignature, setIsProcessingSignature] = useState(false);

  // Department Config dialog state
  const [isDeptConfigOpen, setIsDeptConfigOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [deptDialogError, setDeptDialogError] = useState<string | null>(null);
  const [renamingDeptId, setRenamingDeptId] = useState<string | null>(null);
  const [renameDeptValue, setRenameDeptValue] = useState('');

  // New User Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('password123');
  const [newUserDept, setNewUserDept] = useState('Engineering');
  const [newUserTitle, setNewUserTitle] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('staff');
  const [newUserTelegram, setNewUserTelegram] = useState('');
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [editUserError, setEditUserError] = useState<string | null>(null);
  const [isVerifyingTelegram, setIsVerifyingTelegram] = useState(false);

  const openPasswordReveal = (user: User) => {
    setPasswordRevealUser(user);
    setAdminPasswordForReveal('');
    setRevealedUserPassword(null);
    setPasswordRevealError(null);
  };

  const closePasswordReveal = () => {
    setPasswordRevealUser(null);
    setAdminPasswordForReveal('');
    setRevealedUserPassword(null);
    setPasswordRevealError(null);
    setIsRevealingPassword(false);
  };

  const handleRevealUserPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwordRevealUser || !adminPasswordForReveal) return;
    setIsRevealingPassword(true);
    setPasswordRevealError(null);
    try {
      const password = await usersService.revealPassword(passwordRevealUser.id, adminPasswordForReveal);
      setRevealedUserPassword(password);
      setAdminPasswordForReveal('');
    } catch (err) {
      setPasswordRevealError(
        err instanceof Error && err.message ? err.message : 'Could not verify your admin password.'
      );
    } finally {
      setIsRevealingPassword(false);
    }
  };

  // Confirms a bound Telegram handle really belongs to a Telegram account
  // before a credential is saved. Returns an error message, or null to allow the save.
  const verifyTelegramHandle = async (
    rawHandle: string,
    allowBlank: boolean
  ): Promise<string | null> => {
    const handle = rawHandle.trim();
    if (!handle) {
      return allowBlank ? null : 'Enter a Telegram username before saving.';
    }

    setIsVerifyingTelegram(true);
    try {
      const result = await botService.resolveUsername(handle);
      if (result.exists) return null;
      const display = `@${handle.replace(/^@/, '')}`;
      return `${display} was not found on Telegram.`;
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Unknown error.';
      return `Could not verify the Telegram username: ${message}`;
    } finally {
      setIsVerifyingTelegram(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Departments only offered for new credentials are the active ones; an
  // existing value is always kept selectable so edits don't lose data.
  const activeDepartments = departments.filter((d) => d.isActive);

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newDeptName.trim();
    if (!name) return;
    setDeptDialogError(null);
    try {
      await onAddDepartment(name, true);
      setNewDeptName('');
      showToast(`Department "${name}" added.`);
    } catch (err) {
      setDeptDialogError(err instanceof Error && err.message ? err.message : 'Could not add department.');
    }
  };

  const handleRenameDepartment = async (dept: Department) => {
    const name = renameDeptValue.trim();
    setDeptDialogError(null);
    if (!name || name === dept.name) {
      setRenamingDeptId(null);
      return;
    }
    try {
      await onUpdateDepartment(dept.id, { name });
      setRenamingDeptId(null);
      showToast(`Renamed "${dept.name}" to "${name}". References updated.`);
    } catch (err) {
      setDeptDialogError(err instanceof Error && err.message ? err.message : 'Could not rename department.');
    }
  };

  const handleToggleDepartment = async (dept: Department) => {
    setDeptDialogError(null);
    try {
      await onUpdateDepartment(dept.id, { isActive: !dept.isActive });
      showToast(dept.isActive ? `Department "${dept.name}" disabled.` : `Department "${dept.name}" enabled.`);
    } catch (err) {
      setDeptDialogError(err instanceof Error && err.message ? err.message : 'Could not update department.');
    }
  };

  const handleConfirmDeleteDepartment = async (dept: Department) => {
    setDeptDialogError(null);
    try {
      await onDeleteDepartment(dept.id);
      showToast(`Department "${dept.name}" deleted.`);
    } catch (err) {
      setDeptDialogError(err instanceof Error && err.message ? err.message : 'Could not delete department.');
    }
  };

  const handleToggleUserStatus = (user: User) => {
    if (currentUser.id === user.id) return;
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    const updated: User = {
      ...user,
      status: nextStatus,
    };
    onUpdateUser(updated);
    showToast(
      nextStatus === 'suspended'
        ? `Account for ${user.name} suspended. Portal access revoked.`
        : `Account for ${user.name} reactivated.`
    );
  };

  const handleTogglePermission = (role: UserRole, permKey: keyof RolePermissions) => {
    const updated = {
      ...rolePermissions,
      [role]: {
        ...rolePermissions[role],
        [permKey]: !rolePermissions[role][permKey],
      },
    };
    onUpdateRolePermissions(updated);
    showToast(`Updated '${String(permKey)}' permission for role: ${role.toUpperCase()}`);
  };

  // Picks the signature artwork, trims the blank border and keeps a preview.
  const handleSignatureFile = async (file?: File) => {
    if (!file || !editingUser) return;
    setSignatureError(null);
    setIsProcessingSignature(true);
    try {
      const normalized = await normalizeSignatureImage(file);
      setEditingUser({
        ...editingUser,
        signatureDataUrl: normalized.dataUrl,
        signatureFileName: normalized.fileName,
      });
    } catch (err) {
      setSignatureError(
        err instanceof Error && err.message
          ? err.message
          : 'The signature image could not be processed.'
      );
    } finally {
      setIsProcessingSignature(false);
    }
  };

  // The roster payload omits the signature artwork, so the signed-in admin
  // gets their own stored image injected before the dialog opens.
  const openUserEditor = (user: User) => {
    setSignatureError(null);
    setEditingUser(
      user.id === currentUser.id
        ? {
            ...user,
            signatureDataUrl: currentUser.signatureDataUrl || null,
            signatureFileName: currentUser.signatureFileName || null,
          }
        : user
    );
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditUserError(null);

    // Re-check only when the bound handle actually changed, so an unreachable
    // Telegram never blocks an unrelated edit.
    const original = users.find((u) => u.id === editingUser.id);
    const originalHandle = (original?.telegramHandle || '').trim();
    const nextHandle = (editingUser.telegramHandle || '').trim();
    if (nextHandle !== originalHandle) {
      const telegramIssue = await verifyTelegramHandle(editingUser.telegramHandle || '', true);
      if (telegramIssue) {
        setEditUserError(telegramIssue);
        return;
      }
    }

    onUpdateUser(editingUser);
    setEditingUser(null);
    showToast(`Saved credential profile for ${editingUser.name}`);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;
    setAddUserError(null);

    const telegramIssue = await verifyTelegramHandle(newUserTelegram, true);
    if (telegramIssue) {
      setAddUserError(telegramIssue);
      return;
    }

    const created: User = {
      id: `USR-00${users.length + 1}`,
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      username: newUserUsername.trim().replace(/^@/, '') || null,
      password: newUserPassword.trim() || 'password123',
      department: newUserDept,
      jobTitle: newUserTitle.trim() || 'Team Member',
      role: newUserRole,
      telegramHandle: newUserTelegram.trim().startsWith('@')
        ? newUserTelegram.trim()
        : newUserTelegram.trim()
        ? `@${newUserTelegram.trim()}`
        : '',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      status: 'active',
      credentialType: 'Staff SSO + Bound Telegram',
      lastLogin: 'Never',
      assignedDepartments: [newUserDept],
    };

    onAddUser(created);
    setIsAddUserOpen(false);
    setAddUserError(null);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserUsername('');
    setNewUserPassword('password123');
    setNewUserTitle('');
    setNewUserTelegram('');
    showToast(`Successfully registered credentials for ${created.name}`);
  };

  const rolesList: UserRole[] = ['admin', 'hr', 'manager', 'staff'];

  const permissionDescriptions: { key: keyof RolePermissions; label: string; desc: string }[] = [
    {
      key: 'canViewHandbook',
      label: 'Read Policy Handbook',
      desc: 'Allows browsing, searching, and viewing company policies and directives.',
    },
    {
      key: 'canViewAllStaffStatus',
      label: 'View Other Staff Status & Progress',
      desc: 'CRITICAL ACCESS LIMIT: When OFF (Default for Staff), employees only see their own status and cannot inspect peers.',
    },
    {
      key: 'canVerifyAcknowledgements',
      label: 'HR Verification Desk (Certify Receipts)',
      desc: 'Allows matching incoming Telegram pings and locking acknowledgements as HR Verified.',
    },
    {
      key: 'canCreateMemos',
      label: 'Draft & Publish Official Memos',
      desc: 'Can issue mandatory company-wide or departmental directives.',
    },
    {
      key: 'canManageTelegramBot',
      label: 'Configure Telegram Bot & Webhooks',
      desc: 'Access to bot credentials, broadcast channels, and webhook debugging tools.',
    },
    {
      key: 'canManageUsersAndRoles',
      label: 'Manage Credentials & Access Limits (RBAC)',
      desc: 'Can promote roles, bind Telegram handles, and set system-wide visibility rules.',
    },
    {
      key: 'canExportAuditLogs',
      label: 'Export Legal Audit Records (CSV)',
      desc: 'Can download formal non-repudiation audit trails for compliance auditors.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 p-4 bg-emerald-600 text-white rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold apa-fade-in slide-in-from-top duration-300">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Shield className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Credential &amp; Access Limit Governance (RBAC)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure who can see what across the APA portal, enforce employee data isolation, and manage verified Telegram bindings.
              </p>
            </div>
          </div>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl self-start">
          <button
            onClick={() => setActiveSubTab('users')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'users'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Staff Directory &amp; Credentials ({users.length})
          </button>
          <button
            onClick={() => setActiveSubTab('matrix')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'matrix'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Role Permissions Matrix
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: Access Limits Matrix */}
      {activeSubTab === 'matrix' && (
        <div className="space-y-6">
          {/* Isolation Principle Callout */}
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-900 dark:text-amber-200 block">
                Active Privacy Constraint: Strict Employee Data Isolation
              </span>
              <p className="text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                When a user has the <strong>Staff</strong> role, their <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">canViewAllStaffStatus</code> is disabled. Staff members are blocked from the HR Verification Queue, cannot see how other employees acknowledged memos, and cannot view other users' tokens or Telegram IDs.
              </p>
            </div>
          </div>

          {/* Permissions Matrix Table */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Role-Based Access Limit Permissions Matrix
                </h3>
                <p className="text-[11px] text-slate-500">
                  Toggle permissions on or off to immediately adjust access levels for all users in that role
                </p>
              </div>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4 w-1/3">Permission Feature</th>
                    {rolesList.map((role) => (
                      <th key={role} className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                            role === 'admin'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : role === 'hr'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                              : role === 'manager'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {role}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {permissionDescriptions.map((item) => (
                    <tr key={item.key} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {item.label}
                        </div>
                        <div className="text-[11px] text-slate-500 leading-snug">
                          {item.desc}
                        </div>
                      </td>

                      {rolesList.map((role) => {
                        const isGranted = rolePermissions[role]?.[item.key] ?? false;
                        const isCritical = item.key === 'canViewAllStaffStatus' && role === 'staff';

                        return (
                          <td key={role} className="py-3.5 px-4 text-center">
                            <label className="inline-flex items-center justify-center cursor-pointer p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                              <input
                                type="checkbox"
                                checked={isGranted}
                                onChange={() => handleTogglePermission(role, item.key)}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                              />
                            </label>
                            {isCritical && !isGranted && (
                              <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                                [Isolated]
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Permission toggles — mobile cards (replaces the matrix below md) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/60">
              {permissionDescriptions.map((item) => (
                <div key={item.key} className="p-4 space-y-2.5">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-slate-500 leading-snug">{item.desc}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {rolesList.map((role) => {
                      const isGranted = rolePermissions[role]?.[item.key] ?? false;
                      const isCritical = item.key === 'canViewAllStaffStatus' && role === 'staff';
                      return (
                        <label
                          key={role}
                          className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                            isGranted
                              ? 'border-indigo-200 bg-indigo-50/70 dark:border-indigo-800 dark:bg-indigo-950/40'
                              : 'border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/60'
                          }`}
                        >
                          <span className="min-w-0 flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                                role === 'admin'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : role === 'hr'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                  : role === 'manager'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {role}
                            </span>
                            {isCritical && !isGranted && (
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                [Isolated]
                              </span>
                            )}
                          </span>
                          <input
                            type="checkbox"
                            checked={isGranted}
                            onChange={() => handleTogglePermission(role, item.key)}
                            className="w-4 h-4 shrink-0 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Staff Credentials Management */}
      {activeSubTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">
              Manage accounts, assigned roles, and verified Telegram bindings:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {currentUser.role === 'admin' && (
                <button
                  onClick={() => {
                    setDeptDialogError(null);
                    setRenamingDeptId(null);
                    setIsDeptConfigOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-xs"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Department Config</span>
                </button>
              )}
              <button
                onClick={() => {
                  setAddUserError(null);
                  setIsAddUserOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Staff Credential</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Staff Member &amp; ID</th>
                    <th className="py-3 px-3">Role &amp; Access Limit</th>
                    <th className="py-3 px-3">Bound Telegram ID</th>
                    <th className="py-3 px-3">Credential Security</th>
                    <th className="py-3 px-3">Last Login</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                                             <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {u.name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {u.username} &bull; {u.department}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                            u.role === 'admin'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : u.role === 'hr'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                              : u.role === 'manager'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 font-mono text-sky-600 dark:text-sky-400 font-semibold">
                        {u.telegramHandle}
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="text-slate-700 dark:text-slate-300 font-medium">
                          {u.credentialType}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                          2FA via Out-of-band Telegram
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {u.username || 'No login username'}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-slate-500 text-[11px]">
                        {formatPhnomPenhTime(u.lastLogin) || u.lastLogin}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* One-Click Active/Suspended Toggle */}
                          <button
                            type="button"
                            disabled={currentUser.id === u.id}
                            onClick={() => handleToggleUserStatus(u)}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[10px] transition-all border ${
                              u.status === 'active'
                                ? 'bg-emerald-50 hover:bg-amber-50 text-emerald-700 hover:text-amber-700 border-emerald-200 hover:border-amber-300 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-rose-50 hover:bg-emerald-50 text-rose-700 hover:text-emerald-700 border-rose-200 hover:border-emerald-300 dark:bg-rose-950/60 dark:text-rose-300'
                            } ${currentUser.id === u.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            title={
                              currentUser.id === u.id
                                ? 'Cannot suspend your own logged-in admin account'
                                : u.status === 'active'
                                ? 'Click to suspend account login'
                                : 'Click to reactivate account'
                            }
                          >
                            {u.status === 'active' ? 'Active' : 'Suspended'}
                          </button>

                          {currentUser.role === 'admin' && (
                            <button
                              type="button"
                              onClick={() => openPasswordReveal(u)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                              title={`Reveal ${u.name}'s password after admin verification`}
                              aria-label={`Reveal ${u.name}'s password`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}

                          {/* Edit Profile Button */}
                          <button
                            onClick={() => setEditingUser(u)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 dark:bg-slate-700 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold text-[11px] transition-colors border border-slate-200 dark:border-slate-600"
                            title="Edit Role, Password, Telegram ID or Department"
                          >
                            Edit Profile
                          </button>

                          {/* Delete Account Button */}
                          <button
                            type="button"
                            disabled={currentUser.id === u.id}
                            onClick={() => setUserToDelete(u)}
                            className={`p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors ${
                              currentUser.id === u.id ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                            title={
                              currentUser.id === u.id
                                ? 'Cannot delete your own active administrator account'
                                : `Permanently delete ${u.name}'s account`
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Staff credentials — mobile cards (replaces the table below md) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/60">
              {users.map((u) => (
                <div key={u.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white text-sm truncate">
                        {u.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {u.username} &bull; {u.department}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] shrink-0 ${
                        u.role === 'admin'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : u.role === 'hr'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                          : u.role === 'manager'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {u.role}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                    <div className="col-span-2 min-w-0">
                      <span className="block text-[10px] uppercase text-slate-400">
                        Bound Telegram ID
                      </span>
                      <span className="font-mono text-sky-600 dark:text-sky-400 font-semibold">
                        {u.telegramHandle}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase text-slate-400">
                        Credential Security
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {u.credentialType}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        2FA via Out-of-band Telegram
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase text-slate-400">Last Login</span>
                      <span className="text-slate-500">{formatPhnomPenhTime(u.lastLogin) || u.lastLogin}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-slate-100 dark:border-slate-700/60">
                    <button
                      type="button"
                      disabled={currentUser.id === u.id}
                      onClick={() => handleToggleUserStatus(u)}
                      className={`px-2.5 py-1.5 rounded-lg font-bold text-[10px] transition-all border ${
                        u.status === 'active'
                          ? 'bg-emerald-50 hover:bg-amber-50 text-emerald-700 hover:text-amber-700 border-emerald-200 hover:border-amber-300 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-rose-50 hover:bg-emerald-50 text-rose-700 hover:text-emerald-700 border-rose-200 hover:border-emerald-300 dark:bg-rose-950/60 dark:text-rose-300'
                      } ${currentUser.id === u.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      title={
                        currentUser.id === u.id
                          ? 'Cannot suspend your own logged-in admin account'
                          : u.status === 'active'
                          ? 'Click to suspend account login'
                          : 'Click to reactivate account'
                      }
                    >
                      {u.status === 'active' ? 'Active' : 'Suspended'}
                    </button>

                    {currentUser.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => openPasswordReveal(u)}
                        className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                        title={`Reveal ${u.name}'s password after admin verification`}
                        aria-label={`Reveal ${u.name}'s password`}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => openUserEditor(u)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 dark:bg-slate-700 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold text-[11px] transition-colors border border-slate-200 dark:border-slate-600"
                      title="Edit Role, Password, Telegram ID, Signature or Department"
                    >
                      Edit Profile
                    </button>

                    <button
                      type="button"
                      disabled={currentUser.id === u.id}
                      onClick={() => setUserToDelete(u)}
                      className={`ml-auto p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors ${
                        currentUser.id === u.id ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                      title={
                        currentUser.id === u.id
                          ? 'Cannot delete your own active administrator account'
                          : `Permanently delete ${u.name}'s account`
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 max-h-[90vh] overflow-y-auto max-w-md w-full space-y-4 text-xs">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Edit Credential Profile: {editingUser.name}
            </h3>

            <form onSubmit={handleSaveUserEdit} className="space-y-3">
              {editUserError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-start gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{editUserError}</span>
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Full Name:
                </label>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  placeholder="Enter the user's full name"
                  autoComplete="name"
                  maxLength={100}
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Assigned System Role:
                </label>
                <select
                  value={editingUser.role}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, role: e.target.value as UserRole })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                >
                  <option value="staff">Staff (Can only see own memos &amp; status)</option>
                  <option value="manager">Manager (Can view team progress)</option>
                  <option value="hr">HR Officer (Can verify receipts &amp; issue memos)</option>
                  <option value="admin">Super Admin (Full system control)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Login Username:
                </label>
                <input
                  type="text"
                  value={editingUser.username || ''}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, username: e.target.value })
                  }
                  placeholder="e.g. chan.vanna"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Staff can sign in with this username or their corporate email.
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Bound Telegram Username:
                </label>
                <input
                  type="text"
                  value={editingUser.telegramHandle}
                  onChange={(e) => {
                    setEditUserError(null);
                    setEditingUser({ ...editingUser, telegramHandle: e.target.value });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Incoming acknowledgement pings must originate from this specific Telegram handle.
                  Verified against Telegram when you save.
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Department Scope:
                </label>
                <select
                  value={editingUser.department}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, department: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                >
                  {!departments.some((d) => d.name === editingUser.department) && (
                    <option value={editingUser.department}>{editingUser.department}</option>
                  )}
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                      {d.isActive ? '' : ' (disabled)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Reset Password / Security Passcode:
                </label>
                <input
                  type="text"
                  value={editingUser.password || ''}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, password: e.target.value })
                  }
                  placeholder="Enter new password (e.g. password123)"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Account Status:
                </label>
                <select
                  value={editingUser.status}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, status: e.target.value as 'active' | 'suspended' })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended (Access Revoked)</option>
                </select>
              </div>

              {/* Electronic signature — embedded in the acknowledgement proof PDF. */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Electronic Signature:
                </label>
                {signatureError && (
                  <div className="mb-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{signatureError}</span>
                  </div>
                )}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                  {editingUser.signatureDataUrl ? (
                    <div className="space-y-2">
                      <div className="h-16 flex items-center justify-center">
                        <img
                          src={editingUser.signatureDataUrl}
                          alt={`Electronic signature of ${editingUser.name}`}
                          className="max-h-16 max-w-full object-contain"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-500 truncate">
                          {editingUser.signatureFileName || 'signature.png'}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingUser({
                              ...editingUser,
                              signatureDataUrl: null,
                              signatureFileName: null,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 text-[10px] font-bold shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ) : editingUser.signatureFileName ? (
                    <div className="space-y-2">
                      <div className="flex flex-col items-center justify-center gap-1 py-2 text-center">
                        <PenLine className="w-5 h-5 text-emerald-500" />
                        <span className="text-[10px] text-slate-500 truncate">
                          {editingUser.signatureFileName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          A signature is already stored — upload a new image to replace it.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingUser({
                            ...editingUser,
                            signatureDataUrl: null,
                            signatureFileName: null,
                          })
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 text-[10px] font-bold"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1.5 py-3 text-center">
                      <PenLine className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                      <span className="text-[10px] text-slate-400">
                        No signature on file yet
                      </span>
                    </div>
                  )}
                  <label className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-xs transition-colors cursor-pointer">
                    {isProcessingSignature ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isProcessingSignature
                        ? 'Processing…'
                        : editingUser.signatureDataUrl
                        ? 'Replace image'
                        : 'Upload signature image'}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={(e) => void handleSignatureFile(e.target.files?.[0])}
                    />
                  </label>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  PNG or JPEG exported from a signature tool (e.g. Canva). It is printed on the
                  acknowledgement proof PDF.
                </span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                {currentUser.id !== editingUser.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      const toDelete = editingUser;
                      setEditingUser(null);
                      setUserToDelete(toDelete);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg font-semibold text-xs transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Account</span>
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-3 py-1.5 text-slate-500 hover:text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifyingTelegram}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-bold"
                  >
                    {isVerifyingTelegram ? 'Checking Telegram…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 max-h-[90vh] overflow-y-auto max-w-md w-full space-y-4 text-xs">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Enroll New Employee Credential
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-3">
              {addUserError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-start gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{addUserError}</span>
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Full Name:
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Chan Vanna"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Corporate Email:
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="vanna.chan@apa.internal"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Username:
                </label>
                <input
                  type="text"
                  value={newUserUsername}
                  onChange={(e) => setNewUserUsername(e.target.value)}
                  placeholder="e.g. chan.vanna"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Optional. Used instead of the email address to sign in.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Department:
                  </label>
                  <select
                    value={newUserDept}
                    onChange={(e) => setNewUserDept(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  >
                    {activeDepartments.length === 0 && (
                      <option value="">No departments configured</option>
                    )}
                    {activeDepartments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                    {activeDepartments.length > 0 &&
                      activeDepartments.every((d) => d.name !== newUserDept) && (
                        <option value={newUserDept}>{newUserDept}</option>
                      )}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    System Role:
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
                  >
                    <option value="staff">Staff (Isolated)</option>
                    <option value="manager">Manager</option>
                    <option value="hr">HR Officer</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Initial Account Password:
                </label>
                <input
                  type="text"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="password123"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Staff member will use this password to sign into APA Policy &amp; Memo.</span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Registered Telegram Username:
                </label>
                <input
                  type="text"
                  value={newUserTelegram}
                  onChange={(e) => {
                    setAddUserError(null);
                    setNewUserTelegram(e.target.value);
                  }}
                  placeholder="@vanna_chan"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Optional. Leave blank if the staff member has no Telegram yet. When filled in, it
                  must be an existing Telegram account or the credential will not be saved.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-3 py-1.5 text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingTelegram}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-bold"
                >
                  {isVerifyingTelegram ? 'Checking Telegram…' : 'Enroll Credential'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-rose-200 dark:border-rose-900/60 p-4 sm:p-6 max-h-[90vh] overflow-y-auto max-w-md w-full space-y-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Permanently Delete Staff Credential?
                </h3>
                <p className="text-[11px] text-slate-500">
                  This action removes the staff member from the corporate directory and revokes portal login.
                </p>
              </div>
            </div>

            {/* Target User Summary Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                {userToDelete.name}
              </div>
              <div className="text-slate-500 flex flex-wrap gap-2 text-[11px]">
                <span>{userToDelete.email}</span>
                <span>&bull;</span>
                <span className="capitalize font-semibold text-slate-700 dark:text-slate-300">
                  {userToDelete.role}
                </span>
                <span>&bull;</span>
                <span>{userToDelete.department}</span>
              </div>
            </div>

            {/* Compliance Warning on Historical Acks */}
            {(() => {
              const acksCount = (acknowledgements || []).filter(
                (a) => a.staffId === userToDelete.id || a.staffEmail === userToDelete.email
              ).length;

              if (acksCount > 0) {
                return (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Legal Compliance Notice ({acksCount} signed records)</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      This staff member has {acksCount} signed policy acknowledgement record(s) on file. 
                      Deleting this credential profile removes their login, but their signed certificates and verification tokens will remain preserved in the HR Verification archive.
                    </p>
                    <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 pt-1">
                      Tip: If the employee is offboarding or leaving, you can choose to <strong>Suspend</strong> their account instead.
                    </p>
                  </div>
                );
              }

              return (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 text-[11px]">
                  This user has no signed acknowledgement records on file. Deleting their credentials is completely safe.
                </div>
              );
            })()}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-3.5 py-2 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteUser(userToDelete.id);
                  showToast(`Permanently deleted credential for ${userToDelete.name}`);
                  setUserToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition-colors"
              >
                Confirm &amp; Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Department Configuration Modal */}
      {isDeptConfigOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 max-h-[90vh] overflow-y-auto max-w-lg w-full space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Department Configuration
                </h3>
                <p className="text-[11px] text-slate-500">
                  Manage the departments available throughout the portal. Renaming updates every
                  user, memo, policy and document that references it.
                </p>
              </div>
            </div>

            {deptDialogError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-start gap-2 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{deptDialogError}</span>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60 max-h-72 overflow-y-auto">
              {departments.length === 0 && (
                <div className="p-4 text-slate-500 text-center">No departments yet. Add one below.</div>
              )}
              {departments.map((dept) => {
                const isRenaming = renamingDeptId === dept.id;
                const inUse = (dept.userCount || 0) > 0;
                return (
                  <div key={dept.id} className="flex items-center gap-2 p-3">
                    {isRenaming ? (
                      <>
                        <input
                          autoFocus
                          type="text"
                          value={renameDeptValue}
                          onChange={(e) => setRenameDeptValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleRenameDepartment(dept);
                            }
                            if (e.key === 'Escape') setRenamingDeptId(null);
                          }}
                          className="flex-1 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 rounded-lg text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleRenameDepartment(dept)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingDeptId(null)}
                          className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-bold truncate ${
                                dept.isActive
                                  ? 'text-slate-900 dark:text-white'
                                  : 'text-slate-400 line-through'
                              }`}
                            >
                              {dept.name}
                            </span>
                            {!dept.isActive && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[9px] font-bold uppercase">
                                Disabled
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {dept.userCount || 0} user{(dept.userCount || 0) === 1 ? '' : 's'}
                          </div>
                        </div>
                        <button
                          type="button"
                          title={dept.isActive ? 'Disable' : 'Enable'}
                          onClick={() => handleToggleDepartment(dept)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Rename"
                          onClick={() => {
                            setDeptDialogError(null);
                            setRenamingDeptId(dept.id);
                            setRenameDeptValue(dept.name);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title={inUse ? 'In use — reassign users first' : 'Delete'}
                          disabled={inUse}
                          onClick={() => handleConfirmDeleteDepartment(dept)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleCreateDepartment} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newDeptName}
                onChange={(e) => {
                  setDeptDialogError(null);
                  setNewDeptName(e.target.value);
                }}
                placeholder="New department name"
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              />
              <button
                type="submit"
                disabled={!newDeptName.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </form>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeptConfigOpen(false)}
                className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {passwordRevealUser && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reveal-user-password-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h3 id="reveal-user-password-title" className="font-bold text-base text-slate-900 dark:text-white">
                  Reveal {passwordRevealUser.name}'s password
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Re-enter your administrator password. This reveal is recorded in the audit log.
                </p>
              </div>
            </div>

            {passwordRevealError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs">
                {passwordRevealError}
              </div>
            )}

            {revealedUserPassword !== null ? (
              <div className="space-y-2">
                <label htmlFor="revealed-user-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Account password
                </label>
                <input
                  id="revealed-user-password"
                  type="text"
                  readOnly
                  value={revealedUserPassword}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono text-sm text-slate-900 dark:text-white"
                />
                <p className="text-[10px] text-slate-500">Close this window to hide the password.</p>
              </div>
            ) : (
              <form onSubmit={handleRevealUserPassword} className="space-y-3">
                <div>
                  <label htmlFor="admin-password-to-reveal" className="block mb-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Your administrator password
                  </label>
                  <input
                    id="admin-password-to-reveal"
                    type="password"
                    autoComplete="current-password"
                    autoFocus
                    required
                    value={adminPasswordForReveal}
                    onChange={(event) => {
                      setAdminPasswordForReveal(event.target.value);
                      setPasswordRevealError(null);
                    }}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={closePasswordReveal}
                    className="px-3 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRevealingPassword || !adminPasswordForReveal}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 px-4 py-2 text-white font-bold"
                  >
                    {isRevealingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    {isRevealingPassword ? 'Verifying…' : 'Verify & reveal'}
                  </button>
                </div>
              </form>
            )}

            {revealedUserPassword !== null && (
              <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closePasswordReveal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-white px-4 py-2 text-white dark:text-slate-900 font-bold"
                >
                  <EyeOff className="w-4 h-4" />
                  Hide password
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
