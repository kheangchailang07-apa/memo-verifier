import React from 'react';
import { APP_TITLE } from '../utils/appIdentity';

interface SplashScreenProps {
  status?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  status = 'Establishing secure session…',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3 bg-slate-900 text-slate-300 apa-fade-in"
      style={{
        backgroundImage: 'radial-gradient(circle at 50% 35%, rgba(99, 102, 241, 0.18), transparent 55%)',
      }}
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 flex items-center justify-center shadow-2xl shadow-indigo-500/40">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-8 h-8"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      </div>

      <p className="text-lg font-extrabold tracking-[0.14em] uppercase text-white mt-1">
        {APP_TITLE}
      </p>
      <p className="text-xs text-slate-400 tracking-wide -mt-1">
        Official Company Guidelines &amp; Staff Sign-off
      </p>

      <div
        className="w-9 h-9 mt-2 rounded-full border-[3px] border-slate-700 border-t-indigo-500 animate-spin"
        aria-hidden="true"
      />
      <p className="text-[11px] text-slate-500 tracking-[0.08em]">{status}</p>
    </div>
  );
};
