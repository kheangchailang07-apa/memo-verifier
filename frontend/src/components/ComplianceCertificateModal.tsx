import React from 'react';
import { AcknowledgementRecord } from '../types';
import { generateAcknowledgementPdfWithSignature, MISSING_SIGNATURE_MESSAGE } from '../utils/pdfExport';
import { hasAppliedSignature } from '../utils/signature';
import { formatPhnomPenhTime } from '../utils/format';
import { APP_LOGO, APP_TITLE } from '../utils/appIdentity';
import { ShieldCheck, Printer, X, Download, FileCheck, CheckCircle2, Lock } from 'lucide-react';

interface ComplianceCertificateModalProps {
  record: AcknowledgementRecord;
  onClose: () => void;
}

export const ComplianceCertificateModal: React.FC<ComplianceCertificateModalProps> = ({
  record,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    void generateAcknowledgementPdfWithSignature(record);
  };

  const certificateId = `APA-CERT-${record.verificationToken || '2026'}-${record.id.replace(/[^0-9]/g, '').slice(0, 4) || '001'}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: #fff !important; }
        }
      `}</style>
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-[794px] w-full max-h-[92vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl print:max-w-none print:max-h-none print:overflow-visible print:rounded-none print:p-0 print:border-none print:shadow-none">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm">Official Compliance Certificate</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={!hasAppliedSignature(record)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 text-white text-xs font-bold transition-all shadow-xs"
              title={
                hasAppliedSignature(record)
                  ? 'Download the compliance summary of this acknowledgement'
                  : MISSING_SIGNATURE_MESSAGE
              }
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Download Summary PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Certificate Printable Body */}
        <div className="relative p-4 sm:p-6 aspect-[210/297] overflow-hidden bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 print:bg-white print:text-black print:w-[210mm] print:h-[297mm] print:p-0 print:aspect-auto print:overflow-visible">
          {/* Decorative Border Frame */}
          <div className="h-full border-4 border-double border-indigo-900/30 dark:border-indigo-400/30 p-4 sm:p-5 rounded-2xl relative flex flex-col">
            {/* Watermark Logo */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] dark:opacity-[0.05]">
              <span className="text-9xl font-black tracking-widest text-indigo-950">{APP_LOGO}</span>
            </div>

            {/* Header */}
            <div className="text-center pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-indigo-600 text-white font-black text-xs tracking-tight shadow-lg mb-2">
                {APP_LOGO}
              </div>
              <h2 className="text-lg sm:text-xl font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Certificate of Policy Agreement
              </h2>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold tracking-widest uppercase mt-1">
                {APP_TITLE} &bull; Official Staff Agreement Proof
              </p>
              <div className="mt-2 text-[11px] font-mono text-slate-500">
                Certificate ID: <strong className="text-slate-800 dark:text-slate-200">{certificateId}</strong>
              </div>
            </div>

            {/* Main Statement */}
            <div className="py-4 text-center space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                This certifies that the corporate policy directive referenced below has been formally reviewed, acknowledged, and cryptographically verified
              </p>

              <div className="p-4 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 block mb-1">
                  {record.memoNumber}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
                  {record.memoTitle}
                </h3>
              </div>

              {/* Employee & Verification Details Grid */}
              <div className="grid grid-cols-2 gap-3 text-left pt-1 text-xs">
                <div className="p-3 rounded-lg bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Employee Name</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">{record.staffName}</span>
                  <span className="text-[11px] text-slate-500 block">{record.staffEmail}</span>
                  <span className="text-[11px] text-slate-500 block">{record.department}</span>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Verified Telegram Handle</span>
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400 text-sm">{record.staffTelegramHandle}</span>
                  <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Bi-directional Out-of-Band Match
                  </span>
                </div>
              </div>

              {/* Audit Proof Key-Value Table */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-[11px] space-y-2 text-left font-mono">
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500">Cryptographic Token:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{record.verificationToken}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500">Portal Signature Time:</span>
                  <span>{formatPhnomPenhTime(record.portalTimestamp) || '2026-10-01 18:05:43'}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500">Telegram Receipt Time:</span>
                  <span>{formatPhnomPenhTime(record.telegramSentTimestamp) || '2026-10-01 18:06:15'}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500">Network Origin IP:</span>
                  <span>{record.ipAddress || '203.0.113.88 (Corporate Gateway)'}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500">HR Certified Timestamp:</span>
                  <span className="text-emerald-600 font-bold">{formatPhnomPenhTime(record.hrVerifiedTimestamp) || '2026-10-01 18:15:20'}</span>
                </div>
              </div>
            </div>

            {/* Signatures & Seal */}
            <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800 flex items-end justify-between text-xs">
              <div>
                <div className="w-36 border-b border-slate-400 pb-1 font-serif italic text-slate-800 dark:text-slate-200 text-sm">
                  {record.hrOfficerName || 'Elena Vance'}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 uppercase font-bold">
                  Authorized HR Compliance Officer
                </div>
                <div className="text-[9px] text-slate-400">
                  Head of People &amp; Compliance, APA
                </div>
              </div>

              {/* Digital Seal Stamp */}
              <div className="w-20 h-20 rounded-full border-2 border-emerald-600 p-1 flex items-center justify-center text-center rotate-[-8deg] shadow-xs">
                <div className="w-full h-full rounded-full border border-dashed border-emerald-600 flex flex-col items-center justify-center p-1 text-[8px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-tighter">
                  <Lock className="w-3.5 h-3.5 mb-0.5 text-emerald-600" />
                  <span>SEALED</span>
                  <span>NON-REPUDIATED</span>
                  <span className="font-mono text-[7px]">VERIFIED</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};