import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export default function CpuUtilizationChart({ data = [], height = 260 }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
        No CPU utilization metrics available.
      </div>
    );
  }

  const chartData = data.map((m) => ({
    name: (m.instanceName || m.instanceId).replace('production-', 'prod-').replace('staging-', 'stg-'),
    average: typeof m.average === 'number' ? m.average : 0,
    maximum: typeof m.maximum === 'number' ? m.maximum : 0
  }));

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickFormatter={(v) => `${v}%`}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              borderRadius: '8px',
              border: 'none',
              color: '#f8fafc',
              fontSize: '12px'
            }}
            formatter={(value, name) => [`${value.toFixed(1)}%`, name === 'average' ? 'Average CPU' : 'Peak CPU']}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
          />
          <Bar dataKey="average" name="Average CPU" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="maximum" name="Peak CPU" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
