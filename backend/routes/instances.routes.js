import { Router } from 'express';
import { getEc2Instances } from '../services/ec2.service.js';

const router = Router();

/**
 * GET /api/instances
 * Contract:
 * {
 *   "instances": [],
 *   "mode": "live"
 * }
 */
router.get('/', async (req, res, next) => {
  try {
    const { state, search } = req.query;
    const result = await getEc2Instances();

    let filtered = result.instances;

    // Optional query filtering
    if (state) {
      filtered = filtered.filter(
        (inst) => inst.state.toLowerCase() === String(state).toLowerCase()
      );
    }

    if (search) {
      const term = String(search).toLowerCase();
      filtered = filtered.filter(
        (inst) =>
          inst.name.toLowerCase().includes(term) ||
          inst.instanceId.toLowerCase().includes(term) ||
          inst.instanceType.toLowerCase().includes(term)
      );
    }

    res.json({
      instances: filtered,
      mode: result.mode,
      ...(result.warning && { warning: result.warning })
    });
  } catch (error) {
    next(error);
  }
});

export default router;
