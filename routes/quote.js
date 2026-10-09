// Public estimate-request endpoint: POST /api/quote
// Used by both the quick hero form (form=quick) and the full estimate form (form=full).
const express = require('express');
const { sendLeadAlert, sendCustomerConfirmation } = require('../lib/mailer');
const { rateLimit } = require('../lib/rate-limit');
const { sourceLabel } = require('../lib/lead-source');

const router = express.Router();
const tooMany = rateLimit({ windowMs: 10 * 60 * 1000, max: 5 });

const SERVICES = ['Spray foam', 'Dense-pack cellulose', 'Fiberglass', 'Air sealing', 'Ventilation', 'Vapor barrier', 'Not sure yet'];
const PROPERTY = ['Existing home', 'New construction', 'Addition / renovation', 'Garage / shop / barn', 'Commercial'];
const TIMELINE = ['As soon as possible', 'Within a month', '1–3 months', 'Just planning ahead'];
const DISCOUNT = ['Veteran', 'First responder'];

const clean = (v, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const pick = (v, allowed) => (allowed.includes(v) ? v : '');
const wantsHtml = (req) => !req.is('application/json') && (req.headers.accept || '').includes('text/html');

router.post('/quote', async (req, res) => {
  const body = req.body || {};

  // Honeypot: real people never see or fill this field.
  if (body.company_website) return wantsHtml(req) ? res.redirect(303, '/thanks') : res.json({ ok: true });

  if (tooMany(req.ip)) {
    const msg = 'Too many requests from this connection. Please call (207) 303-7205 instead.';
    return wantsHtml(req) ? res.status(429).type('text').send(msg) : res.status(429).json({ error: msg });
  }

  const rawServices = Array.isArray(body.services) ? body.services : body.services ? [body.services] : [];
  const lead = {
    name: clean(body.name, 100),
    phone: clean(body.phone, 40),
    email: clean(body.email, 160).toLowerCase(),
    town: clean(body.town, 80),
    services: [...new Set(rawServices.map((s) => pick(s, SERVICES)).filter(Boolean))].join(', '),
    property_type: pick(body.property_type, PROPERTY),
    timeline: pick(body.timeline, TIMELINE),
    discount: pick(body.discount, DISCOUNT),
    rebate: body.rebate === 'yes' || body.rebate === true ? 'Yes' : '',
    message: String(body.message ?? '').trim().slice(0, 2000),
    source_form: body.form === 'quick' ? 'quick' : 'full',
    source_page: clean(body.page, 200),
    referrer: clean(body.referrer, 300),
    utm_source: clean(body.utm_source, 80),
    utm_medium: clean(body.utm_medium, 80),
    utm_campaign: clean(body.utm_campaign, 120),
  };

  const errors = {};
  if (!lead.name) errors.name = 'Add your name so we know who to ask for.';
  if (!lead.phone && !lead.email) errors.phone = 'Add a phone number or email so we can reach you.';
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) errors.email = 'Check the email address — it looks incomplete.';
  if (lead.phone && lead.phone.replace(/\D/g, '').length < 10) errors.phone = 'Enter a 10-digit phone number, including area code.';

  if (Object.keys(errors).length) {
    return wantsHtml(req)
      ? res.status(400).type('text').send(Object.values(errors).join('\n'))
      : res.status(400).json({ errors });
  }

  const info = req.app.locals.db
    .prepare(`INSERT INTO leads (name, phone, email, town, services, property_type, timeline, message, discount, rebate,
                                 source_form, source_page, referrer, utm_source, utm_medium, utm_campaign)
              VALUES (@name, @phone, @email, @town, @services, @property_type, @timeline, @message, @discount, @rebate,
                      @source_form, @source_page, @referrer, @utm_source, @utm_medium, @utm_campaign)`)
    .run(lead);

  const withSource = { ...lead, id: info.lastInsertRowid, source: sourceLabel(lead) };
  sendLeadAlert(withSource).catch((err) => console.error('[mailer] Alert failed for lead', info.lastInsertRowid, err.message));
  sendCustomerConfirmation(withSource).catch((err) => console.error('[mailer] Confirmation failed for lead', info.lastInsertRowid, err.message));

  return wantsHtml(req) ? res.redirect(303, '/thanks') : res.json({ ok: true });
});

module.exports = router;
