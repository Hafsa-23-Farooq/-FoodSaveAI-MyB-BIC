const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

module.exports = {
  PORT: Number(process.env.PORT) || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  AUTO_VERIFY: process.env.AUTO_VERIFY !== 'false',
  COMMISSION: Number(process.env.COMMISSION_RATE ?? 0.10),
  GEMINI_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  DEFAULT_LAT: Number(process.env.DEFAULT_LAT) || 33.6844,
  DEFAULT_LNG: Number(process.env.DEFAULT_LNG) || 73.0479,
  KG_PER_PORTION: 0.4,          // estimate used for "food rescued" (labelled as an estimate in the UI)
  MAX_ACTIVE_RESERVATIONS: 3,   // per customer (reduces no-shows)
  MAX_QTY_PER_ORDER: 5,
  SAME_DAY_MAX_HOURS: 12,       // pickup window limit without approved storage
  STORED_MAX_HOURS: 36,         // limit when business confirms safe storage for next-day pickup
  TZ_OFFSET_HOURS: 5,           // Pakistan (UTC+5) - used for weekday / daily grouping
  TZ_NAME: 'Asia/Karachi'
};
