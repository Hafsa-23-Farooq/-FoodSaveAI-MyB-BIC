const router = require('express').Router();
const ai = require('../ai');
const { need } = require('../auth');
const { num, str } = require('../utils');

router.post('/categorize', need('business'), (req, res) => {
  res.json(ai.categorize(`${str(req.body?.title)} ${str(req.body?.description)}`));
});

router.post('/discount', need('business'), async (req, res) => {
  const b = req.body || {};
  const category = ai.CATEGORIES.includes(b.category) ? b.category : ai.categorize(`${str(b.title)} ${str(b.description)}`).category;
  if (!b.pickupEnd || isNaN(Date.parse(b.pickupEnd))) return res.status(400).json({ error: 'Set the pickup deadline first.' });
  const out = ai.suggestDiscount({ originalPrice: num(b.originalPrice), quantity: Math.floor(num(b.quantity) ?? 1), pickupEnd: b.pickupEnd, category });
  if (out.error) return res.status(400).json({ error: out.error });
  const flags = ai.reviewFlags({ storageInfo: str(b.storageInfo), allergens: str(b.allergens), photo: b.hasPhoto, description: str(b.description), pickupStart: new Date().toISOString(), pickupEnd: b.pickupEnd });
  const note = await ai.geminiNote(`You help a food business price surplus food. In 2 short sentences, explain why a ${out.discountPct}% discount (Rs. ${b.originalPrice} to Rs. ${out.suggestedPrice}) suits "${str(b.title)}" (${category}, ${b.quantity} portions) with the pickup deadline at ${b.pickupEnd}. Do not claim the food is safe.`);
  res.json({ ...out, category, flags, aiNote: note, poweredBy: note ? 'Gemini + rules' : 'Rules' });
});

module.exports = router;
