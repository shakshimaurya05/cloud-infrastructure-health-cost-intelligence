import { Router } from 'express';
import { checkAwsConfigured, getExecutionMode } from '../config/aws.js';

const router = Router();

/**
 * GET /api/health
 * Contract:
 * {
 *   "status": "ok",
 *   "awsConfigured": true,
 *   "mode": "live"
 * }
 */
router.get('/', async (req, res, next) => {
  try {
    const awsConfigured = await checkAwsConfigured();
    const mode = getExecutionMode(awsConfigured);

    res.json({
      status: 'ok',
      awsConfigured,
      mode,
      region: process.env.AWS_REGION || 'us-east-1',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

export default router;
