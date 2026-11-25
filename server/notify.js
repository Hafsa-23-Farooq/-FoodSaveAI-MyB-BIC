const db = require('./db');
const { haversine, iso, timeLabel } = require('./utils');

function push(userId, { type, title, body, listingId = null, simulated = false }) {
  db.data.notifications.push({ id: db.id(), userId, type, title, body, listingId, simulated, read: false, createdAt: iso() });
}

// Opted-in customers inside their chosen radius and category, max 3 alerts/hour each (avoids spam).
function notifyCustomers(l) {
  const since = Date.now() - 3600e3;
  let count = 0;
  for (const u of db.data.users) {
    if (u.role !== 'customer' || !u.optIn) continue;
    const d = haversine(u.lat, u.lng, l.lat, l.lng);
    if (d === null || d > (u.radiusKm || 5)) continue;
    if (u.categories?.length && !u.categories.includes(l.category)) continue;
    const recent = db.data.notifications.filter(n => n.userId === u.id && n.type === 'new_listing' && Date.parse(n.createdAt) > since).length;
    if (recent >= 3) continue;
    push(u.id, {
      type: 'new_listing', listingId: l.id,
      title: `${l.title} near you`,
      body: `${l.businessName} · Rs. ${l.originalPrice} → Rs. ${l.price} · ${d} km away · pick up by ${timeLabel(l.pickupEnd)}`
    });
    count++;
  }
  return count;
}

function notifyNgos(l) {
  let count = 0;
  for (const u of db.data.users) {
    if (u.role !== 'ngo' || !u.verified) continue;
    const d = haversine(u.lat, u.lng, l.lat, l.lng);
    if (d === null || d > (u.radiusKm || 15)) continue;
    push(u.id, {
      type: 'donation_available', listingId: l.id,
      title: `Donation available: ${l.title}`,
      body: `${l.businessName} · ${l.remaining} portions · ${d} km away · collect before ${timeLabel(l.pickupEnd)}`
    });
    count++;
  }
  return count;
}

module.exports = { push, notifyCustomers, notifyNgos };
