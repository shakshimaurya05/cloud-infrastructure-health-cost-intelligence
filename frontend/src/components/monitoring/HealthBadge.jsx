import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  PowerOff,
  Trash2
} from 'lucide-react';

/**
 * HealthBadge — displays the derived health status of an EC2 instance.
 *
 * Health values: 'healthy' | 'warning' | 'critical' | 'unknown' | 'stopped' | 'terminated'
 *
 * Props:
 *   status  {string}
 *   size    {'sm'|'md'|'lg'}  default 'md'
 */
export default function HealthBadge({ status = 'unknown', size = 'md' }) {
  const normalized = String(status).toLowerCase();

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2'
  };
  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4'
  };

  const sc = sizeClasses[size] || sizeClasses.md;
  const ic = iconSize[size] || iconSize.md;

  switch (normalized) {
    case 'healthy':
      return (
        <span className={`inline-flex items-center font-semibold rounded-full ${sc} bg-emerald-50 text-emerald-700 border border-emerald-200`}>
          <CheckCircle2 className={`${ic} text-emerald-500`} />
          Healthy
        </span>
      );
    case 'warning':
      return (
        <span className={`inline-flex items-center font-semibold rounded-full ${sc} bg-amber-50 text-amber-700 border border-amber-200`}>
          <AlertTriangle className={`${ic} text-amber-500`} />
          Warning
        </span>
      );
    case 'critical':
      return (
        <span className={`inline-flex items-center font-semibold rounded-full ${sc} bg-rose-50 text-rose-700 border border-rose-200`}>
          <XCircle className={`${ic} text-rose-500`} />
          Critical
        </span>
      );
    case 'stopped':
      return (
        <span className={`inline-flex items-center font-semibold rounded-full ${sc} bg-slate-100 text-slate-600 border border-slate-200`}>
          <PowerOff className={`${ic} text-slate-400`} />
          Stopped
        </span>
      );
    case 'terminated':
      return (
        <span className={`inline-flex items-center font-semibold rounded-full ${sc} bg-slate-100 text-slate-400 border border-slate-200`}>
          <Trash2 className={`${ic} text-slate-400`} />
          Terminated
        </span>
      );
    case 'unknown':
    default:
      return (
        <span className={`inline-flex items-center font-semibold rounded-full ${sc} bg-blue-50 text-blue-600 border border-blue-200`}>
          <HelpCircle className={`${ic} text-blue-400`} />
          Unknown
        </span>
      );
  }
}

