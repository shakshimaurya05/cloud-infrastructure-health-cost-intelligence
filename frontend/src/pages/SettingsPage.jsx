import React, { useState, useEffect } from 'react';
import {
  Settings,
  Server,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Database,
  Cpu,
  Layers,
  Code2,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { fetchHealth, API_BASE_URL } from '../api/client';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function SettingsPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await fetchHealth();
      setHealth(res);
    } catch {
      setHealth({ isFallback: true, mode: 'demo' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const isLive = health?.data?.mode === 'live' && !health?.isFallback;
  const isAwsConfigured = health?.data?.awsConfigured === true;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Capstone Project Overview Header */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Cloud Infrastructure Health and Cost Intelligence Platform
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                College Capstone Engineering Project • Cloud Architecture & FinOps
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
            Version 1.0.0
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed pt-2">
          This platform demonstrates an enterprise cloud management dashboard interfacing with AWS SDK v3.
          It collects EC2 compute inventory, analyzes CloudWatch utilization telemetry, queries AWS Cost Explorer spend trends,
          and surfaces automated rule-based FinOps recommendations without modifying AWS resources.
        </p>
      </div>

      {/* Backend & AWS Connection Status Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-600" />
              Backend Connection & AWS Status
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Live handshake status with the Express API and AWS provider chain</p>
          </div>
          <button
            onClick={checkHealth}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            Check Connection
          </button>
        </div>

        {loading ? (
          <LoadingSpinner message="Testing connection handshake..." size="sm" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Express Server Handshake */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <span className="text-[11px] font-bold uppercase text-slate-400">Express Backend API</span>
              <div className="flex items-center gap-2">
                {health?.isFallback ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-amber-700">Offline (Using Client Fallback)</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-bold text-emerald-700">Connected & Responsive</span>
                  </>
                )}
              </div>
              <p className="text-[11px] font-mono text-slate-500 truncate" title={API_BASE_URL}>
                {API_BASE_URL}
              </p>
            </div>

            {/* AWS Configuration */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <span className="text-[11px] font-bold uppercase text-slate-400">AWS Credentials Chain</span>
              <div className="flex items-center gap-2">
                {isAwsConfigured ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-bold text-emerald-700">Configured & Resolved</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-amber-700">Unconfigured (Demo Mode)</span>
                  </>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Region: <strong className="font-mono text-slate-700">{health?.data?.region || 'us-east-1'}</strong>
              </p>
            </div>

            {/* Data Source Mode */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <span className="text-[11px] font-bold uppercase text-slate-400">Telemetry Mode</span>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                    isLive ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {isLive ? 'Live AWS Telemetry' : 'Simulated Demo Data'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {isLive ? 'Real-time AWS API responses' : 'Synthetic data for demo & development'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Cloud Data Sources Overview */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-600" />
          Monitored AWS Data Sources
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 border border-slate-100 bg-slate-50/50 rounded-xl space-y-1.5">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-blue-600" />
              Amazon EC2
            </h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Fetches compute inventory, lifecycle states, instance families, availability zones, and tags via <code>ec2:DescribeInstances</code>.
            </p>
          </div>

          <div className="p-4 border border-slate-100 bg-slate-50/50 rounded-xl space-y-1.5">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              Amazon CloudWatch
            </h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Retrieves CPU utilization statistics, peak load, and active alarm states via <code>cloudwatch:GetMetricStatistics</code>.
            </p>
          </div>

          <div className="p-4 border border-slate-100 bg-slate-50/50 rounded-xl space-y-1.5">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-emerald-600" />
              AWS Cost Explorer
            </h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Collects daily spend breakdown, product-wise allocations, and period comparisons via <code>ce:GetCostAndUsage</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Capstone Tech Stack Badges */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900">Project Technology Architecture</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-700">Frontend Technology Stack</h4>
            <div className="flex flex-wrap gap-2">
              <span className="px-2.5 py-1 rounded bg-slate-100 font-medium text-slate-700">React 18</span>
              <span className="px-2.5 py-1 rounded bg-slate-100 font-medium text-slate-700">Vite 6</span>
              <span className="px-2.5 py-1 rounded bg-slate-100 font-medium text-slate-700">Tailwind CSS v3</span>
              <span className="px-2.5 py-1 rounded bg-slate-100 font-medium text-slate-700">React Router v6</span>
              <span className="px-2.5 py-1 rounded bg-slate-100 font-medium text-slate-700">Recharts 2.x</span>
              <span className="px-2.5 py-1 rounded bg-slate-100 font-medium text-slate-700">Lucide React Icons</span>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-700">Backend & Cloud Stack</h4>
            <div className="flex flex-wrap gap-2">
              <span className="px-2.5 py-1 rounded bg-slate-100 font-medium text-slate-700">Node.js 24</span>
              <span className="px-2.5 py-1 rounded bg-slate-100 font-medium text-slate-700">Express.js 4</span>
              <span className="px-2.5 py-1 rounded bg-slate-100 font-medium text-slate-700">AWS SDK v3 for JS</span>
              <span className="px-2.5 py-1 rounded bg-slate-100 font-medium text-slate-700">Helmet & CORS</span>
              <span className="px-2.5 py-1 rounded bg-slate-100 font-medium text-slate-700">FinOps Heuristics Engine</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
