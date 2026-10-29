import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export default function SpendTrendChart({ data = [], height = 260 }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
        No daily spending data available.
      </div>
    );
  }

  // Format date labels nicely (e.g. 2026-10-15 -> Oct 15)
  const chartData = data.map((d) => {
    let label = d.date;
    try {
      if (d.date && d.date.includes('-')) {
        const parts = d.date.split('-');
        if (parts.length === 3) {
          label = `${parts[1]}/${parts[2]}`;
        }
      }
    } catch {
      label = d.date;
    }
    return {
      date: label,
      amount: typeof d.amount === 'number' ? d.amount : 0
    };
  });

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              borderRadius: '8px',
              border: 'none',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              color: '#f8fafc',
              fontSize: '12px'
            }}
            formatter={(value) => [`$${value.toFixed(2)}`, 'Spend']}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#4f46e5"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#spendGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
