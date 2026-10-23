import React, { useState } from 'react';
import { Memo, MemoPriority, User, PdfDocument, Department } from '../types';
import { PlusCircle, X, Bell, Calendar, Send, ShieldAlert, Sparkles, FileText, Upload, Users, Check } from 'lucide-react';

interface CreateMemoModalProps {
  currentUser: User;
  pdfDocuments: PdfDocument[];
  departments: Department[];
  onClose: () => void;
  onCreateMemo: (memo: Memo) => void;
  onOpenUploadPdf: () => void;
  autoSelectPdfId?: string | null;
  onAutoSelectPdfIdConsumed?: () => void;
}

export const CreateMemoModal: React.FC<CreateMemoModalProps> = ({
  currentUser,
  pdfDocuments,
  departments,
  onClose,
  onCreateMemo,
  onOpenUploadPdf,
  autoSelectPdfId,
  onAutoSelectPdfIdConsumed,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('IT & Security');
  const [priority, setPriority] = useState<MemoPriority>('Mandatory');
  const [deadlineDate, setDeadlineDate] = useState('2026-10-25');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [selectedPdfId, setSelectedPdfId] = useState('');
  const [broadcastTelegram, setBroadcastTelegram] = useState(true);

  // Department targeting
  const [targetAll, setTargetAll] = useState(true);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);

  // Active departments from the registry; keep any already-selected name that
  // has since been disabled so the selection survives.
  const availableDepartments = (() => {
    const names = departments.filter((d) => d.isActive).map((d) => d.name);
    for (const selected of selectedDepts) {
      if (!names.includes(selected)) names.push(selected);
    }
    return names;
  })();

  React.useEffect(() => {
    if (!autoSelectPdfId) return;
    setSelectedPdfId(autoSelectPdfId);
    onAutoSelectPdfIdConsumed?.();
  }, [autoSelectPdfId]);

  const handleToggleDept = (dept: string) => {
    if (targetAll) {
      setTargetAll(false);
      setSelectedDepts([dept]);
    } else {
      if (selectedDepts.includes(dept)) {
        const next = selectedDepts.filter((d) => d !== dept);
        if (next.length === 0) {
          setTargetAll(true);
        } else {
          setSelectedDepts(next);
        }
      } else {
        setSelectedDepts([...selectedDepts, dept]);
      }
    }
  };

  const handleSelectAll = () => {
    setTargetAll(true);
    setSelectedDepts([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const attachedDoc = pdfDocuments.find((d) => d.id === selectedPdfId);
    const newMemoNumber = `HR-MEMO/2026/0${Math.floor(6 + Math.random() * 5)}`;
    
    const finalTargetDepartments = targetAll ? ['All Departments'] : selectedDepts;
    const recipientEstimate = targetAll ? 42 : selectedDepts.length * 7;

    const newMemo: Memo = {
      id: `MEMO-${Date.now()}`,
      memoNumber: newMemoNumber,
      title: title.trim(),
      releaseDate: new Date().toISOString().slice(0, 10),
      effectiveDate: new Date().toISOString().slice(0, 10),
      deadlineDate: deadlineDate || '2026-10-31',
      category,
      priority,
      summary: summary.trim() || title.trim(),
      content: content.trim(),
      issuerName: currentUser.name,
      issuerTitle: currentUser.jobTitle,
      issuerTelegram: currentUser.telegramHandle,
      targetDepartments: finalTargetDepartments,
      totalRecipients: recipientEstimate,
      attachedPdfId: attachedDoc?.id,
      attachedPdfName: attachedDoc?.fileName,
    };

    onCreateMemo(newMemo);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 apa-rise-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Bell className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Release New Official HR Directive / Memo
              </h2>
              <p className="text-xs text-slate-500">
                Mandates 2-step portal signature and Telegram receipt verification for targeted staff
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-xs max-h-[calc(85vh-160px)] overflow-y-auto">
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Directive / Memo Title:
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mandatory Information Security Directives for Q4"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Category:
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              >
                <option value="IT & Security">IT &amp; Security</option>
                <option value="Workplace & Remote">Workplace &amp; Remote</option>
                <option value="Leave & Attendance">Leave &amp; Attendance</option>
                <option value="Conduct & Ethics">Conduct &amp; Ethics</option>
                <option value="Compensation & Benefits">Compensation &amp; Benefits</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Acknowledgement Priority:
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as MemoPriority)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
              >
                <option value="Urgent">Urgent (Immediate)</option>
                <option value="Mandatory">Mandatory (Required for all)</option>
                <option value="Standard">Standard (General)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Acknowledgement Deadline:
              </label>
              <input
                type="date"
                required
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Department Targeting Selection */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-500" />
                <span>Target Department Scope:</span>
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className={`text-[11px] font-bold px-2 py-0.5 rounded-lg transition-colors ${
                  targetAll
                    ? 'bg-indigo-600 text-white'
                    : 'text-indigo-600 dark:text-indigo-400 hover:underline'
                }`}
              >
                All Departments
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {availableDepartments.map((dept) => {
                const isSelected = targetAll || selectedDepts.includes(dept);
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => handleToggleDept(dept)}
                    className={`p-2 rounded-lg text-left text-[11px] border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 font-semibold'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="truncate">{dept}</span>
                    {isSelected && <Check className="w-3 h-3 text-indigo-600 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Executive Brief / Summary:
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="One or two sentences explaining why staff must acknowledge this"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Full Directive Content &amp; Instructions:
            </label>
            <textarea
              required
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Specify the full policy text, responsibilities, penalties, and explicit compliance requirements..."
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-sans leading-relaxed"
            />
          </div>

          {/* Attach Signed Document (PDF) */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-rose-500" />
                <span>Attach Official Signed PDF Document:</span>
              </label>
              <button
                type="button"
                onClick={onOpenUploadPdf}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <Upload className="w-3 h-3" />
                <span>+ Upload New PDF</span>
              </button>
            </div>

            <select
              value={selectedPdfId}
              onChange={(e) => setSelectedPdfId(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            >
              <option value="">No PDF attached (Text directive only)</option>
              {pdfDocuments.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.code} - {doc.title} ({doc.fileSize})
                </option>
              ))}
            </select>
          </div>

          {/* Broadcast Option */}
          <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="broadcastTelegram"
                checked={broadcastTelegram}
                onChange={(e) => setBroadcastTelegram(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <label htmlFor="broadcastTelegram" className="cursor-pointer">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  Simulate Telegram Channel Broadcast Ping
                </span>
                <span className="text-[11px] text-slate-500">
                  Notifies all staff on @APA_AllStaff that this directive is pending their 2-step signature.
                </span>
              </label>
            </div>
            <Send className="w-4 h-4 text-indigo-500 shrink-0" />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Publish Directive &amp; Enforce Sign-off</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
