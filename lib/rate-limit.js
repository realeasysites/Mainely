// Tiny in-memory rate limiter (per IP). Good enough for a single small Render instance.
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return function limited(key) {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
      return false;
    }
    entry.count += 1;
    return entry.count > max;
  };
}

module.exports = { rateLimit };
