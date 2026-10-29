import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity,
  RefreshCw,
  Search,
  Clock,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  PowerOff,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorAlert from '../components/common/ErrorAlert';
import EmptyState from '../components/common/EmptyState';
import HealthBadge from '../components/monitoring/HealthBadge';
import CpuSparkline from '../components/monitoring/CpuSparkline';
import InstanceHealthDetail from '../components/monitoring/InstanceHealthDetail';
import { fetchMonitoring } from '../api/client';

// ─── Constants ────────────────────────────────────────────────────────────────

const OBSERVATION_OPTIONS = [
  { value: 1,  label: 'Last 1h' },
  { value: 3,  label: 'Last 3h' },
  { value: 6,  label: 'Last 6h' },
  { value: 12, label: 'Last 12h' },
  { value: 24, label: 'Last 24h' },
  { value: 72, label: 'Last 3d' }
];

const HEALTH_FILTERS = [
  { value: 'all',      label: 'All',      icon: null },
  { value: 'critical', label: 'Critical', icon: XCircle },
  { value: 'warning',  label: 'Warning',  icon: AlertTriangle },
  { value: 'healthy',  label: 'Healthy',  icon: CheckCircle2 },
  { value: 'unknown',  label: 'Unknown',  icon: HelpCircle },
  { value: 'stopped',  label: 'Stopped',  icon: PowerOff }
];

const SPARKLINE_COLORS = {
  healthy:    '#10b981',
  warning:    '#f59e0b',
  critical:   '#ef4444',
  unknown:    '#94a3b8',
  stopped:    '#94a3b8',
  terminated: '#94a3b8'
};

// ─── Health Summary Strip ─────────────────────────────────────────────────────

function HealthSummaryStrip({ instances }) {
  const counts = useMemo(() => {
    const map = { critical: 0, warning: 0, healthy: 0, unknown: 0, stopped: 0 };
    for (const inst of instances) {
      const k = inst.health;
      if (k in map) map[k]++;
      else map.stopped++;
    }
    return map;
  }, [instances]);

  const cards = [
    { key: 'critical', label: 'Critical', color: 'text-rose-700   bg-rose-50   border-rose-200',   dot: 'bg-rose-500' },
    { key: 'warning',  label: 'Warning',  color: 'text-amber-700  bg-amber-50  border-amber-200',  dot: 'bg-amber-500' },
    { key: 'healthy',  label: 'Healthy',  color: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
    { key: 'unknown',  label: 'Unknown',  color: 'text-blue-700   bg-blue-50   border-blue-200',   dot: 'bg-blue-400' },
    { key: 'stopped',  label: 'Stopped',  color: 'text-slate-600  bg-slate-100 border-slate-200',  dot: 'bg-slate-400' }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {cards.map(({ key, label, color, dot }) => (
        <div key={key} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color} font-medium`}>
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
          <div>
            <div className="text-xl font-bold leading-none">{counts[key]}</div>
            <div className="text-[10px] uppercase tracking-wide mt-0.5 opacity-70">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Threshold Config Panel ───────────────────────────────────────────────────

function ThresholdPanel({ cpuWarning, cpuCritical, onChange, onApply }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
      <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
        <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
        CPU Threshold Configuration
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">
            Warning %
          </label>
          <input
            type="number"
            min={1} max={99}
            value={cpuWarning}
            onChange={(e) => onChange('cpuWarning', Number(e.target.value))}
            className="w-full px-2.5 py-1.5 text-xs border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 bg-amber-50"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-rose-700 uppercase tracking-wide mb-1">
            Critical %
          </label>
          <input
            type="number"
            min={1} max={100}
            value={cpuCritical}
            onChange={(e) => onChange('cpuCritical', Number(e.target.value))}
            className="w-full px-2.5 py-1.5 text-xs border border-rose-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400/20 focus:border-rose-400 bg-rose-50"
          />
        </div>
      </div>
      <button
        onClick={onApply}
        className="w-full px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
      >
        Apply & Refresh
      </button>
    </div>
  );
}

// ─── Instance Row ─────────────────────────────────────────────────────────────

function InstanceRow({ instance, thresholds, onSelectDetail }) {
  const { cpu, statusCheck, health } = instance;
  const isRunning = instance.instanceState === 'running';

  const sparkColor = SPARKLINE_COLORS[health] || '#94a3b8';

  return (
    <tr className="hover:bg-slate-50/60 transition-colors">
      {/* Name & ID */}
      <td className="py-4 px-5">
        <div className="font-semibold text-slate-900 text-xs">{instance.name}</div>
        <div className="font-mono text-[10px] text-slate-400 mt-0.5">{instance.instanceId}</div>
      </td>

      {/* Health */}
      <td className="py-4 px-4">
        <HealthBadge status={health} size="sm" />
      </td>

      {/* Instance Type */}
      <td className="py-4 px-4">
        <span className="font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
          {instance.instanceType}
        </span>
      </td>

      {/* AZ */}
      <td className="py-4 px-4 text-[11px] text-slate-600 font-medium">
        {instance.availabilityZone}
      </td>

      {/* EC2 Status Check */}
      <td className="py-4 px-4">
        {!isRunning ? (
          <span className="text-[11px] text-slate-400 italic">N/A</span>
        ) : statusCheck ? (
          statusCheck.hasFailed ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              <XCircle className="w-3 h-3 text-rose-500" />
              Impaired
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              2/2 OK
            </span>
          )
        ) : (
          <span className="text-[11px] text-slate-400 italic">Unknown</span>
        )}
      </td>

      {/* CPU Sparkline */}
      <td className="py-4 px-4">
        {isRunning && cpu.hasData ? (
          <div className="flex items-center gap-2">
            <CpuSparkline
              datapoints={cpu.datapoints}
              width={80}
              height={28}
              strokeColor={sparkColor}
            />
            <div className="text-[10px] text-slate-600 space-y-0.5 leading-tight">
              {cpu.average !== null && <div><span className="text-slate-400">avg</span> {cpu.average.toFixed(1)}%</div>}
              {cpu.maximum !== null && <div><span className="text-slate-400">pk</span> <span className={cpu.maximum >= thresholds.cpuCritical ? 'text-rose-600 font-bold' : cpu.maximum >= thresholds.cpuWarning ? 'text-amber-600 font-bold' : 'text-slate-700'}>{cpu.maximum.toFixed(1)}%</span></div>}
            </div>
          </div>
        ) : isRunning ? (
          <span className="text-[11px] text-slate-400 italic">No data</span>
        ) : (
          <span className="text-[11px] text-slate-400 italic">Stopped</span>
        )}
      </td>

      {/* Action */}
      <td className="py-4 px-4 text-right">
        <button
          onClick={() => onSelectDetail(instance)}
          className="px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
        >
          Details
        </button>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('demo');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [healthFilter, setHealthFilter] = useState('all');
  const [lookbackHours, setLookbackHours] = useState(24);

  // Threshold config
  const [cpuWarning, setCpuWarning]    = useState(80);
  const [cpuCritical, setCpuCritical]  = useState(95);
  const [showThresholds, setShowThresholds] = useState(false);

  // Pending threshold values (applied on click only)
  const [pendingWarning, setPendingWarning]   = useState(80);
  const [pendingCritical, setPendingCritical] = useState(95);

  // Detail panel
  const [selectedInstance, setSelectedInstance] = useState(null);

  const loadData = useCallback(async (opts = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMonitoring({
        lookbackHours: opts.lookbackHours ?? lookbackHours,
        cpuWarning:    opts.cpuWarning    ?? cpuWarning,
        cpuCritical:   opts.cpuCritical   ?? cpuCritical
      });
      setData(res.data);
      setMode(res.data?.mode || 'demo');
    } catch (err) {
      setError(err.message || 'Failed to fetch health monitoring data.');
    } finally {
      setLoading(false);
    }
  }, [lookbackHours, cpuWarning, cpuCritical]);

  useEffect(() => {
    loadData();
    // Refresh every 5 minutes — avoids excessive API calls
    const timer = setInterval(() => loadData(), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []); // intentionally runs once on mount; manual controls drive re-fetches

  const handleObservationChange = (hours) => {
    setLookbackHours(hours);
    loadData({ lookbackHours: hours });
  };

  const handleApplyThresholds = () => {
    setCpuWarning(pendingWarning);
    setCpuCritical(pendingCritical);
    setShowThresholds(false);
    loadData({ cpuWarning: pendingWarning, cpuCritical: pendingCritical });
  };

  const instances = data?.instances || [];

  const filtered = useMemo(() => {
    return instances.filter((inst) => {
      if (healthFilter !== 'all' && inst.health !== healthFilter) return false;
      if (!searchTerm) return true;
      const t = searchTerm.toLowerCase();
      return (
        inst.name.toLowerCase().includes(t) ||
        inst.instanceId.toLowerCase().includes(t) ||
        inst.instanceType.toLowerCase().includes(t) ||
        inst.availabilityZone.toLowerCase().includes(t) ||
        inst.region?.toLowerCase().includes(t)
      );
    });
  }, [instances, healthFilter, searchTerm]);

  const thresholds = { cpuWarning, cpuCritical };

  return (
    <div className="space-y-5">

      {/* Health Summary Strip */}
      {instances.length > 0 && (
        <HealthSummaryStrip instances={instances} />
      )}

      {/* Controls Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search instance ID, name, type, AZ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Health Filter */}
            <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium gap-0.5">
              {HEALTH_FILTERS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setHealthFilter(value)}
                  className={`px-2.5 py-1.5 rounded-md capitalize transition-all flex items-center gap-1 ${
                    healthFilter === value
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {Icon && <Icon className="w-3 h-3" />}
                  {label}
                </button>
              ))}
            </div>

            {/* Observation Period */}
            <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium gap-0.5">
              {OBSERVATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleObservationChange(opt.value)}
                  className={`px-2.5 py-1.5 rounded-md transition-all ${
                    lookbackHours === opt.value
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Threshold Toggle */}
            <button
              onClick={() => setShowThresholds((p) => !p)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                showThresholds
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Thresholds
              {showThresholds ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {/* Refresh */}
            <button
              onClick={() => loadData()}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Threshold panel */}
        {showThresholds && (
          <ThresholdPanel
            cpuWarning={pendingWarning}
            cpuCritical={pendingCritical}
            onChange={(key, val) => {
              if (key === 'cpuWarning')  setPendingWarning(val);
              if (key === 'cpuCritical') setPendingCritical(val);
            }}
            onApply={handleApplyThresholds}
          />
        )}

        {/* Meta row */}
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>
            Showing <strong className="text-slate-700">{filtered.length}</strong> of {instances.length} instances
            {mode === 'demo' && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 font-medium">Demo</span>
            )}
          </span>
          {data?.lastFetched && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last fetched: {new Date(data.lastFetched).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Warning banner from API */}
      {data?.warning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          {data.warning}
        </div>
      )}

      {error && <ErrorAlert message={error} onRetry={loadData} />}

      {/* Table */}
      {loading ? (
        <LoadingSpinner message="Fetching EC2 status checks and CloudWatch metrics…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No instances matched your filter"
          description="Try adjusting the health filter or search term."
          icon={Activity}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Instance Name & ID</th>
                  <th className="py-3.5 px-4">Health</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Availability Zone</th>
                  <th className="py-3.5 px-4">Status Checks</th>
                  <th className="py-3.5 px-4">
                    CPU / {lookbackHours}h
                    <span className="ml-1 normal-case font-normal text-slate-400 text-[9px]">
                      warn {cpuWarning}% · crit {cpuCritical}%
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((inst) => (
                  <InstanceRow
                    key={inst.instanceId}
                    instance={inst}
                    thresholds={thresholds}
                    onSelectDetail={setSelectedInstance}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selectedInstance && (
        <InstanceHealthDetail
          instance={selectedInstance}
          thresholds={thresholds}
          lookbackHours={lookbackHours}
          onClose={() => setSelectedInstance(null)}
        />
      )}
    </div>
  );
}

