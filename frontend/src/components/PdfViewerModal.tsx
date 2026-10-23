import React, { useEffect, useState } from 'react';
import { PdfDocument, User } from '../types';
import { pdfsService } from '../utils/services';
import {
  FileText,
  Download,
  X,
  ExternalLink,
  ShieldCheck,
  Calendar,
  UserCheck,
  Tag,
  AlertCircle,
  FileCheck,
} from 'lucide-react';

interface PdfViewerModalProps {
  document: PdfDocument;
  currentUser: User;
  onClose: () => void;
  onAcknowledge?: (doc: PdfDocument) => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  document,
  currentUser,
  onClose,
  onAcknowledge,
}) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Presigned URLs expire, so resolve one each time the viewer opens.
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);

    if (!document.s3Key) {
      setPdfUrl(null);
      return;
    }

    pdfsService
      .getUrl(document.id)
      .then((url) => {
        if (!cancelled) setPdfUrl(url);
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [document.id, document.s3Key]);

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = window.document.createElement('a');
    a.href = pdfUrl;
    a.download = document.fileName || `${document.code}.pdf`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 apa-rise-in">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[90vh]">
        {/* Top Header Bar */}
        <div className="p-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                  {document.code}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {document.category}
                </span>
                {document.isMandatory && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                    Mandatory
                  </span>
                )}
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate mt-0.5">
                {document.title}
              </h2>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors shadow-xs"
              title="Download PDF file"
            >
              <Download className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Download PDF ({document.fileSize})</span>
            </button>

            {onAcknowledge && (
              <button
                onClick={() => onAcknowledge(document)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Acknowledge</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Info Sub-banner */}
        <div className="px-6 py-2 bg-slate-100/60 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-4">
            <span>Version: <strong>v{document.version}</strong></span>
            <span>Uploaded: <strong>{document.uploadDate}</strong> by {document.uploadedBy}</span>
            <span>Scope: <strong>{document.departmentScope}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            {document.tags.map((tag) => (
              <span key={tag} className="px-1.5 py-0.2 rounded bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* PDF Viewer Body */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 sm:p-4 overflow-hidden relative flex flex-col">
          {loadError ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900 space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-500" />
              <h3 className="font-bold text-slate-800 dark:text-slate-200">
                Unable to load this document
              </h3>
              <p className="text-xs text-slate-500 max-w-md">{loadError}</p>
            </div>
          ) : !document.s3Key ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <FileCheck className="w-12 h-12 text-slate-400" />
              <h3 className="font-bold text-slate-800 dark:text-slate-200">
                No File Attached
              </h3>
              <p className="text-xs text-slate-500 max-w-md">
                {document.summary}
              </p>
            </div>
          ) : !pdfUrl ? (
            <div className="h-full flex items-center justify-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500">Preparing document...</span>
            </div>
          ) : (
            <div className="w-full h-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white shadow-inner flex flex-col">
              <object
                data={pdfUrl}
                type="application/pdf"
                className="w-full h-full"
              >
                {/* Fallback iframe */}
                <iframe
                  src={pdfUrl}
                  title={document.title}
                  className="w-full h-full border-0"
                >
                  <div className="p-8 text-center text-xs space-y-3">
                    <p className="text-slate-700">Your browser does not support inline PDF viewing.</p>
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold"
                    >
                      Download {document.fileName}
                    </button>
                  </div>
                </iframe>
              </object>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
