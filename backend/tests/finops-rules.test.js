import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateInfrastructureAlertRules } from '../services/alert.service.js';
import {
  calculateHighestCostService,
  calculateDailyCostTrend,
  calculatePeriodComparison,
  analyzeCostData
} from '../services/cost-analysis.service.js';
import { evaluateRecommendationRules } from '../services/recommendation.service.js';

describe('FinOps Rule Engine - Infrastructure Alerts', () => {
  test('Rule 1: Stopped instance generates info alert with intentional stop explanation', () => {
    const instances = [
      { instanceId: 'i-stopped-01', name: 'batch-worker', state: 'stopped', instanceType: 't3.micro' }
    ];

    const alerts = evaluateInfrastructureAlertRules({ instances });

    assert.equal(alerts.length, 1);
    const alert = alerts[0];
    assert.equal(alert.resourceId, 'i-stopped-01');
    assert.equal(alert.title, 'EC2 Instance Stopped');
    assert.equal(alert.severity, 'info'); // NOT critical
    assert.ok(alert.description.includes('intentional or scheduled'));
    assert.ok(alert.description.includes('provisioned EBS storage charges persist'));
    assert.equal(alert.source, 'EC2');
  });

  test('Rule 2: High and Critical CPU utilization triggers warning and critical alerts', () => {
    const instances = [
      { instanceId: 'i-warn-01', name: 'web-prod-1', state: 'running' },
      { instanceId: 'i-crit-01', name: 'db-prod-1', state: 'running' }
    ];

    const metrics = [
      {
        instanceId: 'i-warn-01',
        average: 84.5,
        maximum: 88.0,
        datapoints: [{ average: 84.5 }]
      },
      {
        instanceId: 'i-crit-01',
        average: 91.2,
        maximum: 96.5, // >= 95% critical threshold
        datapoints: [{ average: 91.2, maximum: 96.5 }]
      }
    ];

    const alerts = evaluateInfrastructureAlertRules({ instances, metrics });

    assert.equal(alerts.length, 2);

    const warnAlert = alerts.find((a) => a.resourceId === 'i-warn-01');
    assert.ok(warnAlert);
    assert.equal(warnAlert.severity, 'warning');
    assert.equal(warnAlert.title, 'High CPU Utilization');

    const critAlert = alerts.find((a) => a.resourceId === 'i-crit-01');
    assert.ok(critAlert);
    assert.equal(critAlert.severity, 'critical');
    assert.equal(critAlert.title, 'Critical CPU Utilization');
  });

  test('Rule 3: Consistently low CPU generates info alert for underutilization', () => {
    const instances = [
      { instanceId: 'i-idle-01', name: 'qa-test-1', state: 'running' }
    ];

    const metrics = [
      {
        instanceId: 'i-idle-01',
        average: 2.8,
        datapoints: [
          { average: 3.0 },
          { average: 2.5 },
          { average: 2.9 }
        ]
      }
    ];

    const alerts = evaluateInfrastructureAlertRules({ instances, metrics });

    assert.equal(alerts.length, 1);
    const alert = alerts[0];
    assert.equal(alert.resourceId, 'i-idle-01');
    assert.equal(alert.severity, 'info');
    assert.equal(alert.title, 'Consistently Low CPU Utilization');
    assert.ok(alert.description.includes('underutilization threshold'));
  });

  test('Rule 4: Running instance with missing metrics generates info alert', () => {
    const instances = [
      { instanceId: 'i-nomon-01', name: 'new-app-1', state: 'running' }
    ];

    const alerts = evaluateInfrastructureAlertRules({ instances, metrics: [] });

    assert.equal(alerts.length, 1);
    const alert = alerts[0];
    assert.equal(alert.resourceId, 'i-nomon-01');
    assert.equal(alert.severity, 'info');
    assert.equal(alert.title, 'CloudWatch Metrics Unavailable');
  });

  test('Rule 5: Cost data retrieval failure generates warning alert', () => {
    const costData = { error: 'AccessDeniedException: User lacks billing permissions' };

    const alerts = evaluateInfrastructureAlertRules({ costData });

    assert.equal(alerts.length, 1);
    const alert = alerts[0];
    assert.equal(alert.severity, 'warning');
    assert.equal(alert.title, 'Cost Explorer Data Unavailable');
    assert.equal(alert.source, 'CostExplorer');
  });
});

describe('FinOps Rule Engine - Cost Analysis', () => {
  test('calculateHighestCostService identifies highest service correctly', () => {
    const breakdown = [
      { service: 'Amazon S3', amount: 45.2, percentage: 10 },
      { service: 'Amazon EC2', amount: 320.5, percentage: 70 },
      { service: 'Amazon RDS', amount: 90.0, percentage: 20 }
    ];

    const highest = calculateHighestCostService(breakdown);
    assert.ok(highest);
    assert.equal(highest.service, 'Amazon EC2');
    assert.equal(highest.amount, 320.5);
    assert.equal(highest.percentage, 70);

    // Empty list safe handling
    assert.equal(calculateHighestCostService([]), null);
    assert.equal(calculateHighestCostService(null), null);
  });

  test('calculateDailyCostTrend computes spend direction and statistics', () => {
    const increasingCosts = [
      { date: '2026-10-01', amount: 20.0 },
      { date: '2026-10-02', amount: 22.0 },
      { date: '2026-10-03', amount: 35.0 },
      { date: '2026-10-04', amount: 40.0 }
    ];

    const trend = calculateDailyCostTrend(increasingCosts);
    assert.equal(trend.direction, 'increasing');
    assert.equal(trend.minDailySpend, 20.0);
    assert.equal(trend.maxDailySpend, 40.0);
    assert.equal(trend.averageDailySpend, 29.25);

    // Insufficient data handles gracefully
    const singleDay = calculateDailyCostTrend([{ date: '2026-10-01', amount: 15.0 }]);
    assert.equal(singleDay.direction, 'insufficient-data');
    assert.equal(singleDay.averageDailySpend, 15.0);
  });

  test('calculatePeriodComparison computes percentage change across sub-periods', () => {
    const costs = [
      { date: '2026-10-01', amount: 50.0 },
      { date: '2026-10-02', amount: 50.0 },
      { date: '2026-10-03', amount: 65.0 },
      { date: '2026-10-04', amount: 65.0 }
    ];

    const comparison = calculatePeriodComparison(costs);
    assert.ok(comparison);
    assert.equal(comparison.previousPeriodTotal, 100.0);
    assert.equal(comparison.currentPeriodTotal, 130.0);
    assert.equal(comparison.percentageChange, 30.0); // +30% increase

    // Fewer than 4 days returns null safely
    assert.equal(calculatePeriodComparison(costs.slice(0, 3)), null);
  });

  test('analyzeCostData enriches complete cost model without errors on empty input', () => {
    const emptyAnalysis = analyzeCostData({});
    assert.equal(emptyAnalysis.currency, 'USD');
    assert.equal(emptyAnalysis.totalCost, 0);
    assert.deepEqual(emptyAnalysis.dailyCosts, []);
    assert.deepEqual(emptyAnalysis.serviceBreakdown, []);
    assert.equal(emptyAnalysis.highestCostService, null);
    assert.equal(emptyAnalysis.percentageChange, null);
    assert.equal(emptyAnalysis.periodComparison, null);
  });
});

describe('FinOps Rule Engine - Cost Optimization Recommendations', () => {
  test('Rule 1: Consistently low CPU generates rightsizing review with null savings', () => {
    const instances = [
      { instanceId: 'i-oversized-01', name: 'staging-api', state: 'running', instanceType: 'm5.2xlarge' }
    ];

    const metrics = [
      {
        instanceId: 'i-oversized-01',
        average: 3.1,
        datapoints: [{ average: 3.5 }, { average: 3.0 }, { average: 2.8 }]
      }
    ];

    const recs = evaluateRecommendationRules({ instances, metrics });

    assert.equal(recs.length, 1);
    const rec = recs[0];
    assert.equal(rec.id, 'rec-rightsize-i-oversized-01');
    assert.equal(rec.title, 'Review EC2 Instance Sizing');
    assert.equal(rec.priority, 'medium');
    assert.equal(rec.status, 'review');
    assert.equal(rec.estimatedMonthlySavings, null); // Strictly null as required!
    assert.equal(rec.currency, 'USD');
  });

  test('Rule 2: Stopped instance generates storage review with null savings', () => {
    const instances = [
      { instanceId: 'i-legacy-stopped', name: 'old-replica', state: 'stopped', instanceType: 'r5.large' }
    ];

    const recs = evaluateRecommendationRules({ instances });

    assert.equal(recs.length, 1);
    const rec = recs[0];
    assert.equal(rec.id, 'rec-storage-stopped-i-legacy-stopped');
    assert.equal(rec.title, 'Review Storage and Charges for Stopped Instance');
    assert.equal(rec.priority, 'medium');
    assert.equal(rec.status, 'review');
    assert.equal(rec.estimatedMonthlySavings, null); // Strictly null
  });

  test('Rule 3: Dominant spend service generates investigation recommendation', () => {
    const costAnalysis = {
      highestCostService: {
        service: 'Amazon Elastic Compute Cloud - Compute',
        amount: 850.0,
        percentage: 65.0
      },
      periodComparison: {
        previousPeriodTotal: 600.0,
        currentPeriodTotal: 850.0,
        percentageChange: 41.67
      }
    };

    const recs = evaluateRecommendationRules({ costAnalysis });

    assert.ok(recs.length >= 1);
    const dominantRec = recs.find((r) => r.title.includes('Dominant Expenditure'));
    assert.ok(dominantRec);
    assert.equal(dominantRec.priority, 'high');
    assert.equal(dominantRec.status, 'review');
    assert.equal(dominantRec.estimatedMonthlySavings, null);

    const spikeRec = recs.find((r) => r.title.includes('Expenditure Spike'));
    assert.ok(spikeRec);
    assert.equal(spikeRec.priority, 'high');
  });

  test('Rule 4: Insufficient monitoring data generates coverage recommendation', () => {
    const instances = [
      { instanceId: 'i-unmonitored-01', name: 'new-worker', state: 'running' }
    ];

    const recs = evaluateRecommendationRules({ instances, metrics: [] });

    assert.equal(recs.length, 1);
    const rec = recs[0];
    assert.equal(rec.title, 'Review Monitoring Data Coverage');
    assert.equal(rec.priority, 'low');
    assert.equal(rec.status, 'review');
    assert.equal(rec.estimatedMonthlySavings, null);
  });
});
