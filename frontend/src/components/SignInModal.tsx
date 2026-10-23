import React, { useState } from 'react';
import { User } from '../types';
import { APP_LOGO, APP_TITLE } from '../utils/appIdentity';
import { Lock, Mail, Key, ShieldCheck, X, AlertCircle, ArrowRight, UserCheck } from 'lucide-react';

interface SignInModalProps {
  users: User[];
  onClose: () => void;
  onSignIn: (user: User) => void;
}

export const SignInModal: React.FC<SignInModalProps> = ({
  users,
  onClose,
  onSignIn,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanIdentifier = email.trim().toLowerCase();
    const matchedUser = users.find(
      (u) =>
        u.email.toLowerCase() === cleanIdentifier ||
        (u.username && u.username.toLowerCase() === cleanIdentifier)
    );

    if (!matchedUser) {
      setErrorMsg('No user account found matching this email or username. Please check your credentials or contact HR.');
      return;
    }

    if (matchedUser.status === 'suspended') {
      setErrorMsg('This account has been suspended by system administrators.');
      return;
    }

    // If user has a password set, verify it (default fallback to 'password123')
    const requiredPassword = matchedUser.password || 'password123';
    if (password !== requiredPassword) {
      setErrorMsg('Incorrect password. Please verify your password and try again.');
      return;
    }

    // Authenticate user
    onSignIn(matchedUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 apa-rise-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 font-black text-xs tracking-tight">
              {APP_LOGO}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Sign In to {APP_TITLE}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official Company Guidelines &amp; Staff Sign-off
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
        <form onSubmit={handleLogin} className="p-4 sm:p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Work Email or Username:
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. yourname@apa.internal or yourname"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Password / Security Passcode:
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your security passcode"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 transition-all"
          >
            <span>Sign In to Account</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
