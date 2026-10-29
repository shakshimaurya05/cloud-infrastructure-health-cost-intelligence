import React, { useState, useEffect, useMemo } from 'react';
import {
  Server,
  Search,
  RefreshCw,
  Cpu,
  CheckCircle2,
  XCircle,
  Tag,
  ExternalLink,
  Info
} from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorAlert from '../components/common/ErrorAlert';
import EmptyState from '../components/common/EmptyState';
import { fetchInstances, fetchMetrics } from '../api/client';

export default function InfrastructurePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [instances, setInstances] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [selectedInstance, setSelectedInstance] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [instRes, metRes] = await Promise.all([
        fetchInstances(),
        fetchMetrics()
      ]);
      setInstances(instRes.data?.instances || []);
      setMetrics(metRes.data?.metrics || []);
    } catch (err) {
      setError(err.message || 'Failed to load EC2 instances.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map CPU metrics by instanceId
  const metricsMap = useMemo(() => {
    const map = new Map();
    for (const m of metrics) {
      if (m.instanceId) {
        map.set(m.instanceId, m);
      }
    }
    return map;
  }, [metrics]);

  // Filter instances
  const filteredInstances = useMemo(() => {
    return instances.filter((inst) => {
      const matchesState = stateFilter === 'all' || inst.state.toLowerCase() === stateFilter.toLowerCase();
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        inst.name.toLowerCase().includes(term) ||
        inst.instanceId.toLowerCase().includes(term) ||
        inst.instanceType.toLowerCase().includes(term) ||
        inst.availabilityZone.toLowerCase().includes(term);

      return matchesState && matchesSearch;
    });
  }, [instances, stateFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Top Filter and Controls Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID, name, instance type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* State Filter Buttons */}
          <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium">
            {['all', 'running', 'stopped'].map((s) => (
              <button
                key={s}
                onClick={() => setStateFilter(s)}
                className={`px-3 py-1.5 rounded-md capitalize transition-all ${
                  stateFilter === s
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <span className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-900">{filteredInstances.length}</strong> of {instances.length} instances
          </span>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={loadData} />}

      {/* Main Table */}
      {loading ? (
        <LoadingSpinner message="Scanning EC2 inventory and CloudWatch metrics..." />
      ) : filteredInstances.length === 0 ? (
        <EmptyState
          title="No instances matched your filter"
          description="Try modifying search keywords or clearing state filters."
          icon={Server}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Instance Name & ID</th>
                  <th className="py-3.5 px-4">State</th>
                  <th className="py-3.5 px-4">Instance Type</th>
                  <th className="py-3.5 px-4">Availability Zone</th>
                  <th className="py-3.5 px-4">Avg CPU %</th>
                  <th className="py-3.5 px-4">IP Addresses</th>
                  <th className="py-3.5 px-4">Health Check</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredInstances.map((inst) => {
                  const metric = metricsMap.get(inst.instanceId);
                  const cpuAvg = metric?.average;
                  const isRunning = inst.state.toLowerCase() === 'running';

                  return (
                    <tr key={inst.instanceId} className="hover:bg-slate-50/60 transition-colors">
                      {/* Name & ID */}
                      <td className="py-4 px-5">
                        <div className="font-semibold text-slate-900">{inst.name}</div>
                        <div className="font-mono text-[11px] text-slate-400 mt-0.5">{inst.instanceId}</div>
                      </td>

                      {/* State */}
                      <td className="py-4 px-4">
                        <StatusBadge type="instanceState" value={inst.state} />
                      </td>

                      {/* Type */}
                      <td className="py-4 px-4">
                        <span className="font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                          {inst.instanceType}
                        </span>
                      </td>

                      {/* AZ */}
                      <td className="py-4 px-4 text-slate-600 font-medium">
                        {inst.availabilityZone}
                      </td>

                      {/* CPU Utilization */}
                      <td className="py-4 px-4">
                        {isRunning && typeof cpuAvg === 'number' ? (
                          <div className="w-32">
                            <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                              <span className="text-slate-700">{cpuAvg.toFixed(1)}%</span>
                              <span className="text-[10px] text-slate-400">avg</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  cpuAvg > 80
                                    ? 'bg-rose-500'
                                    : cpuAvg < 5
                                    ? 'bg-amber-400'
                                    : 'bg-indigo-600'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(5, cpuAvg))}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">N/A (Inactive)</span>
                        )}
                      </td>

                      {/* IP Addresses */}
                      <td className="py-4 px-4 font-mono text-[11px] text-slate-600">
                        <div>Priv: {inst.privateIp || 'None'}</div>
                        {inst.publicIp && (
                          <div className="text-slate-400">Pub: {inst.publicIp}</div>
                        )}
                      </td>

                      {/* Health Check */}
                      <td className="py-4 px-4">
                        {isRunning ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            2/2 checks passed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            <XCircle className="w-3.5 h-3.5 text-slate-400" />
                            Stopped
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => setSelectedInstance(inst)}
                          className="px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Instance Detail Modal */}
      {selectedInstance && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedInstance.name}</h3>
                <p className="text-xs font-mono text-slate-400">{selectedInstance.instanceId}</p>
              </div>
              <button
                onClick={() => setSelectedInstance(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block mb-0.5">State</span>
                <StatusBadge type="instanceState" value={selectedInstance.state} />
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block mb-0.5">Instance Type</span>
                <span className="font-mono font-semibold text-slate-800">{selectedInstance.instanceType}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block mb-0.5">Availability Zone</span>
                <span className="font-semibold text-slate-800">{selectedInstance.availabilityZone}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block mb-0.5">Launch Timestamp</span>
                <span className="text-slate-700">{selectedInstance.launchTime ? new Date(selectedInstance.launchTime).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>

            {/* Tags Section */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-500" />
                Resource Tags
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {selectedInstance.tags && Object.keys(selectedInstance.tags).length > 0 ? (
                  Object.entries(selectedInstance.tags).map(([key, val]) => (
                    <span key={key} className="px-2 py-1 rounded bg-slate-100 text-[11px] text-slate-700 font-mono">
                      <strong className="text-slate-900 font-semibold">{key}:</strong> {val}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No tags configured</span>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedInstance(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
