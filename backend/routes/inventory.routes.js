import { Router } from 'express';
import {
  getInventoryInstances,
  getInventoryVolumes,
  getInventoryElasticIps
} from '../services/inventory.service.js';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Applies server-side search + filter across an array of objects.
 * @param {Array}  items      - source list
 * @param {string} searchTerm - freetext search
 * @param {Array}  searchKeys - object keys to match against
 * @param {object} filters    - { key: value } exact-match filters
 */
function applyFilters(items, searchTerm, searchKeys, filters = {}) {
  let result = items;

  // Exact-match key filters (state, volumeType, …)
  for (const [key, val] of Object.entries(filters)) {
    if (val) {
      result = result.filter(
        (item) => String(item[key] ?? '').toLowerCase() === String(val).toLowerCase()
      );
    }
  }

  // Full-text search across specified keys
  if (searchTerm) {
    const term = String(searchTerm).toLowerCase();
    result = result.filter((item) =>
      searchKeys.some((k) => String(item[k] ?? '').toLowerCase().includes(term))
    );
  }

  return result;
}

/**
 * Wraps an array slice into a pagination envelope.
 */
function paginate(items, page, pageSize) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const start = (currentPage - 1) * pageSize;
  const data = items.slice(start, start + pageSize);
  return { data, total, page: currentPage, pageSize, totalPages };
}

// ─── GET /api/inventory/instances ───────────────────────────────────────────

/**
 * GET /api/inventory/instances
 * Query params:
 *   search      - freetext (matches instanceId, name, instanceType, availabilityZone, privateIp, publicIp)
 *   state       - running | stopped | terminated | …
 *   region      - e.g. us-east-1
 *   page        - 1-indexed (default 1)
 *   pageSize    - items per page (default 25, max 200)
 *
 * Response:
 * {
 *   instances: [], total: 0, page: 1, pageSize: 25, totalPages: 1,
 *   lastRefreshed: "ISO-8601", mode: "live"|"demo"
 * }
 */
router.get('/instances', async (req, res, next) => {
  try {
    const { search, state, region, page = '1', pageSize = '25' } = req.query;
    const parsedPage = parseInt(page, 10) || 1;
    const parsedSize = Math.min(parseInt(pageSize, 10) || 25, 200);

    const result = await getInventoryInstances();

    const filtered = applyFilters(
      result.instances,
      search,
      ['instanceId', 'name', 'instanceType', 'availabilityZone', 'region', 'privateIp', 'publicIp'],
      { ...(state ? { state } : {}), ...(region ? { region } : {}) }
    );

    const { data, total, totalPages } = paginate(filtered, parsedPage, parsedSize);

    res.json({
      instances: data,
      total,
      page: parsedPage,
      pageSize: parsedSize,
      totalPages,
      lastRefreshed: new Date().toISOString(),
      mode: result.mode,
      ...(result.warning && { warning: result.warning })
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/inventory/volumes ──────────────────────────────────────────────

/**
 * GET /api/inventory/volumes
 * Query params:
 *   search      - freetext (matches volumeId, name, attachedInstanceId, attachmentDevice)
 *   state       - available | in-use | creating | deleting | …
 *   volumeType  - gp2 | gp3 | io1 | io2 | st1 | sc1
 *   encrypted   - true | false
 *   page, pageSize
 *
 * Response:
 * {
 *   volumes: [], total, page, pageSize, totalPages, lastRefreshed, mode
 * }
 */
router.get('/volumes', async (req, res, next) => {
  try {
    const { search, state, volumeType, encrypted, page = '1', pageSize = '25' } = req.query;
    const parsedPage = parseInt(page, 10) || 1;
    const parsedSize = Math.min(parseInt(pageSize, 10) || 25, 200);

    const result = await getInventoryVolumes();

    let filtered = applyFilters(
      result.volumes,
      search,
      ['volumeId', 'name', 'attachedInstanceId', 'attachmentDevice', 'availabilityZone'],
      { ...(state ? { state } : {}), ...(volumeType ? { volumeType } : {}) }
    );

    // Boolean filter for encryption
    if (encrypted === 'true' || encrypted === 'false') {
      const enc = encrypted === 'true';
      filtered = filtered.filter((v) => v.encrypted === enc);
    }

    const { data, total, totalPages } = paginate(filtered, parsedPage, parsedSize);

    res.json({
      volumes: data,
      total,
      page: parsedPage,
      pageSize: parsedSize,
      totalPages,
      lastRefreshed: new Date().toISOString(),
      mode: result.mode,
      ...(result.warning && { warning: result.warning })
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/inventory/elastic-ips ─────────────────────────────────────────

/**
 * GET /api/inventory/elastic-ips
 * Query params:
 *   search      - freetext (matches allocationId, publicIp, name, associatedInstanceId)
 *   associated  - true | false
 *   page, pageSize
 *
 * Response:
 * {
 *   elasticIps: [], total, page, pageSize, totalPages, lastRefreshed, mode
 * }
 */
router.get('/elastic-ips', async (req, res, next) => {
  try {
    const { search, associated, page = '1', pageSize = '25' } = req.query;
    const parsedPage = parseInt(page, 10) || 1;
    const parsedSize = Math.min(parseInt(pageSize, 10) || 25, 200);

    const result = await getInventoryElasticIps();

    let filtered = applyFilters(
      result.elasticIps,
      search,
      ['allocationId', 'publicIp', 'name', 'associatedInstanceId', 'privateIpAddress'],
      {}
    );

    if (associated === 'true' || associated === 'false') {
      const assoc = associated === 'true';
      filtered = filtered.filter((ip) => ip.associated === assoc);
    }

    const { data, total, totalPages } = paginate(filtered, parsedPage, parsedSize);

    res.json({
      elasticIps: data,
      total,
      page: parsedPage,
      pageSize: parsedSize,
      totalPages,
      lastRefreshed: new Date().toISOString(),
      mode: result.mode,
      ...(result.warning && { warning: result.warning })
    });
  } catch (error) {
    next(error);
  }
});

export default router;
