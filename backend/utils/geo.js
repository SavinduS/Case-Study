// Sample geo helper (used by geofence + incident location)
function isValidLngLat(lng, lat) {
  return typeof lng === 'number' && typeof lat === 'number'
    && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

module.exports = { isValidLngLat };
