// Creates demo accounts + sample data. Run automatically on first start, or reset with: npm run seed
const bcrypt = require('bcryptjs');
const db = require('./db');
const cfg = require('./config');

let seedState = 42;
const rnd = () => (seedState = (seedState * 1664525 + 1013904223) % 4294967296) / 4294967296;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const H = 3600e3, D = 24 * H;
const at = t => new Date(t).toISOString();

function run() {
  db.load(); db.reset();
  const { DEFAULT_LAT: LAT, DEFAULT_LNG: LNG } = cfg;
  const hash = bcrypt.hashSync('demo123', 8);
  const mk = (role, name, email, extra = {}) => {
    const u = { id: db.id(), role, name, email, passwordHash: hash, phone: '0300-' + ri(1000000, 9999999), address: '', lat: LAT, lng: LNG, radiusKm: role === 'ngo' ? 15 : 5, optIn: role === 'customer', categories: [], businessType: '', registrationNo: '', verified: true, createdAt: at(Date.now() - 60 * D), ...extra };
    db.data.users.push(u); return u;
  };
  mk('admin', 'FoodSave Admin', 'admin@foodsave.test', { passwordHash: bcrypt.hashSync('admin123', 8) });
  const bake = mk('business', 'Bake House', 'bakehouse@foodsave.test', { businessType: 'Bakery', address: 'Main Market, Sector F-7', lat: LAT + 0.012, lng: LNG + 0.010 });
  const spice = mk('business', 'Spice Route Restaurant', 'spice@foodsave.test', { businessType: 'Restaurant', address: 'Jinnah Super Market, F-7', lat: LAT + 0.018, lng: LNG - 0.012 });
  const green = mk('business', 'GreenMart Grocers', 'greenmart@foodsave.test', { businessType: 'Supermarket', address: 'Blue Area, G-6', lat: LAT - 0.010, lng: LNG + 0.020 });
  const cust = [
    mk('customer', 'Ayesha Khan', 'ayesha@foodsave.test', { address: 'University hostel', lat: LAT + 0.008, lng: LNG + 0.004 }),
    mk('customer', 'Bilal Ahmed', 'bilal@foodsave.test', { lat: LAT + 0.02, lng: LNG - 0.005 }),
    mk('customer', 'Sana Malik', 'sana@foodsave.test', { lat: LAT - 0.005, lng: LNG + 0.012 })
  ];
  const hope = mk('ngo', 'Hope Kitchen Trust', 'hope@foodsave.test', { address: 'G-9 Markaz', registrationNo: 'NGO-2019-0417', lat: LAT - 0.004, lng: LNG + 0.006 });
  const roti = mk('ngo', 'Roti Bank Community', 'roti@foodsave.test', { address: 'I-8 Markaz', registrationNo: 'NGO-2021-0092', lat: LAT + 0.004, lng: LNG - 0.008 });

  // ---------- History (28 days) so dashboards and insights have data ----------
  const L = (b, o) => { const l = { id: db.id(), businessId: b.id, businessName: b.name, description: '', photo: '', address: b.address, lat: b.lat, lng: b.lng, storageInfo: 'Kept covered at room temperature, packed fresh today.', allergens: 'May contain gluten', approvedStorage: false, safetyConfirmed: true, status: 'ended', reviewFlags: [], createdAt: at(o.end - 6 * H), pickupStart: at(o.end - 3 * H), remaining: 0, ...o, end: undefined }; l.pickupEnd = at(o.end); delete l.end; db.data.listings.push(l); return l; };
  const catalog = [
    [bake, 'Assorted pastry box', 'Bakery', 450, 6, 14], [bake, 'Fresh sourdough loaf', 'Bakery', 320, 4, 10],
    [spice, 'Chicken biryani plate', 'Meals', 380, 5, 16], [spice, 'Mutton karahi portion', 'Meals', 650, 3, 8],
    [green, 'Mixed fruit crate', 'Fruit & Veg', 500, 3, 9]
  ];
  for (let d = 28; d >= 1; d--) {
    const end = Date.now() - d * D + ri(0, 3) * H;
    const wd = new Date(end + cfg.TZ_OFFSET_HOURS * H).getUTCDay();
    for (const [b, title, category, orig, lo, hi] of catalog) {
      if (rnd() < 0.3) continue;
      const weekendBoost = [5, 6].includes(wd) ? 1.35 : 1; // more surplus on Fri/Sat - a pattern for the insights page
      const quantity = Math.round(ri(lo, hi) * weekendBoost);
      const price = Math.round(orig * 0.6 / 5) * 5;
      const l = L(b, { title, category, type: 'sale', quantity, originalPrice: orig, price, end });
      let sold = Math.min(quantity, Math.round(quantity * (0.45 + rnd() * 0.4) / (weekendBoost > 1 ? 1.3 : 1)));
      while (sold > 0) {
        const q = Math.min(sold, ri(1, 3)); sold -= q;
        const c = cust[ri(0, 2)];
        db.data.orders.push({ id: db.id(), listingId: l.id, businessId: b.id, customerId: c.id, qty: q, unitPrice: price, unitOriginal: orig, total: price * q, commission: Math.round(price * q * cfg.COMMISSION), paymentMethod: 'pay_at_pickup', paymentStatus: 'paid at pickup', pickupCode: String(ri(1000, 9999)), status: 'collected', createdAt: at(end - 4 * H), collectedAt: at(end - ri(1, 2) * H) });
      }
      const left = quantity - db.data.orders.filter(o => o.listingId === l.id).reduce((s, o) => s + o.qty, 0);
      if (left >= 3 && rnd() < 0.4) { // some leftovers were donated
        const dl = L(b, { title: title + ' (donation)', category, type: 'donation', quantity: left, originalPrice: orig, price: 0, end });
        db.data.donations.push({ id: db.id(), listingId: dl.id, businessId: b.id, ngoId: rnd() < 0.5 ? hope.id : roti.id, qty: left, note: '', eta: '', status: 'collected', createdAt: at(end - 2 * H), collectedAt: at(end - 0.5 * H) });
      }
    }
  }

  // ---------- Live listings (times relative to now) ----------
  const now = Date.now();
  const live = (b, title, desc, category, quantity, orig, price, hoursLeft, extra = {}) => {
    const l = L(b, { title, description: desc, category, type: 'sale', quantity, originalPrice: orig, price, end: now + hoursLeft * H, ...extra });
    l.status = 'active'; l.remaining = quantity; l.pickupStart = at(now - 0.5 * H); l.createdAt = at(now - 0.3 * H); return l;
  };
  live(bake, 'Assorted pastry box', 'Mix of croissants, danishes and cinnamon rolls baked this morning.', 'Bakery', 6, 450, 200, 2.2);
  live(bake, 'Sourdough loaf (sliced)', 'Whole sliced loaf, great with breakfast tomorrow.', 'Bakery', 4, 320, 150, 3.5);
  live(spice, 'Chicken biryani plate', 'Fragrant biryani with raita. Kept hot in the kitchen until pickup.', 'Meals', 9, 380, 180, 1.6, { storageInfo: 'Kept hot above 60°C and packed to order.', allergens: 'Dairy (raita)' });
  live(spice, 'Veg pulao family box', 'Serves 3–4. Cooked at 5 PM today.', 'Meals', 3, 900, 400, 4.8, { storageInfo: 'Held hot until collection. Consume the same day.', allergens: 'None declared' });
  live(green, 'Mixed fruit crate', 'Seasonal fruit, slightly bruised but fresh. Perfect for juices.', 'Fruit & Veg', 7, 500, 220, 5.5, { storageInfo: 'Stored in a cool area, packed today.', allergens: 'None' });
  live(green, 'Yoghurt cups (3 pack)', 'Best before tomorrow. Stored refrigerated.', 'Groceries', 12, 240, 110, 6.0, { storageInfo: 'Refrigerated at 4°C, hand over in a cool bag.', allergens: 'Milk' });
  const don = live(spice, 'Daal chawal trays', 'Surplus from a catering order, packed in clean trays. Suitable for a group meal.', 'Meals', 20, 0, 0, 3.0, { storageInfo: 'Kept hot above 60°C, sealed trays.', allergens: 'None declared' });
  don.type = 'donation';
  live(bake, 'Fresh bread loaves', 'Day-end bread from the bakery.', 'Bakery', 15, 100, 0, 2.5).type = 'donation';
  // one sample reservation + notifications
  const l0 = db.data.listings.find(l => l.status === 'active' && l.title === 'Chicken biryani plate');
  db.data.orders.push({ id: db.id(), listingId: l0.id, businessId: spice.id, customerId: cust[0].id, qty: 1, unitPrice: 180, unitOriginal: 380, total: 180, commission: Math.round(180 * cfg.COMMISSION), paymentMethod: 'pay_at_pickup', paymentStatus: 'due at pickup', pickupCode: '4821', status: 'reserved', createdAt: at(now - 10 * 60e3) });
  l0.remaining -= 1;
  db.data.notifications.push({ id: db.id(), userId: cust[0].id, type: 'new_listing', title: 'Assorted pastry box near you', body: 'Bake House · Rs. 450 → Rs. 200 · 1.9 km away', listingId: null, simulated: false, read: false, createdAt: at(now - 20 * 60e3) });
  db.save();
}

module.exports = { run };
if (require.main === module) { run(); console.log('Demo data reset. Accounts → see README.'); }
