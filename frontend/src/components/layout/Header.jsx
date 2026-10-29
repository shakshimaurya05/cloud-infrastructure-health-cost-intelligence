import React from 'react';
import { RefreshCw, Globe, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Header({
  title,
  subtitle,
  mode = 'demo',
  region = 'us-east-1',
  isRefreshing = false,
  onRefresh
}) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 font-medium">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Region Tag */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
          <Globe className="w-3.5 h-3.5 text-slate-500" />
          <span>{region}</span>
        </div>

        {/* Mode Indicator Badge */}
        {mode === 'live' ? (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>AWS LIVE CONNECTED</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-300">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>DEMO MODE (SIMULATED DATA)</span>
          </div>
        )}

        {/* Refresh Action */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-xs disabled:opacity-50"
            title="Refresh dashboard data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span className="hidden md:inline">{isRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
        )}
      </div>
    </header>
  );
}
