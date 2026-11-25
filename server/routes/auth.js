const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const cfg = require('../config');
const { sign, need, pub } = require('../auth');
const { num, str, clamp, iso } = require('../utils');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', (req, res) => {
  const b = req.body || {};
  const role = b.role;
  if (!['customer', 'business', 'ngo'].includes(role)) return res.status(400).json({ error: 'Choose an account type.' });
  const name = str(b.name), email = str(b.email).toLowerCase(), password = String(b.password || '');
  if (name.length < 2) return res.status(400).json({ error: 'Enter your name.' });
  if (!EMAIL.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (db.data.users.some(u => u.email === email)) return res.status(409).json({ error: 'An account with this email already exists. Log in instead.' });
  if (role !== 'customer' && str(b.address).length < 3) return res.status(400).json({ error: 'Enter your address.' });

  const user = {
    id: db.id(), role, name, email, passwordHash: bcrypt.hashSync(password, 10),
    phone: str(b.phone), address: str(b.address),
    lat: num(b.lat) ?? cfg.DEFAULT_LAT, lng: num(b.lng) ?? cfg.DEFAULT_LNG,
    radiusKm: clamp(num(b.radiusKm) ?? (role === 'customer' ? 5 : 15), 1, 50),
    optIn: role === 'customer' ? b.optIn !== false : false,
    categories: [],
    businessType: role === 'business' ? str(b.businessType) || 'Restaurant' : '',
    registrationNo: role === 'ngo' ? str(b.registrationNo) : '',
    verified: role === 'customer' || cfg.AUTO_VERIFY,
    createdAt: iso()
  };
  db.data.users.push(user);
  db.save();
  res.json({ token: sign(user), user: pub(user) });
});

router.post('/login', (req, res) => {
  const email = str(req.body?.email).toLowerCase();
  const user = db.data.users.find(u => u.email === email);
  if (!user || !bcrypt.compareSync(String(req.body?.password || ''), user.passwordHash))
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  res.json({ token: sign(user), user: pub(user) });
});

router.get('/me', need(), (req, res) => res.json({ user: pub(req.user) }));

router.put('/me', need(), (req, res) => {
  const b = req.body || {}, u = req.user;
  if (b.name !== undefined) { if (str(b.name).length < 2) return res.status(400).json({ error: 'Enter your name.' }); u.name = str(b.name); }
  if (b.phone !== undefined) u.phone = str(b.phone);
  if (b.address !== undefined) u.address = str(b.address);
  if (num(b.lat) !== null && num(b.lng) !== null) { u.lat = num(b.lat); u.lng = num(b.lng); }
  if (num(b.radiusKm) !== null) u.radiusKm = clamp(num(b.radiusKm), 1, 50);
  if (u.role === 'customer') {
    if (b.optIn !== undefined) u.optIn = !!b.optIn;
    if (Array.isArray(b.categories)) u.categories = b.categories.map(str).slice(0, 8);
  }
  db.save();
  res.json({ user: pub(u) });
});

module.exports = router;
