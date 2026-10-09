// Turns raw referrer/UTM data into a short, human label for the dashboard ("Google search", "Facebook"…).
function sourceLabel({ utm_source, utm_medium, referrer }) {
  const s = (utm_source || '').toLowerCase();
  const m = (utm_medium || '').toLowerCase();
  if (s) {
    if (/google/.test(s) && /cpc|ppc|paid/.test(m)) return 'Google Ads';
    if (/facebook|fb|instagram|ig|meta/.test(s)) return /cpc|paid/.test(m) ? 'Facebook/Instagram ads' : 'Facebook/Instagram';
    if (/gbp|business|maps/.test(s)) return 'Google Business Profile';
    return utm_source;
  }
  let host = '';
  try { host = new URL(referrer).hostname.replace(/^www\./, ''); } catch (_) { /* no referrer */ }
  if (!host) return 'Direct / typed in';
  if (/google\./.test(host)) return 'Google search';
  if (/bing\.|duckduckgo\.|yahoo\./.test(host)) return 'Other search';
  if (/facebook\.|fb\.|instagram\.|m\.facebook/.test(host)) return 'Facebook/Instagram';
  if (/efficiencymaine\.com/.test(host)) return 'Efficiency Maine';
  if (/mainelyinsulation\.com|onrender\.com/.test(host)) return 'Direct / typed in';
  return host;
}

module.exports = { sourceLabel };
