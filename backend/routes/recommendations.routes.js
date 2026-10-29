import { Router } from 'express';
import { getOptimizationRecommendations } from '../services/recommendation.service.js';

const router = Router();

/**
 * GET /api/recommendations
 * Contract:
 * {
 *   "recommendations": [
 *     {
 *       "id": "rec-id",
 *       "title": "Review EC2 Instance Sizing",
 *       "description": "...",
 *       "resourceId": "i-example",
 *       "priority": "medium",
 *       "estimatedMonthlySavings": null,
 *       "currency": "USD",
 *       "status": "review"
 *     }
 *   ],
 *   "mode": "live"
 * }
 */
router.get('/', async (req, res, next) => {
  try {
    const { priority, status } = req.query;
    const result = await getOptimizationRecommendations();

    let recommendations = result.recommendations;

    // Optional query filtering
    if (priority) {
      recommendations = recommendations.filter(
        (r) => r.priority.toLowerCase() === String(priority).toLowerCase()
      );
    }

    if (status) {
      recommendations = recommendations.filter(
        (r) => (r.status || 'review').toLowerCase() === String(status).toLowerCase()
      );
    }

    res.json({
      recommendations,
      mode: result.mode,
      ...(result.warning && { warning: result.warning })
    });
  } catch (error) {
    next(error);
  }
});

export default router;
