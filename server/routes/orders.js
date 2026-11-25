const router = require('express').Router();
const db = require('../db');
const cfg = require('../config');
const { need } = require('../auth');
const { num, iso } = require('../utils');
const { push } = require('../notify');
const { haversine } = require('../utils');

router.post('/', need('customer'), (req, res) => {
  const l = db.data.listings.find(x => x.id === req.body?.listingId);
  const qty = Math.floor(num(req.body?.qty) ?? 1);
  if (!l || l.status !== 'active' || l.type !== 'sale' || Date.parse(l.pickupEnd) <= Date.now()) return res.status(400).json({ error: 'This listing is no longer available.' });
  if (qty < 1 || qty > cfg.MAX_QTY_PER_ORDER) return res.status(400).json({ error: `You can reserve 1 to ${cfg.MAX_QTY_PER_ORDER} portions at a time.` });
  if (qty > l.remaining) return res.status(400).json({ error: `Only ${l.remaining} portion(s) left.` });
  const active = db.data.orders.filter(o => o.customerId === req.user.id && o.status === 'reserved').length;
  if (active >= cfg.MAX_ACTIVE_RESERVATIONS) return res.status(400).json({ error: `You already have ${active} active reservations. Collect or cancel one first.` });

  const total = l.price * qty;
  const order = {
    id: db.id(), listingId: l.id, businessId: l.businessId, customerId: req.user.id, qty,
    unitPrice: l.price, unitOriginal: l.originalPrice, total, commission: Math.round(total * cfg.COMMISSION),
    paymentMethod: req.body?.paymentMethod === 'card_demo' ? 'card_demo' : 'pay_at_pickup',
    paymentStatus: req.body?.paymentMethod === 'card_demo' ? 'paid (demo)' : 'due at pickup',
    pickupCode: String(Math.floor(1000 + Math.random() * 9000)),
    status: 'reserved', createdAt: iso()
  };
  l.remaining -= qty;
  db.data.orders.push(order);
  push(l.businessId, { type: 'order', title: 'New reservation', body: `${req.user.name} reserved ${qty} × ${l.title}.`, listingId: l.id });
  db.save();
  res.json({ order, listing: l });
});

const withListing = o => ({ ...o, listing: db.data.listings.find(l => l.id === o.listingId) });

router.get('/mine', need('customer'), (req, res) => {
  const orders = db.data.orders.filter(o => o.customerId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(withListing);
  res.json({ orders });
});

router.get('/business', need('business'), (req, res) => {
  const orders = db.data.orders.filter(o => o.businessId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(o => ({ ...withListing(o), customerName: db.data.users.find(u => u.id === o.customerId)?.name || 'Customer' }));
  orders.forEach(o => { if (o.listing) o.listing = { id: o.listing.id, title: o.listing.title, pickupEnd: o.listing.pickupEnd }; });
  res.json({ orders });
});

router.post('/:id/cancel', need('customer'), (req, res) => {
  const o = db.data.orders.find(x => x.id === req.params.id && x.customerId === req.user.id);
  if (!o || o.status !== 'reserved') return res.status(400).json({ error: 'Only active reservations can be cancelled.' });
  const l = db.data.listings.find(x => x.id === o.listingId);
  o.status = 'cancelled';
  if (l && l.status === 'active') l.remaining += o.qty;
  if (l) push(l.businessId, { type: 'order', title: 'Reservation cancelled', body: `${req.user.name} cancelled ${o.qty} × ${l.title}. The portions are available again.`, listingId: l.id });
  db.save();
  res.json({ order: o });
});

// Business confirms handover using the customer's 4-digit pickup code
router.post('/:id/collect', need('business'), (req, res) => {
  const o = db.data.orders.find(x => x.id === req.params.id && x.businessId === req.user.id);
  if (!o || o.status !== 'reserved') return res.status(400).json({ error: 'Reservation not found or already closed.' });
  if (String(req.body?.code) !== o.pickupCode) return res.status(400).json({ error: 'Pickup code does not match.' });
  const l = db.data.listings.find(x => x.id === o.listingId);
  if (l && Date.parse(l.pickupEnd) < Date.now()) return res.status(400).json({ error: 'The pickup window has closed.' });
  o.status = 'collected'; o.collectedAt = iso();
  if (o.paymentMethod === 'pay_at_pickup') o.paymentStatus = 'paid at pickup';
  push(o.customerId, { type: 'order', title: 'Order collected', body: `You saved Rs. ${(o.unitOriginal - o.unitPrice) * o.qty} on ${l?.title || 'your order'}. Thank you for rescuing food!`, listingId: o.listingId });
  db.save();
  res.json({ order: o });
});

module.exports = router;
