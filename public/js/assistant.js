// Mainely question helper: answers common questions, then sends visitors to the ONE estimate form
// (#estimate-form) so there's a single way to submit a request. Scripted (no AI service, no monthly
// cost, never makes up prices or rebate rules). It doesn't collect contact info itself.
(function () {
  const SITE = window.SITE || {};
  const PHONE = SITE.phone || '(207) 303-7205';
  const TEL = SITE.phoneHref || 'tel:+12073037205';
  const STORE = 'mi_assistant_v2';
  const REBATE_URL = 'https://www.efficiencymaine.com/at-home/insulation-rebates-up-to-8600/';


  /* ---------- answers (keep these factual; edit here) ---------- */
  const FAQ = {
    rebates: {
      label: 'Efficiency Maine rebates',
      keys: /rebate|efficiency maine|incentive|money back|tax credit/i,
      text: 'Efficiency Maine offers rebates on insulation and air sealing for qualifying existing Maine homes, up to $8,600 over the life of the home. New construction doesn’t qualify. We help our customers with the rebate process and can go over what your project could qualify for.',
      link: { href: REBATE_URL, label: 'Efficiency Maine’s rebate rules' },
      start: { rebate: 'yes' },
    },
    discount: {
      label: 'Veteran discount',
      keys: /veteran|military|first responder|police|fire ?fighter|ems|discount|served/i,
      text: 'Trey and Scott both served, so this one matters to us. Veterans and first responders get 5% off every job.',
      start: {},
      askDiscount: true,
    },
    services: {
      label: 'What do you install?',
      keys: /service|install|spray|foam|cellulose|fiberglass|batt|blown|air seal|vent|vapor|crawl|attic|basement|wall|rim joist/i,
      text: 'Spray foam, dense-pack cellulose, fiberglass, air sealing, ventilation and vapor barriers. Most houses need a mix of two or three. We look at the house first and tell you what will make the biggest difference.',
      link: { href: '/services', label: 'See photos of our jobs' },
      start: {},
    },
    cost: {
      label: 'How much does it cost?',
      keys: /cost|price|pricing|how much|quote|estimate|expensive|cheap|charge/i,
      text: 'It depends on the house: the size, what’s in the walls and attic now, and what it needs. So we take a look first and give you a clear price for the work. Rebates and the 5% veteran discount can bring it down.',
      start: {},
    },
    area: {
      label: 'Where do you work?',
      keys: /where|area|town|serve|county|york|cumberland|portland|saco|biddeford|kennebunk|wells|scarborough|location|near/i,
      text: 'We’re based at 28 Old Alfred Rd in Biddeford and work across Southern Maine: York and Cumberland counties. If you’re a little outside that, ask anyway.',
      start: {},
    },
    hours: {
      label: 'Hours',
      keys: /hour|open|when|weekend|saturday|sunday|time/i,
      text: `We’re working Monday–Friday, 7am–5pm. Requests sent after hours get a call back the next business day. You can reach Scott directly at ${PHONE}.`,
      start: {},
    },
    moisture: {
      label: 'Ice dams, mold, drafts',
      keys: /ice dam|mold|moist|condens|damp|draft|cold room|cold floor|frost|leak|humid/i,
      text: 'Those usually come from warm, moist air leaking into the attic or walls. Insulation without ventilation leads to condensation, so we fix it as a system: seal the air leaks, insulate, then make sure moisture has a way out.',
      start: {},
    },
  };

  /* ---------- DOM ---------- */
  const root = document.createElement('div');
  root.className = 'mia';
  root.id = 'assistant';
  root.innerHTML = `
    <button class="mia-launch" type="button" aria-expanded="false" aria-controls="mia-panel" aria-label="Questions? Ask us">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>
      <span class="mia-long">Questions? Ask us</span><span class="mia-short">Questions?</span>
    </button>
    <p class="mia-nudge" hidden>Questions about rebates or the veteran discount? Ask here.<button type="button" aria-label="Dismiss">×</button></p>
    <section class="mia-panel" id="mia-panel" role="dialog" aria-modal="false" aria-labelledby="mia-title" hidden>
      <header class="mia-head">
        <div><h2 id="mia-title">Mainely Insulation</h2><p>Quick answers</p></div>
        <button class="mia-x" type="button" aria-label="Close">×</button>
      </header>
      <div class="mia-log" role="log" aria-live="polite"></div>
      <div class="mia-actions"></div>
      <form class="mia-input" autocomplete="on">
        <label class="mia-sr" for="mia-text">Type a message</label>
        <input id="mia-text" type="text" placeholder="Type a question…" autocomplete="off">
        <button type="submit">Send</button>
      </form>
    </section>`;
  document.body.appendChild(root);

  const $ = (s) => root.querySelector(s);
  const launch = $('.mia-launch'), panel = $('.mia-panel'), log = $('.mia-log'), actions = $('.mia-actions');
  const form = $('.mia-input'), input = $('#mia-text'), nudge = $('.mia-nudge');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let state = { lead: {}, history: [] };
  const save = () => { try { sessionStorage.setItem(STORE, JSON.stringify(state)); } catch (_) { /* fine */ } };
  const load = () => { try { return JSON.parse(sessionStorage.getItem(STORE) || 'null'); } catch (_) { return null; } };

  function bubble(who, html, record = true) {
    const p = document.createElement('div');
    p.className = `mia-msg mia-${who}`;
    p.innerHTML = html;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
    if (record) { state.history.push([who, html]); if (state.history.length > 60) state.history.shift(); save(); }
  }
  const bot = (html) => bubble('bot', html);
  const me = (text) => bubble('me', esc(text));

  function buttons(list) {
    actions.innerHTML = '';
    list.forEach(([label, fn, cls]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label; if (cls) b.className = cls;
      b.addEventListener('click', () => fn(label));
      actions.appendChild(b);
    });
  }

  /* ---------- the one way to request: go to the estimate form ---------- */
  function toForm() {
    me('Request an estimate');
    bot('Taking you to the estimate form. Name and a phone number are all Scott needs.');
    const opts = { rebate: state.lead.rebate === 'yes' };
    setTimeout(() => { close(false); if (window.miPrefill) window.miPrefill(opts); else location.href = '/#estimate'; }, 500);
  }
  const ESTIMATE = ['Request an estimate', toForm, 'mia-primary'];

  /* ---------- menu + answers ---------- */
  function menu(intro = true) {
    if (intro) bot('Hi! Ask me a quick question, or go straight to the estimate form.');
    buttons([
      ESTIMATE,
      ...Object.entries(FAQ).slice(0, 5).map(([k, f]) => [f.label, () => { me(f.label); answer(k); }]),
      [`Call Scott: ${PHONE}`, () => { location.href = TEL; }, 'mia-ghost'],
    ]);
  }

  function answer(key) {
    const f = FAQ[key];
    bot(esc(f.text) + (f.link ? ` <a href="${f.link.href}" ${f.link.href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${esc(f.link.label)}</a>` : ''));
    if (f.start && f.start.rebate) state.lead.rebate = 'yes';
    save();
    buttons([
      ESTIMATE,
      ['Ask something else', () => { me('Ask something else'); menu(false); bot('Sure, what else can I help with? Pick one or type it.'); }],
    ]);
  }

  function freeText(text) {
    const hit = Object.entries(FAQ).find(([, f]) => f.keys.test(text));
    if (/^(hi|hello|hey|yo)\b/i.test(text)) { bot('Hi! Ask a question, or go straight to the estimate form.'); return menu(false); }
    if (/human|person|someone|call|talk|phone|speak/i.test(text)) {
      bot(`Call Scott, the company manager, at <a href="${TEL}">${esc(PHONE)}</a>, or Trey, the owner, at <a href="${SITE.ownerPhoneHref || 'tel:+12074233332'}">${esc(SITE.ownerPhone || '(207) 423-3332')}</a> (Mon–Fri, 7am–5pm). Or send the estimate form and Scott will call you.`);
      return buttons([ESTIMATE, ['Back to questions', () => { me('Back'); menu(false); }]]);
    }
    if (hit) return answer(hit[0]);
    bot(`I’m not sure about that one, and I’d rather not guess. Scott can answer it: <a href="${TEL}">${esc(PHONE)}</a>. Or send the estimate form with your question in the notes and he’ll call you back.`);
    buttons([ESTIMATE, ['Other questions', () => { me('Other questions'); menu(false); }]]);
  }

  /* ---------- typing ---------- */
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value;
    if (!v.trim()) return;
    me(v); input.value = '';
    freeText(v);
  });

  /* ---------- open / close ---------- */
  function open() {
    panel.hidden = false; launch.setAttribute('aria-expanded', 'true'); root.classList.add('is-open');
    nudge.hidden = true; try { sessionStorage.setItem('mi_nudged', '1'); } catch (_) { /* fine */ }
    if (!log.children.length) {
      const saved = load();
      if (saved && saved.history && saved.history.length) {
        state = { lead: saved.lead || {}, history: saved.history };
        state.history.forEach(([w, h]) => bubble(w, h, false));
        menu(false);
      } else menu(true);
    }
    setTimeout(() => (actions.querySelector('button') || input).focus(), 60);
  }
  function close(refocus = true) {
    panel.hidden = true; launch.setAttribute('aria-expanded', 'false'); root.classList.remove('is-open');
    if (refocus) launch.focus();
  }
  launch.addEventListener('click', () => (panel.hidden ? open() : close()));
  $('.mia-x').addEventListener('click', () => close());
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
  nudge.querySelector('button').addEventListener('click', () => { nudge.hidden = true; try { sessionStorage.setItem('mi_nudged', '1'); } catch (_) { /* fine */ } });

  // Any link to #assistant opens it (e.g. "Ask a question" buttons)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href="#assistant"]');
    if (a) { e.preventDefault(); open(); }
  });

  // One gentle nudge per visit, after 15s, only if they haven't opened it
  let nudged = false; try { nudged = !!sessionStorage.getItem('mi_nudged'); } catch (_) { nudged = true; }
  if (!nudged) setTimeout(() => { if (panel.hidden) nudge.hidden = false; }, 15000);
})();
