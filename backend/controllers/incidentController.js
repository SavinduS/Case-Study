const Incident = require('../models/Incident');

// POST /api/incidents, GET /api/incidents/mine
async function createIncident(req, res, next) {
  try {
    const incident = await Incident.create({ ...req.body, reporter: req.user?.id });
    res.status(201).json(incident);
  } catch (e) { next(e); }
}

async function myIncidents(req, res, next) {
  try {
    const list = await Incident.find({ reporter: req.user?.id }).sort({ createdAt: -1 });
    res.json(list);
  } catch (e) { next(e); }
}

module.exports = { createIncident, myIncidents };
