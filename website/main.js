/* Raunaq Engineering — scroll story + page motion */
(() => {
  const N = 592;                                  // frames in the sequence
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = Math.min(innerWidth, innerHeight) < 700 || (navigator.connection && navigator.connection.saveData);
  const dir = small ? 'assets/frames/m/' : 'assets/frames/d/';
  const src = i => dir + String(i + 1).padStart(4, '0') + '.webp';
  if (reduced) document.documentElement.classList.add('reduced');
  document.getElementById('yr').textContent = new Date().getFullYear();

  /* ---------- Frame loading (coarse-to-fine so scrubbing works early) ---------- */
  const frames = new Array(N);
  const loaded = new Uint8Array(N);
  const order = [];
  const seen = new Uint8Array(N);
  for (const step of [32, 16, 8, 4, 2, 1]) for (let i = 0; i < N; i += step) if (!seen[i]) { seen[i] = 1; order.push(i); }
  if (!seen[N - 1]) order.push(N - 1);

  const bar = document.getElementById('loaderBar'), pct = document.getElementById('loaderPct'), loader = document.getElementById('loader');
  let nLoaded = 0, revealed = false;
  const gate = Math.ceil(N / 16) + 2; // ~40 keyframes before we lift the curtain
  function reveal() { if (revealed) return; revealed = true; loader.classList.add('done'); draw(true); startPage(); }
  setTimeout(reveal, 7000); // never block the page on a slow connection

  let cursor = 0, inflight = 0;
  const MAX = 8;
  function pump() {
    while (inflight < MAX && cursor < order.length) {
      const i = order[cursor++], img = new Image();
      inflight++;
      img.decoding = 'async';
      img.onload = () => { frames[i] = img; loaded[i] = 1; nLoaded++; inflight--; onProgress(); pump(); };
      img.onerror = () => { inflight--; pump(); };
      img.src = src(i);
    }
  }
  function onProgress() {
    if (!revealed) {
      const p = Math.min(1, nLoaded / gate);
      bar.style.width = (p * 100) + '%'; pct.textContent = String(Math.round(p * 100)).padStart(2, '0') + '%';
      if (nLoaded === 1) draw(true);
      if (nLoaded >= gate) reveal();
    }
    if (Math.abs(lastDrawn - Math.round(cur)) > 0) needDraw = true;
  }
  pump();

  /* ---------- Canvas ---------- */
  const cv = document.getElementById('seq'), ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    em.width = Math.round(W * dpr); em.height = Math.round(H * dpr);
    needDraw = true;
  }
  function nearest(i) {
    if (loaded[i]) return i;
    for (let d = 1; d < N; d++) {
      if (i - d >= 0 && loaded[i - d]) return i - d;
      if (i + d < N && loaded[i + d]) return i + d;
    }
    return -1;
  }
  let lastDrawn = -1, needDraw = true;
  function draw(force) {
    const i = nearest(Math.round(cur));
    if (i < 0 || (!force && !needDraw && i === lastDrawn)) return;
    const img = frames[i];
    const s = Math.max(cv.width / img.naturalWidth, cv.height / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    // gentle push-in over the whole journey for extra depth
    const z = 1 + 0.04 * (cur / (N - 1));
    ctx.drawImage(img, (cv.width - w * z) / 2, (cv.height - h * z) / 2, w * z, h * z);
    lastDrawn = i; needDraw = false;
  }

  /* ---------- Embers (sparks layer) ---------- */
  const em = document.getElementById('embers'), ex = em.getContext('2d');
  const parts = [];
  function heat(f) {
    if (f >= 103 && f <= 156) return 1;          // cutting + welding
    if (f < 48) return 0.35;                       // hero glow
    if (f >= 503) return 0.25;                     // finale
    return 0.06;
  }
  function embers() {
    ex.clearRect(0, 0, em.width, em.height);
    if (reduced) return;
    const h = heat(Math.round(cur)), spawn = h * (small ? 2 : 4);
    for (let k = 0; k < spawn; k++) {
      if (Math.random() > 0.6) continue;
      const fast = h > 0.9 && Math.random() < 0.5;
      parts.push({
        x: Math.random() * em.width, y: em.height + 10,
        vx: (Math.random() - 0.5) * (fast ? 3 : 0.8) * dpr, vy: -(fast ? 3 + Math.random() * 5 : 0.6 + Math.random() * 1.6) * dpr,
        life: 1, decay: 0.004 + Math.random() * (fast ? 0.02 : 0.008), r: (0.6 + Math.random() * 1.6) * dpr
      });
    }
    for (let p = parts.length - 1; p >= 0; p--) {
      const q = parts[p];
      q.x += q.vx + Math.sin((q.y + q.x) * 0.01) * 0.3; q.y += q.vy; q.vy *= 0.995; q.life -= q.decay;
      if (q.life <= 0 || q.y < -20) { parts.splice(p, 1); continue; }
      ex.globalAlpha = q.life * 0.9;
      ex.fillStyle = q.life > 0.6 ? '#ffd08a' : '#ff8a1f';
      ex.beginPath(); ex.arc(q.x, q.y, q.r, 0, 6.283); ex.fill();
    }
    ex.globalAlpha = 1;
    if (parts.length > 500) parts.splice(0, parts.length - 500);
  }

  /* ---------- Scroll → frame ---------- */
  const story = document.getElementById('story');
  const chs = [...document.querySelectorAll('.ch')].map(el => ({ el, a: +el.dataset.a, b: +el.dataset.b }));
  const rail = [...document.querySelectorAll('#rail li')].map(el => ({ el, f: +el.dataset.f }));
  const fc = document.getElementById('fc'), nav = document.getElementById('nav');
  let cur = 0, target = 0;

  function progress() {
    const r = story.getBoundingClientRect();
    const len = story.offsetHeight - innerHeight;
    return Math.min(1, Math.max(0, -r.top / len));
  }
  const smooth = t => t * t * (3 - 2 * t);
  const FADE = 9;
  function chapters(f) {
    for (const c of chs) {
      let o;
      if (f < c.a - FADE || f > c.b + FADE) o = 0;
      else if (f < c.a) o = c.a === 0 ? 1 : smooth((f - (c.a - FADE)) / FADE);
      else if (f > c.b) o = c.b >= N - 1 ? 1 : 1 - smooth((f - c.b) / FADE);
      else o = 1;
      if (o !== c.o) {
        c.o = o;
        c.el.style.opacity = o;
        c.el.style.visibility = o > 0.01 ? 'visible' : 'hidden';
        c.el.style.translate = `0 ${(1 - o) * (f < c.a ? 28 : -28)}px`;
      }
    }
    let active = 0;
    rail.forEach((r, k) => { if (f >= r.f) active = k; });
    rail.forEach((r, k) => { r.el.classList.toggle('on', k === active); r.el.classList.toggle('past', k < active); });
    fc.textContent = String(Math.round(f) + 1).padStart(4, '0');
  }

  function tick() {
    target = progress() * (N - 1);
    cur += (target - cur) * (reduced ? 1 : 0.16);
    if (Math.abs(target - cur) < 0.01) cur = target;
    if (Math.round(cur) !== lastDrawn) needDraw = true;
    draw();
    chapters(cur);
    embers();
    nav.classList.toggle('solid', story.getBoundingClientRect().bottom < innerHeight * 0.6);
    requestAnimationFrame(tick);
  }

  addEventListener('resize', size);
  size();
  requestAnimationFrame(tick);

  /* ---------- Page motion (after loader) ---------- */
  let lenis;
  function startPage() {
    if (window.gsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    if (window.Lenis && !reduced) {
      lenis = new Lenis({ duration: 1.15, smoothWheel: true });
      if (window.gsap) {
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add(t => lenis.raf(t * 1000));
        gsap.ticker.lagSmoothing(0);
      } else {
        const raf = t => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
      }
    }
    if (!window.gsap) { document.querySelectorAll('.reveal').forEach(e => { e.style.opacity = 1; e.style.transform = 'none'; }); return; }

    if (reduced) { gsap.set('.reveal', { opacity: 1, y: 0 }); }
    else {
      ScrollTrigger.batch('.reveal', {
        start: 'top 88%',
        onEnter: b => gsap.to(b, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.08, overwrite: true })
      });
    }

    // Counters
    document.querySelectorAll('.count').forEach(el => {
      const to = +el.dataset.to, suf = el.dataset.suffix || '';
      const o = { v: 0 };
      ScrollTrigger.create({
        trigger: el, start: 'top 90%', once: true,
        onEnter: () => gsap.to(o, { v: to, duration: reduced ? 0 : 2, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString('en-IN') + suf; } })
      });
    });

    // Horizontal gallery (desktop)
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1001px)', () => {
      const track = document.getElementById('galleryTrack');
      const dist = () => track.scrollWidth - innerWidth;
      gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: '.gallery', start: 'top top', end: () => '+=' + dist(), pin: '.gallery-pin', scrub: 0.6, invalidateOnRefresh: true }
      });
    });

    // Team photo unmask
    if (!reduced) {
      gsap.to('.team-img', { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: '.team', start: 'top 85%', end: 'top 25%', scrub: true } });
      gsap.to('.team-img img', { scale: 1, ease: 'none', scrollTrigger: { trigger: '.team', start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.from('.machines-media img', { scale: 1.15, ease: 'none', scrollTrigger: { trigger: '.machines', start: 'top bottom', end: 'bottom top', scrub: true } });
    } else {
      gsap.set('.team-img', { clipPath: 'none' });
    }
    ScrollTrigger.refresh();
  }

  /* ---------- Nav ---------- */
  const toggle = document.getElementById('navToggle'), links = document.getElementById('navLinks');
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const el = id === '#top' ? document.body : document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    links.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false');
    if (lenis) lenis.scrollTo(id === '#top' ? 0 : el, { offset: -60, duration: 1.6 });
    else (id === '#top' ? scrollTo(0, 0) : el.scrollIntoView());
  }));

  /* ---------- Enquiry form ---------- */
  const form = document.getElementById('enquiryForm'), note = document.getElementById('formNote');
  const wa = document.getElementById('waBtn');
  wa.addEventListener('click', e => {
    const d = new FormData(form);
    const msg = `Hello Raunaq Engineering,\nName: ${d.get('name') || ''}\nCompany: ${d.get('company') || ''}\nRequirement: ${d.get('requirement') || ''}\n${d.get('message') || ''}`;
    wa.href = 'https://wa.me/917758812578?text=' + encodeURIComponent(msg.trim());
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    note.textContent = 'Sending…';
    try {
      const res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(form)).toString() });
      if (!res.ok) throw new Error(res.status);
      form.reset();
      note.textContent = 'Thank you. We will get back to you shortly.';
    } catch {
      note.textContent = 'Could not send right now. Please call +91 77588 12578 or use WhatsApp.';
    }
  });
})();
