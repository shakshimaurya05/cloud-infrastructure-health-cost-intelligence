import React from 'react';
import {
  X,
  Clock,
  Cpu,
  Server,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Tag,
  MapPin,
  Globe,
  Lock
} from 'lucide-react';
import HealthBadge from './HealthBadge';
import CpuChart from './CpuChart';
import StatusBadge from '../common/StatusBadge';

function DetailRow({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <div className="text-xs font-medium text-slate-800">{children}</div>
    </div>
  );
}

function StatusCheckRow({ label, status }) {
  const ok = status === 'ok';
  return (
    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-50 border border-slate-200">
      <span className="text-xs text-slate-600 font-medium">{label}</span>
      {ok ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          Passed
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
          <XCircle className="w-3.5 h-3.5 text-rose-500" />
          {status === 'impaired' ? 'Impaired' : String(status)}
        </span>
      )}
    </div>
  );
}

/**
 * InstanceHealthDetail — slide-over panel showing full health context for one instance.
 *
 * Props:
 *   instance    {object}   The instance object from /api/monitoring
 *   thresholds  {object}   { cpuWarning, cpuCritical }
 *   lookbackHours {number}
 *   onClose     {function}
 */
export default function InstanceHealthDetail({ instance, thresholds, lookbackHours = 24, onClose }) {
  if (!instance) return null;

  const { cpu, statusCheck, health, healthReason, tags } = instance;
  const isRunning = instance.instanceState === 'running';

  // Alert categories based on health
  const getAlertBanner = () => {
    if (health === 'critical' && statusCheck?.hasFailed) {
      return {
        bg: 'bg-rose-50 border-rose-200',
        icon: <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />,
        title: 'EC2 Status Check Failure',
        body: healthReason
      };
    }
    if (health === 'critical') {
      return {
        bg: 'bg-rose-50 border-rose-200',
        icon: <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />,
        title: `Critical CPU: ${cpu.maximum !== null ? `${cpu.maximum.toFixed(1)}% peak` : 'N/A'}`,
        body: healthReason
      };
    }
    if (health === 'warning') {
      return {
        bg: 'bg-amber-50 border-amber-200',
        icon: <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />,
        title: `High CPU: ${cpu.average !== null ? `${cpu.average.toFixed(1)}% avg` : 'N/A'}, ${cpu.maximum !== null ? `${cpu.maximum.toFixed(1)}% peak` : ''}`,
        body: healthReason
      };
    }
    return null;
  };

  const alertBanner = getAlertBanner();

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-start justify-end z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[calc(100vh-2rem)] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-slate-900">{instance.name}</h2>
              <HealthBadge status={health} size="sm" />
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">{instance.instanceId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Health alert banner */}
          {alertBanner && (
            <div className={`flex items-start gap-2.5 p-3.5 rounded-xl border ${alertBanner.bg}`}>
              {alertBanner.icon}
              <div>
                <p className="text-xs font-bold text-slate-900">{alertBanner.title}</p>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{alertBanner.body}</p>
              </div>
            </div>
          )}

          {/* Instance metadata grid */}
          <div className="grid grid-cols-2 gap-3">
            <DetailRow label="Instance State">
              <StatusBadge type="instanceState" value={instance.instanceState} />
            </DetailRow>
            <DetailRow label="Instance Type">
              <span className="font-mono px-2 py-0.5 bg-slate-100 rounded text-[11px] text-slate-700">
                {instance.instanceType}
              </span>
            </DetailRow>
            <DetailRow label="Availability Zone">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                {instance.availabilityZone}
              </span>
            </DetailRow>
            <DetailRow label="Region">
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3 text-slate-400" />
                {instance.region}
              </span>
            </DetailRow>
            <DetailRow label="Launch Time">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {instance.launchTime ? new Date(instance.launchTime).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
              </span>
            </DetailRow>
            <DetailRow label="IP Addresses">
              <div className="space-y-0.5 font-mono text-[11px]">
                {instance.privateIp && <div className="flex items-center gap-1"><Lock className="w-2.5 h-2.5 text-slate-400" />{instance.privateIp}</div>}
                {instance.publicIp  && <div className="flex items-center gap-1"><Globe className="w-2.5 h-2.5 text-blue-400" />{instance.publicIp}</div>}
                {!instance.privateIp && !instance.publicIp && <span className="text-slate-400 italic">None</span>}
              </div>
            </DetailRow>
          </div>

          {/* EC2 Status Checks */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
              EC2 Status Checks
            </h3>
            {!isRunning ? (
              <p className="text-xs text-slate-400 italic px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                Status checks are only performed on running instances.
              </p>
            ) : statusCheck ? (
              <div className="space-y-1.5">
                <StatusCheckRow label="Instance Reachability"  status={statusCheck.instanceStatus} />
                <StatusCheckRow label="System Status"          status={statusCheck.systemStatus} />
                {statusCheck.hasFailed && statusCheck.failedCheckDetails && (
                  <p className="text-[11px] text-rose-600 italic px-3 py-1.5 bg-rose-50 rounded border border-rose-100">
                    Failed checks: {statusCheck.failedCheckDetails}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                Status check data is not available (insufficient IAM permissions or not yet retrieved).
              </p>
            )}
          </div>

          {/* CPU Metrics */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                CPU Utilization — Last {lookbackHours}h
              </h3>
              {cpu.hasData && (
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  {cpu.average !== null && <span>Avg <strong className="text-slate-800">{cpu.average.toFixed(1)}%</strong></span>}
                  {cpu.maximum !== null && <span>Peak <strong className="text-rose-700">{cpu.maximum.toFixed(1)}%</strong></span>}
                  {cpu.minimum !== null && <span>Min <strong className="text-slate-600">{cpu.minimum.toFixed(1)}%</strong></span>}
                </div>
              )}
            </div>

            {!isRunning ? (
              <div className="flex items-center justify-center h-20 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-400 italic">
                CPU metrics are not collected for stopped instances.
              </div>
            ) : (
              <>
                <CpuChart datapoints={cpu.datapoints || []} thresholds={thresholds} height={160} />
                {cpu.observedAt && (
                  <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    Fetched {new Date(cpu.observedAt).toLocaleTimeString()} · Unit: {cpu.unit || 'Percent'}
                    {!cpu.hasData && ' · No data points in this window'}
                  </p>
                )}
                {cpu.permissionDenied && (
                  <p className="text-[11px] text-amber-600 mt-1 italic">
                    CloudWatch access denied — check ec2:GetMetricStatistics IAM permission.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Health reason */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
              Health Assessment
            </p>
            <p className="text-xs text-slate-700 leading-relaxed">{healthReason}</p>
          </div>

          {/* Tags */}
          {tags && Object.keys(tags).length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-500" />
                Resource Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(tags).map(([k, v]) => (
                  <span key={k} className="px-2 py-1 rounded bg-slate-100 text-[11px] font-mono text-slate-700">
                    <strong className="text-slate-900">{k}:</strong> {v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-slate-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

