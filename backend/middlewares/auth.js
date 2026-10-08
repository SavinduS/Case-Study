// Sample JWT guard: sets req.user or 401
module.exports = function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token' });
  req.user = { id: 'TODO-decode', role: 'ranger' }; // TODO: jwt.verify(token)
  next();
};
