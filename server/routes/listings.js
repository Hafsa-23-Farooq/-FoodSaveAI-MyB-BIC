const router = require('express').Router();
const db = require('../db');
const cfg = require('../config');
const ai = require('../ai');
const { need, needVerified } = require('../auth');
const { num, str, haversine, iso } = require('../utils');
const { push, notifyCustomers, notifyNgos } = require('../notify');

const view = (l, lat, lng) => ({
  ...l,
  distanceKm: haversine(lat, lng, l.lat, l.lng),
  minutesLeft: Math.max(0, Math.round((Date.parse(l.pickupEnd) - Date.now()) / 60000))
});

// Public marketplace feed with filters: distance, category, price, collection time, text search
router.get('/', (req, res) => {
  const q = req.query;
  const lat = num(q.lat) ?? req.user?.lat ?? cfg.DEFAULT_LAT;
  const lng = num(q.lng) ?? req.user?.lng ?? cfg.DEFAULT_LNG;
  const type = q.type === 'donation' ? 'donation' : 'sale';
  if (type === 'donation' && !['ngo', 'admin'].includes(req.user?.role)) return res.status(403).json({ error: 'Donation listings are only visible to registered NGOs.' });

  const now = Date.now();
  let rows = db.data.listings.filter(l => l.status === 'active' && l.type === type && l.remaining > 0 && Date.parse(l.pickupEnd) > now)
    .map(l => view(l, lat, lng));
  if (q.radius) rows = rows.filter(l => l.distanceKm !== null && l.distanceKm <= Number(q.radius));
  if (q.category && q.category !== 'all') rows = rows.filter(l => l.category === q.category);
  if (num(q.maxPrice) !== null) rows = rows.filter(l => l.price <= Number(q.maxPrice));
  if (num(q.withinMinutes) !== null) rows = rows.filter(l => l.minutesLeft <= Number(q.withinMinutes));
  if (q.search) { const s = String(q.search).toLowerCase(); rows = rows.filter(l => (l.title + l.businessName + l.description).toLowerCase().includes(s)); }
  const sorters = { distance: (a, b) => a.distanceKm - b.distanceKm, price: (a, b) => a.price - b.price, ending: (a, b) => a.minutesLeft - b.minutesLeft };
  rows.sort(sorters[q.sort] || sorters.distance);
  if (num(q.limit)) rows = rows.slice(0, Number(q.limit));
  res.json({ listings: rows, center: { lat, lng } });
});

router.get('/mine', need('business'), (req, res) => {
  const rows = db.data.listings.filter(l => l.businessId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(l => ({ ...view(l), reservedQty: db.data.orders.filter(o => o.listingId === l.id && o.status === 'reserved').reduce((s, o) => s + o.qty, 0), soldQty: db.data.orders.filter(o => o.listingId === l.id && o.status === 'collected').reduce((s, o) => s + o.qty, 0) }));
  res.json({ listings: rows });
});

router.get('/:id', (req, res) => {
  const l = db.data.listings.find(x => x.id === req.params.id);
  if (!l) return res.status(404).json({ error: 'Listing not found.' });
  res.json({ listing: view(l, req.user?.lat, req.user?.lng) });
});

function validate(b, user) {
  const errors = [];
  const type = b.type === 'donation' ? 'donation' : 'sale';
  const title = str(b.title);
  const quantity = Math.floor(num(b.quantity) ?? 0);
  const originalPrice = num(b.originalPrice) ?? 0;
  const price = type === 'donation' ? 0 : num(b.price);
  const now = Date.now();
  const start = b.pickupStart ? Date.parse(b.pickupStart) : now;
  const end = Date.parse(b.pickupEnd);
  const approvedStorage = !!b.approvedStorage;
  const maxHours = approvedStorage ? cfg.STORED_MAX_HOURS : cfg.SAME_DAY_MAX_HOURS;

  if (title.length < 3) errors.push('Enter a food title.');
  if (quantity < 1 || quantity > 500) errors.push('Quantity must be between 1 and 500.');
  if (type === 'sale') {
    if (!(originalPrice > 0)) errors.push('Enter the original price.');
    if (price === null || !(price >= 0) || price > originalPrice) errors.push('Discounted price must be between 0 and the original price.');
  }
  if (isNaN(end) || end <= now) errors.push('Pickup deadline must be in the future.');
  else if (end - now > maxHours * 3600e3) errors.push(approvedStorage
    ? `Pickup deadline cannot be more than ${cfg.STORED_MAX_HOURS} hours from now.`
    : `Same-day pickup deadline cannot be more than ${cfg.SAME_DAY_MAX_HOURS} hours from now. For next-day pickup, confirm safe storage.`);
  if (!isNaN(end) && start >= end) errors.push('Pickup start must be before the deadline.');
  if (str(b.storageInfo).length < 3) errors.push('Add storage / handling information.');
  if (b.safetyConfirmed !== true) errors.push('Confirm that the food is safe and suitable to distribute.');
  if (errors.length) return { errors };

  const text = `${title} ${str(b.description)}`;
  return {
    data: {
      title, description: str(b.description), type, quantity, remaining: quantity,
      originalPrice: type === 'sale' ? originalPrice : originalPrice || 0, price,
      category: ai.CATEGORIES.includes(b.category) ? b.category : ai.categorize(text).category,
      photo: typeof b.photo === 'string' && b.photo.startsWith('data:image/') && b.photo.length < 1.5e6 ? b.photo : '',
      pickupStart: iso(Math.min(start, now)), pickupEnd: iso(end),
      address: str(b.address) || user.address, lat: num(b.lat) ?? user.lat, lng: num(b.lng) ?? user.lng,
      storageInfo: str(b.storageInfo), allergens: str(b.allergens), approvedStorage, safetyConfirmed: true
    }
  };
}

router.post('/', need('business'), needVerified, (req, res) => {
  const { errors, data } = validate(req.body || {}, req.user);
  if (errors) return res.status(400).json({ error: errors[0], errors });
  const l = { id: db.id(), businessId: req.user.id, businessName: req.user.name, status: 'active', createdAt: iso(), ...data };
  l.reviewFlags = ai.reviewFlags(l);
  db.data.listings.push(l);
  const notified = l.type === 'sale' ? notifyCustomers(l) : notifyNgos(l);
  db.save();
  res.json({ listing: l, notified, audience: l.type === 'sale' ? 'customers' : 'NGO partners' });
});

router.put('/:id', need('business'), (req, res) => {
  const l = db.data.listings.find(x => x.id === req.params.id && x.businessId === req.user.id);
  if (!l) return res.status(404).json({ error: 'Listing not found.' });
  if (l.status !== 'active') return res.status(400).json({ error: 'Only active listings can be edited.' });
  const b = req.body || {};
  const reserved = db.data.orders.filter(o => o.listingId === l.id && o.status === 'reserved').reduce((s, o) => s + o.qty, 0);
  const sold = db.data.orders.filter(o => o.listingId === l.id && o.status === 'collected').reduce((s, o) => s + o.qty, 0);
  if (b.quantity !== undefined) {
    const q = Math.floor(num(b.quantity) ?? 0);
    if (q < reserved + sold || q > 500) return res.status(400).json({ error: `Quantity cannot be lower than ${reserved + sold} (already reserved or sold).` });
    l.remaining = q - reserved - sold; l.quantity = q;
  }
  if (b.price !== undefined && l.type === 'sale') {
    const p = num(b.price);
    if (p === null || p < 0 || p > l.originalPrice) return res.status(400).json({ error: 'Price must be between 0 and the original price.' });
    l.price = p;
  }
  if (b.description !== undefined) l.description = str(b.description);
  db.save();
  res.json({ listing: l });
});

router.post('/:id/withdraw', need('business'), (req, res) => {
  const l = db.data.listings.find(x => x.id === req.params.id && x.businessId === req.user.id);
  if (!l || !['active'].includes(l.status)) return res.status(404).json({ error: 'Active listing not found.' });
  l.status = 'withdrawn';
  db.data.orders.filter(o => o.listingId === l.id && o.status === 'reserved').forEach(o => {
    o.status = 'cancelled';
    push(o.customerId, { type: 'order', title: 'Listing withdrawn', body: `${l.businessName} withdrew "${l.title}". Your reservation was cancelled.`, listingId: l.id });
  });
  db.data.donations.filter(d => d.listingId === l.id && ['requested', 'accepted'].includes(d.status)).forEach(d => {
    d.status = 'declined';
    push(d.ngoId, { type: 'donation', title: 'Donation withdrawn', body: `"${l.title}" is no longer available.`, listingId: l.id });
  });
  db.save();
  res.json({ listing: l });
});

// Offer the remaining portions of a discounted listing to NGO partners instead
router.post('/:id/donate', need('business'), needVerified, (req, res) => {
  const l = db.data.listings.find(x => x.id === req.params.id && x.businessId === req.user.id);
  if (!l || l.status !== 'active' || l.type !== 'sale') return res.status(400).json({ error: 'Only active discounted listings can be offered as a donation.' });
  if (l.remaining < 1) return res.status(400).json({ error: 'No unreserved portions left to donate.' });
  l.type = 'donation'; l.price = 0;
  const notified = notifyNgos(l);
  db.save();
  res.json({ listing: l, notified });
});

module.exports = router;
