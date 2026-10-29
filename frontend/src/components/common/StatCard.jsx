import React from 'react';

export default function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  color = 'indigo',
  trend
}) {
  const colorMap = {
    indigo: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-600',
      border: 'border-l-indigo-600'
    },
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      border: 'border-l-emerald-500'
    },
    amber: {
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      border: 'border-l-amber-500'
    },
    rose: {
      bg: 'bg-rose-50',
      text: 'text-rose-600',
      border: 'border-l-rose-500'
    },
    blue: {
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      border: 'border-l-blue-500'
    }
  };

  const scheme = colorMap[color] || colorMap.indigo;

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200/90 border-l-4 ${scheme.border} p-5 transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500 tracking-wide uppercase">{title}</p>
        {Icon && (
          <div className={`p-2.5 rounded-lg ${scheme.bg} ${scheme.text}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <h3 className="text-2xl font-bold tracking-tight text-slate-900">{value}</h3>
        {trend && (
          <span className={`text-xs font-semibold ${trend > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {trend > 0 ? `+${trend}%` : `${trend}%`}
          </span>
        )}
      </div>
      {subtext && (
        <p className="mt-1 text-xs text-slate-400">{subtext}</p>
      )}
    </div>
  );
}
