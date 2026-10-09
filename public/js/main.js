(function () {
  const SITE = window.SITE || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  /* Mobile menu */
  const menuBtn = $('.menu-btn');
  const nav = $('#site-nav');
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', (e) => {
      if (e.target.closest('a')) { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
    });
  }

  /* Photo slots that never loaded (onerror may have fired before this script) */
  $$('.ph img').forEach((img) => {
    if (img.complete && img.naturalWidth === 0) img.closest('.ph').classList.add('is-missing');
  });

  /* Social links — edit in js/site-config.js */
  const ICONS = {
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.3H7.5V14h2.7v8z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
    google: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>',
  };
  const NAMES = { facebook: 'Facebook', instagram: 'Instagram', google: 'Google reviews' };
  $$('[data-socials]').forEach((box) => {
    const links = Object.entries(SITE.socials || {}).filter(([, url]) => url);
    if (!links.length) { box.remove(); return; }
    box.innerHTML = links.map(([k, url]) =>
      `<a href="${url}" target="_blank" rel="noopener" aria-label="Mainely Insulation and Weatherization on ${NAMES[k]}" title="${NAMES[k]}">${ICONS[k] || ''}</a>`).join('');
  });
  $$('[data-google-link]').forEach((a) => { if (SITE.socials && SITE.socials.google) a.href = SITE.socials.google; });

  /* Thermal before/after */
  const thermal = $('.thermal');
  if (thermal) {
    const buttons = $$('.seg button', thermal);
    const status = $('#thermal-status');
    buttons.forEach((b) => b.addEventListener('click', () => {
      thermal.dataset.state = b.dataset.state;
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (status) status.textContent = b.dataset.state === 'after'
        ? 'Showing the house after insulation: heat stays inside.'
        : 'Showing the house before insulation: heat escaping.';
    }));
  }

  /* Lead source: remember where the visitor came from (first page of the visit) */
  const TRACK_KEY = 'mi_source';
  let track = null;
  try { track = JSON.parse(sessionStorage.getItem(TRACK_KEY) || 'null'); } catch (_) { /* storage blocked */ }
  if (!track) {
    const p = new URLSearchParams(location.search);
    track = {
      referrer: document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : '',
      utm_source: p.get('utm_source') || '', utm_medium: p.get('utm_medium') || '', utm_campaign: p.get('utm_campaign') || '',
    };
    try { sessionStorage.setItem(TRACK_KEY, JSON.stringify(track)); } catch (_) { /* fine without it */ }
  }

  /* Estimate forms (quick hero form + full form share one handler) */
  const params = new URLSearchParams(location.search);
  const full = $('#estimate-form');
  if (full) {
    const svc = params.get('service');
    if (svc) { const box = $(`input[name="services"][data-key="${CSS.escape(svc)}"]`, full); if (box) box.checked = true; }
    if (params.get('rebate')) { const r = $('input[name="rebate"]', full); if (r) r.checked = true; }
  }

  $$('form[data-form]').forEach((form) => {
    const kind = form.dataset.form;
    const statusEl = $('.form-status', form);
    const showErr = (name, msg) => {
      const input = form.elements[name];
      const el = $(`[data-err="${name}"]`, form);
      if (input && input.setAttribute) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (el) { el.textContent = msg || ''; el.classList.toggle('show', !!msg); }
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      ['name', 'phone', 'email'].forEach((n) => showErr(n, ''));
      statusEl.textContent = ''; statusEl.classList.remove('err');

      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());
      data.services = fd.getAll('services');
      Object.assign(data, track, { form: kind, page: location.pathname });

      const name = (data.name || '').trim(), phone = (data.phone || '').trim(), email = (data.email || '').trim();
      let bad = false;
      if (!name) { showErr('name', 'Add your name so we know who to ask for.'); bad = true; }
      if (kind === 'quick' && !phone) { showErr('phone', 'Add a phone number so we can call you back.'); bad = true; }
      if (kind === 'full' && !phone && !email) { showErr('phone', 'Add a phone number or email so we can reach you.'); bad = true; }
      if (bad) { form.querySelector('[aria-invalid="true"]').focus(); return; }

      const btn = $('button[type="submit"]', form);
      const label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        const res = await fetch('/api/quote', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (out.errors) Object.entries(out.errors).forEach(([k, v]) => showErr(k, v));
          throw new Error(out.error || 'Check the highlighted fields and send again.');
        }
        const first = name.split(' ')[0].replace(/[<>&"]/g, '');
        form.innerHTML = kind === 'quick'
          ? `<div class="form-done" role="status" tabindex="-1"><h3>Thanks${first ? `, ${first}` : ''}. Scott will call you back.</h3>
             <p>Calls go out Monday–Friday, 7am–5pm. Need us now? Call <a href="${SITE.phoneHref}">${SITE.phone}</a>.</p></div>`
          : `<div class="form-done" role="status" tabindex="-1"><h3>Request sent${first ? `, ${first}` : ''}.</h3>
             <p>The Mainely team will reach out to set up your estimate. Need us sooner? Call <a href="${SITE.phoneHref}">${SITE.phone}</a>.</p></div>`;
        $('.form-done', form).focus();
      } catch (err) {
        statusEl.textContent = err.message === 'Failed to fetch'
          ? `The request didn't go through. Check your connection, or call ${SITE.phone}.`
          : err.message;
        statusEl.classList.add('err');
        btn.disabled = false; btn.textContent = label;
      }
    });
  });

  /* Services page galleries + lightbox */
  const G = window.GALLERY;
  const dialog = $('#lightbox');
  if (G && dialog) {
    let current = [], index = 0;
    const lbImg = $('img', dialog), lbCount = $('.lb-count', dialog);
    const show = () => {
      lbImg.src = current[index].src; lbImg.alt = current[index].alt;
      lbCount.textContent = `${index + 1} of ${current.length}`;
    };
    $$('[data-gallery]').forEach((grid) => {
      const set = G[grid.dataset.gallery]; if (!set) return;
      set.photos.forEach((src, i) => {
        const alt = `${set.label} job by Mainely Insulation and Weatherization, photo ${i + 1}`;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('aria-label', `Open ${alt}`);
        btn.innerHTML = `<div class="ph" data-label="${set.label} photo ${i + 1}"><img loading="lazy" alt="${alt}"></div>`;
        const img = $('img', btn);
        img.addEventListener('error', () => { btn.querySelector('.ph').classList.add('is-missing'); btn.disabled = true; btn.style.cursor = 'default'; });
        img.src = src;
        btn.addEventListener('click', () => {
          current = $$('button:not([disabled]) img', grid).map((im) => ({ src: im.currentSrc || im.src, alt: im.alt }));
          index = Math.max(0, current.findIndex((c) => c.src === (img.currentSrc || img.src)));
          show(); dialog.showModal();
        });
        grid.appendChild(btn);
      });
    });
    $('.lb-prev', dialog).addEventListener('click', () => { index = (index - 1 + current.length) % current.length; show(); });
    $('.lb-next', dialog).addEventListener('click', () => { index = (index + 1) % current.length; show(); });
    $('.lb-close', dialog).addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') $('.lb-prev', dialog).click();
      if (e.key === 'ArrowRight') $('.lb-next', dialog).click();
    });
  }

  /* Footer year */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
