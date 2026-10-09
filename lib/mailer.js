// Lead emails.
//  - sendLeadAlert: new-lead alert to NOTIFY_EMAIL (comma-separate to alert Trey and Scott both).
//    Reply-To is the customer, so hitting Reply goes straight to them.
//  - sendCustomerConfirmation: short "we got your request" email to the customer, if they gave an email.
//    Turn off with SEND_CONFIRMATION=false.
const nodemailer = require('nodemailer');

const BIZ = 'Mainely Insulation and Weatherization';
const PHONE = '(207) 303-7205';
let transport = null;

function getTransport() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: String(process.env.SMTP_SECURE || (port === 465)).toLowerCase() === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transport;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fromAddr = () => process.env.SMTP_FROM || `"${BIZ}" <${process.env.SMTP_USER}>`;

async function sendLeadAlert(lead) {
  const t = getTransport();
  const to = process.env.NOTIFY_EMAIL;
  if (!t || !to) {
    console.log('[mailer] Email alerts not configured (SMTP_* / NOTIFY_EMAIL). Lead saved to dashboard only.');
    return;
  }

  const site = (process.env.SITE_URL || '').replace(/\/$/, '');
  const dashboard = site ? `${site}/admin` : '';
  const telHref = lead.phone ? `tel:${lead.phone.replace(/[^\d+]/g, '')}` : '';
  const rows = [
    ['Name', lead.name],
    ['Phone', lead.phone],
    ['Email', lead.email],
    ['Town', lead.town],
    ['Services', lead.services],
    ['Property', lead.property_type],
    ['Timeline', lead.timeline],
    ['Discount', lead.discount ? `${lead.discount} (5%)` : ''],
    ['Efficiency Maine', lead.rebate ? 'Wants to use rebates' : ''],
    ['Message', lead.message],
    ['Found you via', lead.source],
    ['Form', lead.source_form === 'quick' ? 'Quick estimate (top of page)' : 'Full estimate form'],
  ].filter(([, v]) => v);

  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n') + (dashboard ? `\n\nView in dashboard: ${dashboard}` : '');
  const btn = (href, label, bg) => `<a href="${esc(href)}" style="display:inline-block;background:${bg};color:${bg === '#3da433' ? '#0a1a08' : '#ffffff'};padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold;margin:0 8px 8px 0">${esc(label)}</a>`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px">
      <h2 style="margin:0 0 4px;color:#1d5d16">New estimate request</h2>
      <p style="margin:0 0 14px;color:#55654f">Leads called back within the hour book far more often. Reach out soon.</p>
      <p style="margin:0 0 12px">${telHref ? btn(telHref, `Call ${lead.name.split(' ')[0]}`, '#3da433') : ''}${lead.email ? btn(`mailto:${lead.email}`, 'Email back', '#10260d') : ''}</p>
      <table style="border-collapse:collapse;width:100%">
        ${rows.map(([k, v]) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #e3ebe0;color:#55654f;width:120px;vertical-align:top">${esc(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #e3ebe0;white-space:pre-wrap">${esc(v)}</td></tr>`).join('')}
      </table>
      ${dashboard ? `<p style="margin-top:18px">${btn(dashboard, 'Open lead dashboard', '#10260d')}</p>` : ''}
    </div>`;

  await t.sendMail({
    from: fromAddr(),
    to,
    replyTo: lead.email || undefined,
    subject: `New estimate request: ${lead.name}${lead.town ? ` (${lead.town})` : ''}${lead.services ? ` · ${lead.services}` : ''}`,
    text,
    html,
  });
}

async function sendCustomerConfirmation(lead) {
  const t = getTransport();
  if (!t || !lead.email || String(process.env.SEND_CONFIRMATION).toLowerCase() === 'false') return;
  const first = lead.name.split(' ')[0];
  const replyTo = (process.env.NOTIFY_EMAIL || '').split(',')[0].trim() || undefined;

  const text = `Hi ${first},

Thanks for reaching out to ${BIZ}. We got your estimate request${lead.services ? ` for ${lead.services.toLowerCase()}` : ''}, and someone from our team will be in touch soon to set up a time.

Need us sooner? Call Scott directly at ${PHONE} (Mon–Fri, 7am–5pm).
${lead.rebate ? '\nYou mentioned Efficiency Maine rebates. We\'re a Registered Vendor, so we\'ll go over what your project qualifies for.\n' : ''}${lead.discount ? `\nThank you for your service. Your 5% ${lead.discount.toLowerCase()} discount is noted.\n` : ''}
Whatever it takes,
${BIZ}
Veteran-owned and operated · Biddeford, Maine`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;color:#1b2a19;line-height:1.5">
      <p>Hi ${esc(first)},</p>
      <p>Thanks for reaching out to ${BIZ}. We got your estimate request${lead.services ? ` for ${esc(lead.services.toLowerCase())}` : ''}, and someone from our team will be in touch soon to set up a time.</p>
      <p>Need us sooner? Call Scott directly at <a href="tel:+12073037205" style="color:#1d5d16;font-weight:bold">${PHONE}</a> (Mon–Fri, 7am–5pm).</p>
      ${lead.rebate ? '<p>You mentioned Efficiency Maine rebates. We\'re a Registered Vendor, so we\'ll go over what your project qualifies for.</p>' : ''}
      ${lead.discount ? `<p>Thank you for your service. Your 5% ${esc(lead.discount.toLowerCase())} discount is noted.</p>` : ''}
      <p style="margin-top:22px"><strong style="color:#1d5d16">“Whatever it takes.”</strong><br>${BIZ}<br><span style="color:#55654f">Veteran-owned and operated · Biddeford, Maine</span></p>
    </div>`;

  await t.sendMail({ from: fromAddr(), to: lead.email, replyTo, subject: `We got your estimate request, ${first}`, text, html });
}

module.exports = { sendLeadAlert, sendCustomerConfirmation };
