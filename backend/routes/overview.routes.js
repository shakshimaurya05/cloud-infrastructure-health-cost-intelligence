import { Router } from 'express';
import { getEc2Instances } from '../services/ec2.service.js';
import { getAwsCosts } from '../services/cost.service.js';
import { getInfrastructureAlerts } from '../services/alert.service.js';

const router = Router();

/**
 * GET /api/overview
 * Contract:
 * {
 *   "totalInstances": 0,
 *   "runningInstances": 0,
 *   "stoppedInstances": 0,
 *   "monthlyCost": 0,
 *   "activeAlerts": 0,
 *   "mode": "live"
 * }
 */
router.get('/', async (req, res, next) => {
  try {
    // Fetch overview components concurrently
    const [instancesResult, costsResult, alertsResult] = await Promise.all([
      getEc2Instances(),
      getAwsCosts(),
      getInfrastructureAlerts()
    ]);

    const instances = instancesResult.instances || [];
    const totalInstances = instances.length;
    const runningInstances = instances.filter(
      (inst) => (inst.state || '').toLowerCase() === 'running'
    ).length;
    const stoppedInstances = instances.filter(
      (inst) => (inst.state || '').toLowerCase() === 'stopped'
    ).length;

    const monthlyCost = costsResult.totalCost || 0;
    const activeAlerts = (alertsResult.alerts || []).length;

    // Determine aggregate execution mode
    const isDemo =
      instancesResult.mode === 'demo' ||
      costsResult.mode === 'demo' ||
      alertsResult.mode === 'demo';

    const mode = isDemo ? 'demo' : 'live';

    res.json({
      totalInstances,
      runningInstances,
      stoppedInstances,
      monthlyCost,
      activeAlerts,
      mode
    });
  } catch (error) {
    next(error);
  }
});

export default router;
