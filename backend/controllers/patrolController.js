const PatrolRecord = require('../models/PatrolRecord');
const { findSectorByCode } = require('../config/areas');

// POST /api/patrols — log a patrol record so the analytics reports can
// measure coverage against it. Rangers log their own patrols, managers may
// log on their behalf, and the no-login demo mode stays usable.
async function createPatrol(req, res, next) {
  try {
    const sector = findSectorByCode(req.body?.sector || req.body?.sectorCode || req.body?.terrainZone);
    if (!sector) {
      return res.status(400).json({ message: 'sector must be a configured terrain zone code (e.g. NORTHBOUNDARY)' });
    }
    const record = await PatrolRecord.create({
      ranger: req.user?.id || null,
      sector: sector.code,
      patrolDate: req.body?.patrolDate,
      date: req.body?.date,
      startedAt: req.body?.startedAt,
      endedAt: req.body?.endedAt,
      hours: req.body?.hours,
      durationHours: req.body?.durationHours,
      location: req.body?.location,
      notes: req.body?.notes
    });
    res.status(201).json(record);
  } catch (e) {
    if (e.name === 'ValidationError'
      || e.message === 'patrol dates are required'
      || e.message === 'endedAt must be after startedAt') {
      e.statusCode = 400;
    }
    next(e);
  }
}

module.exports = { createPatrol };
