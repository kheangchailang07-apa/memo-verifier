import React, { useState, useMemo } from 'react';
import { Policy, Memo, PdfDocument, User } from '../types';
import { pdfsService } from '../utils/services';
import {
  Search,
  BookOpen,
  Shield,
  Clock,
  Tag,
  ChevronRight,
  Printer,
  Sparkles,
  CheckCircle,
  FileText,
  AlertTriangle,
  X,
  ExternalLink,
  Upload,
  Download,
  Eye,
  FileCheck,
  Calendar,
  UserCheck,
  PlusCircle,
  Trash2,
  Edit2,
  Loader2,
} from 'lucide-react';

interface HandbookViewProps {
  policies: Policy[];
  memos: Memo[];
  pdfDocuments: PdfDocument[];
  currentUser: User;
  canUploadDocuments: boolean;
  onSelectMemo?: (memoId: string) => void;
  onOpenUploadPdf: () => void;
  onOpenPdfViewer: (doc: PdfDocument) => void;
  onDeletePdf?: (doc: PdfDocument) => void;
  onOpenCreatePolicy?: () => void;
  onUpdatePolicy?: (policy: Policy) => Promise<void> | void;
  onDeletePolicy?: (policy: Policy) => Promise<void> | void;
}

const HandbookViewBase: React.FC<HandbookViewProps> = ({
  policies,
  memos,
  pdfDocuments,
  currentUser,
  canUploadDocuments,
  onSelectMemo,
  onOpenUploadPdf,
  onOpenPdfViewer,
  onDeletePdf,
  onOpenCreatePolicy,
  onUpdatePolicy,
  onDeletePolicy,
}) => {
  const [activeHandbookTab, setActiveHandbookTab] = useState<'articles' | 'pdf-docs'>('articles');
  const [pendingDelete, setPendingDelete] = useState<PdfDocument | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingPolicyDelete, setPendingPolicyDelete] = useState<Policy | null>(null);
  const [policyDeleteError, setPolicyDeleteError] = useState<string | null>(null);
  const [isDeletingPolicy, setIsDeletingPolicy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(policies[0] || null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    policies.forEach((p) => set.add(p.category));
    pdfDocuments.forEach((d) => set.add(d.category));
    const list = Array.from(set);
    if (list.length === 0) {
      return ['All', 'IT & Security', 'Conduct & Ethics', 'Leave & Attendance', 'Workplace & Remote', 'Compensation & Benefits'];
    }
    return ['All', ...list];
  }, [policies, pdfDocuments]);

  // Filtered Policies
  const filteredPolicies = useMemo(() => {
    return policies.filter((p) => {
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inTitle = p.title.toLowerCase().includes(q);
      const inCode = p.code.toLowerCase().includes(q);
      const inSummary = p.summary.toLowerCase().includes(q);
      const inTags = p.tags.some((t) => t.toLowerCase().includes(q));
      const inSections = p.sections.some(
        (s) =>
          s.heading.toLowerCase().includes(q) ||
          s.content.toLowerCase().includes(q) ||
          s.keyPoints?.some((kp) => kp.toLowerCase().includes(q))
      );
      return inTitle || inCode || inSummary || inTags || inSections;
    });
  }, [policies, selectedCategory, searchQuery]);

  // Filtered PDF Documents
  const filteredPdfDocs = useMemo(() => {
    return pdfDocuments.filter((d) => {
      const matchesCategory = selectedCategory === 'All' || d.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        d.title.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [pdfDocuments, selectedCategory, searchQuery]);

  // Find related memos for currently selected policy
  const relatedMemos = useMemo(() => {
    if (!selectedPolicy) return [];
    return memos.filter((m) => m.category === selectedPolicy.category);
  }, [selectedPolicy, memos]);

  // Find related PDF for currently selected policy
  const relatedPdfDoc = useMemo(() => {
    if (!selectedPolicy) return null;
    return pdfDocuments.find(
      (d) =>
        d.code.toLowerCase().includes(selectedPolicy.code.toLowerCase()) ||
        d.category === selectedPolicy.category
    );
  }, [selectedPolicy, pdfDocuments]);

  const handlePrint = () => {
    window.print();
  };

  const handleDirectDownload = async (doc: PdfDocument) => {
    if (!doc.s3Key) return;
    const url = await pdfsService.getUrl(doc.id);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const canDelete = currentUser.role === 'admin' && Boolean(onDeletePdf);
  const canManageArticles = currentUser.role === 'admin';

  const confirmDelete = async () => {
    if (!pendingDelete || !onDeletePdf) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDeletePdf(pendingDelete);
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Unable to delete this document.');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmPolicyDelete = async () => {
    if (!pendingPolicyDelete || !onDeletePolicy) return;
    setIsDeletingPolicy(true);
    setPolicyDeleteError(null);
    try {
      await onDeletePolicy(pendingPolicyDelete);
      if (selectedPolicy?.id === pendingPolicyDelete.id) {
        setSelectedPolicy(policies.find((p) => p.id !== pendingPolicyDelete.id) || null);
      }
      setPendingPolicyDelete(null);
    } catch (err) {
      setPolicyDeleteError(err instanceof Error ? err.message : 'Unable to delete this article.');
    } finally {
      setIsDeletingPolicy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Search & Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-indigo-900/40">
        <div className="absolute right-0 top-0 -mt-12 -mr-12 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3 border border-indigo-400/30">
            <BookOpen className="w-3.5 h-3.5" />
            <span>APA Policy &amp; Memo Library</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Company Policies &amp; Workplace Guidelines
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed">
            Search official company policies, operating guidelines, and signed PDF documents. Read, agree, and follow without exception.
          </p>

          {/* Search Bar */}
          <div className="mt-6 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across policy articles and uploaded PDF files..."
              className="w-full pl-12 pr-10 py-3.5 bg-white/10 hover:bg-white/15 focus:bg-white text-slate-900 focus:text-slate-900 placeholder:text-slate-300 focus:placeholder:text-slate-400 rounded-xl border border-white/20 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all text-sm backdrop-blur-md shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Switcher: Articles vs PDF Document Repository */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveHandbookTab('articles')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeHandbookTab === 'articles'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Interactive Handbook Articles ({policies.length})</span>
          </button>

          <button
            onClick={() => setActiveHandbookTab('pdf-docs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeHandbookTab === 'pdf-docs'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 text-rose-400" />
            <span>Official PDF Documents ({pdfDocuments.length})</span>
          </button>
        </div>

        {/* Action Buttons for Authorized Admin/HR */}
        {canUploadDocuments && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {onOpenCreatePolicy && (
              <button
                onClick={onOpenCreatePolicy}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold transition-all shadow-xs"
              >
                <PlusCircle className="w-4 h-4 text-indigo-500" />
                <span>+ Create Article</span>
              </button>
            )}

            <button
              onClick={onOpenUploadPdf}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Document (PDF)</span>
            </button>
          </div>
        )}
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* VIEW 1: Interactive Policy Articles */}
      {activeHandbookTab === 'articles' && (
        policies.length === 0 ? (
          <div className="p-6 sm:p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-xl mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                No Policy Articles Published Yet
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                The handbook repository is completely clean. Get started by drafting your first company policy article or uploading signed PDF circulars.
              </p>
            </div>
            {canUploadDocuments && (
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {onOpenCreatePolicy && (
                  <button
                    onClick={onOpenCreatePolicy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Create Policy Article</span>
                  </button>
                )}
                <button
                  onClick={onOpenUploadPdf}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Document (PDF)</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Policy Cards List */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 font-medium">
                <span>Showing {filteredPolicies.length} policy articles</span>
                {searchQuery && <span>Filtered by "{searchQuery}"</span>}
              </div>

              {filteredPolicies.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                  <Search className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">No policies match your search</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Try searching for different keywords or reset category filters.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                    }}
                    className="mt-3 text-xs text-indigo-600 font-semibold hover:underline"
                  >
                    Clear all filters
                  </button>
                </div>
              ) : (
                filteredPolicies.map((p) => {
                  const isSelected = selectedPolicy?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPolicy(p)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all text-left relative ${
                        isSelected
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-sm ring-1 ring-indigo-500/20'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {p.code}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {p.isMandatoryReading && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              Mandatory
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400">v{p.version}</span>
                        </div>
                      </div>

                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-2 leading-snug">
                        {p.title}
                      </h3>

                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {p.summary}
                      </p>

                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Updated {p.lastUpdated}
                        </span>
                        <div className="flex items-center gap-2">
                          {canManageArticles && onUpdatePolicy && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdatePolicy(p);
                              }}
                              className="p-1 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors"
                              title="Edit this article"
                              aria-label={`Edit ${p.title}`}
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                          {canManageArticles && onDeletePolicy && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPolicyDeleteError(null);
                                setPendingPolicyDelete(p);
                              }}
                              className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 transition-colors"
                              title="Delete this article"
                              aria-label={`Delete ${p.title}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                          <span className="text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-0.5 group">
                            Read Policy
                            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Column: Policy Reader */}
            <div className="lg:col-span-7">
              {selectedPolicy ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden sticky top-20">
                  {/* Header Bar */}
                  <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
                          {selectedPolicy.code}
                        </span>
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                          {selectedPolicy.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {relatedPdfDoc && (
                          <button
                            onClick={() => onOpenPdfViewer(relatedPdfDoc)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 rounded-lg border border-rose-200 dark:border-rose-900 hover:bg-rose-100 transition-colors shadow-xs"
                            title="Open Signed PDF Version"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>View Signed PDF</span>
                          </button>
                        )}

                        <button
                          onClick={handlePrint}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shadow-xs"
                          title="Print or Save as PDF"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                      </div>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-3">
                      {selectedPolicy.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 dark:text-slate-400 mt-2">
                      <span>Effective Date: <strong>{selectedPolicy.effectiveDate}</strong></span>
                      <span>Scope: <strong>{selectedPolicy.departmentScope}</strong></span>
                      <span>Version: <strong>{selectedPolicy.version}</strong></span>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {selectedPolicy.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        >
                          <Tag className="w-3 h-3 text-slate-400" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Policy Body */}
                  <div className="p-6 space-y-6 max-h-[calc(100vh-280px)] overflow-y-auto">
                    {/* Executive Summary */}
                    <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5 mb-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Policy Overview
                      </h4>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {selectedPolicy.summary}
                      </p>
                    </div>

                    {/* Content Sections */}
                    <div className="space-y-6">
                      {selectedPolicy.sections.map((sec) => (
                        <div key={sec.id} className="pt-2 border-t border-slate-100 dark:border-slate-700/60 first:border-0 first:pt-0">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                            {sec.heading}
                          </h3>
                          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                            {sec.content}
                          </p>

                          {sec.keyPoints && sec.keyPoints.length > 0 && (
                            <div className="mt-3 pl-3 border-l-2 border-indigo-500 space-y-1.5">
                              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                Key Compliance Rules:
                              </p>
                              {sec.keyPoints.map((kp, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                  <span>{kp}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-96 flex items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-400">
                  Select a policy from the list to read.
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* VIEW 2: Official PDF Documents Repository */}
      {activeHandbookTab === 'pdf-docs' && (
        pdfDocuments.length === 0 ? (
          <div className="p-6 sm:p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-xl mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950 text-rose-600 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                No PDF Documents Uploaded Yet
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Your official PDF library is currently empty. Upload your signed policy documents, employee guidelines, and compliance circulars.
              </p>
            </div>
            {canUploadDocuments && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={onOpenUploadPdf}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload First Document (PDF)</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 font-medium">
              <span>Showing {filteredPdfDocs.length} signed PDF documents</span>
              {canUploadDocuments && (
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold cursor-pointer hover:underline" onClick={onOpenUploadPdf}>
                  + Upload another PDF file
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              {filteredPdfDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex flex-col justify-between space-y-4"
                >
                  <div>
                    {/* Top line badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400 shrink-0">
                          <FileText className="w-5 h-5" />
                        </span>
                        <div>
                          <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 block">
                            {doc.code}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {doc.category} &bull; v{doc.version}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {doc.isMandatory && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                            Mandatory
                          </span>
                        )}
                        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {doc.fileSize}
                        </span>
                      </div>
                    </div>

                    {/* Title & Summary */}
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-3 leading-snug">
                      {doc.title}
                    </h3>

                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                      {doc.summary}
                    </p>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {doc.uploadDate}
                      </span>
                      <span className="flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />
                        {doc.uploadedBy}
                      </span>
                      <span>Scope: <strong>{doc.departmentScope}</strong></span>
                    </div>
                  </div>

                  {/* Bottom Actions */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                    <span className="text-[11px] font-mono text-slate-400 truncate max-w-[180px]">
                      {doc.fileName}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDirectDownload(doc)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
                        title="Direct Download PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onOpenPdfViewer(doc)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview PDF</span>
                      </button>

                      {canDelete && (
                        <button
                          onClick={() => {
                            setDeleteError(null);
                            setPendingDelete(doc);
                          }}
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 transition-colors"
                          title="Delete this document permanently"
                          aria-label={`Delete ${doc.fileName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Delete confirmation — admin only */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="p-2.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Delete this document?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  <strong className="font-semibold">{pendingDelete.title}</strong> and its
                  uploaded file will be permanently removed. Any acknowledgements referencing
                  it are not affected.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setPendingDelete(null);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-bold transition-all shadow-md shadow-rose-500/20"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation — handbook policy article (admin only) */}
      {pendingPolicyDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="p-2.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Delete this policy article?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  <strong className="font-semibold">{pendingPolicyDelete.title}</strong> will be
                  permanently removed from the handbook. This action cannot be undone.
                </p>
              </div>
            </div>

            {policyDeleteError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                {policyDeleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setPendingPolicyDelete(null);
                  setPolicyDeleteError(null);
                }}
                disabled={isDeletingPolicy}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50"
              >
                No
              </button>
              <button
                onClick={confirmPolicyDelete}
                disabled={isDeletingPolicy}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-bold transition-all shadow-md shadow-rose-500/20"
              >
                {isDeletingPolicy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{isDeletingPolicy ? 'Deleting...' : 'Yes, Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const HandbookView = React.memo(HandbookViewBase);
