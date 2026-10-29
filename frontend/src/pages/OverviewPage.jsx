import React, { useState, useEffect } from 'react';
import {
  Server,
  PlayCircle,
  StopCircle,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Cpu,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorAlert from '../components/common/ErrorAlert';
import SpendTrendChart from '../components/charts/SpendTrendChart';
import ServicePieChart from '../components/charts/ServicePieChart';
import CpuUtilizationChart from '../components/charts/CpuUtilizationChart';
import { fetchOverview, fetchCosts, fetchAlerts, fetchMetrics } from '../api/client';

export default function OverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState(null);
  const [costs, setCosts] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [metrics, setMetrics] = useState([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovRes, costRes, alertRes, metricRes] = await Promise.all([
        fetchOverview(),
        fetchCosts(),
        fetchAlerts(),
        fetchMetrics({ lookbackHours: 24 })
      ]);

      setOverview(ovRes.data);
      setCosts(costRes.data);
      setAlerts(alertRes.data?.alerts || []);
      setMetrics(metricRes.data?.metrics || []);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard overview data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Aggregating AWS health & FinOps telemetry..." size="lg" />;
  }

  const totalInstances = overview?.totalInstances || 0;
  const runningInstances = overview?.runningInstances || 0;
  const stoppedInstances = overview?.stoppedInstances || 0;
  const monthlyCost = overview?.monthlyCost || costs?.totalCost || 0;
  const activeAlertsCount = alerts.length || overview?.activeAlerts || 0;

  return (
    <div className="space-y-8">
      {error && <ErrorAlert message={error} onRetry={loadData} />}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total EC2 Instances"
          value={totalInstances}
          subtext="Provisioned Compute"
          icon={Server}
          color="indigo"
        />
        <StatCard
          title="Running Instances"
          value={runningInstances}
          subtext="Active Workloads"
          icon={PlayCircle}
          color="emerald"
        />
        <StatCard
          title="Stopped Instances"
          value={stoppedInstances}
          subtext="EBS charges ongoing"
          icon={StopCircle}
          color="amber"
        />
        <StatCard
          title="Monthly AWS Cost"
          value={`$${monthlyCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtext="Period spend to date"
          icon={DollarSign}
          color="blue"
          trend={costs?.percentageChange}
        />
        <StatCard
          title="Active Alerts"
          value={activeAlertsCount}
          subtext="Health & cost anomalies"
          icon={AlertTriangle}
          color={activeAlertsCount > 0 ? 'rose' : 'emerald'}
        />
      </div>

      {/* Main Charts Row: Spend Trend + Service Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Spending Trend (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-xs border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                AWS Expenditure Trend
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Daily AWS billing trend for the requested observation window</p>
            </div>
            {costs?.dailyTrend && (
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
                Trend: <span className="text-indigo-600 uppercase">{costs.dailyTrend.direction}</span>
              </span>
            )}
          </div>
          <SpendTrendChart data={costs?.dailyCosts || []} height={260} />
        </div>

        {/* Service Cost Breakdown (1 col) */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                Spend by Service
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Distribution across AWS products</p>
            </div>
            <Link to="/costs" className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <ServicePieChart data={costs?.serviceBreakdown || []} height={260} />
        </div>
      </div>

      {/* Second Row: CPU Utilization + Recent Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU Utilization Bar Chart */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-600" />
                EC2 CPU Utilization Overview
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Average vs Peak CPU% over last 24 hours</p>
            </div>
            <Link to="/infrastructure" className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              Instances <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <CpuUtilizationChart data={metrics} height={250} />
        </div>

        {/* Active Alerts Preview */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Recent Infrastructure Alerts
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Issues requiring engineering or FinOps attention</p>
            </div>
            <Link to="/alerts" className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              Manage <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[250px] pr-1">
            {alerts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <p className="text-xs font-medium">All infrastructure systems operating within normal parameters.</p>
              </div>
            ) : (
              alerts.slice(0, 4).map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-slate-100/70 transition-colors flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge type="severity" value={alert.severity} />
                      <h4 className="text-xs font-bold text-slate-800">{alert.title}</h4>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                      {alert.description}
                    </p>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Resource: {alert.resourceId}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 flex-shrink-0 font-medium">
                    {alert.source}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
