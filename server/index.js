const path = require('path');
const express = require('express');
const cfg = require('./config');
const db = require('./db');
const { attach } = require('./auth');
const { expireOld } = require('./lifecycle');

db.load();
if (!db.data.users.length) { require('./seed').run(); console.log('First run: demo data created.'); }

const app = express();
app.use(express.json({ limit: '4mb' }));
app.use('/api', attach, (req, res, next) => { expireOld(); next(); });

app.use('/api/auth', require('./routes/auth'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/donations', require('./routes/donations'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/insights', require('./routes/insights'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((err, req, res, next) => { // eslint-disable-line
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong on the server.' });
});

setInterval(expireOld, 60e3);
app.listen(cfg.PORT, () => console.log(`FoodSave AI running → http://localhost:${cfg.PORT}`));
