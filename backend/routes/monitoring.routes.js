import { Router } from 'express';
import {
  getHealthSummary,
  DEFAULT_HEALTH_THRESHOLDS,
  OBSERVATION_PERIODS
} from '../services/health.service.js';

const router = Router();

/**
 * GET /api/monitoring
 *
 * Returns EC2 health summary: instance metadata, EC2 status checks,
 * CloudWatch CPU metrics, derived health status, and health reason.
 *
 * Query params:
 *   lookbackHours  {number}  1 | 3 | 6 | 12 | 24 | 72  (default: 24)
 *   instanceId     {string}  Scope to a single instance (optional)
 *   cpuWarning     {number}  CPU warning threshold % (default: 80)
 *   cpuCritical    {number}  CPU critical threshold % (default: 95)
 *
 * Response contract:
 * {
 *   "instances": [
 *     {
 *       "instanceId":        "i-xxx",
 *       "name":              "string",
 *       "instanceType":      "string",
 *       "instanceState":     "running|stopped|...",
 *       "availabilityZone":  "string",
 *       "region":            "string",
 *       "launchTime":        "ISO8601|null",
 *       "publicIp":          "string|null",
 *       "privateIp":         "string|null",
 *       "tags":              {},
 *       "statusCheck": {
 *         "instanceStatus":     "ok|impaired|unknown",
 *         "systemStatus":       "ok|impaired|unknown",
 *         "hasFailed":          false,
 *         "failedCheckDetails": "string|null"
 *       } | null,
 *       "cpu": {
 *         "hasData":    true,
 *         "average":    12.4,    // null when no data — NEVER substituted with 0
 *         "maximum":    38.1,    // null when no data
 *         "minimum":    2.3,     // null when no data
 *         "unit":       "Percent",
 *         "datapoints": [{ "timestamp": "...", "average": ..., "maximum": ..., "minimum": ... }],
 *         "observedAt": "ISO8601"
 *       },
 *       "health":       "healthy|warning|critical|unknown|stopped|terminated",
 *       "healthReason": "Human-readable explanation of what triggered this status"
 *     }
 *   ],
 *   "mode":           "live|demo",
 *   "lastFetched":    "ISO8601",
 *   "thresholds":     { "cpuWarning": 80, "cpuCritical": 95 },
 *   "observationPeriods": { ... },
 *   "warning":        "string|undefined"
 * }
 */
router.get('/', async (req, res, next) => {
  try {
    const lookbackHours = req.query.lookbackHours
      ? parseInt(req.query.lookbackHours, 10)
      : 24;

    const thresholds = {
      cpuWarning:  req.query.cpuWarning  ? parseFloat(req.query.cpuWarning)  : DEFAULT_HEALTH_THRESHOLDS.cpuWarning,
      cpuCritical: req.query.cpuCritical ? parseFloat(req.query.cpuCritical) : DEFAULT_HEALTH_THRESHOLDS.cpuCritical
    };

    const result = await getHealthSummary({
      lookbackHours,
      instanceId: req.query.instanceId ? String(req.query.instanceId) : undefined,
      thresholds
    });

    res.json({
      instances:          result.instances,
      mode:               result.mode,
      lastFetched:        result.lastFetched,
      thresholds,
      observationPeriods: OBSERVATION_PERIODS,
      ...(result.warning ? { warning: result.warning } : {})
    });
  } catch (err) {
    next(err);
  }
});

export default router;

