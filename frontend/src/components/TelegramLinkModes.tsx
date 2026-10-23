import React, { useEffect, useState } from 'react';
import { Loader2, QrCode } from 'lucide-react';

interface TelegramLinkModesProps {
  /** Builds the t.me deep link that the QR code encodes. */
  resolveUrl: () => Promise<string>;
  /** Fired when the QR panel opens - start waiting for the handshake there. */
  onQrActive?: () => void;
  /** Fired when the QR panel is dismissed in favour of the link button. */
  onLinkActive?: () => void;
  /** When this changes, the QR panel closes (used after a link completes). */
  resetSignal?: unknown;
  /** Hides the QR button and panel completely — used once already linked. */
  hideQr?: boolean;
  /** The link action button — this is what the Link button runs. */
  children: React.ReactNode;
  layout?: 'inline' | 'stack';
  className?: string;
  panelClassName?: string;
  qrCaption?: string;
  qrLabel?: string;
}

const qrImageSrc = (url: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;

/**
 * Two ways to connect Telegram, offered everywhere a link is made:
 * [LINK Telegram]  → runs the link handshake (opens the deep link / starts waiting)
 * [QR]             → shows the QR code for the same deep link to scan
 */
export const TelegramLinkModes: React.FC<TelegramLinkModesProps> = ({
  resolveUrl,
  onQrActive,
  onLinkActive,
  resetSignal,
  hideQr = false,
  children,
  layout = 'stack',
  className = '',
  panelClassName = '',
  qrCaption = 'Scan with your phone camera, then press Start in Telegram.',
  qrLabel = 'QR',
}) => {
  const [qrOpen, setQrOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  // A finished handshake closes the QR panel.
  useEffect(() => {
    setQrOpen(false);
  }, [resetSignal]);

  // Once linked there is nothing left to scan, so the QR option disappears.
  useEffect(() => {
    if (hideQr) {
      setQrOpen(false);
      setError(null);
    }
  }, [hideQr]);

  const toggleQr = async () => {
    if (qrOpen) {
      setQrOpen(false);
      setError(null);
      return;
    }
    setQrOpen(true);
    setError(null);
    setIsResolving(true);
    try {
      const resolved = await resolveUrl();
      setUrl(resolved);
      setIsResolving(false);
      onQrActive?.();
    } catch (err) {
      setUrl(null);
      setError(err instanceof Error ? err.message : 'Unable to build the QR code.');
      setIsResolving(false);
    }
  };

  // Clicking the Link button hands control back to the caller's action.
  const dismissQr = () => {
    if (!qrOpen) return;
    setQrOpen(false);
    setError(null);
    onLinkActive?.();
  };

  const qrButtonClass = `shrink-0 self-stretch inline-flex items-center justify-center gap-1.5 px-3 rounded-xl border text-xs font-bold transition-colors ${
    qrOpen
      ? 'bg-sky-600 border-sky-600 text-white'
      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
  }`;

  const qrPanel = (
    <div
      className={`rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 flex flex-col items-center gap-2 ${panelClassName}`}
    >
      {error ? (
        <div className="text-[11px] text-rose-600 dark:text-rose-400 text-center leading-snug py-3 px-2">
          {error}
        </div>
      ) : isResolving || !url ? (
        <div className="flex items-center gap-2 text-[11px] text-slate-500 py-6">
          <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
          <span>Preparing QR code…</span>
        </div>
      ) : (
        <>
          <img
            src={qrImageSrc(url)}
            alt="Telegram link QR code"
            className="w-44 h-44 rounded-lg bg-white p-1 border border-slate-200 dark:border-slate-700"
          />
          <span className="text-[10px] text-slate-500 dark:text-slate-400 text-center leading-snug">
            {qrCaption}
          </span>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline break-all text-center"
          >
            {url}
          </a>
        </>
      )}
    </div>
  );

  return (
    <div
      className={`${layout === 'inline' ? 'relative flex items-center gap-2' : 'flex flex-col gap-2'} ${className}`}
    >
      <div
        className={`flex items-stretch gap-2 ${layout === 'inline' ? '' : 'w-full'}`}
        onClickCapture={dismissQr}
      >
        <div className={layout === 'inline' ? '' : 'flex-1'}>{children}</div>
        {!hideQr && (
          <button
            type="button"
            onClick={() => void toggleQr()}
            className={qrButtonClass}
            title="Show a QR code to scan with your phone"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>{qrLabel}</span>
          </button>
        )}
      </div>

      {!hideQr && qrOpen && qrPanel}
    </div>
  );
};

export default TelegramLinkModes;
