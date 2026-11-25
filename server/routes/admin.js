const router = require('express').Router();
const db = require('../db');
const { need, pub } = require('../auth');
const { push } = require('../notify');

router.get('/orgs', need('admin'), (req, res) => {
  res.json({ orgs: db.data.users.filter(u => ['business', 'ngo'].includes(u.role)).map(pub).sort((a, b) => a.verified - b.verified) });
});

router.post('/orgs/:id/verify', need('admin'), (req, res) => {
  const u = db.data.users.find(x => x.id === req.params.id && ['business', 'ngo'].includes(x.role));
  if (!u) return res.status(404).json({ error: 'Organisation not found.' });
  u.verified = req.body?.verified !== false;
  if (u.verified) push(u.id, { type: 'account', title: 'Account verified', body: 'You can now publish listings and manage donations.' });
  db.save();
  res.json({ org: pub(u) });
});

module.exports = router;
