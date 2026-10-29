import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const COLORS = ['#4f46e5', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];

export default function ServicePieChart({ data = [], height = 260 }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
        No service expenditure data available.
      </div>
    );
  }

  // Abbreviate service names for clean legend display
  const cleanData = data.slice(0, 6).map((d) => ({
    name: d.service.replace('Amazon ', '').replace('Elastic Compute Cloud', 'EC2').replace('Relational Database Service', 'RDS').replace('Simple Storage Service', 'S3').replace('Virtual Private Cloud', 'VPC'),
    fullName: d.service,
    amount: d.amount,
    percentage: d.percentage
  }));

  return (
    <div style={{ width: '100%', height }} className="flex flex-col md:flex-row items-center">
      <div className="w-full md:w-1/2 h-full">
        <ResponsiveContainer>
          <PieChart>
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderRadius: '8px',
                border: 'none',
                color: '#f8fafc',
                fontSize: '12px'
              }}
              formatter={(value, name, item) => [
                `$${value.toFixed(2)} (${item.payload.percentage}%)`,
                item.payload.fullName
              ]}
            />
            <Pie
              data={cleanData}
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="amount"
            >
              {cleanData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend Column */}
      <div className="w-full md:w-1/2 space-y-2 mt-4 md:mt-0 pl-2">
        {cleanData.map((item, idx) => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate pr-2">
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
              />
              <span className="text-slate-600 truncate font-medium" title={item.fullName}>
                {item.name}
              </span>
            </div>
            <div className="text-right flex-shrink-0 font-semibold text-slate-800">
              ${item.amount.toFixed(0)} <span className="text-[10px] text-slate-400 font-normal">({item.percentage}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
