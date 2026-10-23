import React, { useState, useRef } from 'react';
import { PdfDocument, User, Memo, Department } from '../types';
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Shield,
  Tag,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { SAMPLE_BASE64_PDF } from '../data/mockData';

interface UploadPdfModalProps {
  currentUser: User;
  memos: Memo[];
  departments: Department[];
  onClose: () => void;
  onUploadSuccess: (newDoc: PdfDocument, file: File) => Promise<void>;
}

const UploadPdfModalBase: React.FC<UploadPdfModalProps> = ({
  currentUser,
  memos,
  departments,
  onClose,
  onUploadSuccess,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState<PdfDocument['category']>('IT & Security');
  const [departmentScope, setDepartmentScope] = useState('All Departments');
  const [version, setVersion] = useState('1.0');
  const [summary, setSummary] = useState('');
  const [tagsInput, setTagsInput] = useState('Policy, Compliance, Official');
  const [isMandatory, setIsMandatory] = useState(false);
  const [linkedMemoId, setLinkedMemoId] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setErrorMsg(null);
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setErrorMsg('Please select a valid PDF document (.pdf)');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg('File size exceeds maximum allowed limit of 25 MB');
      return;
    }

    setSelectedFile(file);
    if (!title) {
      setTitle(file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '));
    }
    if (!code) {
      setCode(`APA-DOC-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
    }
  };

  const handleUseSample = async () => {
    setErrorMsg(null);
    try {
      const blob = await (await fetch(SAMPLE_BASE64_PDF)).blob();
      const file = new File([blob], 'APA_Corporate_Information_Security_Directive_v2026.pdf', {
        type: 'application/pdf',
      });
      setSelectedFile(file);
      setTitle('APA Corporate Information Security Directive 2026');
      setCode(`APA-IT-SEC-${new Date().getFullYear()}-09`);
      setSummary(
        'Official signed directive specifying zero-trust access controls, hardware tokens, and two-factor Telegram protocol.'
      );
      setCategory('IT & Security');
    } catch {
      setErrorMsg('Unable to load the sample PDF. Please upload a file instead.');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;
    if (!selectedFile) {
      setErrorMsg('Please select a PDF file first.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Please provide a document title.');
      return;
    }

    const sizeFormatted = (selectedFile.size / (1024 * 1024)).toFixed(1) + ' MB';

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const newDoc: PdfDocument = {
      id: `DOC-PDF-${Date.now()}`,
      code: code.trim() || `APA-DOC-${Date.now().toString().slice(-4)}`,
      title: title.trim(),
      category,
      fileName: selectedFile.name,
      fileSize: sizeFormatted,
      uploadDate: new Date().toISOString().slice(0, 10),
      uploadedBy: currentUser.name,
      uploadedByRole: currentUser.jobTitle,
      departmentScope,
      version: version.trim() || '1.0',
      summary: summary.trim() || title.trim(),
      tags: tags.length ? tags : ['Official', 'PDF'],
      isMandatory,
      linkedMemoId: linkedMemoId || undefined,
      pageCount: Math.floor(4 + Math.random() * 12),
    };

    setIsUploading(true);
    setErrorMsg(null);
    try {
      await onUploadSuccess(newDoc, selectedFile);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 apa-rise-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Upload className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Upload Official Policy Document (PDF)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload verified PDF circulars, policies, and employee handbook addendums to APA
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

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-xs max-h-[calc(85vh-160px)] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Drag & Drop File Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40'
                : selectedFile
                ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20'
                : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-800/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />

            {selectedFile ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  {selectedFile.name}
                </div>
                <div className="text-[11px] text-slate-500">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; PDF Document Ready
                </div>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline">
                  Click or drag to replace file
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                  Drag and drop your PDF here, or <span className="text-indigo-600 dark:text-indigo-400 underline">browse files</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Accepts standard PDF documents up to 25 MB
                </div>
              </div>
            )}
          </div>

          {/* Quick Sample Button */}
          {!selectedFile && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleUseSample}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Or use pre-formatted sample PDF for testing</span>
              </button>
            </div>
          )}

                    {/* Metadata Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Document Title:
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. IT Asset & Password Security Standards"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Official Document Code:
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. APA-POL-IT-01"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Policy Category:
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PdfDocument['category'])}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              >
                <option value="IT & Security">IT &amp; Security</option>
                <option value="Conduct & Ethics">Conduct &amp; Ethics</option>
                <option value="Leave & Attendance">Leave &amp; Attendance</option>
                <option value="Workplace & Remote">Workplace &amp; Remote</option>
                <option value="Compensation & Benefits">Compensation &amp; Benefits</option>
                <option value="General">General Corporate</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Department Scope:
              </label>
              <select
                value={departmentScope}
                onChange={(e) => setDepartmentScope(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              >
                <option value="All Departments">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Version:
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="e.g. 2.1"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Executive Brief &amp; Document Summary:
            </label>
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief description of what this policy contains and who is impacted..."
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Link to Official Memo (Optional):
              </label>
              <select
                value={linkedMemoId}
                onChange={(e) => setLinkedMemoId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              >
                <option value="">None (Independent Policy Document)</option>
                {memos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.memoNumber} - {m.title.slice(0, 30)}...
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Tags (Comma separated):
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Security, Hardware, Passwords"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 cursor-pointer">
            <input
              type="checkbox"
              checked={isMandatory}
              onChange={(e) => setIsMandatory(e.target.checked)}
              className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
            />
            <span className="text-xs text-rose-950 dark:text-rose-200">
              <strong>Mandatory Compliance Reading:</strong> Flag this PDF document as required reading for affected staff.
            </span>
          </label>

          {isUploading && (
            <div className="flex items-center gap-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 px-3 py-2.5">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-indigo-500" />
              </span>
              <span className="text-xs text-indigo-800 dark:text-indigo-200">
                Uploading <strong>{selectedFile?.name}</strong> to secure storage...
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload &amp; Publish PDF Document</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const UploadPdfModal = React.memo(UploadPdfModalBase);
