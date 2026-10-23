import React, { useState, useMemo } from 'react';
import { AcknowledgementRecord, Memo, User, StatusScheme, AckStatus, TelegramBotSettings } from '../types';
import { StatusBadge } from './StatusBadge';
import { ComplianceCertificateModal } from './ComplianceCertificateModal';
import { TelegramReminderModal } from './TelegramReminderModal';
import { BatchTelegramReminderModal } from './BatchTelegramReminderModal';
import { generateAcknowledgementPdfWithSignature, generateComplianceDossierPdf, MISSING_SIGNATURE_MESSAGE } from '../utils/pdfExport';
import { hasAppliedSignature } from '../utils/signature';
import { formatPhnomPenhTime } from '../utils/format';
import {
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  FileSpreadsheet,
  Check,
  X,
  ExternalLink,
  Lock,
  ArrowRight,
  UserCheck,
  Bot,
  MessageSquare,
  Sparkles,
  Award,
  Bell,
  Printer,
  Download,
  FileText,
  TrendingUp,
  Building,
  AlertTriangle,
  ChevronDown,
  FileCheck,
} from 'lucide-react';

interface HRAcknowledgementQueueProps {
  acknowledgements: AcknowledgementRecord[];
  memos: Memo[];
  currentUser: User;
  scheme: StatusScheme;
  allStaffUsers?: User[];
  botSettings?: TelegramBotSettings;
  onUpdateAcknowledgement: (updated: AcknowledgementRecord) => void;
  onDispatchReminder?: () => void | Promise<void>;
}

export const HRAcknowledgementQueue: React.FC<HRAcknowledgementQueueProps> = ({
  acknowledgements,
  memos,
  currentUser,
  scheme,
  allStaffUsers = [],
  botSettings = {
    botName: 'APA HR Dispatch Bot',
    botUsername: '@APA_HR_Bot',
    hrOfficerTelegram: '@elena_vance_hr',
    channelName: '@APA_AllStaff',
    autoVerifyWithBotToken: false,
    activeStatusScheme: 'standard',
  },
  onUpdateAcknowledgement,
  onDispatchReminder,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'Submitted' | 'In Review' | 'HR Verified'>('all');
  const [selectedMemoId, setSelectedMemoId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<AcknowledgementRecord | null>(null);
  const [verificationNote, setVerificationNote] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals & Scorecard State (Options A & B)
  const [certificateRecord, setCertificateRecord] = useState<AcknowledgementRecord | null>(null);
  const [reminderMemo, setReminderMemo] = useState<Memo | null>(null);
  const [isScorecardOpen, setIsScorecardOpen] = useState(true);
  const [isBatchReminderOpen, setIsBatchReminderOpen] = useState(false);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');

  // Option B — every targeted employee whose directive is not yet HR Verified.
  const pendingStaffList = useMemo(() => {
    const list: { staff: User; memo: Memo; ack?: AcknowledgementRecord; isOverdue: boolean }[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);

    memos.forEach((memo) => {
      const targeted = allStaffUsers.filter((u) => {
        if (!memo.targetDepartments || memo.targetDepartments.length === 0) return true;
        if (memo.targetDepartments.includes('All Departments')) return true;
        return memo.targetDepartments.includes(u.department);
      });

      targeted.forEach((staff) => {
        const matchingAck = acknowledgements.find((a) => a.memoId === memo.id && a.staffId === staff.id);
        if (!matchingAck || matchingAck.status !== 'HR Verified') {
          const isOverdue = memo.deadlineDate ? memo.deadlineDate <= todayStr : false;
          list.push({ staff, memo, ack: matchingAck, isOverdue });
        }
      });
    });

    return list;
  }, [memos, allStaffUsers, acknowledgements]);

  // Option A — department-by-department compliance analytics.
  const departmentComplianceStats = useMemo(() => {
    const deptMap = new Map<string, { totalRequired: number; verifiedCount: number; staffCount: number }>();
    allStaffUsers.forEach((u) => {
      if (!deptMap.has(u.department)) {
        deptMap.set(u.department, { totalRequired: 0, verifiedCount: 0, staffCount: 0 });
      }
      deptMap.get(u.department)!.staffCount += 1;
    });

    memos.forEach((memo) => {
      const targeted = allStaffUsers.filter((u) => {
        if (!memo.targetDepartments || memo.targetDepartments.length === 0) return true;
        if (memo.targetDepartments.includes('All Departments')) return true;
        return memo.targetDepartments.includes(u.department);
      });

      targeted.forEach((staff) => {
        const dStat = deptMap.get(staff.department);
        if (dStat) {
          dStat.totalRequired += 1;
          const matchingAck = acknowledgements.find(
            (a) => a.memoId === memo.id && a.staffId === staff.id && a.status === 'HR Verified'
          );
          if (matchingAck) dStat.verifiedCount += 1;
        }
      });
    });

    return Array.from(deptMap.entries()).map(([dept, data]) => {
      const rate = data.totalRequired > 0 ? Math.round((data.verifiedCount / data.totalRequired) * 100) : 100;
      return {
        department: dept,
        totalRequired: data.totalRequired,
        verifiedCount: data.verifiedCount,
        staffCount: data.staffCount,
        rate,
      };
    });
  }, [memos, allStaffUsers, acknowledgements]);

  // Option A — company-wide certification standing behind the circular gauge.
  const overallComplianceRate = useMemo(() => {
    let totalReq = 0;
    let totalVer = 0;
    departmentComplianceStats.forEach((d) => {
      totalReq += d.totalRequired;
      totalVer += d.verifiedCount;
    });
    return totalReq > 0 ? Math.round((totalVer / totalReq) * 100) : 100;
  }, [departmentComplianceStats]);

  const overdueStaffCount = pendingStaffList.filter((p) => p.isOverdue).length;

  // Option D — consolidated dossier for the directive currently selected in the queue.
  const handleExportSelectedDossier = () => {
    const targetMemo = selectedMemoId !== 'all' ? memos.find((m) => m.id === selectedMemoId) : memos[0];
    if (!targetMemo) {
      showToast('No active directive available to export dossier.');
      return;
    }
    generateComplianceDossierPdf(targetMemo, acknowledgements, allStaffUsers, 'APA', currentUser.name);
    showToast(`Exported Comprehensive Legal Audit Dossier for Directive ${targetMemo.memoNumber}`);
  };

  const filteredRecords = useMemo(() => {
    return acknowledgements.filter((rec) => {
      if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
      if (selectedMemoId !== 'all' && rec.memoId !== selectedMemoId) return false;
      if (selectedDeptFilter !== 'all' && rec.department !== selectedDeptFilter) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        rec.staffName.toLowerCase().includes(q) ||
        rec.department.toLowerCase().includes(q) ||
        rec.verificationToken.toLowerCase().includes(q) ||
        rec.staffTelegramHandle.toLowerCase().includes(q) ||
        rec.memoNumber.toLowerCase().includes(q)
      );
    });
  }, [acknowledgements, statusFilter, selectedMemoId, selectedDeptFilter, searchQuery]);

  // Counts
  const submittedCount = acknowledgements.filter((a) => a.status === 'Submitted').length;
  const inReviewCount = acknowledgements.filter((a) => a.status === 'In Review').length;
  const verifiedCount = acknowledgements.filter((a) => a.status === 'HR Verified').length;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleMarkInReview = (rec: AcknowledgementRecord) => {
    const updated: AcknowledgementRecord = {
      ...rec,
      status: 'In Review',
      telegramSentTimestamp: rec.telegramSentTimestamp || new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      telegramMessageSnippet: `✅ [Telegram Inbound] ${rec.staffName} confirmed receipt of ${rec.memoNumber}. Token: ${rec.verificationToken}`,
    };
    onUpdateAcknowledgement(updated);
    if (selectedRecord?.id === rec.id) setSelectedRecord(updated);
    showToast(`Marked ${rec.staffName}'s acknowledgement as In Review (Telegram Received)`);
  };

  const handleVerifyAndLock = (rec: AcknowledgementRecord) => {
    const updated: AcknowledgementRecord = {
      ...rec,
      status: 'HR Verified',
      hrVerifiedTimestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      hrOfficerName: currentUser.name,
      hrNotes: verificationNote || 'Verified against staff registered Telegram account. Non-repudiation audit sealed.',
    };
    onUpdateAcknowledgement(updated);
    if (selectedRecord?.id === rec.id) setSelectedRecord(updated);
    setVerificationNote('');
    showToast(`Successfully certified and locked acknowledgement for ${rec.staffName}!`);
  };

  const handleExportCSV = () => {
    const headers = [
      'Record ID',
      'Staff Name',
      'Department',
      'Telegram Handle',
      'Memo Code',
      'Status',
      'Audit Token',
      'Portal Timestamp',
      'Telegram Timestamp',
      'HR Verified Timestamp',
      'Verified By Officer',
      'IP Address',
    ];

    const rows = acknowledgements.map((r) => [
      `"${r.id}"`,
      `"${r.staffName}"`,
      `"${r.department}"`,
      `"${r.staffTelegramHandle}"`,
      `"${r.memoNumber}"`,
      `"${r.status}"`,
      `"${r.verificationToken}"`,
      `"${r.portalTimestamp || ''}"`,
      `"${r.telegramSentTimestamp || ''}"`,
      `"${r.hrVerifiedTimestamp || ''}"`,
      `"${r.hrOfficerName || ''}"`,
      `"${r.ipAddress || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `apa_compliance_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 bg-emerald-600 text-white rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold apa-fade-in slide-in-from-top duration-300">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header and Explanation */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                HR Verification Desk
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verify employee memo sign-offs against Telegram messages and approve official agreements
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pendingStaffList.length > 0 && (
            <button
              onClick={() => setIsBatchReminderOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shadow-xs"
              title="Broadcast Telegram reminder to all overdue staff"
            >
              <Send className="w-4 h-4" />
              <span>Broadcast Overdue Alerts ({pendingStaffList.length})</span>
            </button>
          )}

          <button
            onClick={handleExportSelectedDossier}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs"
            title="Export full consolidated Legal Audit Dossier PDF for Directive"
          >
            <FileCheck className="w-4 h-4 text-indigo-200" />
            <span>Export Audit Dossier (PDF)</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 text-xs font-semibold transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Export Legal Audit CSV</span>
          </button>
        </div>
      </div>

      {/* Option A: Executive Compliance Scorecard & Department Breakdown */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-indigo-50/40 dark:from-slate-900/40 dark:to-indigo-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                  Executive Compliance Scorecard &amp; Department Analytics
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  Live Audit
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Tracking mandatory directive certifications across {allStaffUsers.length} staff and{' '}
                {departmentComplianceStats.length} operating departments
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsScorecardOpen(!isScorecardOpen)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <span>{isScorecardOpen ? 'Collapse Analytics' : 'Expand Analytics'}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${isScorecardOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>

        {isScorecardOpen && (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* Company-Wide Compliance Meter */}
              <div className="md:col-span-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-4">
                <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                  <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-200 dark:text-slate-700"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={
                        overallComplianceRate >= 90
                          ? 'text-emerald-500'
                          : overallComplianceRate >= 70
                          ? 'text-amber-500'
                          : 'text-rose-500'
                      }
                      strokeDasharray={`${overallComplianceRate}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="absolute text-sm font-black text-slate-900 dark:text-white">
                    {overallComplianceRate}%
                  </span>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Company-Wide Compliance
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {verifiedCount} of {acknowledgements.length || allStaffUsers.length} total sign-offs
                    locked as HR Verified
                  </div>
                  <div className="mt-1">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        overallComplianceRate >= 90
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : overallComplianceRate >= 70
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}
                    >
                      {overallComplianceRate >= 90
                        ? 'High Compliance Standing'
                        : overallComplianceRate >= 70
                        ? 'Acceptable Audit Level'
                        : 'Action Required'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Urgent & Overdue Alert Banner */}
              <div className="md:col-span-8 p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
                      {pendingStaffList.length} Outstanding Staff Acknowledgements
                      {overdueStaffCount > 0 ? ` (${overdueStaffCount} Past Legal Deadline)` : ''}
                    </div>
                    <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                      Employees targeted by active workplace directives who have not yet submitted certified
                      out-of-band signatures.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsBatchReminderOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Broadcast Telegram Alerts</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Department Leaderboard & Progress Bars */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-indigo-500" />
                  <span>Departmental Breakdown (Click to filter queue records):</span>
                </span>
                {selectedDeptFilter !== 'all' && (
                  <button
                    onClick={() => setSelectedDeptFilter('all')}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                  >
                    Clear Filter ({selectedDeptFilter})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {departmentComplianceStats.map((d) => {
                  const isSelected = selectedDeptFilter === d.department;
                  return (
                    <button
                      key={d.department}
                      onClick={() => setSelectedDeptFilter(isSelected ? 'all' : d.department)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/50 shadow-xs ring-1 ring-indigo-500/30'
                          : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/30 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          {d.department}
                        </span>
                        <span
                          className={`font-black text-xs ${
                            d.rate >= 90
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : d.rate >= 70
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {d.rate}%
                        </span>
                      </div>

                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 my-2 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${
                            d.rate >= 90
                              ? 'bg-emerald-500'
                              : d.rate >= 70
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${d.rate}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                        <span>{d.verifiedCount} Verified</span>
                        <span>{d.totalRequired} Total Required</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Workflow Queue KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">
            Total Signatures Recorded
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {acknowledgements.length}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-sky-100 dark:border-sky-900/40 shadow-xs">
          <span className="text-sky-600 dark:text-sky-400 text-xs font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Phase 1: {scheme.labels.submitted}</span>
          </span>
          <div className="text-2xl font-bold text-sky-700 dark:text-sky-300 mt-1">
            {submittedCount}
          </div>
          <span className="text-[11px] text-slate-400">Awaiting Telegram Ping</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-purple-100 dark:border-purple-900/40 shadow-xs">
          <span className="text-purple-600 dark:text-purple-400 text-xs font-medium flex items-center gap-1">
            <Bot className="w-3.5 h-3.5" />
            <span>Phase 2: {scheme.labels.inReview}</span>
          </span>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">
            {inReviewCount}
          </div>
          <span className="text-[11px] text-slate-400">Telegram Token Received</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-900/40 shadow-xs">
          <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Phase 3: {scheme.labels.hrVerified}</span>
          </span>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
            {verifiedCount}
          </div>
          <span className="text-[11px] text-slate-400">Audit-Locked &amp; Certified</span>
        </div>
      </div>

      {/* Main Table and Inspector Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Records Table */}
        <div className={selectedRecord ? 'lg:col-span-7 space-y-4' : 'lg:col-span-12 space-y-4'}>
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filter Status:
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-medium"
              >
                <option value="all">All Statuses ({acknowledgements.length})</option>
                <option value="Submitted">Submitted ({submittedCount})</option>
                <option value="In Review">In Review ({inReviewCount})</option>
                <option value="HR Verified">HR Verified ({verifiedCount})</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedMemoId}
                onChange={(e) => setSelectedMemoId(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-medium max-w-[200px] truncate"
              >
                <option value="all">All Directives / Memos</option>
                {memos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.memoNumber} - {m.title}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search staff, token..."
                  className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs w-44 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Table — desktop / tablet */}
          <div className="hidden md:block bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-3">Directive</th>
                    <th className="py-3 px-3">Token &amp; Telegram</th>
                    <th className="py-3 px-3">Verification Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No acknowledgement records found matching this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((rec) => {
                      const isSelected = selectedRecord?.id === rec.id;
                      return (
                        <tr
                          key={rec.id}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors cursor-pointer ${
                            isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/40' : ''
                          }`}
                          onClick={() => setSelectedRecord(rec)}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {rec.staffName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {rec.department}
                            </div>
                          </td>

                          <td className="py-3.5 px-3">
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                              {rec.memoNumber}
                            </span>
                          </td>

                          <td className="py-3.5 px-3">
                            <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                              {rec.verificationToken}
                            </span>
                            <div className="text-[10px] text-sky-600 dark:text-sky-400">
                              {rec.staffTelegramHandle}
                            </div>
                          </td>

                          <td className="py-3.5 px-3">
                            <StatusBadge status={rec.status} scheme={scheme} size="sm" />
                          </td>

                          <td className="py-3.5 px-4 text-right space-x-1.5">
                            {rec.status === 'HR Verified' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCertificateRecord(rec);
                                }}
                                className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] transition-colors inline-flex items-center gap-1"
                                title="View Legal Certificate of Non-Repudiation"
                              >
                                <Award className="w-3 h-3 text-emerald-600" />
                                <span>Certificate</span>
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void generateAcknowledgementPdfWithSignature(rec)
                                  .then(() => showToast(`Exported Compliance Summary PDF for ${rec.staffName}`))
                                  .catch((error) =>
                                    showToast(
                                      error instanceof Error
                                        ? error.message
                                        : MISSING_SIGNATURE_MESSAGE
                                    )
                                  );
                              }}
                              disabled={!hasAppliedSignature(rec)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold text-[11px] transition-colors"
                              title={
                                hasAppliedSignature(rec)
                                  ? 'Export Individual HR Compliance PDF'
                                  : MISSING_SIGNATURE_MESSAGE
                              }
                            >
                              <Download className="w-3 h-3 text-indigo-500" />
                              <span>PDF Export</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRecord(rec);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px] transition-colors"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Records — mobile cards (replaces the table below md) */}
          <div className="md:hidden space-y-3">
            {filteredRecords.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                No acknowledgement records found matching this filter.
              </div>
            ) : (
              filteredRecords.map((rec) => {
                const isSelected = selectedRecord?.id === rec.id;
                const initials = rec.staffName
                  .split(/\s+/)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();
                return (
                  <div
                    key={rec.id}
                    onClick={() => setSelectedRecord(rec)}
                    className={`rounded-2xl border p-4 space-y-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-indigo-300 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-950/40'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                          {rec.staffName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {rec.department}
                        </div>
                      </div>
                      <StatusBadge status={rec.status} scheme={scheme} size="sm" />
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                      <div className="min-w-0">
                        <span className="block text-[10px] uppercase text-slate-400">Directive</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {rec.memoNumber}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] uppercase text-slate-400">Token</span>
                        <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                          {rec.verificationToken}
                        </span>
                      </div>
                      <div className="col-span-2 min-w-0">
                        <span className="block text-[10px] uppercase text-slate-400">Telegram</span>
                        <span className="font-mono text-sky-600 dark:text-sky-400">
                          {rec.staffTelegramHandle}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-700/60">
                      {rec.status === 'HR Verified' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCertificateRecord(rec);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] inline-flex items-center gap-1"
                          title="View Legal Certificate of Non-Repudiation"
                        >
                          <Award className="w-3 h-3 text-emerald-600" />
                          <span>Certificate</span>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void generateAcknowledgementPdfWithSignature(rec)
                            .then(() => showToast(`Exported Compliance Summary PDF for ${rec.staffName}`))
                            .catch((error) =>
                              showToast(
                                error instanceof Error ? error.message : MISSING_SIGNATURE_MESSAGE
                              )
                            );
                        }}
                        disabled={!hasAppliedSignature(rec)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold text-[11px] inline-flex items-center gap-1"
                        title={
                          hasAppliedSignature(rec)
                            ? 'Export Individual HR Compliance PDF'
                            : MISSING_SIGNATURE_MESSAGE
                        }
                      >
                        <Download className="w-3 h-3 text-indigo-500" />
                        <span>PDF Export</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRecord(rec);
                        }}
                        className="ml-auto px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px]"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Verification Inspector Drawer */}
        {selectedRecord && (
          <div className="lg:col-span-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md p-6 space-y-5 sticky top-20">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Two-Party Verification Inspector
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Staff Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {selectedRecord.staffName}
                </span>
                <StatusBadge status={selectedRecord.status} scheme={scheme} size="sm" />
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-500 text-[11px]">
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase">Department</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {selectedRecord.department}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase">Registered Telegram</span>
                  <span className="font-mono text-sky-600 dark:text-sky-400 font-bold">
                    {selectedRecord.staffTelegramHandle}
                  </span>
                </div>
              </div>
            </div>

            {/* Cryptographic Token Match */}
            <div className="p-4 rounded-xl bg-slate-900 text-white font-mono text-xs space-y-2 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-[10px]">
                <span>AUDIT RECORD TOKEN</span>
                <span className="text-indigo-400">{selectedRecord.memoNumber}</span>
              </div>
              <div className="text-lg font-bold text-indigo-400 tracking-wider">
                {selectedRecord.verificationToken}
              </div>
              <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between">
                <span>Portal Time:</span>
                <span>{selectedRecord.portalTimestamp || 'N/A'}</span>
              </div>
              <div className="text-[10px] text-slate-400 flex justify-between">
                <span>Telegram Time:</span>
                <span className="text-sky-400">{formatPhnomPenhTime(selectedRecord.telegramSentTimestamp) || 'Pending Out-of-Band'}</span>
              </div>
              <div className="text-[10px] text-slate-400 flex justify-between">
                <span>Client IP:</span>
                <span>{selectedRecord.ipAddress || 'Internal Gateway'}</span>
              </div>
            </div>

            {/* Telegram Inbound Snippet */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-sky-500" />
                <span>Telegram Inbound Message Proof:</span>
              </label>
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300">
                {selectedRecord.telegramMessageSnippet || (
                  <span className="text-slate-400 italic">
                    No matching message received from {selectedRecord.staffTelegramHandle} yet.
                  </span>
                )}
              </div>
            </div>

            {/* Verification Actions */}
            <div className="space-y-3 pt-2">
              {selectedRecord.status === 'Submitted' && (
                <button
                  onClick={() => handleMarkInReview(selectedRecord)}
                  className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                >
                  <Bot className="w-4 h-4" />
                  <span>Confirm Telegram Message Received &rarr; Mark In Review</span>
                </button>
              )}

              {selectedRecord.status === 'In Review' && (
                <div className="space-y-3 p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                  <label className="text-xs font-bold text-indigo-900 dark:text-indigo-300 block">
                    HR Certification Notes:
                  </label>
                  <input
                    type="text"
                    value={verificationNote}
                    onChange={(e) => setVerificationNote(e.target.value)}
                    placeholder="e.g. Identity cross-checked with staff phone record. Token verified."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs"
                  />
                  <button
                    onClick={() => handleVerifyAndLock(selectedRecord)}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Certify &amp; Legally Lock (HR Verified)</span>
                  </button>
                </div>
              )}

              {selectedRecord.status === 'HR Verified' && (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>
                      Certified by {selectedRecord.hrOfficerName || 'Elena Vance'} on{' '}
                      {formatPhnomPenhTime(selectedRecord.hrVerifiedTimestamp) || 'a pending timestamp'}. Sealed and non-repudiated.
                    </span>
                  </div>

                  <button
                    onClick={() => setCertificateRecord(selectedRecord)}
                    className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                  >
                    <Award className="w-4 h-4" />
                    <span>View &amp; Print Official Compliance Certificate</span>
                  </button>
                </div>
              )}

              {/* Dedicated Export Compliance Summary PDF Button */}
              <button
                onClick={() => {
                  void generateAcknowledgementPdfWithSignature(selectedRecord)
                    .then(() => showToast(`Exported Compliance Summary PDF for ${selectedRecord.staffName}`))
                    .catch((error) =>
                      showToast(error instanceof Error ? error.message : MISSING_SIGNATURE_MESSAGE)
                    );
                }}
                disabled={!hasAppliedSignature(selectedRecord)}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 shadow-xs transition-colors"
                title={
                  hasAppliedSignature(selectedRecord)
                    ? 'Export the compliance summary of this acknowledgement'
                    : MISSING_SIGNATURE_MESSAGE
                }
              >
                <Download className="w-4 h-4 text-indigo-400" />
                <span>Export Compliance Summary (PDF)</span>
              </button>
            </div>
          </div>
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

      {/* Option B — Batch Telegram Reminder Modal (Company-Wide Overdue Staff) */}
      {isBatchReminderOpen && (
        <BatchTelegramReminderModal
          pendingStaffList={pendingStaffList}
          botSettings={botSettings}
          onClose={() => setIsBatchReminderOpen(false)}
          onConfirmBroadcast={async (count) => {
            if (onDispatchReminder) await onDispatchReminder();
            showToast(`Dispatched batch Telegram alerts to ${count} employee(s)`);
          }}
        />
      )}
    </div>
  );
};
