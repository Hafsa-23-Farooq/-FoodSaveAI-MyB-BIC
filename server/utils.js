const cfg = require('./config');

const num = v => (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
const str = v => (typeof v === 'string' ? v.trim() : '');
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const iso = (d = Date.now()) => new Date(d).toISOString();

function haversine(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some(v => typeof v !== 'number')) return null;
  const R = 6371, rad = x => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return +(2 * R * Math.asin(Math.sqrt(a))).toFixed(2);
}

const localDate = ts => new Date(new Date(ts).getTime() + cfg.TZ_OFFSET_HOURS * 3600e3);
const dayKey = ts => localDate(ts).toISOString().slice(0, 10);
const weekday = ts => localDate(ts).getUTCDay();
const timeLabel = ts => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: cfg.TZ_NAME });

module.exports = { num, str, clamp, iso, haversine, dayKey, weekday, timeLabel };
