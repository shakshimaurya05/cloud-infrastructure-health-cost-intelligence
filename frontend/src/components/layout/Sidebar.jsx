import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  DollarSign,
  AlertTriangle,
  Settings,
  Cloud,
  ShieldCheck
} from 'lucide-react';

export default function Sidebar({ mode = 'demo' }) {
  const navItems = [
    { name: 'Overview', path: '/', icon: LayoutDashboard },
    { name: 'Infrastructure', path: '/infrastructure', icon: Server },
    { name: 'Cost Intelligence', path: '/costs', icon: DollarSign },
    { name: 'Alerts & Actions', path: '/alerts', icon: AlertTriangle },
    { name: 'System Info', path: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#0a1128] text-slate-300 flex flex-col flex-shrink-0 min-h-screen border-r border-slate-800 shadow-xl">
      {/* Branding Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800/80 bg-[#070c1e]">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
          <Cloud className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight leading-none">CloudIntel</h1>
          <p className="text-[10px] text-slate-400 font-medium tracking-wide mt-1 uppercase">Health & FinOps</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-6 space-y-1.5">
        <p className="px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Platform Management
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Mode & Security Indicator */}
      <div className="p-4 m-3 rounded-xl bg-slate-900/90 border border-slate-800/80">
        <div className="flex items-center gap-2 mb-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-slate-200">Security & Access</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Read-only IAM role access. No mutating AWS commands enabled.
        </p>
        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-500">Mode</span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              mode === 'live'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}
          >
            {mode === 'live' ? 'Live AWS' : 'Demo Mode'}
          </span>
        </div>
      </div>
    </aside>
  );
}
