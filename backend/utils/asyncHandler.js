// Sample: wrap async route handlers so errors go to Express error handler
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
