import { Router } from 'express';
import { getAnalyzedCostData } from '../services/cost-analysis.service.js';

const router = Router();
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/costs
 * Contract:
 * {
 *   "currency": "USD",
 *   "totalCost": 0,
 *   "dailyCosts": [],
 *   "serviceBreakdown": [],
 *   "highestCostService": { "service": "...", "amount": 0, "percentage": 0 },
 *   "dailyTrend": { "direction": "...", "averageDailySpend": 0 },
 *   "percentageChange": 0,
 *   "periodComparison": { "previousPeriodTotal": 0, "currentPeriodTotal": 0, "percentageChange": 0 },
 *   "mode": "live"
 * }
 */
router.get('/', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (startDate && !dateRegex.test(startDate)) {
      return res.status(400).json({
        error: 'Invalid startDate format. Expected YYYY-MM-DD.',
        currency: 'USD',
        totalCost: 0,
        dailyCosts: [],
        serviceBreakdown: [],
        mode: 'error'
      });
    }

    if (endDate && !dateRegex.test(endDate)) {
      return res.status(400).json({
        error: 'Invalid endDate format. Expected YYYY-MM-DD.',
        currency: 'USD',
        totalCost: 0,
        dailyCosts: [],
        serviceBreakdown: [],
        mode: 'error'
      });
    }

    const analyzedCosts = await getAnalyzedCostData(startDate, endDate);

    res.json(analyzedCosts);
  } catch (error) {
    next(error);
  }
});

export default router;
