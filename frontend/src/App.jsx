import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/layout/Layout';
import OverviewPage from './pages/OverviewPage';
import InfrastructurePage from './pages/InfrastructurePage';
import MonitoringPage from './pages/MonitoringPage';
import InventoryPage from './pages/InventoryPage';
import CostIntelligencePage from './pages/CostIntelligencePage';
import AlertsRecommendationsPage from './pages/AlertsRecommendationsPage';
import SettingsPage from './pages/SettingsPage';
import { fetchHealth } from './api/client';

function AppContent() {
  const location = useLocation();
  const [mode, setMode] = useState('demo');
  const [region, setRegion] = useState('us-east-1');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Sync health & mode on mount
  const syncHealth = async () => {
    try {
      const res = await fetchHealth();
      if (res.data?.mode) {
        setMode(res.data.mode);
      }
      if (res.data?.region) {
        setRegion(res.data.region);
      }
    } catch {
      setMode('demo');
    }
  };

  useEffect(() => {
    syncHealth();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await syncHealth();
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // Determine page title based on current route
  const getPageMeta = () => {
    switch (location.pathname) {
      case '/infrastructure':
        return {
          title: 'Infrastructure Monitoring',
          subtitle: 'Real-time EC2 compute inventory, states, and CloudWatch utilization'
        };
      case '/monitoring':
        return {
          title: 'Health & Monitoring',
          subtitle: 'EC2 status checks, CloudWatch CPU metrics, health indicators, and threshold-based alerts'
        };
      case '/inventory':
        return {
          title: 'Infrastructure Inventory',
          subtitle: 'EC2 instances, EBS volumes, and Elastic IPs — search, filter, and inspect resources'
        };
      case '/costs':
        return {
          title: 'Cloud Cost Intelligence',
          subtitle: 'AWS Cost Explorer daily spend trends, service distribution, and FinOps analytics'
        };
      case '/alerts':
        return {
          title: 'Alerts & Optimization Actions',
          subtitle: 'Active infrastructure health alerts and automated cost-saving recommendations'
        };
      case '/settings':
        return {
          title: 'Project Information & Health',
          subtitle: 'System architecture, AWS provider chain, and live endpoint diagnostics'
        };
      case '/':
      default:
        return {
          title: 'Cloud Intelligence Overview',
          subtitle: 'Executive health, compute inventory, and cloud expenditure summary'
        };
    }
  };

  const { title, subtitle } = getPageMeta();

  return (
    <Layout
      title={title}
      subtitle={subtitle}
      mode={mode}
      region={region}
      isRefreshing={isRefreshing}
      onRefresh={handleRefresh}
    >
      <div key={refreshKey}>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/infrastructure" element={<InfrastructurePage />} />
          <Route path="/monitoring"     element={<MonitoringPage />} />
          <Route path="/inventory"      element={<InventoryPage />} />
          <Route path="/costs" element={<CostIntelligencePage />} />
          <Route path="/alerts" element={<AlertsRecommendationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
