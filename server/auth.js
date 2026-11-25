const jwt = require('jsonwebtoken');
const db = require('./db');
const { JWT_SECRET } = require('./config');

const sign = u => jwt.sign({ id: u.id, role: u.role }, JWT_SECRET, { expiresIn: '7d' });

// Reads "Authorization: Bearer <token>" and sets req.user (if valid)
function attach(req, res, next) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) {
    try {
      const p = jwt.verify(h.slice(7), JWT_SECRET);
      req.user = db.data.users.find(u => u.id === p.id);
    } catch { /* invalid token = treated as guest */ }
  }
  next();
}

// need() = any logged-in user, need('business') = only that role
const need = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'Your account type cannot do this.' });
  next();
};

const needVerified = (req, res, next) =>
  req.user.verified ? next() : res.status(403).json({ error: 'Your account is waiting for verification by the FoodSave AI team.' });

const pub = u => { const { passwordHash, ...rest } = u; return rest; };

module.exports = { sign, attach, need, needVerified, pub };
