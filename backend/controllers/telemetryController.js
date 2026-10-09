const { ingestBatch } = require('../services/alertService');
const { writeAudit } = require('../services/alertService');
const { AUDIT_ACTION } = require('../utils/collarAlertConstants');

/**
 * POST /api/telemetry/fixes
 *
 * The IoT gateway / satellite link posts collar fixes here. Accepts either a
 * single fix or a batch. A batch posted with `delayed: true` is a replay of
 * historical timestamps after a dropout, and any breach it contains is
 * flagged as a retroactive "Delayed Incident" (alternate flow D).
 *
 *   { "fixes": [{ "collarId": "E-402", "coordinates": [81.03, 8.24], "at": "..." }],
 *     "delayed": false }
 */
async function ingestFixes(req, res, next) {
  try {
    const { fixes, delayed = false } = req.body;

    if (!Array.isArray(fixes) || fixes.length === 0) {
      return res.status(400).json({ message: 'Body must include a non-empty fixes array' });
    }

    const result = await ingestBatch(fixes, { delayed });
    res.status(201).json({
      received: fixes.length,
      alertsCreated: result.created.length,
      alerts: result.created.map((alert) => ({
        alertId: alert.alertId,
        collarId: alert.collarId,
        zoneId: alert.zoneId,
        threatLevel: alert.threatLevel,
        status: alert.status,
        detectedAt: alert.detectedAt
      })),
      rejected: result.rejected
    });
  } catch (e) { next(e); }
}

// PUT /api/telemetry/collars/:collarId/signal - gateway reports a dropout.
async function reportSignalLost(req, res, next) {
  try {
    const Collar = require('../models/Collar');
    const { collarId } = req.params;
    const { lost = true, reason = 'Gateway heartbeat timeout' } = req.body;

    const collar = await Collar.findOneAndUpdate(
      { collarId },
      { $set: { status: lost ? 'signal_lost' : 'active' } },
      { new: true }
    );
    if (!collar) return res.status(404).json({ message: 'Collar not found' });

    if (lost) {
      await writeAudit({
        action: AUDIT_ACTION.SIGNAL_LOST,
        actor: 'CollarGateway',
        detail: `Telemetry link lost for ${collarId}: ${reason}.`
      });
    }
    res.json(collar);
  } catch (e) { next(e); }
}

module.exports = { ingestFixes, reportSignalLost };