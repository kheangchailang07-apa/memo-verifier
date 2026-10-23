import React from 'react';
import { StatusScheme } from '../types';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Send,
  Clock,
  ArrowRight,
  Bot,
  UserCheck,
  FileCheck,
  Sparkles,
  HelpCircle,
  Eye,
  AlertTriangle,
  Key,
} from 'lucide-react';

const SHOW_SCHEME_SWITCHER = false;

interface WorkflowExplainerProps {
  currentScheme: StatusScheme;
  onSelectScheme: (schemeKey: 'standard' | 'formal') => void;
}

export const WorkflowExplainer: React.FC<WorkflowExplainerProps> = ({
  currentScheme,
  onSelectScheme,
}) => {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Hero Recommendation Header */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 text-white p-6 sm:p-8 rounded-2xl border border-indigo-800/40 shadow-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-3 border border-emerald-400/30">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Strategic Architectural Recommendation</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Status Transparency &amp; Non-Repudiation Telegram Protocol
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed max-w-3xl">
          Your insight is exactly right: <strong>HR does not &ldquo;approve&rdquo; an employee&rsquo;s acknowledgement</strong> (an employee has an obligation to read directives). Instead, HR performs <strong>Identity &amp; Non-Repudiation Receipt Verification</strong> to guarantee that an IT admin or third party did not falsely acknowledge on the staff member&rsquo;s behalf.
        </p>
      </div>

      {/* The Core Problem & The 2-Factor Solution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vulnerability Card */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-rose-200 dark:border-rose-900/40 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            The Credential Spoofing Problem (Repudiation Risk)
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            In standard corporate web portals, database administrators, IT technicians, or malicious actors could theoretically check an acknowledgement box or log in as an employee.
          </p>
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-100 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300">
            <strong>The Resulting Excuse:</strong> An employee who breaches a policy can claim: <em>&ldquo;I never saw or clicked that memo! IT or my manager must have checked it with their master credentials.&rdquo;</em>
          </div>
        </div>

        {/* 2FA Telegram Solution */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            The Out-of-Band Telegram Verification Solution
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            By generating a single-use audit token (e.g. <code className="font-mono text-emerald-600 dark:text-emerald-400">ACK-2026-X841</code>) in the portal and requiring the employee to dispatch it from their personal, 2FA-secured Telegram device to HR, non-repudiation is achieved.
          </p>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-300">
            <strong>The Legal Standard:</strong> IT administrators cannot send messages from the employee&rsquo;s physical smartphone Telegram app. HR matches the token and confirms receipt, creating an airtight audit trail.
          </div>
        </div>
      </div>

      {/* Suggested Status Pipeline Breakdown */}
      <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Recommended Status Lifecycle: &lsquo;Submitted&rsquo; &rarr; &lsquo;In Review&rsquo; &rarr; &lsquo;HR Verified&rsquo; &rarr; &lsquo;Processed&rsquo;
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Why avoid &ldquo;Pending Approval&rdquo;? Because an employee doesn&rsquo;t request approval to comply. Below is the recommended 4-stage progression:
          </p>
        </div>

        {/* 4 Stage Timeline Visual */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Stage 1 */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">STAGE 1</span>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              Action Required (Unacknowledged)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              HR issues the memo. The staff member is notified on the portal and via Telegram channel broadcast.
            </p>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              Portal action pending
            </div>
          </div>

          {/* Stage 2 */}
          <div className="p-4 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-sky-500">STAGE 2</span>
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            </div>
            <h4 className="font-bold text-sm text-sky-950 dark:text-sky-200">
              Submitted (Token Issued)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Staff clicks acknowledge in the web portal. The system issues single-use token <span className="font-mono text-sky-600 dark:text-sky-400">ACK-XXXX</span> and saves the proof PDF on the staff member&rsquo;s device. Awaiting the staff member to send that proof to HR.
            </p>
            <div className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">
              Employee proof PDF to be sent
            </div>
          </div>

          {/* Stage 3 */}
          <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-purple-500">STAGE 3</span>
              <span className="w-2 h-2 rounded-full bg-purple-500" />
            </div>
            <h4 className="font-bold text-sm text-purple-950 dark:text-purple-200">
              In Review (Proof Received)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Staff sends the acknowledgement proof PDF from their Telegram handle to HR. HR receives the inbound message and matches it with the portal record.
            </p>
            <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
              Two factors joined; HR inspecting
            </div>
          </div>

          {/* Stage 4 */}
          <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-emerald-500">STAGE 4</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <h4 className="font-bold text-sm text-emerald-950 dark:text-emerald-200">
              HR Verified / Processed
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              HR Officer confirms token match and signs the verification. The record is permanently locked into the compliance register as non-repudiable.
            </p>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Certified &amp; legally binding
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Scheme Switcher */}
      {SHOW_SCHEME_SWITCHER && (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Choose Active Terminology Scheme for this System
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Switching updates all badges, modals, and tables across the entire app so you can evaluate how each feels:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => onSelectScheme('standard')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              currentScheme.id === 'standard'
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900 dark:text-white">
                Option A: Precision Audit Scheme (Your Preference)
              </span>
              {currentScheme.id === 'standard' && (
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Labels: <code>Action Required</code> &rarr; <code>Submitted</code> &rarr;{' '}
              <code>In Review</code> &rarr; <code>HR Verified</code>
            </p>
          </div>

          <div
            onClick={() => onSelectScheme('formal')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              currentScheme.id === 'formal'
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900 dark:text-white">
                Option B: Corporate Legal Scheme
              </span>
              {currentScheme.id === 'formal' && (
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Labels: <code>Pending Signature</code> &rarr; <code>Token Issued</code> &rarr;{' '}
              <code>Receipt Recorded</code> &rarr; <code>Processed &amp; Certified</code>
            </p>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
