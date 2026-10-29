import React, { useMemo } from 'react';

/**
 * CpuChart — SVG line chart for the instance detail panel.
 * Shows Average, Maximum, and Minimum CPU % over time.
 * Never plots null values — gaps are left in the line instead.
 *
 * Props:
 *   datapoints   {Array<{timestamp, average, maximum, minimum}>}
 *   thresholds   {{ cpuWarning: number, cpuCritical: number }}
 *   height       {number}
 */
export default function CpuChart({
  datapoints = [],
  thresholds = { cpuWarning: 80, cpuCritical: 95 },
  height = 160
}) {
  const W = 560;
  const H = height;
  const padLeft = 36;
  const padRight = 12;
  const padTop = 10;
  const padBottom = 24;
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;

  const validPoints = useMemo(
    () => datapoints.filter((d) => d.average !== null && d.average !== undefined),
    [datapoints]
  );

  const { avgPath, maxPath, minPath, xLabels, yTicks } = useMemo(() => {
    if (validPoints.length === 0) {
      return { avgPath: '', maxPath: '', minPath: '', xLabels: [], yTicks: [] };
    }

    const allVals = validPoints.flatMap((d) =>
      [d.average, d.maximum, d.minimum].filter((v) => v !== null)
    );
    const maxY = Math.min(100, Math.max(...allVals, thresholds.cpuCritical, 10));
    const minY = 0;
    const range = maxY - minY || 1;

    const toX = (i) => padLeft + (i / Math.max(validPoints.length - 1, 1)) * chartW;
    const toY = (v) => padTop + chartH - ((v - minY) / range) * chartH;

    const buildPath = (key) =>
      validPoints
        .map((d, i) =>
          d[key] !== null && d[key] !== undefined
            ? `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d[key]).toFixed(1)}`
            : ''
        )
        .filter(Boolean)
        .join(' ');

    // X-axis labels: first, middle, last
    const xLabels = [];
    const labelIndices = new Set([0, Math.floor((validPoints.length - 1) / 2), validPoints.length - 1]);
    for (const idx of labelIndices) {
      const d = validPoints[idx];
      if (d) {
        const dt = new Date(d.timestamp);
        xLabels.push({
          x: toX(idx),
          label: `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
        });
      }
    }

    // Y-axis ticks: 0, 25, 50, 75, 100
    const yTicks = [0, 25, 50, 75, 100]
      .filter((v) => v <= maxY + 5)
      .map((v) => ({ y: toY(v), label: `${v}%` }));

    // Threshold lines
    const warnY    = toY(thresholds.cpuWarning);
    const critY    = toY(thresholds.cpuCritical);

    return {
      avgPath:  buildPath('average'),
      maxPath:  buildPath('maximum'),
      minPath:  buildPath('minimum'),
      xLabels,
      yTicks,
      warnY,
      critY,
      toX,
      toY
    };
  }, [validPoints, thresholds, chartW, chartH]);

  if (validPoints.length === 0) {
    return (
      <div className="flex items-center justify-center h-28 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-400 italic">
        No CloudWatch data available for this observation window.
      </div>
    );
  }

  const { warnY, critY } = useMemo(() => {
    if (validPoints.length === 0) return { warnY: null, critY: null };
    const allVals = validPoints.flatMap((d) =>
      [d.average, d.maximum, d.minimum].filter((v) => v !== null)
    );
    const maxY = Math.min(100, Math.max(...allVals, thresholds.cpuCritical, 10));
    const range = maxY || 1;
    const toY = (v) => padTop + chartH - (v / range) * chartH;
    return { warnY: toY(thresholds.cpuWarning), critY: toY(thresholds.cpuCritical) };
  }, [validPoints, thresholds, chartH]);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: H }}
        role="img"
        aria-label="CPU utilization chart"
      >
        {/* Y-axis ticks */}
        {yTicks.map((t) => (
          <g key={t.label}>
            <line
              x1={padLeft} y1={t.y} x2={padLeft + chartW} y2={t.y}
              stroke="#e2e8f0" strokeWidth="1"
            />
            <text x={padLeft - 4} y={t.y + 3.5} textAnchor="end" fontSize="9" fill="#94a3b8">
              {t.label}
            </text>
          </g>
        ))}

        {/* Warning threshold line */}
        {warnY !== null && (
          <g>
            <line
              x1={padLeft} y1={warnY} x2={padLeft + chartW} y2={warnY}
              stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 2"
            />
            <text x={padLeft + chartW - 2} y={warnY - 3} textAnchor="end" fontSize="8" fill="#d97706">
              warn {thresholds.cpuWarning}%
            </text>
          </g>
        )}

        {/* Critical threshold line */}
        {critY !== null && (
          <g>
            <line
              x1={padLeft} y1={critY} x2={padLeft + chartW} y2={critY}
              stroke="#ef4444" strokeWidth="1" strokeDasharray="4 2"
            />
            <text x={padLeft + chartW - 2} y={critY - 3} textAnchor="end" fontSize="8" fill="#dc2626">
              crit {thresholds.cpuCritical}%
            </text>
          </g>
        )}

        {/* Min line */}
        {minPath && (
          <path d={minPath} fill="none" stroke="#bfdbfe" strokeWidth="1.2" strokeLinejoin="round" />
        )}
        {/* Max line */}
        {maxPath && (
          <path d={maxPath} fill="none" stroke="#93c5fd" strokeWidth="1.2" strokeLinejoin="round" />
        )}
        {/* Average line */}
        {avgPath && (
          <path d={avgPath} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* X-axis labels */}
        {xLabels.map((l) => (
          <text key={l.label + l.x} x={l.x} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">
            {l.label}
          </text>
        ))}

        {/* Axes */}
        <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + chartH} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={padLeft} y1={padTop + chartH} x2={padLeft + chartW} y2={padTop + chartH} stroke="#cbd5e1" strokeWidth="1" />
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 justify-center text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-indigo-500 rounded" /> Average</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-blue-300 rounded" /> Maximum</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-blue-200 rounded" /> Minimum</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-amber-400 rounded border-dashed" /> Warning</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-red-400 rounded" /> Critical</span>
      </div>
    </div>
  );
}

