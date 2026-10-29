import { Router } from 'express';
import { getAllMetrics } from '../services/cloudwatch.service.js';

const router = Router();

/**
 * GET /api/metrics
 * Contract:
 * {
 *   "metrics": [],
 *   "mode": "live"
 * }
 */
router.get('/', async (req, res, next) => {
  try {
    const { lookbackHours, period, instanceId } = req.query;

    const parsedLookback = lookbackHours ? parseInt(lookbackHours, 10) : undefined;
    const parsedPeriod = period ? parseInt(period, 10) : undefined;

    const result = await getAllMetrics({
      lookbackHours: parsedLookback,
      period: parsedPeriod,
      instanceId: instanceId ? String(instanceId) : undefined
    });

    res.json({
      metrics: result.metrics,
      mode: result.mode,
      ...(result.warning && { warning: result.warning })
    });
  } catch (error) {
    next(error);
  }
});

export default router;
