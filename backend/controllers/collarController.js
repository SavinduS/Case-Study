const Collar = require('../models/Collar');
const { COLLAR_STATUS, AUDIT_ACTION } = require('../utils/collarAlertConstants');
const { writeAudit } = require('../services/alertService');

// GET /api/collars, GET /api/collars/:collarId, POST /api/collars
async function listCollars(req, res, next) {
  try {
    const { status } = req.query;
    const collars = await Collar.find(status ? { status } : {}).sort({ collarId: 1 }).lean();
    res.json(collars);
  } catch (e) { next(e); }
}

async function getCollar(req, res, next) {
  try {
    const collar = await Collar.findOne({ collarId: req.params.collarId }).lean();
    if (!collar) return res.status(404).json({ message: 'Collar not found' });
    res.json(collar);
  } catch (e) { next(e); }
}

async function registerCollar(req, res, next) {
  try {
    const exists = await Collar.findOne({ collarId: req.body.collarId });
    if (exists) return res.status(409).json({ message: 'Collar already registered' });
    const collar = await Collar.create(req.body);
    await writeAudit({
      action: AUDIT_ACTION.COLLAR_REGISTERED,
      actor: 'admin',
      detail: `Collar ${collar.collarId} registered (${collar.species}).`
    });
    res.status(201).json(collar);
  } catch (e) { next(e); }
}

// PUT /api/collars/:collarId/status - used by the gateway to flag signal loss.
async function updateCollarStatus(req, res, next) {
  try {
    const { status } = req.body;
    const collar = await Collar.findOneAndUpdate(
      { collarId: req.params.collarId },
      { $set: { status } },
      { new: true }
    );
    if (!collar) return res.status(404).json({ message: 'Collar not found' });

    if (status === COLLAR_STATUS.SIGNAL_LOST) {
      await writeAudit({
        action: AUDIT_ACTION.SIGNAL_LOST,
        actor: 'CollarGateway',
        detail: `Telemetry link lost for ${collar.collarId}.`
      });
    }
    res.json(collar);
  } catch (e) { next(e); }
}

module.exports = { listCollars, getCollar, registerCollar, updateCollarStatus };