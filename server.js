// Mainely Insulation and Weatherization — thin entry point. Routes live in routes/, helpers in lib/.
const path = require('path');
const express = require('express');

const { initDb } = require('./db/init');
const quoteRoutes = require('./routes/quote');
const adminRoutes = require('./routes/admin');
const legacyRedirects = require('./routes/legacy');

const app = express();
app.set('trust proxy', 1); // Render sits behind a proxy; needed for secure cookies + client IPs
app.disable('x-powered-by');
app.locals.db = initDb();

app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.get('/healthz', (req, res) => res.type('text').send('ok'));
app.use(legacyRedirects);
app.use('/api', quoteRoutes);
app.use('/admin', adminRoutes);
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: '1h' }));

app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Mainely Insulation and Weatherization site running on port ${PORT}`));
