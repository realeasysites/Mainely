// Mainely guided assistant: answers common questions and walks visitors step by step into an
// estimate request. Scripted (no AI service, no monthly cost, never makes up prices or rebate rules).
// Requests post to /api/quote with form=assistant and land in the lead dashboard like any other lead.
(function () {
  const SITE = window.SITE || {};
  const PHONE = SITE.phone || '(207) 303-7205';
  const TEL = SITE.phoneHref || 'tel:+12073037205';
  const STORE = 'mi_assistant';
  const REBATE_URL = 'https://www.efficiencymaine.com/at-home/insulation-rebates-up-to-8600/';

  const SERVICES = ['Spray foam', 'Dense-pack cellulose', 'Fiberglass', 'Air sealing', 'Ventilation', 'Vapor barrier', 'Not sure yet'];
  const PROPERTY = ['Existing home', 'New construction', 'Addition / renovation', 'Garage / shop / barn', 'Commercial'];
  const TIMELINE = ['As soon as possible', 'Within a month', '1–3 months', 'Just planning ahead'];

  /* ---------- answers (keep these factual; edit here) ---------- */
  const FAQ = {
    rebates: {
      label: 'Efficiency Maine rebates',
      keys: /rebate|efficiency maine|incentive|money back|tax credit/i,
      text: 'We’re an Efficiency Maine Registered Vendor. Efficiency Maine only pays its insulation and air sealing rebates when a registered vendor does the work. Qualifying existing Maine homes can get up to $8,600 back over the life of the home. New construction doesn’t qualify. We’ll go over what your house qualifies for.',
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
    <button class="mia-launch" type="button" aria-expanded="false" aria-controls="mia-panel" aria-label="Questions? Get an estimate">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>
      <span class="mia-long">Questions? Get an estimate</span><span class="mia-short">Questions?</span>
    </button>
    <p class="mia-nudge" hidden>Ask about rebates, the veteran discount, or start an estimate.<button type="button" aria-label="Dismiss">×</button></p>
    <section class="mia-panel" id="mia-panel" role="dialog" aria-modal="false" aria-labelledby="mia-title" hidden>
      <header class="mia-head">
        <div><h2 id="mia-title">Mainely Insulation</h2><p>Quick answers and estimate requests</p></div>
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

  let state = { lead: {}, step: null, history: [] };
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

  // Input mode: 'chat' (free questions), or a field for the guided flow
  function setInput({ type = 'text', placeholder = 'Type a question…', autocomplete = 'off', inputmode = '' } = {}) {
    input.type = type; input.placeholder = placeholder; input.autocomplete = autocomplete;
    if (inputmode) input.setAttribute('inputmode', inputmode); else input.removeAttribute('inputmode');
    input.value = '';
  }

  function buttons(list) {
    actions.innerHTML = '';
    list.forEach(([label, fn, cls]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label; if (cls) b.className = cls;
      b.addEventListener('click', () => fn(label));
      actions.appendChild(b);
    });
  }

  /* ---------- menu + answers ---------- */
  function menu(intro = true) {
    state.step = null; save();
    setInput();
    if (intro) bot('Hi! I can answer quick questions, or get your estimate started in about a minute.');
    buttons([
      ['Start my estimate', () => { me('Start my estimate'); startFlow(); }, 'mia-primary'],
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
      ['Start my estimate', () => { me('Start my estimate'); startFlow(); }, 'mia-primary'],
      ['Ask something else', () => { me('Ask something else'); menu(false); bot('Sure, what else can I help with? Pick one or type it.'); }],
    ]);
  }

  function freeText(text) {
    const hit = Object.entries(FAQ).find(([, f]) => f.keys.test(text));
    if (/^(hi|hello|hey|yo)\b/i.test(text)) { bot('Hi! Want to start an estimate, or ask a question?'); return menu(false); }
    if (/human|person|someone|call|talk|phone|speak/i.test(text)) {
      bot(`Call Scott, the company manager, at <a href="${TEL}">${esc(PHONE)}</a>, or Trey, the owner, at <a href="${SITE.ownerPhoneHref || 'tel:+12074233332'}">${esc(SITE.ownerPhone || '(207) 423-3332')}</a> (Mon–Fri, 7am–5pm). Or I can take your info and have Scott call you.`);
      return buttons([['Have Scott call me', () => { me('Have Scott call me'); startFlow(); }, 'mia-primary'], ['Back to questions', () => { me('Back'); menu(false); }]]);
    }
    if (hit) return answer(hit[0]);
    bot(`I’m not sure about that one, and I’d rather not guess. Scott can answer it: <a href="${TEL}">${esc(PHONE)}</a>. Or start a request and add your question, and he’ll call you back.`);
    buttons([['Start my estimate', () => { me('Start my estimate'); startFlow(); }, 'mia-primary'], ['Other questions', () => { me('Other questions'); menu(false); }]]);
  }

  /* ---------- guided estimate request ---------- */
  const STEPS = {
    service: {
      ask: 'What can we help with? Pick the closest one.',
      options: SERVICES.map((s) => s === 'Not sure yet' ? ['Not sure: house is cold or drafty', 'Not sure yet'] : [s, s]),
      set: (v) => { state.lead.services = v; },
      next: 'property',
    },
    property: {
      ask: 'What kind of building is it?',
      options: PROPERTY.map((p) => [p, p]),
      set: (v) => { state.lead.property_type = v; },
      next: () => (state.lead.property_type === 'Existing home' && !state.lead.rebate ? 'rebate' : 'timeline'),
    },
    rebate: {
      ask: 'Existing homes can qualify for Efficiency Maine rebates of up to $8,600. Want us to check yours?',
      options: [['Yes, check my rebates', 'yes'], ['No thanks', '']],
      set: (v) => { state.lead.rebate = v; },
      next: 'timeline',
    },
    timeline: {
      ask: 'When are you hoping to get it done?',
      options: TIMELINE.map((t) => [t, t]),
      set: (v) => { state.lead.timeline = v; },
      next: 'discount',
    },
    discount: {
      ask: 'Are you a veteran or first responder? You’d get 5% off.',
      options: [['Veteran', 'Veteran'], ['First responder', 'First responder'], ['No', '']],
      set: (v) => { state.lead.discount = v; },
      next: 'town',
    },
    town: {
      ask: 'What town is the house in?',
      input: { placeholder: 'Saco, Kennebunk, Portland…', autocomplete: 'address-level2' },
      validate: (v) => (v.trim().length >= 2 ? '' : 'Type the town name.'),
      set: (v) => { state.lead.town = v.trim(); },
      next: 'name',
    },
    name: {
      ask: 'Got it. What’s your name?',
      input: { placeholder: 'First and last name', autocomplete: 'name' },
      validate: (v) => (v.trim().length >= 2 ? '' : 'Type your name so Scott knows who to ask for.'),
      set: (v) => { state.lead.name = v.trim(); },
      next: 'phone',
    },
    phone: {
      ask: () => `Thanks, ${esc(state.lead.name.split(' ')[0])}. What’s the best number for Scott to call?`,
      input: { type: 'tel', placeholder: '(207) 555-1234', autocomplete: 'tel', inputmode: 'tel' },
      validate: (v) => (v.replace(/\D/g, '').length >= 10 ? '' : 'Enter a 10-digit phone number, including area code.'),
      set: (v) => { state.lead.phone = v.trim(); },
      next: 'email',
    },
    email: {
      ask: 'Email, if you’d like a confirmation? (optional)',
      input: { type: 'email', placeholder: 'you@example.com', autocomplete: 'email', inputmode: 'email' },
      skip: 'Skip',
      validate: (v) => (!v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'That email looks incomplete. Fix it or tap Skip.'),
      set: (v) => { state.lead.email = v.trim(); },
      next: 'notes',
    },
    notes: {
      ask: 'Anything we should know? Age of the house, cold rooms, ice dams, a question for Scott… (optional)',
      input: { placeholder: 'Type a note, or tap Skip' },
      skip: 'Skip',
      set: (v) => { state.lead.message = v.trim(); },
      next: 'review',
    },
  };

  function startFlow() {
    state.lead = { rebate: state.lead.rebate || '' };
    bot('Great. A few quick questions, one at a time.');
    go('service');
  }

  function go(key) {
    state.step = key; save();
    if (key === 'review') return review();
    const st = STEPS[key];
    bot(typeof st.ask === 'function' ? st.ask() : esc(st.ask));
    if (st.options) {
      setInput({ placeholder: 'Pick one above, or type a question…' });
      buttons(st.options.map(([label, value]) => [label, () => { me(label); st.set(value); advance(st); }]));
    } else {
      setInput(st.input);
      buttons(st.skip ? [[st.skip, () => { me(st.skip); st.set(''); advance(st); }, 'mia-ghost']] : []);
      setTimeout(() => input.focus(), 50);
    }
  }
  const advance = (st) => go(typeof st.next === 'function' ? st.next() : st.next);

  function review() {
    const l = state.lead;
    const rows = [
      ['Help with', l.services], ['Building', l.property_type], ['When', l.timeline], ['Town', l.town],
      ['Name', l.name], ['Phone', l.phone], ['Email', l.email],
      ['Rebates', l.rebate ? 'Check Efficiency Maine rebates' : ''], ['Discount', l.discount ? `${l.discount} (5%)` : ''], ['Note', l.message],
    ].filter(([, v]) => v);
    bot(`Here’s what I’ll send to Scott:<dl class="mia-sum">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`);
    setInput({ placeholder: 'Type a question…' });
    buttons([
      ['Send my request', send, 'mia-primary'],
      ['Start over', () => { me('Start over'); startFlow(); }, 'mia-ghost'],
    ]);
  }

  async function send() {
    me('Send my request');
    buttons([]);
    const track = (() => { try { return JSON.parse(sessionStorage.getItem('mi_source') || '{}'); } catch (_) { return {}; } })();
    const l = state.lead;
    const body = {
      ...track, form: 'assistant', page: location.pathname,
      name: l.name, phone: l.phone, email: l.email || '', town: l.town,
      services: l.services ? [l.services] : [], property_type: l.property_type || '', timeline: l.timeline || '',
      discount: l.discount || '', rebate: l.rebate ? 'yes' : '', message: l.message || '',
    };
    try {
      const res = await fetch('/api/quote', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = out.errors ? Object.values(out.errors).join(' ') : (out.error || 'Something went wrong sending that.');
        bot(`${esc(msg)} You can fix it and try again, or call Scott at <a href="${TEL}">${esc(PHONE)}</a>.`);
        return buttons([['Try again', () => { me('Try again'); startFlow(); }, 'mia-primary']]);
      }
      const first = esc((l.name || '').split(' ')[0]);
      bot(`Sent! Thanks, ${first}. Scott will call you at ${esc(l.phone)} (Monday–Friday, 7am–5pm).${l.email ? ' A confirmation is on its way to your email.' : ''} Need us sooner? <a href="${TEL}">${esc(PHONE)}</a>`);
      state.lead = {}; state.step = 'done'; save();
      buttons([['Ask another question', () => { me('Ask another question'); menu(false); bot('Sure, what can I help with?'); }, 'mia-ghost']]);
    } catch (_) {
      bot(`That didn’t go through. Check your connection and try again, or call Scott at <a href="${TEL}">${esc(PHONE)}</a>.`);
      buttons([['Try again', send, 'mia-primary']]);
    }
  }

  /* ---------- typing ---------- */
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value;
    const st = STEPS[state.step];
    if (st && st.input && state.step !== 'notes' && /\?\s*$/.test(v)) {
      me(v); input.value = '';
      const hit = Object.entries(FAQ).find(([, f]) => f.keys.test(v));
      bot(hit ? esc(FAQ[hit[0]].text) : 'Good question for Scott. Add it in the note at the end and he’ll answer when he calls.');
      return go(state.step);
    }
    if (st && st.input) {
      const err = st.validate ? st.validate(v) : '';
      if (!v.trim() && !st.skip) return;
      if (err) { if (v.trim()) me(v); bot(esc(err)); return; }
      if (!v.trim()) { me(st.skip); st.set(''); return advance(st); }
      me(st.input.type === 'tel' || st.input.type === 'email' ? v.trim() : v);
      st.set(v); input.value = ''; return advance(st);
    }
    if (!v.trim()) return;
    me(v); input.value = '';
    // a question in the middle of the flow: answer it, then offer to pick up where they left off
    if (st && st.options) {
      const hit = Object.entries(FAQ).find(([, f]) => f.keys.test(v));
      if (hit) bot(esc(FAQ[hit[0]].text));
      else bot(`Good question for Scott; add it in the note at the end and he’ll answer when he calls.`);
      return go(state.step);
    }
    freeText(v);
  });

  /* ---------- open / close ---------- */
  function open() {
    panel.hidden = false; launch.setAttribute('aria-expanded', 'true'); root.classList.add('is-open');
    nudge.hidden = true; try { sessionStorage.setItem('mi_nudged', '1'); } catch (_) { /* fine */ }
    if (!log.children.length) {
      const saved = load();
      if (saved && saved.history && saved.history.length) {
        state = saved; state.history.forEach(([w, h]) => bubble(w, h, false));
        if (state.step && STEPS[state.step]) { bot('Picking up where we left off.'); go(state.step); }
        else if (state.step === 'review') review();
        else menu(false);
      } else menu(true);
    }
    setTimeout(() => (actions.querySelector('button') || input).focus(), 60);
  }
  function close() {
    panel.hidden = true; launch.setAttribute('aria-expanded', 'false'); root.classList.remove('is-open');
    launch.focus();
  }
  launch.addEventListener('click', () => (panel.hidden ? open() : close()));
  $('.mia-x').addEventListener('click', close);
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
