import React, { useMemo } from 'react';

/**
 * CpuSparkline — a lightweight SVG sparkline for CPU datapoints.
 * Renders nothing meaningful when datapoints are empty (no data = no line).
 *
 * Props:
 *   datapoints  {Array<{average: number|null}>}
 *   width       {number}   SVG viewBox width
 *   height      {number}   SVG viewBox height
 *   color       {string}   Tailwind CSS stroke color class (unused for SVG; pass as hex)
 *   strokeColor {string}   Hex stroke color
 */
export default function CpuSparkline({
  datapoints = [],
  width = 120,
  height = 36,
  strokeColor = '#6366f1'
}) {
  const validPoints = useMemo(
    () => datapoints.filter((d) => d.average !== null && d.average !== undefined),
    [datapoints]
  );

  const path = useMemo(() => {
    if (validPoints.length < 2) return null;

    const maxVal = Math.max(...validPoints.map((d) => d.average), 1);
    const minVal = Math.min(...validPoints.map((d) => d.average), 0);
    const range  = maxVal - minVal || 1;

    const xStep = width / (validPoints.length - 1);
    const pad   = 3;

    return validPoints
      .map((d, i) => {
        const x = i * xStep;
        const y = pad + ((1 - (d.average - minVal) / range) * (height - pad * 2));
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [validPoints, width, height]);

  if (!path) {
    return (
      <div
        className="flex items-center justify-center text-[10px] text-slate-400 italic"
        style={{ width, height }}
      >
        No data
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label="CPU utilization sparkline"
    >
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

