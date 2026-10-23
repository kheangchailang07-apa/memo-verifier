import React, { useState } from 'react';
import { Memo, User, AcknowledgementRecord, StatusScheme, TelegramBotSettings } from '../types';
import { authService, linkTelegramService } from '../utils/services';
import { buildAcknowledgementProofPdf, downloadAcknowledgementPdf, MISSING_SIGNATURE_MESSAGE } from '../utils/pdfExport';
import { TelegramLinkModes } from './TelegramLinkModes';
import { SignatureCaptureModal } from './SignatureCaptureModal';
import { SignaturePanel } from './SignaturePanel';
import {
  ShieldAlert,
  Send,
  CheckCircle2,
  Copy,
  Bot,
  Info,
  Lock,
  ArrowRight,
  X,
  Zap,
  QrCode,
  Smartphone,
  Check,
  Link2,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Download,
  FileText,
  Paperclip,
  PenLine,
  RefreshCw,
} from 'lucide-react';

// Dev-only "Simulate Sent" shortcut — kept out of the production UI.
const SHOW_SIMULATOR = false;

interface AcknowledgeModalProps {
  memo: Memo;
  currentUser: User;
  existingAck?: AcknowledgementRecord;
  scheme: StatusScheme;
  botSettings: TelegramBotSettings;
  onClose: () => void;
  onSaveAcknowledgement: (ack: AcknowledgementRecord) => void | Promise<void>;
  onTelegramHandleSaved?: (updated: User) => void;
  onSignatureSaved?: (updated: User) => void;
  onOpenTelegramTest?: () => void;
}

export const AcknowledgeModal: React.FC<AcknowledgeModalProps> = ({
  memo,
  currentUser,
  existingAck,
  scheme,
  botSettings,
  onClose,
  onSaveAcknowledgement,
  onTelegramHandleSaved,
  onSignatureSaved,
  onOpenTelegramTest,
}) => {
  const [step, setStep] = useState<1 | 2>(existingAck?.status === 'Submitted' ? 2 : 1);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [showTelegramSetup, setShowTelegramSetup] = useState(false);
  const [isLinkingTelegram, setIsLinkingTelegram] = useState(false);
  const [linkingError, setLinkingError] = useState<string | null>(null);
  const linkPollRef = React.useRef<number | null>(null);

  // The proof PDF that the staff member attaches to the Telegram message.
  const [proofFile, setProofFile] = useState<{ fileName: string; blobUrl: string } | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  // Telegram stays locked until the proof PDF has actually been saved locally.
  const [hasDownloadedProof, setHasDownloadedProof] = useState(false);

  // Generate or reuse token
  const [token] = useState<string>(() => {
    if (existingAck?.verificationToken) return existingAck.verificationToken;
    const randomHex = Math.floor(1000 + Math.random() * 9000).toString();
    return `ACK-2026-${randomHex}`;
  });

  // The electronic signature is an option: the staff member may sign the memo
  // with the artwork on their account or acknowledge it without one. The URL of
  // the artwork is stored with the acknowledgement either way it is used.
  const [useElectronicSignature, setUseElectronicSignature] = useState(true);
  const signatureUrl = currentUser.signatureUrl || null;
  const hasSignatureOnFile = Boolean(currentUser.signatureDataUrl || signatureUrl);
  const signatureIsApplied = useElectronicSignature && hasSignatureOnFile;

  // t.me deep links only accept usernames, never numeric chat ids, so the
  // stored HR value is used as-is only when it parses as a real username.
  const TELEGRAM_USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{2,31}$/;
  const asUsername = (value?: string | null): string => {
    const trimmed = (value || '').trim().replace(/^@/, '');
    return TELEGRAM_USERNAME_PATTERN.test(trimmed) ? trimmed : '';
  };

  const handleForMessage = currentUser.telegramHandle || '';
  const missingTelegramHandle = !asUsername(handleForMessage);

  // The staff member's electronic signature, embedded in the proof PDF.
  // It is only applied when the option is switched on in step 1.
  const signature = signatureIsApplied && currentUser.signatureDataUrl
    ? { dataUrl: currentUser.signatureDataUrl }
    : null;

  // Signature capture (draw or upload) reachable straight from this dialog.
  const [isSignatureCaptureOpen, setIsSignatureCaptureOpen] = useState(false);
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const [signatureError, setSignatureError] = useState<string | null>(null);

  /** Stores the new signature on the account and refreshes the proof PDF. */
  const handleSaveSignature = async (dataUrl: string, fileName: string) => {
    setIsSavingSignature(true);
    setSignatureError(null);
    try {
      const updated = await authService.updateProfile({
        signatureDataUrl: dataUrl,
        signatureFileName: fileName,
      });
      onSignatureSaved?.(updated as unknown as User);
      // The proof PDF already carries the old artwork — rebuild it so the
      // downloaded file matches the signature that was just stored.
      if (proofFile) {
        generateProofPdf(buildRecord('Submitted'), useElectronicSignature ? { dataUrl } : null);
        setHasDownloadedProof(false);
      }
    } catch (err) {
      setSignatureError(
        err instanceof Error && err.message
          ? err.message
          : 'The signature could not be saved. Please try again.'
      );
    } finally {
      setIsSavingSignature(false);
    }
  };

  /** Removes the stored signature from the account. */
  const handleRemoveSignature = async () => {
    setIsSavingSignature(true);
    setSignatureError(null);
    try {
      const updated = await authService.updateProfile({
        signatureDataUrl: null,
        signatureFileName: null,
      });
      onSignatureSaved?.(updated as unknown as User);
      if (proofFile) {
        generateProofPdf(buildRecord('Submitted'), null);
        setHasDownloadedProof(false);
      }
    } catch (err) {
      setSignatureError(
        err instanceof Error && err.message
          ? err.message
          : 'The signature could not be removed. Please try again.'
      );
    } finally {
      setIsSavingSignature(false);
    }
  };

  const nowUtc = () => new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  // Plain-text message the staff member sends to HR — the proof PDF travels
  // as a separate attachment inside Telegram.
  const buildTelegramMessage = (handle: string) => {
    const lines = [
      '🔐 [APA COMPLIANCE DISPATCH]',
      `Employee: ${currentUser.name} (${currentUser.jobTitle})`,
      `Staff ID: ${currentUser.id}`,
      `Telegram: ${handle}`,
      `Memo Number: ${memo.memoNumber}`,
      `Subject: ${memo.title}`,
      `Verification Token: ${token}`,
      `Timestamp: ${nowUtc()}`,
    ];
    if (proofFile) {
      lines.push(`Attached: ${proofFile.fileName} (Acknowledgement Proof PDF)`);
    }
    lines.push(
      'Declaration: I verify that I have personally read, understood, and acknowledged this memo. The attached proof PDF is my signed acknowledgement of record.'
    );
    return lines.join('\n');
  };

  const formattedTelegramMessage = buildTelegramMessage(handleForMessage);

  const hrReceiver = (botSettings.hrOfficerUsername || botSettings.hrOfficerTelegram || '').trim() || 'Not configured';
  // The manual deep link must reach the HR officer personally, so prefer the
  // captured @username over a numeric chat id (which t.me cannot resolve).
  const hrUsername = asUsername(botSettings.hrOfficerUsername) || asUsername(botSettings.hrOfficerTelegram);
  const cleanBotTelegram = asUsername(botSettings.botUsername) || 'Duty_t_bot';
  // Target of the button: HR directly when a username is known, otherwise the
  // bot (the only handle guaranteed to resolve).
  const deepLinkTarget = hrUsername || cleanBotTelegram;

  // Telegram Web and Deep Link URLs
  const telegramWebUrl = `https://t.me/${deepLinkTarget}?text=${encodeURIComponent(formattedTelegramMessage)}`;

  // Public QR Code generator URL for mobile phone camera scanning
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(telegramWebUrl)}`;

  // Staff without a linked Telegram account cannot be bound to the out-of-band
  // proof, so the ping is held back until they link via Telegram.
  const openTelegramSetup = () => {
    setShowTelegramSetup(true);
  };

  // Closing the popup abandons any handshake still in flight.
  const closeTelegramSetup = () => {
    if (linkPollRef.current !== null) {
      window.clearTimeout(linkPollRef.current);
      linkPollRef.current = null;
    }
    setIsLinkingTelegram(false);
    setLinkingError(null);
    setShowTelegramSetup(false);
  };

  // The t.me deep link encoded by the QR mode of the same dialog.
  const resolveLinkUrl = async (): Promise<string> => {
    const { link } = await linkTelegramService.me();
    if (!link.url) throw new Error('No Telegram link available yet — try again in a moment.');
    return link.url;
  };

  // Polls until the /start <code> deep link back-reports the user's Telegram
  // chat, then adopts the handle and closes the dialog.
  // openTab: false is the QR path - the phone scans the code instead.
  const linkTelegramAccount = async (openTab: boolean = true) => {
    if (isLinkingTelegram) return;
    setLinkingError(null);
    try {
      const { link } = await linkTelegramService.me();
      if (link.status === 'linked') {
        setShowTelegramSetup(false);
        return;
      }
      if (openTab) window.open(link.url, '_blank', 'noopener');
      setIsLinkingTelegram(true);

      let attempts = 0;
      const tick = async () => {
        attempts += 1;
        try {
          const check = await linkTelegramService.check();
          if (check.status === 'linked') {
            const adoptedHandle = check.user?.telegramHandle || check.link?.telegramUsername || '';
            if (adoptedHandle && onTelegramHandleSaved) {
              onTelegramHandleSaved({ ...currentUser, telegramHandle: adoptedHandle } as User);
            }
            setShowTelegramSetup(false);
            setIsLinkingTelegram(false);
            return;
          }
        } catch {
          // Transient poll failure — keep waiting until the timeout budget is spent.
        }
        if (attempts >= 30) {
          setIsLinkingTelegram(false);
          setLinkingError('Linking timed out. Keep the Telegram tab open and try again.');
          return;
        }
        linkPollRef.current = window.setTimeout(tick, 2000);
      };
      linkPollRef.current = window.setTimeout(tick, 2000);
    } catch (err) {
      setLinkingError(err instanceof Error ? err.message : 'Unable to start Telegram linking.');
    }
  };

  // Clear any in-flight polling when the dialog/user disappears.
  React.useEffect(() => {
    return () => {
      if (linkPollRef.current !== null) window.clearTimeout(linkPollRef.current);
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedTelegramMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Shared acknowledgement payload for every save (step 1, proof, final submit).
  const buildRecord = (
    status: AcknowledgementRecord['status'],
    extra?: Partial<AcknowledgementRecord>
  ): AcknowledgementRecord => ({
    id: existingAck?.id || `ACK-${Date.now()}`,
    memoId: memo.id,
    memoNumber: memo.memoNumber,
    memoTitle: memo.title,
    staffId: currentUser.id,
    staffName: currentUser.name,
    staffEmail: currentUser.email,
    department: currentUser.department,
    staffTelegramHandle: handleForMessage,
    status,
    verificationToken: token,
    portalTimestamp: existingAck?.portalTimestamp || nowUtc(),
    ipAddress: '198.51.100.15 (Corporate Gateway)',
    // The electronic signature option and the URL of the artwork that is
    // stored with this acknowledgement.
    signatureApplied: signatureIsApplied,
    signatureUrl: signatureIsApplied ? signatureUrl : null,
    ...extra,
  });

  // Renders the proof of acknowledgement. The file is only written to the
  // device when the staff member presses "Download the PDF" — the Telegram
  // hand-over stays locked until that happened.
  const generateProofPdf = (
    record: AcknowledgementRecord,
    sig: { dataUrl: string } | null = signature
  ) => {
    setIsGeneratingProof(true);
    setProofError(null);
    try {
      const result = buildAcknowledgementProofPdf(record, 'APA', sig);
      setProofFile(result);
    } catch (err) {
      setProofError(
        err instanceof Error && err.message
          ? err.message
          : 'The proof PDF could not be generated. Please try again.'
      );
    } finally {
      setIsGeneratingProof(false);
    }
  };

  const downloadProofPdf = () => {
    if (!proofFile) return;
    try {
      downloadAcknowledgementPdf(proofFile);
      setHasDownloadedProof(true);
    } catch (err) {
      setProofError(
        err instanceof Error && err.message ? err.message : 'The proof PDF could not be saved.'
      );
    }
  };

  // The hand-over to Telegram is only unlocked once the PDF sits on the device.
  const proofReady = Boolean(proofFile) && hasDownloadedProof;

  const handleStep1Submit = () => {
    if (!hasAgreed) return;

    const record = buildRecord('Submitted');
    void onSaveAcknowledgement(record);
    // The PDF is the proof of the acknowledgement — generate it right away so
    // the staff member only has to attach it to the Telegram message.
    generateProofPdf(record);
    setStep(2);
  };

  const handleSimulateTelegramSent = () => {
    void onSaveAcknowledgement(
      buildRecord('In Review', {
        telegramSentTimestamp: nowUtc(),
        telegramMessageSnippet: formattedTelegramMessage.split('\n')[0] + ' ... Token: ' + token,
      })
    );
  };

  // The modal may only be closed once the verification actually reached HR,
  // either in this session or on an earlier visit to Step 2. Opening the
  // pre-filled Telegram compose link counts too — the staff member sends the
  // message with the attached proof PDF manually.
  const [openedInTelegram, setOpenedInTelegram] = useState(false);
  const proofShared =
    Boolean(existingAck?.telegramSentTimestamp) || openedInTelegram;

  // Final action of the dialog: persist the acknowledgement server-side, then
  // close so the staff member can review the resulting status in My Memo.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleDoneAndSubmit = async () => {
    if (isSubmitting || !proofShared) return;
    setIsSubmitting(true);
    try {
      await onSaveAcknowledgement(
        buildRecord('In Review', {
          telegramSentTimestamp: existingAck?.telegramSentTimestamp || nowUtc(),
          telegramMessageSnippet:
            existingAck?.telegramMessageSnippet ||
            formattedTelegramMessage.split('\n')[0] + ' ... Token: ' + token,
        })
      );
      onClose();
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Unknown error';
      setProofError(`Acknowledgement submit failed: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 apa-rise-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300">
                {memo.memoNumber}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                {memo.priority} Acknowledgement
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-2 leading-snug">
            {memo.title}
          </h2>

          {/* Stepper indicator */}
          <div className="mt-4 flex items-center gap-2 text-xs">
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold ${
                step === 1
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              }`}
            >
              {step > 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>1</span>}
              <span>Phase 1: In-System Sign-off</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold ${
                step === 2
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <span>2</span>
              <span>Phase 2: Send Proof to HR via Telegram</span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[calc(85vh-180px)] overflow-y-auto">
          {step === 1 ? (
            /* STEP 1: Portal declaration */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs space-y-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Memo Executive Summary:
                </span>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {memo.summary}
                </p>
              </div>

              {/* Employee Authenticated Profile */}
              <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 text-xs">
                <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-300 font-semibold mb-2">
                  <Lock className="w-4 h-4 text-indigo-600" />
                  <span>Your Authenticated Signer Profile:</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="text-slate-400 block text-[10px]">FULL NAME:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{currentUser.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">EMPLOYEE ID:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{currentUser.id}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">DEPARTMENT:</span>
                    <span className="text-slate-700 dark:text-slate-300">{currentUser.department}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">VERIFIED TELEGRAM:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sky-600 dark:text-sky-400 font-semibold">
                        {currentUser.telegramHandle || 'Not linked'}
                      </span>
                      {onOpenTelegramTest && (
                        <button
                          type="button"
                          onClick={onOpenTelegramTest}
                          className="inline-flex items-center gap-1 text-[10px] text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 underline font-semibold"
                          title="Send a test ping to the corporate bot"
                        >
                          <Smartphone className="w-3 h-3" />
                          <span>Test Link</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Anti-Repudiation Notice */}
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Important Compliance Notice Regarding Non-Repudiation:</span>
                </div>
                <p className="leading-relaxed text-amber-800 dark:text-amber-300">
                  Submitting this form records your intent in the system and issues a unique Verification Token. A proof PDF is generated on your device right away — in Step 2 you attach it to a Telegram message addressed to HR.
                </p>
              </div>

              {/* Electronic signature — printed on the proof PDF generated below */}
              <SignaturePanel
                user={currentUser}
                isSaving={isSavingSignature}
                error={signatureError}
                onOpenCapture={() => setIsSignatureCaptureOpen(true)}
                onRemove={() => void handleRemoveSignature()}
              />

              {/* Electronic signature option — the artwork and its URL are recorded */}
              <div
                className={`p-4 rounded-xl border text-xs space-y-2.5 ${
                  signatureIsApplied
                    ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                }`}
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useElectronicSignature}
                    onChange={(e) => setUseElectronicSignature(e.target.checked)}
                    disabled={!hasSignatureOnFile}
                    className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 disabled:opacity-50"
                  />
                  <span className="flex-1">
                    <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <PenLine className="w-3.5 h-3.5 text-indigo-500" />
                      Electronic Signature
                    </span>
                    <span className="block mt-1 leading-relaxed text-slate-600 dark:text-slate-400">
                      {hasSignatureOnFile
                        ? 'Apply the electronic signature on your account to this acknowledgement. The artwork is printed on the proof PDF and its URL is stored in the acknowledgement record.'
                        : 'You have no electronic signature on file yet. Add one below (or in your profile) to sign this memo with your own artwork.'}
                    </span>
                  </span>
                </label>
                {signatureIsApplied && signatureUrl && (
                  <div className="rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-2.5 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Signature URL stored with this acknowledgement
                    </span>
                    <p className="font-mono text-[10px] text-slate-600 dark:text-slate-300 break-all">
                      {signatureUrl}
                    </p>
                  </div>
                )}
                {!signatureIsApplied && (
                  <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
                    Without the electronic signature no proof PDF can be produced. The acknowledgement
                    is still filed, but the document for HR stays locked until you sign.
                  </p>
                )}
              </div>

              {/* Attestation Checkbox */}
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <input
                  type="checkbox"
                  checked={hasAgreed}
                  onChange={(e) => setHasAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
                  I confirm that I have reviewed the full content of{' '}
                  <strong className="text-slate-900 dark:text-white">{memo.memoNumber}</strong>,
                  understand its directives, and acknowledge my compliance responsibility.
                </span>
              </label>

              {/* Step 1 Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStep1Submit}
                  disabled={!hasAgreed}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20"
                >
                  <span>Submit &amp; Generate Token</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: Proof PDF handed over to HR through Telegram */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-start gap-3 text-xs">
                <div className="w-8 h-8 rounded-lg bg-sky-500 text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sky-950 dark:text-sky-200">
                    Step 2: Send Your Acknowledgement Proof to HR
                  </h4>
                  <p className="text-sky-800 dark:text-sky-300 mt-1 leading-relaxed">
                    Your portal status is{' '}
                    <span className="font-semibold px-1.5 py-0.2 rounded bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200">
                      {scheme.labels.submitted}
                    </span>
                    . The proof PDF is ready — download it and{' '}
                    <strong>please send it to HR ({hrReceiver}) via Telegram</strong> by
                    attaching it to the message below.
                  </p>
                </div>
              </div>

              {/* Verification Token Display */}
              <div className="p-4 rounded-xl bg-slate-900 text-white font-mono text-xs space-y-2 border border-slate-800 shadow-inner">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>OFFICIAL AUDIT TOKEN</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Signed in Portal
                  </span>
                </div>
                <div className="text-xl font-bold tracking-widest text-indigo-400 py-1">
                  {token}
                </div>
                <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>Portal Timestamp:</span>
                    <span>{existingAck?.portalTimestamp || 'Recorded Now'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Target HR Receiver:</span>
                    <span className="text-sky-400">
                      {botSettings.hrOfficerUsername || botSettings.hrOfficerTelegram}
                    </span>
                  </div>
                </div>
              </div>

              {/* Electronic signature preview — the same artwork is embedded in the PDF */}
              <SignaturePanel
                user={currentUser}
                isSaving={isSavingSignature}
                error={signatureError}
                onOpenCapture={() => setIsSignatureCaptureOpen(true)}
                onRemove={() => void handleRemoveSignature()}
              />

              {/* Electronic signature — what was recorded with this acknowledgement */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex items-start gap-2.5">
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    signatureIsApplied
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                  }`}
                >
                  <PenLine className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0">
                  <span className="font-bold text-slate-800 dark:text-slate-100 block">
                    {signatureIsApplied
                      ? 'Signed electronically'
                      : 'Acknowledged without an electronic signature'}
                  </span>
                  <span className="block mt-0.5 text-slate-500 dark:text-slate-400 leading-relaxed">
                    {signatureIsApplied
                      ? 'Your artwork is printed on the proof PDF and its URL is stored with this acknowledgement.'
                      : 'No electronic signature was applied, so no proof PDF can be produced for this acknowledgement.'}
                  </span>
                  {signatureIsApplied && signatureUrl && (
                    <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400 break-all mt-1">
                      {signatureUrl}
                    </p>
                  )}
                </div>
              </div>

              {/* Generated proof PDF */}
              {proofFile ? (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-3 ${
                    hasDownloadedProof
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                      : 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0 ${
                        hasDownloadedProof ? 'bg-emerald-500' : 'bg-sky-500'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <h4
                        className={`font-bold ${
                          hasDownloadedProof
                            ? 'text-emerald-900 dark:text-emerald-200'
                            : 'text-sky-950 dark:text-sky-200'
                        }`}
                      >
                        {hasDownloadedProof
                          ? 'Acknowledgement Proof PDF downloaded'
                          : 'Acknowledgement Proof PDF ready'}
                      </h4>
                      <p
                        className={`mt-0.5 leading-relaxed ${
                          hasDownloadedProof
                            ? 'text-emerald-800 dark:text-emerald-300'
                            : 'text-sky-800 dark:text-sky-300'
                        }`}
                      >
                        {hasDownloadedProof
                          ? 'The file is saved on your device. Attach it to the Telegram message you send to HR — it is the proof that you have already acknowledged this memo.'
                          : 'Download the proof file first. The Telegram hand-over unlocks once the PDF is saved on your device.'}
                      </p>
                      <p
                        className={`mt-1.5 font-mono text-[11px] break-all ${
                          hasDownloadedProof
                            ? 'text-emerald-900 dark:text-emerald-200'
                            : 'text-sky-900 dark:text-sky-200'
                        }`}
                      >
                        {proofFile.fileName}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={downloadProofPdf}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{hasDownloadedProof ? 'Download the PDF again' : 'Download the PDF'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => generateProofPdf(buildRecord('Submitted'))}
                      disabled={isGeneratingProof}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-bold shadow-xs transition-colors disabled:opacity-60"
                    >
                      {isGeneratingProof ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Regenerate</span>
                    </button>
                    {hasDownloadedProof && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Saved to your device</span>
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-bold text-amber-900 dark:text-amber-200">
                        No proof PDF yet
                      </h4>
                      <p className="text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                        {signatureIsApplied
                          ? 'Generate the proof of your acknowledgement first — you have to download and attach it to the Telegram message you send to HR.'
                          : 'No electronic signature was applied, so no proof PDF can be produced. Go back to step 1, apply your electronic signature and submit again.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => generateProofPdf(buildRecord('Submitted'))}
                    disabled={isGeneratingProof || !signatureIsApplied}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-[11px] font-bold shadow-xs transition-colors"
                    title={signatureIsApplied ? undefined : MISSING_SIGNATURE_MESSAGE}
                  >
                    {isGeneratingProof ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                    <span>{isGeneratingProof ? 'Generating…' : 'Generate Proof PDF'}</span>
                  </button>
                </div>
              )}

              {proofError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{proofError}</span>
                </div>
              )}

              {/* Blocked state: no Telegram username bound to this account */}
              {missingTelegramHandle && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span className="flex-1">
                    Telegram isn&rsquo;t linked to your account, so the proof cannot be traced back
                    to you. Link it first, then send the message with the attached PDF.
                  </span>
                  <button
                    type="button"
                    onClick={openTelegramSetup}
                    className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold shadow-xs transition-colors"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Link Telegram</span>
                  </button>
                </div>
              )}

              {/* How to send the proof to HR */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                  How to send the proof to HR:
                </span>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                  <li>
                    Press{' '}
                    <strong className="text-slate-800 dark:text-slate-200">Download the PDF</strong>{' '}
                    above — the file is saved on your device.
                  </li>
                  <li>
                    Press <strong className="text-slate-800 dark:text-slate-200">Open in Telegram</strong>{' '}
                    (or scan the QR code with your phone) — the message below opens pre-filled.
                  </li>
                  <li>
                    Attach the PDF{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {proofFile ? proofFile.fileName : 'generated above'}
                    </strong>{' '}
                    with the paperclip in the Telegram chat, then send it to {hrReceiver}.
                  </li>
                  <li>
                    Press <strong className="text-slate-800 dark:text-slate-200">Done</strong> below.
                  </li>
                </ol>
              </div>

              {/* 1-Click Telegram App Opener & QR Code Switcher — unlocked after the download */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1-Click Telegram App Opener */}
                <button
                  type="button"
                  onClick={() => {
                    if (!proofReady) return;
                    window.open(telegramWebUrl, '_blank', 'noopener,noreferrer');
                    setOpenedInTelegram(true);
                  }}
                  disabled={!proofReady}
                  title={
                    proofReady
                      ? 'Open Telegram with the verification message pre-filled'
                      : 'Download the proof PDF first — the Telegram hand-over unlocks after that'
                  }
                  className={`py-3 px-4 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all text-center ${
                    proofReady
                      ? 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>Open in Telegram</span>
                  {proofReady && <ExternalLink className="w-3.5 h-3.5 opacity-80" />}
                </button>

                {/* QR Code Toggle for Mobile Users */}
                <button
                  type="button"
                  onClick={() => {
                    if (!proofReady) return;
                    setShowQrCode(!showQrCode);
                  }}
                  disabled={!proofReady}
                  title={
                    proofReady
                      ? 'Show a QR code to scan with your phone'
                      : 'Download the proof PDF first — the Telegram hand-over unlocks after that'
                  }
                  className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all text-center ${
                    proofReady
                      ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                  }`}
                >
                  <QrCode className="w-4 h-4 text-indigo-500" />
                  <span>{showQrCode ? 'Hide QR Code' : 'Scan QR on Mobile Phone'}</span>
                </button>
              </div>

              {!proofReady && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {proofFile
                      ? 'Download the proof PDF to unlock the Telegram hand-over.'
                      : 'Generate and download the proof PDF to unlock the Telegram hand-over.'}
                  </span>
                </p>
              )}

              {/* Collapsible QR Code Display */}
              {showQrCode && (
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-dashed border-indigo-300 dark:border-indigo-700 flex flex-col items-center justify-center text-center space-y-2 apa-fade-in">
                  <div className="p-2 bg-white rounded-xl shadow-xs border">
                    <img
                      src={qrCodeUrl}
                      alt="Telegram Deep Link QR Code"
                      className="w-36 h-36 object-contain"
                    />
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1">
                      <Smartphone className="w-3.5 h-3.5 text-sky-500" />
                      Scan with your phone camera
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Opens Telegram directly on your smartphone with the message pre-filled.
                    </p>
                  </div>
                </div>
              )}

              {/* Pre-Formatted Telegram Message Box with Copy */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <span>Pre-Formatted Telegram Message:</span>
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied to Clipboard!' : 'Copy Text'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-[11px] text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap border border-slate-200 dark:border-slate-700">
                  {formattedTelegramMessage}
                </pre>
              </div>

              {/* Quick Simulator Tool — hidden from the live UI */}
              {SHOW_SIMULATOR && (
                <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-3">
                  <div className="text-xs">
                    <span className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      Applet Test Simulator:
                    </span>
                    <span className="text-[11px] text-indigo-700 dark:text-indigo-400">
                      Simulate instant Telegram message receipt by HR Bot
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSimulateTelegramSent}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shrink-0 shadow-xs"
                  >
                    Simulate Sent
                  </button>
                </div>
              )}

              {/* Bottom Actions */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  &larr; Back to Step 1
                </button>
                <div className="flex flex-col items-end gap-1.5">
                  {!proofShared && (
                    <span className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5 text-right">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {proofReady ? (
                          <>
                            Press <strong>&ldquo;Open in Telegram&rdquo;</strong> above, attach the
                            proof PDF and send it — then you can finish.
                          </>
                        ) : (
                          <>
                            Download the proof PDF first — then the Telegram hand-over unlocks.
                          </>
                        )}
                      </span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDoneAndSubmit()}
                    disabled={!proofShared || isSubmitting}
                    title={
                      !proofShared
                        ? 'Send the proof PDF to HR through Telegram first'
                        : isSubmitting
                        ? 'Submitting your acknowledgement…'
                        : 'Submit your acknowledgement, then review its status'
                    }
                    className={`px-4 py-2 rounded-xl font-semibold text-xs shadow-xs transition-colors inline-flex items-center gap-1.5 ${
                      proofShared
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isSubmitting ? 'Submitting…' : 'Done (Check Status)-submit'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Link Telegram required popup — binds the account before the proof is sent */}
      {showTelegramSetup && (
        <div className="absolute inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-start gap-3">
              <span className="p-2 rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400 shrink-0">
                <Link2 className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Link Telegram required
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Your Telegram account isn&rsquo;t connected, so the proof cannot be traced back
                  to you.
                </p>
              </div>
              <button
                type="button"
                onClick={closeTelegramSetup}
                aria-label="Close"
                title="Close"
                className="ml-auto p-1.5 -m-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 p-3.5 text-xs text-slate-600 dark:text-slate-300">
                <p className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-1.5">
                  <Link2 className="w-3.5 h-3.5 text-sky-500" />
                  How to link
                </p>
                <p className="leading-relaxed">
                  Pick <strong>Link</strong> to open Telegram on this device, or{' '}
                  <strong>QR Code</strong> to scan it with your phone camera.
                  <br />
                  1. Continue in the Telegram tab (or on your phone after scanning).
                  <br />
                  2. Press <strong>Start</strong>.
                  <br />
                  3. Your account binds automatically — then send the proof PDF to HR.
                </p>
              </div>

              {linkingError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{linkingError}</span>
                </div>
              )}

              <TelegramLinkModes
                layout="stack"
                resolveUrl={resolveLinkUrl}
                onQrActive={() => void linkTelegramAccount(false)}
                qrCaption="Scan with your phone camera, then press Start in Telegram."
              >
                <button
                  type="button"
                  onClick={() => void linkTelegramAccount(true)}
                  disabled={isLinkingTelegram}
                  className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-70 disabled:cursor-wait text-white text-xs font-bold transition-all inline-flex items-center justify-center gap-2"
                >
                  {isLinkingTelegram ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4" />
                  )}
                  <span>{isLinkingTelegram ? 'Waiting for Telegram…' : 'Link Telegram'}</span>
                </button>
              </TelegramLinkModes>
            </div>
          </div>
        </div>
      )}

      {/* Signature capture — draw it or upload a Canva export. */}
      <SignatureCaptureModal
        open={isSignatureCaptureOpen}
        onClose={() => setIsSignatureCaptureOpen(false)}
        onSave={handleSaveSignature}
        initialDataUrl={currentUser.signatureDataUrl || null}
        initialFileName={currentUser.signatureFileName || ''}
        ownerName={currentUser.name}
      />
    </div>
  );
};
