import React from 'react';
import { AckStatus, StatusScheme } from '../types';
import { Clock, Send, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: AckStatus;
  scheme: StatusScheme;
  size?: 'sm' | 'md' | 'lg';
  showDescription?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  scheme,
  size = 'md',
  showDescription = false,
}) => {
  const getBadgeConfig = () => {
    switch (status) {
      case 'Unacknowledged':
        return {
          label: scheme.labels.unacknowledged,
          desc: scheme.descriptions.unacknowledged,
          bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
          dot: 'bg-amber-500',
          icon: AlertCircle,
        };
      case 'Submitted':
        return {
          label: scheme.labels.submitted,
          desc: scheme.descriptions.submitted,
          bg: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
          dot: 'bg-sky-500 animate-pulse',
          icon: Send,
        };
      case 'In Review':
        return {
          label: scheme.labels.inReview,
          desc: scheme.descriptions.inReview,
          bg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
          dot: 'bg-purple-500',
          icon: Clock,
        };
      case 'HR Verified':
        return {
          label: scheme.labels.hrVerified,
          desc: scheme.descriptions.hrVerified,
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
          dot: 'bg-emerald-500',
          icon: ShieldCheck,
        };
      default:
        return {
          label: status,
          desc: '',
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
          icon: CheckCircle2,
        };
    }
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-medium',
  };

  return (
    <div className="inline-flex flex-col">
      <span
        className={`inline-flex items-center rounded-full border transition-colors ${config.bg} ${sizeClasses[size]}`}
        title={config.desc}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        <span>{config.label}</span>
      </span>
      {showDescription && (
        <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-1">
          {config.desc}
        </span>
      )}
    </div>
  );
};
