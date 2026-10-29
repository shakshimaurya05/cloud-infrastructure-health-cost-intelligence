import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Award,
  Layers,
  Calendar,
  AlertCircle,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { Link } from 'react-router-dom';
import StatCard from '../components/common/StatCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorAlert from '../components/common/ErrorAlert';
import SpendTrendChart from '../components/charts/SpendTrendChart';
import ServicePieChart from '../components/charts/ServicePieChart';
import { fetchCosts } from '../api/client';

export default function CostIntelligencePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [costData, setCostData] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCosts();
      setCostData(res.data);
    } catch (err) {
      setError(err.message || 'Failed to retrieve AWS Cost Explorer analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Querying AWS Cost Explorer dimensions & service allocations..." size="lg" />;
  }

  const totalCost = costData?.totalCost || 0;
  const currency = costData?.currency || 'USD';
  const highestService = costData?.highestCostService;
  const dailyTrend = costData?.dailyTrend;
  const periodComparison = costData?.periodComparison;
  const serviceBreakdown = costData?.serviceBreakdown || [];

  return (
    <div className="space-y-8">
      {error && <ErrorAlert message={error} onRetry={loadData} />}

      {/* Top FinOps Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Cloud Expenditure"
          value={`$${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtext={`Currency: ${currency} (Unblended)`}
          icon={DollarSign}
          color="indigo"
          trend={costData?.percentageChange}
        />
        <StatCard
          title="Highest Cost Service"
          value={highestService ? `$${highestService.amount.toFixed(0)}` : '$0.00'}
          subtext={highestService ? `${highestService.percentage}% total (${highestService.service.split(' - ')[0]})` : 'None'}
          icon={Award}
          color="rose"
        />
        <StatCard
          title="Average Daily Spend"
          value={`$${dailyTrend?.averageDailySpend ? dailyTrend.averageDailySpend.toFixed(2) : '0.00'}`}
          subtext={`Min: $${dailyTrend?.minDailySpend || 0} / Max: $${dailyTrend?.maxDailySpend || 0}`}
          icon={Calendar}
          color="blue"
        />
        <StatCard
          title="Period Spend Trend"
          value={dailyTrend?.direction ? dailyTrend.direction.toUpperCase() : 'STABLE'}
          subtext={periodComparison ? `${periodComparison.percentageChange > 0 ? '+' : ''}${periodComparison.percentageChange}% vs prior period` : 'Observation steady'}
          icon={TrendingUp}
          color={dailyTrend?.direction === 'increasing' ? 'rose' : 'emerald'}
        />
      </div>

      {/* Spending Trend Visualization & Donut Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-xs border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Daily Cloud Spend Progression
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Historical daily unblended AWS expenditure</p>
            </div>
            <span className="text-xs text-slate-400 font-medium">Daily Granularity</span>
          </div>
          <SpendTrendChart data={costData?.dailyCosts || []} height={280} />
        </div>

        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                Service Proportions
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Relative percentage share by AWS service</p>
            </div>
          </div>
          <ServicePieChart data={serviceBreakdown} height={280} />
        </div>
      </div>

      {/* Detailed Service Allocation Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Service-Level Spending Breakdown</h3>
            <p className="text-xs text-slate-500 mt-0.5">Categorized expenditure by AWS product and service dimension</p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-md">
            {serviceBreakdown.length} Services Detected
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-5">AWS Service Name</th>
                <th className="py-3 px-4">Expenditure Amount</th>
                <th className="py-3 px-4">% Share of Bill</th>
                <th className="py-3 px-5">Relative Distribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {serviceBreakdown.map((item, idx) => (
                <tr key={item.service} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-5 font-semibold text-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-bold text-[10px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span>{item.service}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                    ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-indigo-600">
                    {item.percentage}%
                  </td>
                  <td className="py-3.5 px-5">
                    <div className="w-48 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(3, item.percentage))}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Potential Optimization Opportunities Callout */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-900 to-slate-900 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4" />
            FinOps Recommendation Engine Active
          </div>
          <h3 className="text-lg font-bold">Identified Potential Cost Optimization Opportunities</h3>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Our rule-based engine has identified idle compute, unattached storage volumes, and dominant spend drivers.
            Review the actionable recommendations to eliminate waste and optimize cloud spend.
          </p>
        </div>
        <Link
          to="/alerts"
          className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold transition-all shadow-md hover:shadow-indigo-500/25"
        >
          <span>View Optimization Rules</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
