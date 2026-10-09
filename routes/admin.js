// Admin lead dashboard: /admin (login-protected)
const path = require('path');
const express = require('express');
const { adminConfigured, checkCredentials, startSession, endSession, requireAdmin } = require('../lib/auth');
const { rateLimit } = require('../lib/rate-limit');
const { sourceLabel } = require('../lib/lead-source');

const router = express.Router();
const tooManyLogins = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const view = (name) => path.join(__dirname, '..', 'views', name);

const STATUSES = ['new', 'contacted', 'visit scheduled', 'quoted', 'won', 'lost'];

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});

router.get('/login', (req, res) => res.sendFile(view('login.html')));

router.post('/login', (req, res) => {
  if (!adminConfigured()) return res.redirect(303, '/admin/login?e=setup');
  if (tooManyLogins(req.ip)) return res.redirect(303, '/admin/login?e=wait');
  const { username, password } = req.body || {};
  if (!checkCredentials(username, password)) return res.redirect(303, '/admin/login?e=bad');
  startSession(req, res);
  return res.redirect(303, '/admin');
});

router.post('/logout', (req, res) => {
  endSession(res);
  res.redirect(303, '/admin/login');
});

router.use(requireAdmin);

router.get('/', (req, res) => res.sendFile(view('dashboard.html')));

const withSource = (l) => ({ ...l, source: sourceLabel(l) });

router.get('/api/leads', (req, res) => {
  const { status } = req.query;
  const db = req.app.locals.db;
  const leads = STATUSES.includes(status)
    ? db.prepare('SELECT * FROM leads WHERE status = ? ORDER BY id DESC').all(status)
    : db.prepare('SELECT * FROM leads ORDER BY id DESC').all();
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  db.prepare('SELECT status, COUNT(*) AS n FROM leads GROUP BY status').all().forEach((r) => { counts[r.status] = r.n; });
  res.json({ leads: leads.map(withSource), counts, statuses: STATUSES });
});

// Headline numbers for the top of the dashboard — the "is the website working?" view.
router.get('/api/stats', (req, res) => {
  const db = req.app.locals.db;
  const one = (sql, ...a) => db.prepare(sql).get(...a).n;
  const all = db.prepare('SELECT services, referrer, utm_source, utm_medium, rebate FROM leads').all();

  const bySource = {};
  const byService = {};
  all.forEach((l) => {
    const src = sourceLabel(l);
    bySource[src] = (bySource[src] || 0) + 1;
    (l.services || 'Not specified').split(', ').forEach((s) => { byService[s] = (byService[s] || 0) + 1; });
  });
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, n]) => ({ label, n }));

  const total = all.length;
  const won = one("SELECT COUNT(*) AS n FROM leads WHERE status = 'won'");
  const closed = one("SELECT COUNT(*) AS n FROM leads WHERE status IN ('won','lost')");
  res.json({
    total,
    last7: one("SELECT COUNT(*) AS n FROM leads WHERE created_at >= datetime('now','-7 days')"),
    last30: one("SELECT COUNT(*) AS n FROM leads WHERE created_at >= datetime('now','-30 days')"),
    needsFollowUp: one("SELECT COUNT(*) AS n FROM leads WHERE status = 'new' AND created_at <= datetime('now','-1 day')"),
    newCount: one("SELECT COUNT(*) AS n FROM leads WHERE status = 'new'"),
    won,
    winRate: closed ? Math.round((won / closed) * 100) : null,
    rebateLeads: all.filter((l) => l.rebate).length,
    topSources: top(bySource),
    topServices: top(byService),
  });
});

// Mutations require a JSON body (blocks cross-site form posts).
const jsonOnly = (req, res, next) => (req.is('application/json') ? next() : res.status(415).json({ error: 'Send JSON.' }));

router.patch('/api/leads/:id', jsonOnly, (req, res) => {
  const id = Number(req.params.id);
  const { status, notes } = req.body || {};
  const db = req.app.locals.db;
  const lead = db.prepare('SELECT id FROM leads WHERE id = ?').get(id);
  if (!lead) return res.status(404).json({ error: 'That lead no longer exists. Refresh the list.' });
  if (status !== undefined) {
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Pick a status from the list.' });
    db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(status, id);
    if (status !== 'new') db.prepare("UPDATE leads SET contacted_at = datetime('now') WHERE id = ? AND contacted_at IS NULL").run(id);
  }
  if (notes !== undefined) db.prepare('UPDATE leads SET notes = ? WHERE id = ?').run(String(notes).slice(0, 4000), id);
  res.json({ ok: true });
});

router.delete('/api/leads/:id', jsonOnly, (req, res) => {
  req.app.locals.db.prepare('DELETE FROM leads WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

router.get('/api/leads.csv', (req, res) => {
  const rows = req.app.locals.db.prepare('SELECT * FROM leads ORDER BY id DESC').all().map(withSource);
  const cols = ['id', 'created_at', 'status', 'name', 'phone', 'email', 'town', 'services', 'property_type', 'timeline', 'discount', 'rebate',
    'message', 'notes', 'source', 'source_form', 'source_page', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign', 'contacted_at'];
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n');
  res.set('Content-Disposition', 'attachment; filename="mainely-insulation-leads.csv"');
  res.type('text/csv').send(csv);
});

module.exports = router;
