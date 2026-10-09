// Admin auth: one username/password from env vars, HMAC-signed session cookie.
// No default password — if ADMIN_PASSWORD isn't set (8+ chars), login is disabled.
const crypto = require('crypto');

const COOKIE = 'mi_admin';
const MAX_AGE_MS = 12 * 60 * 60 * 1000;
let ephemeralSecret = null;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (!ephemeralSecret) {
    ephemeralSecret = crypto.randomBytes(32).toString('hex');
    console.warn('[auth] SESSION_SECRET not set (16+ chars). Using a random per-boot secret; admin logins reset on restart.');
  }
  return ephemeralSecret;
}

function adminConfigured() {
  const p = process.env.ADMIN_PASSWORD;
  return typeof p === 'string' && p.length >= 8;
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function checkCredentials(username, password) {
  if (!adminConfigured()) return false;
  const userOk = safeEqual(username || '', process.env.ADMIN_USERNAME || 'admin');
  const passOk = safeEqual(password || '', process.env.ADMIN_PASSWORD);
  return passOk;
}

const sign = (value) => crypto.createHmac('sha256', secret()).update(value).digest('base64url');

function createToken() {
  const payload = `admin.${Date.now() + MAX_AGE_MS}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (!token) return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  if (!safeEqual(sig, sign(payload))) return false;
  const exp = Number(payload.split('.')[1]);
  return Number.isFinite(exp) && exp > Date.now();
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) {
      try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch (_) { /* skip bad cookie */ }
    }
  });
  return out;
}

function startSession(req, res) {
  res.cookie(COOKIE, createToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: MAX_AGE_MS,
    path: '/admin',
  });
}

function endSession(res) {
  res.clearCookie(COOKIE, { path: '/admin' });
}

function requireAdmin(req, res, next) {
  if (verifyToken(parseCookies(req.headers.cookie)[COOKIE])) return next();
  if (req.path.startsWith('/api')) return res.status(401).json({ error: 'Your session ended. Sign in again to continue.' });
  return res.redirect('/admin/login');
}

module.exports = { adminConfigured, checkCredentials, startSession, endSession, requireAdmin };
