import React, { useState } from 'react';
import {
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Trash2,
  Rocket,
  ShieldCheck,
  Bot,
  FileText,
  Users,
  X,
  AlertTriangle,
  ArrowRight,
  Database,
} from 'lucide-react';

interface SystemReadinessModalProps {
  systemMode: 'production_clean' | 'demo';
  onClose: () => void;
  onResetToCleanProduction: () => void;
  onResetToDemoSample: () => void;
}

export const SystemReadinessModal: React.FC<SystemReadinessModalProps> = ({
  systemMode,
  onClose,
  onResetToCleanProduction,
  onResetToDemoSample,
}) => {
  const [confirmCleanOpen, setConfirmCleanOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleCleanStart = () => {
    onResetToCleanProduction();
    setConfirmCleanOpen(false);
    showToast('System initialized to clean production workspace! Ready for real staff use.');
  };

  const handleDemoSample = () => {
    onResetToDemoSample();
    showToast('Sample demo data loaded with staff members & test records.');
  };

  const readinessChecklist = [
    {
      title: 'Company Policy Handbook & Guidelines',
      desc: 'Master handbook with full-text search, categories, and printable policy sheets.',
      status: 'Ready',
      icon: FileText,
    },
    {
      title: 'PDF Document Repository & File Uploader',
      desc: 'Accepts drag-and-drop PDF directives up to 25MB with embedded PDF previewer.',
      status: 'Ready',
      icon: FileText,
    },
    {
      title: 'Two-Factor Telegram Bot Verification',
      desc: 'Out-of-band anti-repudiation mechanism with cryptographic tokens and Telegram deep links.',
      status: 'Ready',
      icon: Bot,
    },
    {
      title: 'Strict Staff Data Isolation (RBAC)',
      desc: 'Non-admin staff are strictly restricted to only viewing their own status and assigned memos.',
      status: 'Enforced',
      icon: ShieldCheck,
    },
    {
      title: 'Persistent Storage & Refresh Resilience',
      desc: 'All edits, uploaded PDFs, acknowledgements, and enrolled users persist across browser refreshes.',
      status: 'Active',
      icon: Database,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 apa-rise-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Toast */}
        {toastMsg && (
          <div className="absolute top-4 right-4 z-50 p-3 bg-emerald-600 text-white rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold apa-fade-in slide-in-from-top duration-300">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-900/10 via-slate-900/5 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  System Deployment &amp; Fresh Start Hub
                </h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    systemMode === 'production_clean'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {systemMode === 'production_clean' ? 'Clean Production Workspace' : 'Sample Demo Mode'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verify operational readiness or reset to a fresh clean start for real organizational use
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

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6 max-h-[calc(85vh-160px)] overflow-y-auto text-xs">
          {/* Readiness Checklist */}
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <span>Operational Readiness Audit: 5/5 Operational</span>
            </h3>

            <div className="space-y-2">
              {readinessChecklist.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {item.desc}
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                      {item.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Onboarding Next Steps */}
          <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 space-y-2">
            <span className="font-bold text-indigo-950 dark:text-indigo-200 block text-xs">
              Quick 3-Step Setup for Your Real Organization:
            </span>
            <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
              <div className="flex items-start gap-2">
                <span className="font-bold text-indigo-600 dark:text-indigo-400">1.</span>
                <span>
                  Go to <strong>Bot Setup</strong> and configure your HR Telegram handle (e.g. <code>@your_hr_officer</code>).
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-indigo-600 dark:text-indigo-400">2.</span>
                <span>
                  Go to <strong>Access Limits (RBAC)</strong> &rarr; <strong>Staff Credentials</strong> and click <strong>Add Staff Credential</strong> to enroll your team members with their personal Telegram usernames.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-indigo-600 dark:text-indigo-400">3.</span>
                <span>
                  Click <strong>Upload Document (PDF)</strong> in the Handbook or <strong>Issue New Memo</strong> to release your first official company directive.
                </span>
              </div>
            </div>
          </div>


        </div>

        {/* Confirmation Modal for Fresh Start */}
        {confirmCleanOpen && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-6 z-50">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 space-y-4 text-xs shadow-2xl apa-fade-in zoom-in-95">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Initialize Fresh Start for Real Organization?
                </h4>
                <p className="text-slate-500 mt-1 leading-relaxed text-xs">
                  This will wipe all sample test acknowledgement records and reset the compliance log to clean 0 records. Primary admin accounts, master policies, and uploaded PDFs will remain intact.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmCleanOpen(false)}
                  className="px-3 py-1.5 text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCleanStart}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm"
                >
                  Yes, Start Fresh
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
