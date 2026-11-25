const router = require('express').Router();
const db = require('../db');
const { need } = require('../auth');
const { haversine } = require('../utils');
const { push } = require('../notify');

router.get('/', need(), (req, res) => {
  const all = db.data.notifications.filter(n => n.userId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ notifications: all.slice(0, 50), unread: all.filter(n => !n.read).length });
});

router.post('/read-all', need(), (req, res) => {
  db.data.notifications.forEach(n => { if (n.userId === req.user.id) n.read = true; });
  db.save();
  res.json({ ok: true });
});

router.post('/:id/read', need(), (req, res) => {
  const n = db.data.notifications.find(x => x.id === req.params.id && x.userId === req.user.id);
  if (n) { n.read = true; db.save(); }
  res.json({ ok: true });
});

// MVP demo: sends the logged-in customer an alert for the closest live listing (works even if alerts are opted out)
router.post('/simulate', need('customer'), (req, res) => {
  const u = req.user;
  const live = db.data.listings.filter(l => l.status === 'active' && l.type === 'sale' && l.remaining > 0 && Date.parse(l.pickupEnd) > Date.now())
    .map(l => ({ l, d: haversine(u.lat, u.lng, l.lat, l.lng) })).filter(x => x.d !== null).sort((a, b) => a.d - b.d)[0];
  if (!live) return res.status(404).json({ error: 'No live listings to simulate an alert for right now.' });
  push(u.id, { type: 'new_listing', simulated: true, listingId: live.l.id, title: `Demo alert: ${live.l.title}`,
    body: `${live.l.businessName} · Rs. ${live.l.originalPrice} → Rs. ${live.l.price} · ${live.d} km away. This is how a real alert looks.` });
  db.save();
  res.json({ ok: true });
});

module.exports = router;
