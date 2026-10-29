import { Router } from 'express';
import { getInfrastructureAlerts } from '../services/alert.service.js';

const router = Router();

/**
 * GET /api/alerts
 * Contract:
 * {
 *   "alerts": [
 *     {
 *       "id": "alert-id",
 *       "title": "High CPU Utilization",
 *       "severity": "warning",
 *       "description": "...",
 *       "resourceId": "i-example",
 *       "source": "CloudWatch",
 *       "createdAt": "..."
 *     }
 *   ],
 *   "mode": "live"
 * }
 */
router.get('/', async (req, res, next) => {
  try {
    const { severity, highCpuThreshold, criticalCpuThreshold, lowCpuThreshold } = req.query;

    const options = {};
    if (highCpuThreshold) options.highCpuWarningThreshold = parseFloat(highCpuThreshold);
    if (criticalCpuThreshold) options.criticalCpuThreshold = parseFloat(criticalCpuThreshold);
    if (lowCpuThreshold) options.lowCpuThreshold = parseFloat(lowCpuThreshold);

    const alertResult = await getInfrastructureAlerts(options);

    let alerts = alertResult.alerts;

    // Optional query filtering by severity (info, warning, critical)
    if (severity) {
      alerts = alerts.filter(
        (a) => a.severity.toLowerCase() === String(severity).toLowerCase()
      );
    }

    res.json({
      alerts,
      mode: alertResult.mode,
      ...(alertResult.warning && { warning: alertResult.warning })
    });
  } catch (error) {
    next(error);
  }
});

export default router;
