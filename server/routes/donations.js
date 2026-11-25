const router = require('express').Router();
const db = require('../db');
const { need, needVerified } = require('../auth');
const { str, iso, haversine } = require('../utils');
const { push } = require('../notify');

// NGO: donation offers still open for collection
router.get('/available', need('ngo'), needVerified, (req, res) => {
  const rows = db.data.listings.filter(l => l.type === 'donation' && l.status === 'active' && l.remaining > 0 && Date.parse(l.pickupEnd) > Date.now())
    .map(l => ({ ...l, distanceKm: haversine(req.user.lat, req.user.lng, l.lat, l.lng), minutesLeft: Math.round((Date.parse(l.pickupEnd) - Date.now()) / 60000),
      requested: db.data.donations.some(d => d.listingId === l.id && d.ngoId === req.user.id && ['requested', 'accepted'].includes(d.status)) }))
    .sort((a, b) => a.minutesLeft - b.minutesLeft);
  res.json({ listings: rows });
});

router.post('/request', need('ngo'), needVerified, (req, res) => {
  const l = db.data.listings.find(x => x.id === req.body?.listingId);
  if (!l || l.type !== 'donation' || l.status !== 'active' || Date.parse(l.pickupEnd) <= Date.now()) return res.status(400).json({ error: 'This donation is no longer available.' });
  if (db.data.donations.some(d => d.listingId === l.id && d.ngoId === req.user.id && ['requested', 'accepted'].includes(d.status))) return res.status(400).json({ error: 'You already requested this donation.' });
  const d = { id: db.id(), listingId: l.id, businessId: l.businessId, ngoId: req.user.id, qty: l.remaining, note: str(req.body?.note).slice(0, 300), eta: str(req.body?.eta), status: 'requested', createdAt: iso() };
  db.data.donations.push(d);
  push(l.businessId, { type: 'donation', title: 'Donation request', body: `${req.user.name} wants to collect "${l.title}".${d.eta ? ' ETA: ' + d.eta : ''}`, listingId: l.id });
  db.save();
  res.json({ donation: d });
});

const enrich = d => {
  const l = db.data.listings.find(x => x.id === d.listingId);
  const ngo = db.data.users.find(u => u.id === d.ngoId);
  const biz = db.data.users.find(u => u.id === d.businessId);
  return { ...d, listing: l && { id: l.id, title: l.title, category: l.category, address: l.address, pickupEnd: l.pickupEnd, storageInfo: l.storageInfo, allergens: l.allergens },
    ngoName: ngo?.name, ngoPhone: ngo?.phone, businessName: biz?.name,
    // pickup contact is shared only once the business accepts
    businessPhone: d.status === 'accepted' || d.status === 'collected' ? biz?.phone : undefined };
};

router.get('/mine', need('ngo'), (req, res) => res.json({ donations: db.data.donations.filter(d => d.ngoId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(enrich) }));
router.get('/business', need('business'), (req, res) => res.json({ donations: db.data.donations.filter(d => d.businessId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(enrich) }));

router.post('/:id/accept', need('business'), (req, res) => {
  const d = db.data.donations.find(x => x.id === req.params.id && x.businessId === req.user.id);
  const l = d && db.data.listings.find(x => x.id === d.listingId);
  if (!d || d.status !== 'requested' || !l || l.status !== 'active') return res.status(400).json({ error: 'This request can no longer be accepted.' });
  d.status = 'accepted'; d.qty = l.remaining; l.status = 'claimed';
  push(d.ngoId, { type: 'donation', title: 'Donation accepted', body: `${l.businessName} accepted your request for "${l.title}". Collect before ${new Date(l.pickupEnd).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' })} at ${l.address}.`, listingId: l.id });
  db.data.donations.filter(o => o.listingId === l.id && o.id !== d.id && o.status === 'requested').forEach(o => {
    o.status = 'declined';
    push(o.ngoId, { type: 'donation', title: 'Donation given to another organisation', body: `"${l.title}" was accepted by another NGO.`, listingId: l.id });
  });
  db.save();
  res.json({ donation: enrich(d) });
});

router.post('/:id/decline', need('business'), (req, res) => {
  const d = db.data.donations.find(x => x.id === req.params.id && x.businessId === req.user.id);
  if (!d || d.status !== 'requested') return res.status(400).json({ error: 'Request not found.' });
  d.status = 'declined';
  push(d.ngoId, { type: 'donation', title: 'Donation request declined', body: 'The business declined your request.', listingId: d.listingId });
  db.save();
  res.json({ donation: enrich(d) });
});

router.post('/:id/collect', need('business'), (req, res) => {
  const d = db.data.donations.find(x => x.id === req.params.id && x.businessId === req.user.id);
  if (!d || d.status !== 'accepted') return res.status(400).json({ error: 'Only accepted donations can be marked as collected.' });
  d.status = 'collected'; d.collectedAt = iso();
  push(d.ngoId, { type: 'donation', title: 'Collection recorded', body: 'Thank you for redistributing this food.', listingId: d.listingId });
  db.save();
  res.json({ donation: enrich(d) });
});

module.exports = router;
