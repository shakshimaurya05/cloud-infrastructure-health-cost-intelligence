/**
 * Fallback mock dataset used exclusively when the backend server is unreachable.
 * Guaranteed to keep the capstone frontend 100% interactive under all network conditions.
 */

export const mockHealth = {
  status: 'ok',
  awsConfigured: false,
  mode: 'demo',
  region: 'us-east-1',
  timestamp: new Date().toISOString()
};

export const mockOverview = {
  totalInstances: 5,
  runningInstances: 3,
  stoppedInstances: 2,
  monthlyCost: 718.35,
  activeAlerts: 4,
  mode: 'demo'
};

export const mockInstances = [
  {
    instanceId: 'i-09a8b7c6d5e4f3a21',
    name: 'production-api-01',
    state: 'running',
    instanceType: 't3.xlarge',
    availabilityZone: 'us-east-1a',
    launchTime: '2026-08-15T08:30:00.000Z',
    publicIp: '54.210.45.12',
    privateIp: '10.0.1.15',
    tags: { Environment: 'Production', Project: 'Core-API', Owner: 'DevOps' }
  },
  {
    instanceId: 'i-07b6c5d4e3f2a1b90',
    name: 'production-worker-01',
    state: 'running',
    instanceType: 'm5.large',
    availabilityZone: 'us-east-1b',
    launchTime: '2026-08-20T11:15:00.000Z',
    publicIp: '54.210.78.33',
    privateIp: '10.0.2.24',
    tags: { Environment: 'Production', Project: 'Queue-Worker', Owner: 'Backend' }
  },
  {
    instanceId: 'i-03e2f1a0b9c8d7e65',
    name: 'staging-api-01',
    state: 'running',
    instanceType: 't3.medium',
    availabilityZone: 'us-east-1a',
    launchTime: '2026-09-01T14:00:00.000Z',
    publicIp: '34.201.12.90',
    privateIp: '10.0.1.88',
    tags: { Environment: 'Staging', Project: 'Core-API', Owner: 'QA' }
  },
  {
    instanceId: 'i-05c4d3e2f1a0b9c87',
    name: 'analytics-db-replica',
    state: 'stopped',
    instanceType: 'r5.xlarge',
    availabilityZone: 'us-east-1c',
    launchTime: '2026-07-10T09:00:00.000Z',
    publicIp: null,
    privateIp: '10.0.3.50',
    tags: { Environment: 'Production', Project: 'Analytics', Owner: 'DataTeam' }
  },
  {
    instanceId: 'i-01f2e3d4c5b6a7980',
    name: 'dev-bastion-host',
    state: 'stopped',
    instanceType: 't3.nano',
    availabilityZone: 'us-east-1a',
    launchTime: '2026-09-15T16:45:00.000Z',
    publicIp: null,
    privateIp: '10.0.1.200',
    tags: { Environment: 'Development', Project: 'Bastion', Owner: 'Security' }
  }
];

export const mockMetrics = [
  {
    instanceId: 'i-09a8b7c6d5e4f3a21',
    instanceName: 'production-api-01',
    metricName: 'CPUUtilization',
    unit: 'Percent',
    average: 68.4,
    maximum: 94.2,
    minimum: 42.1,
    datapoints: [
      { timestamp: '10:00', average: 58.2, maximum: 72.0, minimum: 45.0 },
      { timestamp: '11:00', average: 64.5, maximum: 81.2, minimum: 50.0 },
      { timestamp: '12:00', average: 75.8, maximum: 91.5, minimum: 62.0 },
      { timestamp: '13:00', average: 88.2, maximum: 94.2, minimum: 78.0 },
      { timestamp: '14:00', average: 65.4, maximum: 80.0, minimum: 52.0 },
      { timestamp: '15:00', average: 68.4, maximum: 85.0, minimum: 42.1 }
    ]
  },
  {
    instanceId: 'i-07b6c5d4e3f2a1b90',
    instanceName: 'production-worker-01',
    metricName: 'CPUUtilization',
    unit: 'Percent',
    average: 34.8,
    maximum: 53.6,
    minimum: 18.1,
    datapoints: [
      { timestamp: '10:00', average: 32.0, maximum: 45.0, minimum: 20.0 },
      { timestamp: '11:00', average: 36.5, maximum: 50.0, minimum: 22.0 },
      { timestamp: '12:00', average: 41.2, maximum: 53.6, minimum: 28.0 },
      { timestamp: '13:00', average: 35.0, maximum: 48.0, minimum: 24.0 },
      { timestamp: '14:00', average: 31.8, maximum: 42.0, minimum: 19.0 },
      { timestamp: '15:00', average: 34.8, maximum: 46.0, minimum: 18.1 }
    ]
  },
  {
    instanceId: 'i-03e2f1a0b9c8d7e65',
    instanceName: 'staging-api-01',
    metricName: 'CPUUtilization',
    unit: 'Percent',
    average: 3.5,
    maximum: 13.2,
    minimum: 0.1,
    datapoints: [
      { timestamp: '10:00', average: 2.1, maximum: 6.0, minimum: 0.1 },
      { timestamp: '11:00', average: 4.5, maximum: 12.0, minimum: 1.0 },
      { timestamp: '12:00', average: 3.8, maximum: 13.2, minimum: 0.5 },
      { timestamp: '13:00', average: 2.9, maximum: 7.0, minimum: 0.2 },
      { timestamp: '14:00', average: 3.2, maximum: 8.5, minimum: 0.3 },
      { timestamp: '15:00', average: 3.5, maximum: 9.0, minimum: 0.2 }
    ]
  }
];

export const mockCosts = {
  currency: 'USD',
  totalCost: 718.35,
  dailyCosts: [
    { date: '10-16', amount: 54.61, unit: 'USD' },
    { date: '10-17', amount: 39.15, unit: 'USD' },
    { date: '10-18', amount: 37.80, unit: 'USD' },
    { date: '10-19', amount: 52.40, unit: 'USD' },
    { date: '10-20', amount: 56.10, unit: 'USD' },
    { date: '10-21', amount: 54.20, unit: 'USD' },
    { date: '10-22', amount: 55.80, unit: 'USD' },
    { date: '10-23', amount: 57.30, unit: 'USD' },
    { date: '10-24', amount: 41.20, unit: 'USD' },
    { date: '10-25', amount: 38.90, unit: 'USD' },
    { date: '10-26', amount: 56.40, unit: 'USD' },
    { date: '10-27', amount: 58.10, unit: 'USD' },
    { date: '10-28', amount: 51.50, unit: 'USD' },
    { date: '10-29', amount: 54.79, unit: 'USD' }
  ],
  serviceBreakdown: [
    { service: 'Amazon Elastic Compute Cloud - Compute', amount: 620.40, unit: 'USD', percentage: 41.76 },
    { service: 'Amazon Relational Database Service', amount: 395.12, unit: 'USD', percentage: 26.60 },
    { service: 'Amazon Simple Storage Service', amount: 185.30, unit: 'USD', percentage: 12.47 },
    { service: 'Amazon CloudWatch', amount: 98.40, unit: 'USD', percentage: 6.62 },
    { service: 'Amazon Virtual Private Cloud', amount: 84.60, unit: 'USD', percentage: 5.69 },
    { service: 'AWS Lambda', amount: 42.15, unit: 'USD', percentage: 2.84 },
    { service: 'Other AWS Services', amount: 59.65, unit: 'USD', percentage: 4.02 }
  ],
  highestCostService: {
    service: 'Amazon Elastic Compute Cloud - Compute',
    amount: 620.40,
    percentage: 41.76
  },
  dailyTrend: {
    direction: 'stable',
    averageDailySpend: 51.31,
    minDailySpend: 37.80,
    maxDailySpend: 58.10
  },
  percentageChange: 2.1,
  periodComparison: {
    previousPeriodTotal: 340.26,
    currentPeriodTotal: 378.09,
    percentageChange: 2.1
  },
  mode: 'demo'
};

export const mockAlerts = [
  {
    id: 'alt-001',
    title: 'High CPU Utilization',
    severity: 'warning',
    description: 'Average CPU utilization on production-api-01 sustained > 90% for over 15 minutes.',
    resourceId: 'i-09a8b7c6d5e4f3a21',
    source: 'CloudWatch',
    createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString()
  },
  {
    id: 'alt-002',
    title: 'EC2 Instance Stopped',
    severity: 'info',
    description: 'Instance analytics-db-replica is stopped. Note: stopped instances may be intentional or scheduled, but provisioned EBS storage charges persist.',
    resourceId: 'i-05c4d3e2f1a0b9c87',
    source: 'EC2',
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  },
  {
    id: 'alt-003',
    title: 'NAT Gateway Spend Spike',
    severity: 'warning',
    description: 'NAT Gateway data processing volume experienced a 45% spike compared to weekly baseline.',
    resourceId: 'vpc-natgw-01',
    source: 'VPC',
    createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString()
  },
  {
    id: 'alt-004',
    title: 'Budget Alert Threshold Reached',
    severity: 'info',
    description: 'Projected monthly AWS spend is currently within 4% of configured alert threshold ($1,500.00).',
    resourceId: 'budget-monthly-core',
    source: 'CostExplorer',
    createdAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString()
  }
];

export const mockRecommendations = [
  {
    id: 'rec-001',
    title: 'Review EC2 Instance Sizing',
    description: 'Instance staging-api-01 (t3.medium) averages 3.5% CPU utilization during the observation period. Review for potential rightsizing.',
    resourceId: 'i-03e2f1a0b9c8d7e65',
    priority: 'medium',
    estimatedMonthlySavings: null,
    currency: 'USD',
    status: 'review',
    category: 'Cost Optimization',
    impact: 'Medium'
  },
  {
    id: 'rec-002',
    title: 'Check Storage for Stopped Instance',
    description: 'analytics-db-replica has been stopped for > 14 days. Verify if attached EBS volumes and snapshots can be archived or deleted.',
    resourceId: 'i-05c4d3e2f1a0b9c87',
    priority: 'medium',
    estimatedMonthlySavings: null,
    currency: 'USD',
    status: 'review',
    category: 'Cost Optimization',
    impact: 'Medium'
  },
  {
    id: 'rec-003',
    title: 'Investigate Top Expenditure Service: EC2 Compute',
    description: 'Amazon EC2 represents 41.76% of total cloud expenditure. Review steady-state workloads for Compute Savings Plans eligibility.',
    resourceId: 'Amazon Elastic Compute Cloud - Compute',
    priority: 'high',
    estimatedMonthlySavings: null,
    currency: 'USD',
    status: 'review',
    category: 'Cost Optimization',
    impact: 'High'
  },
  {
    id: 'rec-004',
    title: 'Review Monitoring Coverage for Bastion Host',
    description: 'Instance dev-bastion-host has no active monitoring metrics. Ensure CloudWatch detailed monitoring is configured if active.',
    resourceId: 'i-01f2e3d4c5b6a7980',
    priority: 'low',
    estimatedMonthlySavings: null,
    currency: 'USD',
    status: 'review',
    category: 'Governance & Monitoring',
    impact: 'Low'
  }
];
