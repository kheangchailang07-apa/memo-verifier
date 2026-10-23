import React from 'react';
import { User } from '../types';
import { signatureImageSrc } from '../utils/signature';
import { AlertTriangle, CheckCircle2, Loader2, PenLine, Trash2 } from 'lucide-react';

interface SignaturePanelProps {
  user: User;
  /** True while the signature is being written to the server. */
  isSaving: boolean;
  error: string | null;
  /** Opens the draw / upload capture dialog. */
  onOpenCapture: () => void;
  /** Removes the stored signature from the account. */
  onRemove: () => void;
}

/**
 * Electronic signature card. It shows the stored artwork, offers the capture
 * dialog (draw or upload a Canva export) and reports the save state.
 */
export const SignaturePanel: React.FC<SignaturePanelProps> = ({
  user,
  isSaving,
  error,
  onOpenCapture,
  onRemove,
}) => {
  // The artwork is served by this app; the URL that is stored in the database
  // is absolute, so only its path is used to load the picture.
  const imageSrc = user.signatureUrl
    ? signatureImageSrc(user.signatureUrl)
    : user.signatureDataUrl || '';
  const hasSignature = Boolean(imageSrc);

  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
          <PenLine className="w-3.5 h-3.5 text-indigo-500" />
          Electronic Signature
        </span>
        {hasSignature ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>On file</span>
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">Not set</span>
        )}
      </div>

      {hasSignature ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3">
          <div className="h-16 flex items-center justify-center">
            <img
              src={imageSrc}
              alt={`Electronic signature of ${user.name}`}
              className="max-h-16 max-w-full object-contain"
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-2 text-center">
            Signed electronically by {user.name} — this signature is embedded in the proof PDF.
          </p>
          {user.signatureUrl && (
            <p className="font-mono text-[10px] text-slate-400 mt-1 text-center break-all">
              {user.signatureUrl}
            </p>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          No electronic signature on file yet. Add one now — draw it below or upload a PNG exported
          from Canva — and it is embedded into the proof PDF.
        </p>
      )}

      {error && (
        <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onOpenCapture}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-[11px] font-bold shadow-xs transition-colors"
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <PenLine className="w-3.5 h-3.5" />
          )}
          <span>{hasSignature ? 'Replace signature' : 'Add signature'}</span>
        </button>
        {hasSignature && (
          <button
            type="button"
            onClick={onRemove}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 text-[11px] font-bold transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove</span>
          </button>
        )}
        <span className="text-[10px] text-slate-400">Draw it, or upload a PNG/JPEG from Canva.</span>
      </div>
    </div>
  );
};
