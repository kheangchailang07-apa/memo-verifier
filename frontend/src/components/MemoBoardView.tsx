import React, { useState, useMemo } from 'react';
import { Memo, User, AcknowledgementRecord, StatusScheme, TelegramBotSettings, RolePermissions, UserRole, PdfDocument, Department } from '../types';
import { StatusBadge } from './StatusBadge';
import { ComplianceCertificateModal } from './ComplianceCertificateModal';
import { TelegramReminderModal } from './TelegramReminderModal';
import { generateAcknowledgementPdfWithSignature, generateComplianceDossierPdf, MISSING_SIGNATURE_MESSAGE } from '../utils/pdfExport';
import { hasAppliedSignature } from '../utils/signature';
import {
  Bell,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Send,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  FileCheck,
  Bot,
  ArrowUpRight,
  Filter,
  Lock,
  FileText,
  Eye,
  Sparkles,
  Award,
  Users,
  Timer,
  Download,
} from 'lucide-react';

interface MemoBoardViewProps {
  memos: Memo[];
  currentUser: User;
  acknowledgements: AcknowledgementRecord[];
  scheme: StatusScheme;
  botSettings: TelegramBotSettings;
  rolePermissions: Record<UserRole, RolePermissions>;
  pdfDocuments?: PdfDocument[];
  allStaffUsers?: User[];
  departments?: Department[];
  onOpenAcknowledgeModal: (memo: Memo) => void;
  onOpenCreateMemoModal: () => void;
  onNavigateToHRQueue: () => void;
  onOpenPdfViewer?: (doc: PdfDocument) => void;
  onDispatchReminder?: () => void | Promise<void>;
}

export const MemoBoardView: React.FC<MemoBoardViewProps> = ({
  memos,
  currentUser,
  acknowledgements,
  scheme,
  botSettings,
  rolePermissions,
  pdfDocuments = [],
  allStaffUsers = [],
  departments = [],
  onOpenAcknowledgeModal,
  onOpenCreateMemoModal,
  onNavigateToHRQueue,
  onOpenPdfViewer,
  onDispatchReminder,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'inReview' | 'verified'>('all');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('All');
  const [expandedMemoId, setExpandedMemoId] = useState<string | null>(memos[0]?.id || null);

  // Modals
  const [certificateRecord, setCertificateRecord] = useState<AcknowledgementRecord | null>(null);
  const [reminderMemo, setReminderMemo] = useState<Memo | null>(null);

  const canViewAllStaffStatus = rolePermissions[currentUser.role]?.canViewAllStaffStatus ?? false;
  const canCreateMemos = rolePermissions[currentUser.role]?.canCreateMemos ?? false;

  // Names to offer in the admin/HR department filter: registered departments
  // plus any legacy scope still referenced by an existing memo.
  const departmentFilterOptions = useMemo(() => {
    const names = new Set<string>(departments.map((d) => d.name));
    for (const m of memos) {
      for (const dept of m.targetDepartments || []) {
        if (dept && dept !== 'All Departments') names.add(dept);
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [departments, memos]);

  // Filter memos by user department if staff
  const visibleMemos = useMemo(() => {
    return memos.filter((m) => {
      // If admin or HR, they can view all, or filter by selectedDeptFilter
      if (currentUser.role === 'admin' || currentUser.role === 'hr') {
        if (selectedDeptFilter !== 'All') {
          return m.targetDepartments.includes('All Departments') || m.targetDepartments.includes(selectedDeptFilter);
        }
        return true;
      }
      // If staff, strictly only see memos targeted to "All Departments" OR their own department
      if (!m.targetDepartments || m.targetDepartments.includes('All Departments')) return true;
      return m.targetDepartments.includes(currentUser.department);
    });
  }, [memos, currentUser, selectedDeptFilter]);

  // Index acknowledgements for current user by memoId
  const userAcksByMemoId = useMemo(() => {
    const map = new Map<string, AcknowledgementRecord>();
    acknowledgements
      .filter((a) => a.staffId === currentUser.id)
      .forEach((a) => map.set(a.memoId, a));
    return map;
  }, [acknowledgements, currentUser.id]);

  // Filtered memos according to status
  const filteredMemos = useMemo(() => {
    return visibleMemos.filter((memo) => {
      const ack = userAcksByMemoId.get(memo.id);
      const status = ack ? ack.status : 'Unacknowledged';

      if (filter === 'pending') return status === 'Unacknowledged' || status === 'Submitted';
      if (filter === 'inReview') return status === 'In Review';
      if (filter === 'verified') return status === 'HR Verified';
      return true;
    });
  }, [visibleMemos, filter, userAcksByMemoId]);

  // Counts for tabs
  const pendingCount = visibleMemos.filter((m) => {
    const s = userAcksByMemoId.get(m.id)?.status || 'Unacknowledged';
    return s === 'Unacknowledged' || s === 'Submitted';
  }).length;

  const inReviewCount = visibleMemos.filter(
    (m) => userAcksByMemoId.get(m.id)?.status === 'In Review'
  ).length;

  const verifiedCount = visibleMemos.filter(
    (m) => userAcksByMemoId.get(m.id)?.status === 'HR Verified'
  ).length;

  // Deadline countdown helper
  const getDeadlineInfo = (deadlineStr: string) => {
    const deadline = new Date(deadlineStr);
    const now = new Date();
    deadline.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        text: `Overdue by ${Math.abs(diffDays)}d`,
        badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-900',
        isOverdue: true,
      };
    } else if (diffDays === 0) {
      return {
        text: 'Due Today',
        badgeClass: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300',
        isOverdue: false,
      };
    } else if (diffDays <= 3) {
      return {
        text: `Due in ${diffDays}d`,
        badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200',
        isOverdue: false,
      };
    } else {
      return {
        text: `Due in ${diffDays}d`,
        badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        isOverdue: false,
      };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {currentUser.role === 'staff' ? 'My Memos & Guidelines' : 'Company Memos & Directives'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {visibleMemos.length} Memos
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {currentUser.role === 'staff'
              ? 'Official company memos for you to read, agree, and follow without exception.'
              : 'Issue official company memos, track employee agreements, and manage Telegram verification.'}
          </p>
        </div>

        {/* Action Button for HR & Admin */}
        {canCreateMemos && (
          <button
            onClick={onOpenCreateMemoModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all self-start sm:self-auto shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Release New Directive</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All ({visibleMemos.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'pending'
                ? 'bg-amber-500 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Action Required ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('inReview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'inReview'
                ? 'bg-purple-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            In Review ({inReviewCount})
          </button>
          <button
            onClick={() => setFilter('verified')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === 'verified'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            HR Verified ({verifiedCount})
          </button>
        </div>

        {/* Department Filter for Admin/HR */}
        {(currentUser.role === 'admin' || currentUser.role === 'hr') && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Department:
            </span>
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
            >
              <option value="All">All Scopes</option>
              {departmentFilterOptions.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Memos List */}
      <div className="space-y-4">
        {filteredMemos.length === 0 ? (
          <div className="p-6 sm:p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-lg mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center mx-auto">
              <Bell className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              No Directives or Memos Found
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              No policy directives match your active filter or department scope.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {canCreateMemos && (
                <button
                  onClick={onOpenCreateMemoModal}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Issue First Directive / Memo</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          filteredMemos.map((memo) => {
            const ack = userAcksByMemoId.get(memo.id);
            const currentStatus = ack ? ack.status : 'Unacknowledged';
            const isExpanded = expandedMemoId === memo.id;
            const deadlineInfo = getDeadlineInfo(memo.deadlineDate);

            // Calculate company-wide stats for this memo
            const memoAcks = acknowledgements.filter((a) => a.memoId === memo.id);
            const verifiedStaff = memoAcks.filter((a) => a.status === 'HR Verified').length;
            const completionPercentage = Math.round((verifiedStaff / (memo.totalRecipients || 1)) * 100);

            return (
              <div
                key={memo.id}
                className={`rounded-2xl border transition-all ${
                  currentStatus === 'HR Verified'
                    ? 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                    : currentStatus === 'Submitted' || currentStatus === 'In Review'
                    ? 'bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-500/10'
                    : 'bg-white dark:bg-slate-800 border-amber-200 dark:border-amber-800/60 shadow-xs'
                }`}
              >
                {/* Card Header */}
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {memo.memoNumber}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          memo.priority === 'Urgent'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : memo.priority === 'Mandatory'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        }`}
                      >
                        {memo.priority}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {memo.category}
                      </span>

                      {/* Deadline Countdown Alert Badge */}
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${deadlineInfo.badgeClass}`}>
                        <Timer className="w-3 h-3" />
                        <span>{deadlineInfo.text}</span>
                      </span>
                    </div>

                    {/* Current User Status Badge */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 font-medium">Your Status:</span>
                      <StatusBadge status={currentStatus} scheme={scheme} size="md" />
                    </div>
                  </div>

                  {/* Memo Title & Summary */}
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-3">
                    {memo.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                    {memo.summary}
                  </p>

                  {/* Dates & Issuer Info */}
                  <div className="flex flex-wrap items-center gap-y-2 gap-x-5 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Released: <strong>{memo.releaseDate}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Deadline: <strong>{memo.deadlineDate}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Target Scope: <strong>{memo.targetDepartments.join(', ')}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span>Issuer: {memo.issuerName}</span>
                    </div>
                  </div>

                  {/* Attached Official PDF Document (if any) */}
                  {(() => {
                    const attachedDoc = pdfDocuments.find(
                      (d) => d.id === memo.attachedPdfId || d.linkedMemoId === memo.id
                    );
                    if (!attachedDoc) return null;
                    return (
                      <div className="mt-3.5 p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {attachedDoc.title}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {attachedDoc.code} &bull; {attachedDoc.fileSize}
                            </span>
                          </div>
                        </div>

                        {onOpenPdfViewer && (
                          <button
                            onClick={() => onOpenPdfViewer(attachedDoc)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs self-start sm:self-auto shrink-0 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview Attached PDF</span>
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Company Progress Bar (Only visible to Admin, HR & Manager) */}
                  {canViewAllStaffStatus && (
                    <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Company-wide Verification Rate:
                        </span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {verifiedStaff} of {memo.totalRecipients} Staff ({completionPercentage}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                          style={{ width: `${completionPercentage}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Personal 2-Step Sign-off Progress for Employees */}
                  {!canViewAllStaffStatus && (
                    <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Your Two-Party Verification Progress:
                        </span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {currentStatus === 'HR Verified'
                            ? 'Phase 2/2: Certified & Sealed'
                            : currentStatus === 'In Review'
                            ? 'Phase 1.5/2: Telegram Received by HR'
                            : currentStatus === 'Submitted'
                            ? 'Phase 1/2: Portal Signed (Send Telegram)'
                            : 'Phase 0/2: Not Yet Signed'}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            currentStatus === 'HR Verified'
                              ? 'bg-emerald-500'
                              : currentStatus === 'In Review'
                              ? 'bg-purple-500'
                              : currentStatus === 'Submitted'
                              ? 'bg-sky-500'
                              : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                          style={{
                            width:
                              currentStatus === 'HR Verified'
                                ? '100%'
                                : currentStatus === 'In Review'
                                ? '75%'
                                : currentStatus === 'Submitted'
                                ? '50%'
                                : '0%',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Expandable Full Content */}
                  {isExpanded && (
                    <div className="mt-5 p-4 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-3 apa-rise-in">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>OFFICIAL DIRECTIVE FULL TEXT</span>
                        <span>Target: {memo.targetDepartments.join(', ')}</span>
                      </div>
                      <pre className="text-xs text-slate-700 dark:text-slate-300 font-sans whitespace-pre-wrap leading-relaxed">
                        {memo.content}
                      </pre>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                    <button
                      onClick={() => setExpandedMemoId(isExpanded ? null : memo.id)}
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                    >
                      <span>{isExpanded ? 'Collapse Memo Text' : 'Read Full Directive'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* HR Actions: Consolidated Audit Dossier & Reminder Broadcast */}
                      {(currentUser.role === 'admin' || currentUser.role === 'hr') && (
                        <>
                          <button
                            onClick={() =>
                              generateComplianceDossierPdf(
                                memo,
                                acknowledgements,
                                allStaffUsers,
                                'APA',
                                currentUser.name
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition-all shadow-xs"
                            title="Export complete Legal Compliance Dossier PDF for this directive"
                          >
                            <FileCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>Audit Dossier (PDF)</span>
                          </button>

                          <button
                            onClick={() => setReminderMemo(memo)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold transition-all shadow-xs"
                            title="Broadcast Reminder to pending staff on Telegram"
                          >
                            <Bell className="w-3.5 h-3.5 text-amber-600" />
                            <span>Telegram Reminder</span>
                          </button>
                        </>
                      )}

                      {/* User Action Button depending on status */}
                      {currentStatus === 'Unacknowledged' && (
                        <button
                          onClick={() => onOpenAcknowledgeModal(memo)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Acknowledge Memo (2-Step Verification)</span>
                        </button>
                      )}

                      {currentStatus === 'Submitted' && (
                        <button
                          onClick={() => onOpenAcknowledgeModal(memo)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-all shadow-md shadow-sky-500/20"
                        >
                          <Bot className="w-3.5 h-3.5" />
                          <span>Step 2: Send Proof to HR via Telegram</span>
                        </button>
                      )}

                      {currentStatus === 'In Review' && (
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Telegram Received: HR Review in Progress</span>
                        </div>
                      )}

                      {currentStatus === 'HR Verified' && ack && (
                        <div className="flex items-center gap-2">
                          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-medium">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Certified &amp; Non-Repudiation Locked (Token: {ack.verificationToken})</span>
                          </div>

                          <button
                            onClick={() => setCertificateRecord(ack)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
                            title="View Official Certificate"
                          >
                            <Award className="w-3.5 h-3.5" />
                            <span>View Certificate</span>
                          </button>

                          <button
                            onClick={() => void generateAcknowledgementPdfWithSignature(ack)}
                            disabled={!hasAppliedSignature(ack)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 text-xs font-bold shadow-xs transition-colors"
                            title={
                              hasAppliedSignature(ack)
                                ? 'Download Official HR Compliance Summary PDF'
                                : MISSING_SIGNATURE_MESSAGE
                            }
                          >
                            <Download className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Download PDF</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Compliance Certificate Modal */}
      {certificateRecord && (
        <ComplianceCertificateModal
          record={certificateRecord}
          onClose={() => setCertificateRecord(null)}
        />
      )}

      {/* Telegram Reminder Broadcast Modal */}
      {reminderMemo && (
        <TelegramReminderModal
          memo={reminderMemo}
          acknowledgements={acknowledgements}
          allStaffUsers={allStaffUsers}
          botSettings={botSettings}
          onClose={() => setReminderMemo(null)}
          onDispatched={onDispatchReminder}
        />
      )}
    </div>
  );
};
