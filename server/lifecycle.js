// Food safety rule: expired listings are removed, unclaimed reservations/donations expire. Nothing is auto-relisted.
const db = require('./db');
const { push } = require('./notify');

function expireOld() {
  const now = Date.now();
  let changed = false;
  for (const l of db.data.listings) {
    if (['withdrawn', 'ended'].includes(l.status) || Date.parse(l.pickupEnd) > now) continue;
    l.status = 'ended';
    changed = true;
    for (const o of db.data.orders) {
      if (o.listingId === l.id && o.status === 'reserved') {
        o.status = 'expired';
        push(o.customerId, { type: 'order', title: 'Pickup window closed', body: `"${l.title}" was not collected before the deadline.`, listingId: l.id });
      }
    }
    for (const d of db.data.donations) {
      if (d.listingId === l.id && ['requested', 'accepted'].includes(d.status)) d.status = 'expired';
    }
  }
  if (changed) db.save();
}

module.exports = { expireOld };
