import React, { useState } from 'react';
import { User, Department } from '../types';
import { authService } from '../utils/services';
import { normalizeSignatureImage } from '../utils/signature';
import { SignatureCaptureModal } from './SignatureCaptureModal';
import {
  X,
  AlertCircle,
  Save,
  User as UserIcon,
  KeyRound,
  PenLine,
  Upload,
  Trash2,
  Loader2,
} from 'lucide-react';

interface EditProfileModalProps {
  user: User;
  departments?: Department[];
  onClose: () => void;
  onSaved: (updated: User) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ user, departments = [], onClose, onSaved }) => {
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username || '');
  const [telegramHandle, setTelegramHandle] = useState(user.telegramHandle || '');
  const [jobTitle, setJobTitle] = useState(user.jobTitle || '');
  const [department, setDepartment] = useState(user.department || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Electronic signature image (a PNG/JPEG exported from a signature tool).
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(
    user.signatureDataUrl || null
  );
  const [signatureFileName, setSignatureFileName] = useState<string>(
    user.signatureFileName || ''
  );
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const [isProcessingSignature, setIsProcessingSignature] = useState(false);
  const [isSignatureCaptureOpen, setIsSignatureCaptureOpen] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const isChangingPassword = newPassword.length > 0 || confirmPassword.length > 0;

  // Picks the signature artwork, trims the blank border and keeps a preview.
  const handleSignatureFile = async (file?: File) => {
    if (!file) return;
    setSignatureError(null);
    setIsProcessingSignature(true);
    try {
      const normalized = await normalizeSignatureImage(file);
      setSignatureDataUrl(normalized.dataUrl);
      setSignatureFileName(normalized.fileName);
    } catch (err) {
      setSignatureError(
        err instanceof Error && err.message
          ? err.message
          : 'The signature image could not be processed.'
      );
    } finally {
      setIsProcessingSignature(false);
    }
  };

  const clearSignature = () => {
    setSignatureDataUrl(null);
    setSignatureFileName('');
    setSignatureError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavedMessage(null);

    if (!name.trim()) {
      setErrorMsg('Full name cannot be empty.');
      return;
    }
    if (isChangingPassword) {
      if (!currentPassword) {
        setErrorMsg('Enter your current password to change it.');
        return;
      }
      if (newPassword.length < 8) {
        setErrorMsg('New password must be at least 8 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('New password and confirmation do not match.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload: Parameters<typeof authService.updateProfile>[0] = {
        name: name.trim(),
        username: username.trim(),
        telegramHandle: telegramHandle.trim(),
        jobTitle: jobTitle.trim(),
        department: department.trim(),
        signatureDataUrl,
        signatureFileName: signatureDataUrl ? signatureFileName : null,
      };
      if (isChangingPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const updated = await authService.updateProfile(payload);
      setSavedMessage('Profile updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onSaved(updated as unknown as User);
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : 'Could not save your profile. Please try again.';
      setErrorMsg(message);
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none';
  const labelClass = 'font-semibold text-slate-700 dark:text-slate-300 block mb-1';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 apa-rise-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Edit Profile</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {user.email} &bull; {user.role}
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

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-xs max-h-[70vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {savedMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 text-xs">
              {savedMessage}
            </div>
          )}

          <div>
            <label className={labelClass}>Full Name:</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Username (login handle):</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. sokha"
              className={`${inputClass} font-mono`}
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Used with your password to sign in instead of your email. Leave blank to remove it.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Job Title:</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Department:</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className={inputClass}
              >
                {!departments.some((d) => d.name === department) && department && (
                  <option value={department}>{department}</option>
                )}
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                    {d.isActive ? '' : ' (disabled)'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Telegram Handle:</label>
            <input
              type="text"
              value={telegramHandle}
              onChange={(e) => setTelegramHandle(e.target.value)}
              placeholder="@vanna_chan"
              className={`${inputClass} font-mono`}
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 mb-2">
              <PenLine className="w-3.5 h-3.5 text-indigo-500" />
              <span>Electronic Signature</span>
            </div>
            <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
              Upload a PNG or JPEG of your signature (for example exported from Canva). It is
              embedded into the acknowledgement proof PDF you send to HR.
            </p>

            {signatureError && (
              <div className="mb-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{signatureError}</span>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
              {signatureDataUrl ? (
                <div className="space-y-2">
                  <div className="h-20 flex items-center justify-center">
                    <img
                      src={signatureDataUrl}
                      alt="Your electronic signature"
                      className="max-h-20 max-w-full object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500 truncate">
                      {signatureFileName || 'signature.png'}
                    </span>
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 text-[10px] font-bold shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1.5 py-3 text-center">
                  <PenLine className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                  <span className="text-[10px] text-slate-400">No signature on file yet</span>
                </div>
              )}

              <label className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-xs transition-colors cursor-pointer">
                {isProcessingSignature ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>
                  {isProcessingSignature
                    ? 'Processing…'
                    : signatureDataUrl
                    ? 'Replace image'
                    : 'Upload signature image'}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => void handleSignatureFile(e.target.files?.[0])}
                />
              </label>
              <button
                type="button"
                onClick={() => setIsSignatureCaptureOpen(true)}
                className="mt-2 ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-colors"
              >
                <PenLine className="w-3.5 h-3.5" />
                <span>Draw signature</span>
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 mb-2">
              <KeyRound className="w-3.5 h-3.5 text-amber-500" />
              <span>Change Password (optional)</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Current Password:</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={`${inputClass} font-mono`}
                  autoComplete="current-password"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>New Password:</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`${inputClass} font-mono`}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className={labelClass}>Confirm:</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`${inputClass} font-mono`}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-bold flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving…' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Signature capture — draw it or upload a Canva export. */}
      <SignatureCaptureModal
        open={isSignatureCaptureOpen}
        onClose={() => setIsSignatureCaptureOpen(false)}
        onSave={(dataUrl, fileName) => {
          setSignatureDataUrl(dataUrl);
          setSignatureFileName(fileName);
          setSignatureError(null);
        }}
        initialDataUrl={signatureDataUrl}
        initialFileName={signatureFileName}
        ownerName={user.name}
      />
    </div>
  );
};
