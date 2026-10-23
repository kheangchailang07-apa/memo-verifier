import React, { useState, useMemo, useEffect } from 'react';
import { AuditLogEntry, User, UserRole, AuditCategory } from '../types';
import {
  FileText,
  Search,
  Filter,
  Download,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Clock,
  User as UserIcon,
  Bell,
  BookOpen,
  Key,
  Bot,
  Terminal,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Code2,
  Calendar,
  CheckCircle2,
} from 'lucide-react';

interface AuditLogViewProps {
  auditLogs: AuditLogEntry[];
  currentUser: User;
  onClearLogs?: () => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({
  auditLogs,
  currentUser,
  onClearLogs,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [inspectingEntry, setInspectingEntry] = useState<AuditLogEntry | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Filtered and sorted logs
  const filteredLogs = useMemo(() => {
    return auditLogs
      .filter((entry) => {
        if (selectedCategory !== 'all' && entry.category !== selectedCategory) return false;
        if (selectedRole !== 'all' && entry.actorRole !== selectedRole) return false;

        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          entry.actorName.toLowerCase().includes(q) ||
          entry.description.toLowerCase().includes(q) ||
          entry.actionType.toLowerCase().includes(q) ||
          (entry.targetName && entry.targetName.toLowerCase().includes(q)) ||
          (entry.targetId && entry.targetId.toLowerCase().includes(q)) ||
          (entry.ipAddress && entry.ipAddress.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [auditLogs, selectedCategory, selectedRole, searchQuery, sortOrder]);

  // Pagination
  const totalItems = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedLogs = useMemo(
    () => filteredLogs.slice(startIndex, startIndex + pageSize),
    [filteredLogs, startIndex, pageSize]
  );
  const firstVisible = totalItems === 0 ? 0 : startIndex + 1;
  const lastVisible = Math.min(startIndex + pageSize, totalItems);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedRole, sortOrder, pageSize]);

  // Statistics
  const directiveEvents = auditLogs.filter((l) => l.category === 'Directives').length;
  const verificationEvents = auditLogs.filter((l) => l.category === 'Verification').length;
  const accessEvents = auditLogs.filter((l) => l.category === 'Access & Roles').length;

  const handleExportCSV = () => {
    const headers = [
      'Log ID',
      'Timestamp (UTC)',
      'Actor Name',
      'Actor Email',
      'Actor Role',
      'Category',
      'Action Type',
      'Description',
      'Target ID',
      'Target Name',
      'IP Address',
    ];

    const rows = filteredLogs.map((log) => [
      `"${log.id}"`,
      `"${log.timestamp}"`,
      `"${log.actorName}"`,
      `"${log.actorEmail}"`,
      `"${log.actorRole}"`,
      `"${log.category}"`,
      `"${log.actionType}"`,
      `"${log.description.replace(/"/g, '""')}"`,
      `"${log.targetId || ''}"`,
      `"${(log.targetName || '').replace(/"/g, '""')}"`,
      `"${log.ipAddress || ''}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `apa_system_audit_log_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `apa_system_audit_log_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getCategoryBadge = (category: AuditCategory) => {
    switch (category) {
      case 'Directives':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      case 'Verification':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      case 'Access & Roles':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800';
      case 'Policies':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-300 dark:border-blue-800';
      case 'System':
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    }
  };

  const getActionIcon = (category: AuditCategory) => {
    switch (category) {
      case 'Directives':
        return <Bell className="w-3.5 h-3.5 text-amber-500" />;
      case 'Verification':
        return <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />;
      case 'Access & Roles':
        return <Key className="w-3.5 h-3.5 text-rose-500" />;
      case 'Policies':
        return <BookOpen className="w-3.5 h-3.5 text-blue-500" />;
      case 'System':
      default:
        return <Terminal className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const getPageNumbers = (current: number, total: number): (number | '…')[] => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages = new Set<number>([1, total, current]);
    for (let offset = -1; offset <= 1; offset++) {
      const p = current + offset;
      if (p >= 1 && p <= total) pages.add(p);
    }

    const sorted = Array.from(pages).sort((a, b) => a - b);
    const result: (number | '…')[] = [];
    let previous = 0;
    for (const page of sorted) {
      if (previous && page - previous > 1) result.push('…');
      result.push(page);
      previous = page;
    }
    return result;
  };

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Shield className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Administrative Audit Log &amp; Event Ledger
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Non-repudiation event trail recording all actions taken by HR and Administrators in the APA portal.
              </p>
            </div>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 text-xs font-bold transition-all shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-all shadow-xs"
          >
            <Code2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Export JSON</span>
          </button>

          {currentUser.role === 'admin' && onClearLogs && (
            <button
              onClick={() => setConfirmClearOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold transition-colors"
              title="Clear old logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">
            Total Logged Events
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {auditLogs.length}
          </div>
          <span className="text-[11px] text-slate-400">Recorded In Local Ledger</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-amber-100 dark:border-amber-900/40 shadow-xs">
          <span className="text-amber-600 dark:text-amber-400 text-xs font-medium flex items-center gap-1">
            <Bell className="w-3.5 h-3.5" />
            <span>Directive Releases</span>
          </span>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
            {directiveEvents}
          </div>
          <span className="text-[11px] text-slate-400">Memos &amp; Instructions</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-900/40 shadow-xs">
          <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Certifications &amp; Locks</span>
          </span>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
            {verificationEvents}
          </div>
          <span className="text-[11px] text-slate-400">Tokens Sealed by HR</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-rose-100 dark:border-rose-900/40 shadow-xs">
          <span className="text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-1">
            <Key className="w-3.5 h-3.5" />
            <span>Access &amp; Role Updates</span>
          </span>
          <div className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">
            {accessEvents}
          </div>
          <span className="text-[11px] text-slate-400">RBAC &amp; Permission Modifications</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Category:
          </span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-medium"
          >
            <option value="all">All Categories ({auditLogs.length})</option>
            <option value="Directives">Directives ({directiveEvents})</option>
            <option value="Verification">Verification ({verificationEvents})</option>
            <option value="Access & Roles">Access &amp; Roles ({accessEvents})</option>
            <option value="Policies">Policies</option>
            <option value="System">System</option>
          </select>

          <span className="text-slate-400 ml-2">Actor Role:</span>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-medium"
          >
            <option value="all">All Roles</option>
            <option value="admin">Administrators</option>
            <option value="hr">HR Compliance</option>
            <option value="staff">Staff Members</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search actions, actors..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs w-48 sm:w-60 focus:outline-none"
            />
          </div>

          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            {sortOrder === 'desc' ? 'Newest ↓' : 'Oldest ↑'}
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-3">Actor / Operator</th>
                <th className="py-3 px-3">Event Category</th>
                <th className="py-3 px-4">Action Description &amp; Target</th>
                <th className="py-3 px-3">Network IP</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No audit records found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {log.timestamp}
                      </td>

                      {/* Actor */}
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{log.actorName}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase ${
                              log.actorRole === 'admin'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : log.actorRole === 'hr'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {log.actorRole}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                          {log.actorEmail}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryBadge(
                            log.category
                          )}`}
                        >
                          {getActionIcon(log.category)}
                          <span>{log.category}</span>
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {log.actionType}
                        </div>
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="font-medium text-slate-800 dark:text-slate-200 text-xs leading-snug">
                          {log.description}
                        </div>
                        {log.targetName && (
                          <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono truncate mt-0.5">
                            Target: {log.targetName} {log.targetId ? `(${log.targetId})` : ''}
                          </div>
                        )}
                      </td>

                      {/* IP */}
                      <td className="py-3.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {log.ipAddress || 'Internal Gateway'}
                      </td>

                      {/* Inspect Button */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setInspectingEntry(log)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition-colors"
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

        {/* Events — mobile cards (replaces the table below md) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/60">
          {paginatedLogs.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              No audit records found matching your filters.
            </div>
          ) : (
            paginatedLogs.map((log) => (
              <div key={log.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                      <span className="truncate">{log.actorName}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase ${
                          log.actorRole === 'admin'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : log.actorRole === 'hr'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {log.actorRole}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{log.actorEmail}</div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${getCategoryBadge(
                      log.category
                    )}`}
                  >
                    {getActionIcon(log.category)}
                    <span>{log.category}</span>
                  </span>
                </div>

                <div className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-snug">
                  {log.description}
                </div>
                {log.targetName && (
                  <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono truncate">
                    Target: {log.targetName} {log.targetId ? `(${log.targetId})` : ''}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
                  <span className="truncate">{log.timestamp}</span>
                  <span className="shrink-0">{log.ipAddress || 'Internal Gateway'}</span>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => setInspectingEntry(log)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition-colors"
                  >
                    Inspect
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 text-xs">
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            <span>
              Showing <strong className="text-slate-800 dark:text-slate-200">{firstVisible}</strong>
              {' – '}
              <strong className="text-slate-800 dark:text-slate-200">{lastVisible}</strong> of{' '}
              <strong className="text-slate-800 dark:text-slate-200">{totalItems}</strong> events
            </span>
            <label className="flex items-center gap-1.5">
              <span className="text-slate-400">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-medium focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safePage <= 1}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="First page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(safePage - 1)}
              disabled={safePage <= 1}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {getPageNumbers(safePage, totalPages).map((page, idx) =>
              page === '…' ? (
                <span key={`gap-${idx}`} className="px-1.5 text-slate-400 select-none">
                  …
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page as number)}
                  className={`min-w-[28px] px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                    page === safePage
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
                  }`}
                >
                  {page}
                </button>
              )
            )}

            <button
              onClick={() => setCurrentPage(safePage + 1)}
              disabled={safePage >= totalPages}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage >= totalPages}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Last page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Inspect Entry Modal */}
      {inspectingEntry && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 apa-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Audit Record Inspector ({inspectingEntry.id})
                </h3>
              </div>
              <button
                onClick={() => setInspectingEntry(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 text-xs max-h-[calc(90vh-140px)] overflow-y-auto">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between items-center text-slate-500">
                  <span>Timestamp:</span>
                  <span className="font-mono text-slate-900 dark:text-white font-semibold">
                    {inspectingEntry.timestamp}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Operator:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {inspectingEntry.actorName} ({inspectingEntry.actorRole.toUpperCase()})
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Category:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {inspectingEntry.category} ({inspectingEntry.actionType})
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Origin IP:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {inspectingEntry.ipAddress || 'Internal Gateway'}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Full Action Summary:
                </label>
                <p className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 leading-relaxed font-sans border border-slate-200 dark:border-slate-700">
                  {inspectingEntry.description}
                </p>
              </div>

              {/* Metadata JSON */}
              {inspectingEntry.metadata && Object.keys(inspectingEntry.metadata).length > 0 && (
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Event Parameters &amp; Metadata:
                  </label>
                  <pre className="p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-slate-800">
                    {JSON.stringify(inspectingEntry.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setInspectingEntry(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Clear Modal */}
      {confirmClearOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Clear System Audit Log?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                This will purge historical audit events from your local storage. An initial reset ledger event will be generated.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setConfirmClearOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onClearLogs) onClearLogs();
                  setConfirmClearOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/20"
              >
                Confirm Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
