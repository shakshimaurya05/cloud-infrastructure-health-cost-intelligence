/**
 * Sample / Demo datasets for development, testing, and fallback when AWS is not connected.
 * Every response derived from this data is explicitly labeled with mode: "demo".
 */

export const getDemoInstances = () => [
  {
    instanceId: 'i-09a8b7c6d5e4f3a21',
    name: 'production-api-01',
    state: 'running',
    instanceType: 't3.xlarge',
    availabilityZone: 'us-east-1a',
    launchTime: '2026-08-15T08:30:00.000Z',
    publicIp: '54.210.45.12',
    privateIp: '10.0.1.15',
    tags: {
      Environment: 'Production',
      Project: 'Core-API',
      Owner: 'DevOps'
    }
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
    tags: {
      Environment: 'Production',
      Project: 'Queue-Worker',
      Owner: 'Backend'
    }
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
    tags: {
      Environment: 'Staging',
      Project: 'Core-API',
      Owner: 'QA'
    }
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
    tags: {
      Environment: 'Production',
      Project: 'Analytics',
      Owner: 'DataTeam'
    }
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
    tags: {
      Environment: 'Development',
      Project: 'Bastion',
      Owner: 'Security'
    }
  }
];

export const getDemoMetrics = (lookbackHours = 24) => {
  const now = Date.now();
  const instances = [
    { id: 'i-09a8b7c6d5e4f3a21', name: 'production-api-01', baseCpu: 68, variance: 22 },
    { id: 'i-07b6c5d4e3f2a1b90', name: 'production-worker-01', baseCpu: 35, variance: 15 },
    { id: 'i-03e2f1a0b9c8d7e65', name: 'staging-api-01', baseCpu: 3.5, variance: 2.5 }
  ];

  return instances.map((inst) => {
    const datapoints = [];
    const intervalHours = Math.max(1, Math.floor(lookbackHours / 24));
    const stepCount = Math.min(24, Math.floor(lookbackHours / intervalHours));

    for (let i = stepCount; i >= 0; i--) {
      const time = new Date(now - i * intervalHours * 3600 * 1000).toISOString();
      const wave = Math.sin((stepCount - i) / 2) * (inst.variance * 0.7);
      const randomNoise = (Math.random() - 0.5) * (inst.variance * 0.4);
      const avg = Math.min(100, Math.max(0.5, parseFloat((inst.baseCpu + wave + randomNoise).toFixed(2))));
      const max = Math.min(100, parseFloat((avg + Math.random() * 8).toFixed(2)));
      const min = Math.max(0.1, parseFloat((avg - Math.random() * 6).toFixed(2)));

      datapoints.push({
        timestamp: time,
        average: avg,
        maximum: max,
        minimum: min
      });
    }

    const avgVal = parseFloat(
      (datapoints.reduce((acc, d) => acc + d.average, 0) / (datapoints.length || 1)).toFixed(2)
    );
    const maxVal = Math.max(...datapoints.map((d) => d.maximum));
    const minVal = Math.min(...datapoints.map((d) => d.minimum));

    return {
      instanceId: inst.id,
      instanceName: inst.name,
      metricName: 'CPUUtilization',
      unit: 'Percent',
      average: avgVal,
      maximum: maxVal,
      minimum: minVal,
      datapoints
    };
  });
};

export const getDemoCosts = (days = 14) => {
  const dailyCosts = [];
  const now = new Date();
  let accumulatedTotal = 0;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    
    // Slight weekend variance
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const baseDaily = isWeekend ? 38.5 : 54.2;
    const randomVariation = (Math.random() - 0.5) * 8.0;
    const amount = parseFloat((baseDaily + randomVariation).toFixed(2));
    
    accumulatedTotal += amount;
    dailyCosts.push({
      date: dateStr,
      amount,
      unit: 'USD'
    });
  }

  const serviceBreakdown = [
    { service: 'Amazon Elastic Compute Cloud - Compute', amount: 620.40, unit: 'USD', percentage: 41.76 },
    { service: 'Amazon Relational Database Service', amount: 395.12, unit: 'USD', percentage: 26.60 },
    { service: 'Amazon Simple Storage Service', amount: 185.30, unit: 'USD', percentage: 12.47 },
    { service: 'Amazon CloudWatch', amount: 98.40, unit: 'USD', percentage: 6.62 },
    { service: 'Amazon Virtual Private Cloud', amount: 84.60, unit: 'USD', percentage: 5.69 },
    { service: 'AWS Lambda', amount: 42.15, unit: 'USD', percentage: 2.84 },
    { service: 'Other AWS Services', amount: 59.65, unit: 'USD', percentage: 4.02 }
  ];

  return {
    currency: 'USD',
    totalCost: parseFloat(accumulatedTotal.toFixed(2)),
    dailyCosts,
    serviceBreakdown
  };
};

export const getDemoAlerts = () => [
  {
    id: 'alt-001',
    title: 'High CPU Utilization',
    severity: 'warning',
    description: 'Average CPU utilization on production-api-01 sustained > 90% for over 15 minutes.',
    resourceId: 'i-09a8b7c6d5e4f3a21',
    source: 'CloudWatch',
    createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    // Backward compatibility fields
    type: 'warning',
    message: 'Average CPU utilization on production-api-01 sustained > 90% for over 15 minutes.',
    resourceType: 'CloudWatch',
    timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString()
  },
  {
    id: 'alt-002',
    title: 'EC2 Instance Stopped',
    severity: 'info',
    description: 'Instance analytics-db-replica is stopped. Note: stopped instances may be intentional or scheduled, but provisioned EBS storage charges persist.',
    resourceId: 'i-05c4d3e2f1a0b9c87',
    source: 'EC2',
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    type: 'info',
    message: 'Instance analytics-db-replica is stopped. Note: stopped instances may be intentional or scheduled, but provisioned EBS storage charges persist.',
    resourceType: 'EC2',
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  },
  {
    id: 'alt-003',
    title: 'NAT Gateway Spend Spike',
    severity: 'warning',
    description: 'NAT Gateway data processing volume experienced a 45% spike compared to weekly baseline.',
    resourceId: 'vpc-natgw-01',
    source: 'VPC',
    createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    type: 'warning',
    message: 'NAT Gateway data processing volume experienced a 45% spike compared to weekly baseline.',
    resourceType: 'VPC',
    timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString()
  },
  {
    id: 'alt-004',
    title: 'Budget Alert Threshold Reached',
    severity: 'info',
    description: 'Projected monthly AWS spend is currently within 4% of configured alert threshold ($1,500.00).',
    resourceId: 'budget-monthly-core',
    source: 'CostExplorer',
    createdAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    type: 'info',
    message: 'Projected monthly AWS spend is currently within 4% of configured alert threshold ($1,500.00).',
    resourceType: 'CostExplorer',
    timestamp: new Date(Date.now() - 8 * 3600 * 1000).toISOString()
  }
];

export const getDemoRecommendations = () => [
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
