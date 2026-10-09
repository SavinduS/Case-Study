const Geofence = require('../models/Geofence');
const Park = require('../models/Park');
const RangerTeam = require('../models/RangerTeam');
const { findNearestRanger } = require('../services/geofenceService');
const { isValidLngLat } = require('../utils/geo');

// GET /api/geofences, GET /api/geofences/:zoneId, PUT /api/geofences/:zoneId
async function listGeofences(req, res, next) {
  try {
    const { enabled } = req.query;
    const filter = {};
    if (enabled !== undefined) filter.enabled = enabled === 'true';
    const zones = await Geofence.find(filter).sort({ zoneId: 1 }).lean();
    res.json(zones);
  } catch (e) { next(e); }
}

async function getGeofence(req, res, next) {
  try {
    const zone = await Geofence.findOne({ zoneId: req.params.zoneId }).lean();
    if (!zone) return res.status(404).json({ message: 'Geofence not found' });
    res.json(zone);
  } catch (e) { next(e); }
}

// Toggles whether a zone is drawn and evaluated. Disabling stops both the
// map overlay and geofence evaluation, which is what an officer expects
// from the Geofences panel.
async function updateGeofence(req, res, next) {
  try {
    const zone = await Geofence.findOneAndUpdate(
      { zoneId: req.params.zoneId },
      { $set: { enabled: req.body.enabled } },
      { new: true }
    );
    if (!zone) return res.status(404).json({ message: 'Geofence not found' });
    res.json(zone);
  } catch (e) { next(e); }
}

// GET /api/parks/current, GET /api/ranger-teams
async function getCurrentPark(req, res, next) {
  try {
    const park = await Park.findOne().lean();
    if (!park) return res.status(404).json({ message: 'No park configured' });
    res.json(park);
  } catch (e) { next(e); }
}

async function listRangerTeams(req, res, next) {
  try {
    const { status } = req.query;
    const teams = await RangerTeam.find(status ? { status } : {}).sort({ rangerId: 1 }).lean();
    res.json(teams);
  } catch (e) { next(e); }
}

/**
 * GET /api/parks/ranger-teams/nearest?lng=&lat=
 * Lets the officer see which team a dispatch would pick before confirming.
 */
async function getNearestRangerTeam(req, res, next) {
  try {
    const { lng, lat } = req.query;
    const coordinates = [Number(lng), Number(lat)];
    if (!isValidLngLat(coordinates[0], coordinates[1])) {
      return res.status(400).json({ message: 'lng and lat query params are required and must be valid' });
    }
    const teams = await RangerTeam.find().lean();
    res.json(findNearestRanger(coordinates, teams));
  } catch (e) { next(e); }
}

module.exports = {
  listGeofences,
  getGeofence,
  updateGeofence,
  getCurrentPark,
  listRangerTeams,
  getNearestRangerTeam
};