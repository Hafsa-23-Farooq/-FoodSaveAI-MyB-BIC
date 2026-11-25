const router = require('express').Router();
const db = require('../db');
const cfg = require('../config');
const ai = require('../ai');
const { need } = require('../auth');
const { dayKey } = require('../utils');

function scopeFor(user) {
  const { listings, orders, donations } = db.data;
  if (user.role === 'admin') return { listings, orders, donations };
  if (user.role === 'business') return {
    listings: listings.filter(l => l.businessId === user.id),
    orders: orders.filter(o => o.businessId === user.id),
    donations: donations.filter(d => d.businessId === user.id)
  };
  if (user.role === 'ngo') {
    const ds = donations.filter(d => d.ngoId === user.id);
    return { listings: listings.filter(l => ds.some(d => d.listingId === l.id)), orders: [], donations: ds };
  }
  const os = orders.filter(o => o.customerId === user.id);
  return { listings: listings.filter(l => os.some(o => o.listingId === l.id)), orders: os, donations: [] };
}

// Sold and donated quantities are recorded separately (as the proposal requires)
function calc({ listings, orders, donations }) {
  const sold = orders.filter(o => o.status === 'collected');
  const given = donations.filter(d => d.status === 'collected');
  const soldQty = sold.reduce((s, o) => s + o.qty, 0);
  const donatedQty = given.reduce((s, d) => s + d.qty, 0);
  const ended = listings.filter(l => Date.parse(l.pickupEnd) < Date.now() && l.status !== 'withdrawn');
  const listedQty = ended.reduce((s, l) => s + l.quantity, 0);

  const days = [];
  for (let i = 13; i >= 0; i--) days.push(dayKey(Date.now() - i * 86400e3));
  const series = days.map(date => ({
    date,
    sold: sold.filter(o => dayKey(o.collectedAt) === date).reduce((s, o) => s + o.qty, 0),
    donated: given.filter(d => dayKey(d.collectedAt) === date).reduce((s, d) => s + d.qty, 0)
  }));

  return {
    soldQty, donatedQty,
    ordersCompleted: sold.length, donationsCompleted: given.length,
    listingsCount: listings.length,
    revenueRecovered: sold.reduce((s, o) => s + o.total, 0),
    platformCommission: sold.reduce((s, o) => s + o.commission, 0),
    customerSavings: sold.reduce((s, o) => s + (o.unitOriginal - o.unitPrice) * o.qty, 0),
    collectionRate: listedQty ? Math.round(((soldQty + donatedQty) / listedQty) * 100) : null,
    estimatedKgRescued: +((soldQty + donatedQty) * cfg.KG_PER_PORTION).toFixed(1),
    estimateNote: `Estimate: each portion is assumed to be about ${cfg.KG_PER_PORTION} kg.`,
    series
  };
}

router.get('/public', (req, res) => {
  const m = calc(db.data);
  res.json({ businesses: db.data.users.filter(u => u.role === 'business' && u.verified).length, ngos: db.data.users.filter(u => u.role === 'ngo' && u.verified).length,
    soldQty: m.soldQty, donatedQty: m.donatedQty, estimatedKgRescued: m.estimatedKgRescued, estimateNote: m.estimateNote });
});

router.get('/impact', need(), (req, res) => res.json({ role: req.user.role, metrics: calc(scopeFor(req.user)) }));

router.get('/trends', need('business', 'admin'), (req, res) => {
  const s = scopeFor(req.user);
  res.json(ai.analyzeTrends(s.listings, s.orders, s.donations));
});

module.exports = router;
