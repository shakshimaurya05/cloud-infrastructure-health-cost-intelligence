import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Lightbulb,
  CheckCircle,
  ExternalLink,
  Shield,
  Layers,
  ArrowRight,
  Filter,
  Check
} from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorAlert from '../components/common/ErrorAlert';
import EmptyState from '../components/common/EmptyState';
import { fetchAlerts, fetchRecommendations } from '../api/client';

export default function AlertsRecommendationsPage() {
  const [activeTab, setActiveTab] = useState('alerts'); // 'alerts' | 'recommendations'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [acknowledgedItems, setAcknowledgedItems] = useState(new Set());

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [alertRes, recRes] = await Promise.all([
        fetchAlerts(),
        fetchRecommendations()
      ]);
      setAlerts(alertRes.data?.alerts || []);
      setRecommendations(recRes.data?.recommendations || []);
    } catch (err) {
      setError(err.message || 'Failed to load alerts and recommendations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleAcknowledge = (id) => {
    setAcknowledgedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (severityFilter === 'all') return true;
      return a.severity.toLowerCase() === severityFilter.toLowerCase();
    });
  }, [alerts, severityFilter]);

  // Filtered recommendations
  const filteredRecommendations = useMemo(() => {
    return recommendations.filter((r) => {
      if (priorityFilter === 'all') return true;
      return r.priority.toLowerCase() === priorityFilter.toLowerCase();
    });
  }, [recommendations, priorityFilter]);

  return (
    <div className="space-y-6">
      {/* Tab Switcher & Filters */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'alerts'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Active Alerts</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">
              {alerts.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'recommendations'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lightbulb className="w-4 h-4 text-indigo-500" />
            <span>FinOps Recommendations</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-bold">
              {recommendations.length}
            </span>
          </button>
        </div>

        {/* Sub-Filters */}
        <div className="flex items-center gap-3">
          {activeTab === 'alerts' ? (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Severity:
              </span>
              {['all', 'critical', 'warning', 'info'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-2.5 py-1 rounded-md capitalize text-xs font-medium transition-all ${
                    severityFilter === sev
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Priority:
              </span>
              {['all', 'high', 'medium', 'low'].map((pri) => (
                <button
                  key={pri}
                  onClick={() => setPriorityFilter(pri)}
                  className={`px-2.5 py-1 rounded-md capitalize text-xs font-medium transition-all ${
                    priorityFilter === pri
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {pri}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={loadData} />}

      {loading ? (
        <LoadingSpinner message="Evaluating infrastructure alarms & FinOps heuristic rules..." />
      ) : activeTab === 'alerts' ? (
        /* Alerts List */
        filteredAlerts.length === 0 ? (
          <EmptyState
            title="No alerts match the selected severity"
            description="All monitored AWS infrastructure is within defined health and utilization thresholds."
            icon={CheckCircle}
          />
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert) => {
              const isAcknowledged = acknowledgedItems.has(alert.id);
              return (
                <div
                  key={alert.id}
                  className={`bg-white rounded-xl shadow-xs border p-5 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    isAcknowledged ? 'border-slate-200 opacity-60 bg-slate-50/50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2.5">
                      <StatusBadge type="severity" value={alert.severity} />
                      <h4 className="text-sm font-bold text-slate-900">{alert.title}</h4>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {alert.source}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                      {alert.description}
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-slate-400 font-medium">
                      <span>Resource: <strong className="font-mono text-slate-600">{alert.resourceId}</strong></span>
                      <span>•</span>
                      <span>Logged: {new Date(alert.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center">
                    <button
                      onClick={() => toggleAcknowledge(alert.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                        isAcknowledged
                          ? 'bg-slate-100 text-slate-600 border-slate-200'
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {isAcknowledged ? 'Acknowledged' : 'Acknowledge'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Recommendations List */
        filteredRecommendations.length === 0 ? (
          <EmptyState
            title="No recommendations match the filter"
            description="Your cloud infrastructure sizing and architecture are well optimized."
            icon={Lightbulb}
          />
        ) : (
          <div className="space-y-4">
            {filteredRecommendations.map((rec) => {
              const isAcknowledged = acknowledgedItems.has(rec.id);
              return (
                <div
                  key={rec.id}
                  className={`bg-white rounded-xl shadow-xs border p-6 transition-all space-y-4 ${
                    isAcknowledged ? 'border-slate-200 opacity-60 bg-slate-50/50' : 'border-slate-200 hover:shadow-sm'
                  }`}
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <StatusBadge type="priority" value={rec.priority} />
                      <h4 className="text-base font-bold text-slate-900">{rec.title}</h4>
                      {rec.category && (
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {rec.category}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-slate-500">
                      Target: <strong className="text-slate-800">{rec.resourceId}</strong>
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed max-w-4xl">
                    {rec.description}
                  </p>

                  <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-[11px] font-medium text-slate-400 block">Estimated Savings Impact</span>
                      <span className="text-xs font-bold text-slate-700">
                        {rec.estimatedMonthlySavings !== null
                          ? `$${rec.estimatedMonthlySavings.toFixed(2)}/mo`
                          : 'Requires FinOps sizing assessment (No synthetic estimate)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleAcknowledge(rec.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                          isAcknowledged
                            ? 'bg-slate-200 text-slate-700 border-slate-300'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {isAcknowledged ? 'Action Plan Initiated' : 'Mark as In-Progress'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
