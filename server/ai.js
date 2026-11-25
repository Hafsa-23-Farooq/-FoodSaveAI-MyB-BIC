// AI-assisted helpers. Rules run always (transparent + works offline).
// If GEMINI_API_KEY is set, Gemini adds a short plain-language explanation on top of the rule-based result.
// AI never declares food safe - it only flags missing information for human review.
const cfg = require('./config');

const CATEGORIES = ['Bakery', 'Meals', 'Fast food', 'Desserts', 'Fruit & Veg', 'Beverages', 'Groceries', 'Other'];

const KEYWORDS = {
  'Bakery': ['bread', 'bun', 'naan', 'roti', 'croissant', 'pastry', 'pastries', 'bagel', 'sourdough', 'loaf', 'baguette', 'donut', 'doughnut', 'muffin', 'bakery'],
  'Desserts': ['cake', 'brownie', 'cookie', 'ice cream', 'kheer', 'halwa', 'gulab', 'dessert', 'pudding', 'tart', 'cheesecake', 'mithai', 'sweet'],
  'Fast food': ['burger', 'pizza', 'fries', 'nugget', 'wrap', 'shawarma', 'sandwich', 'roll', 'hot dog', 'fried chicken', 'zinger'],
  'Meals': ['biryani', 'karahi', 'curry', 'rice', 'pulao', 'daal', 'dal', 'meal', 'thali', 'platter', 'bbq', 'tikka', 'handi', 'pasta', 'noodles', 'soup', 'lunch', 'dinner'],
  'Fruit & Veg': ['fruit', 'vegetable', 'veg', 'salad', 'apple', 'banana', 'mango', 'tomato', 'spinach', 'potato', 'onion', 'orange'],
  'Beverages': ['juice', 'smoothie', 'tea', 'coffee', 'lassi', 'drink', 'shake', 'water'],
  'Groceries': ['milk', 'yogurt', 'yoghurt', 'cheese', 'eggs', 'butter', 'packaged', 'grocery', 'cereal', 'snack', 'chips', 'canned']
};
const PERISHABLE = ['Meals', 'Bakery', 'Desserts', 'Fast food'];

function categorize(text = '') {
  const t = ` ${text.toLowerCase()} `;
  let best = 'Other', hits = 0;
  for (const [cat, words] of Object.entries(KEYWORDS)) {
    const n = words.filter(w => t.includes(w)).length;
    if (n > hits) { best = cat; hits = n; }
  }
  return { category: best, confidence: hits >= 2 ? 'medium' : hits === 1 ? 'low' : 'none' };
}

// Rule-based discount: more discount as the pickup deadline gets closer, perishable food and large batches.
function suggestDiscount({ originalPrice, quantity = 1, pickupEnd, category = 'Other', now = Date.now() }) {
  const price0 = Number(originalPrice);
  if (!(price0 > 0)) return { error: 'Enter the original price first.' };
  const hrs = Math.max(0, (Date.parse(pickupEnd) - now) / 3600e3);
  const reasons = [];
  let pct = hrs > 8 ? 15 : hrs > 5 ? 25 : hrs > 3 ? 35 : hrs > 1.5 ? 45 : 55;
  reasons.push(`${hrs.toFixed(1)} hours until the pickup deadline → base discount ${pct}%.`);
  if (PERISHABLE.includes(category)) { pct += 5; reasons.push(`${category} is quick to lose quality → +5%.`); }
  if (quantity >= 10) { pct += 5; reasons.push(`${quantity} portions to clear → +5%.`); }
  else if (quantity <= 2) { pct -= 5; reasons.push('Very few portions left → −5%.'); }
  pct = Math.min(70, Math.max(10, pct));
  const suggestedPrice = Math.max(5, Math.min(Math.round(price0 * (1 - pct / 100) / 5) * 5, price0));
  return {
    suggestedPrice,
    discountPct: Math.round((1 - suggestedPrice / price0) * 100),
    reasons,
    label: 'AI-assisted recommendation. You decide the final price.'
  };
}

// Flags missing info for human review. Never says "safe".
function reviewFlags(l) {
  const f = [];
  if (!l.storageInfo || l.storageInfo.length < 10) f.push('Add clearer storage / handling information.');
  if (!l.allergens) f.push('Allergen information is missing.');
  if (!l.photo) f.push('No photo added - customers trust listings with photos.');
  if (!l.description || l.description.length < 15) f.push('Description is very short.');
  if ((Date.parse(l.pickupEnd) - Date.parse(l.pickupStart)) / 3600e3 > 8) f.push('Long pickup window - confirm the food stays safe for the whole period.');
  return f;
}

async function geminiNote(prompt) {
  if (!cfg.GEMINI_KEY) return null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 7000);
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cfg.GEMINI_MODEL}:generateContent`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.GEMINI_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    return j.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch { return null; }
}

// Simple, transparent trend analysis over finished listings of one business (or the whole platform).
function analyzeTrends(listings, orders, donations) {
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const { weekday } = require('./utils');
  const done = listings.filter(l => Date.parse(l.pickupEnd) < Date.now() && l.status !== 'withdrawn');
  const rows = done.map(l => {
    const sold = orders.filter(o => o.listingId === l.id && o.status === 'collected').reduce((s, o) => s + o.qty, 0);
    const given = donations.filter(d => d.listingId === l.id && d.status === 'collected').reduce((s, d) => s + d.qty, 0);
    return { day: weekday(l.pickupEnd), category: l.category, listed: l.quantity, unsold: Math.max(0, l.quantity - sold - given) };
  });
  const byWeekday = DAYS.map((name, i) => {
    const r = rows.filter(x => x.day === i);
    return { day: name, listings: r.length, avgListed: r.length ? +(r.reduce((s, x) => s + x.listed, 0) / r.length).toFixed(1) : 0, avgUnsold: r.length ? +(r.reduce((s, x) => s + x.unsold, 0) / r.length).toFixed(1) : 0 };
  });
  const cats = {};
  rows.forEach(x => { cats[x.category] = (cats[x.category] || 0) + x.unsold; });
  const byCategory = Object.entries(cats).map(([category, unsold]) => ({ category, unsold })).sort((a, b) => b.unsold - a.unsold);

  if (rows.length < 6) return { enough: false, sample: rows.length, byWeekday, byCategory, message: 'Not enough finished listings yet. Insights appear after about 6 listings.' };

  const worst = [...byWeekday].filter(d => d.listings >= 2).sort((a, b) => b.avgUnsold - a.avgUnsold)[0];
  const tips = [];
  if (worst && worst.avgUnsold >= 1) tips.push(`${worst.day} has the most recurring surplus (about ${worst.avgUnsold} portions unsold per listing). Consider preparing roughly ${Math.max(1, Math.round(worst.avgUnsold * 0.7))} fewer portions that day.`);
  if (byCategory[0]?.unsold > 0) tips.push(`${byCategory[0].category} is your biggest source of unsold food (${byCategory[0].unsold} portions in total).`);
  return { enough: true, sample: rows.length, byWeekday, byCategory, tips, disclaimer: `Based on ${rows.length} past listings. This is a recommendation, not a guaranteed forecast.` };
}

module.exports = { CATEGORIES, categorize, suggestDiscount, reviewFlags, geminiNote, analyzeTrends };
