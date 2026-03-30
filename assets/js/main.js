/* ============================================================
   ALIANÇA CENTRO AUTOMOTIVO — Main JavaScript
   GSAP ScrollTrigger · Lenis Smooth Scroll · Interactivity
   v2 — Performance: ScrollTrigger.batch, quickTo, scrub 1.5
   ============================================================ */

'use strict';

/* ---- LOADER ---------------------------------------------- */
(function initLoader() {
  const loader = document.getElementById('loader');
  if (!loader) return;
  window.addEventListener('load', () => {
    setTimeout(() => loader.classList.add('done'), 1400);
  });
})();

/* ---- LENIS SMOOTH SCROLL --------------------------------- */
let lenis;
(function initLenis() {
  if (typeof Lenis === 'undefined') return;
  lenis = new Lenis({
    duration: 0.75,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 1.1,
    touchMultiplier: 1.5,
  });
  if (typeof gsap !== 'undefined') {
    gsap.ticker.add((time) => { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  } else {
    (function raf(time) { lenis.raf(time); requestAnimationFrame(raf); })(0);
  }
  if (typeof ScrollTrigger !== 'undefined') {
    lenis.on('scroll', ScrollTrigger.update);
  }
})();

/* ---- GSAP SETUP ------------------------------------------ */
(function initGSAP() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  /* ---- Hero animation ---- */
  document.querySelectorAll('.hh-line').forEach((line, i) => {
    gsap.to(line, { opacity:1, y:0, duration:0.85, ease:'power3.out', delay:1.6 + i * 0.15 });
  });
  gsap.fromTo('.hero-kicker',  { opacity:0, y:14 }, { opacity:1, y:0, duration:0.65, ease:'power2.out', delay:1.5 });
  gsap.fromTo('.hero-desc',    { opacity:0, y:18 }, { opacity:1, y:0, duration:0.65, ease:'power2.out', delay:2.0 });
  gsap.fromTo('.hero-actions', { opacity:0, y:18 }, { opacity:1, y:0, duration:0.65, ease:'power2.out', delay:2.15 });
  gsap.fromTo('.hero-emblem',  { opacity:0, scale:0.88 }, { opacity:1, scale:1, duration:1.1, ease:'back.out(1.4)', delay:1.75 });
  gsap.fromTo('.emblem-ring--outer', { opacity:0 }, { opacity:1, duration:1.2, delay:2.0 });
  gsap.fromTo('.emblem-ring--inner', { opacity:0 }, { opacity:1, duration:1.2, delay:2.2 });
  document.querySelectorAll('.hero-stat').forEach((el, i) => {
    gsap.to(el, { opacity:1, y:0, duration:0.55, ease:'power2.out', delay:2.3 + i * 0.15 });
  });

  /* ---- Scroll reveals: ScrollTrigger.batch ---- */
  /* ANTES: 1 ScrollTrigger por elemento (~73 instâncias)            */
  /* AGORA: 1 instância por grupo — reduz 73 → ~12 instâncias        */

  ScrollTrigger.batch('.reveal-up', {
    start: 'top 90%',
    once: true,
    onEnter: batch => gsap.fromTo(batch,
      { opacity:0, y:36 },
      { opacity:1, y:0, duration:0.75, ease:'power3.out', stagger:0.07, overwrite:true }
    ),
  });

  ScrollTrigger.batch('.reveal-right', {
    start: 'top 85%',
    once: true,
    onEnter: batch => gsap.fromTo(batch,
      { opacity:0, x:56 },
      { opacity:1, x:0, duration:0.9, ease:'power3.out', stagger:0.08, overwrite:true }
    ),
  });

  ScrollTrigger.batch('.reveal-card', {
    start: 'top 92%',
    once: true,
    onEnter: batch => gsap.fromTo(batch,
      { opacity:0, y:48 },
      { opacity:1, y:0, duration:0.65, ease:'power3.out', stagger:0.08, overwrite:true }
    ),
  });

  ScrollTrigger.batch('.reveal-stat', {
    start: 'top 88%',
    once: true,
    onEnter: batch => gsap.fromTo(batch,
      { opacity:0, y:24 },
      { opacity:1, y:0, duration:0.6, ease:'power3.out', stagger:0.1, overwrite:true }
    ),
  });

  ScrollTrigger.batch('.step-num', {
    start: 'top 80%',
    once: true,
    onEnter: batch => gsap.fromTo(batch,
      { opacity:0, scale:0.5 },
      { opacity:1, scale:1, duration:0.6, ease:'back.out(1.5)', stagger:0.15, overwrite:true }
    ),
  });

  ScrollTrigger.batch('.stat-num', {
    start: 'top 88%',
    once: true,
    onEnter: batch => gsap.fromTo(batch,
      { scale:0.7, opacity:0 },
      { scale:1, opacity:1, duration:0.6, ease:'back.out(1.7)', stagger:0.1, overwrite:true }
    ),
  });

  /* ---- Parallax about: scrub suavizado (1.5s) ---- */
  const aboutImg = document.querySelector('.about-img-frame');
  if (aboutImg) {
    gsap.fromTo(aboutImg,
      { y: 0 },
      { y: -30, ease:'none', scrollTrigger: {
        trigger: '.section-about',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1.5,
      }}
    );
  }

  /* ---- Nav scrolled state ---- */
  ScrollTrigger.create({
    start: 60,
    onEnter: () => document.getElementById('navbar')?.classList.add('scrolled'),
    onLeaveBack: () => document.getElementById('navbar')?.classList.remove('scrolled'),
  });

  /* ---- Section bg via CSS custom property (sem animar body) ---- */
  const sections = [
    { el: '.section-services',     bg: '#050505' },
    { el: '.section-stats',        bg: '#000' },
    { el: '.section-about',        bg: '#050505' },
    { el: '.section-process',      bg: '#000' },
    { el: '.section-testimonials', bg: '#050505' },
    { el: '.section-lead',         bg: '#000' },
    { el: '.section-blog',         bg: '#050505' },
  ];
  sections.forEach(({ el, bg }) => {
    const node = document.querySelector(el);
    if (!node) return;
    ScrollTrigger.create({
      trigger: node,
      start: 'top 60%',
      end: 'bottom 40%',
      onEnter:     () => node.style.setProperty('--section-bg', bg),
      onLeave:     () => node.style.setProperty('--section-bg', '#000'),
      onEnterBack: () => node.style.setProperty('--section-bg', bg),
      onLeaveBack: () => node.style.setProperty('--section-bg', '#000'),
    });
  });

  /* ---- Service cards 3D tilt: gsap.quickTo ---- */
  /* ANTES: gsap.to() a cada mousemove = centenas de tweens/s        */
  /* AGORA: quickTo reutiliza o mesmo tween                          */
  document.querySelectorAll('.service-card').forEach(card => {
    gsap.set(card, { transformPerspective: 800 });
    const rotY = gsap.quickTo(card, 'rotateY', { duration:0.35, ease:'power2.out' });
    const rotX = gsap.quickTo(card, 'rotateX', { duration:0.35, ease:'power2.out' });
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      rotY(((e.clientX - r.left - r.width  / 2) / (r.width  / 2)) * 6);
      rotX(((e.clientY - r.top  - r.height / 2) / (r.height / 2)) * -6);
    });
    card.addEventListener('mouseleave', () => { rotY(0); rotX(0); });
  });

})();

/* ---- COUNTER ANIMATION ----------------------------------- */
(function initCounters() {
  const counters = document.querySelectorAll('.count');
  if (!counters.length) return;
  const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(0) + '.000' : n.toString();
  new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.target, 10);
      const start = performance.now();
      (function step(now) {
        const p = Math.min((now - start) / 2000, 1);
        el.textContent = fmt(Math.round((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = fmt(target);
      })(start);
      entry.target._observer?.unobserve(el);
    });
  }, { threshold: 0.5 }).observe(document.querySelector('.count') || document.body);
  counters.forEach(c => {
    new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      const target = parseInt(c.dataset.target, 10);
      const start = performance.now();
      const fmt2 = (n) => n >= 1000 ? (n / 1000).toFixed(0) + '.000' : n.toString();
      (function step(now) {
        const p = Math.min((now - start) / 2000, 1);
        c.textContent = fmt2(Math.round((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) requestAnimationFrame(step);
        else c.textContent = fmt2(target);
      })(start);
    }, { threshold: 0.5 }).observe(c);
  });
})();

/* ---- TESTIMONIALS CAROUSEL ------------------------------- */
(function initTestimonials() {
  const track = document.getElementById('tTrack');
  if (!track) return;
  const cards = track.querySelectorAll('.tcard');
  const dotsContainer = document.querySelector('.t-dots');
  const prevBtn = document.querySelector('.t-prev');
  const nextBtn = document.querySelector('.t-next');
  if (!cards.length || !dotsContainer) return;

  let current = 0, autoTimer, dragStart = 0, isDragging = false, dragDelta = 0;

  cards.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 't-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', 'Depoimento ' + (i + 1));
    dot.addEventListener('click', () => goTo(i));
    dotsContainer.appendChild(dot);
  });

  function getVisible() {
    return window.innerWidth <= 768 ? 1 : window.innerWidth <= 1024 ? 2 : 3;
  }
  function goTo(idx) {
    const max = Math.max(0, cards.length - getVisible());
    current = Math.max(0, Math.min(idx, max));
    const cardW = cards[0].offsetWidth + 20;
    if (typeof gsap !== 'undefined') gsap.to(track, { x: -current * cardW, duration:0.65, ease:'power3.out' });
    else track.style.transform = 'translateX(' + (-current * cardW) + 'px)';
    dotsContainer.querySelectorAll('.t-dot').forEach((d, i) => d.classList.toggle('active', i === current));
  }

  prevBtn?.addEventListener('click', () => { goTo(current - 1); resetAuto(); });
  nextBtn?.addEventListener('click', () => { goTo(current + 1); resetAuto(); });
  function startAuto() { autoTimer = setInterval(() => goTo(current + 1), 5000); }
  function resetAuto() { clearInterval(autoTimer); startAuto(); }

  const wrap = track.closest('.testimonials-wrap');
  if (wrap) {
    wrap.addEventListener('mousedown', e => { isDragging = true; dragStart = e.clientX; });
    wrap.addEventListener('mousemove', e => { if (isDragging) dragDelta = e.clientX - dragStart; });
    wrap.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      if (dragDelta < -50) goTo(current + 1);
      else if (dragDelta > 50) goTo(current - 1);
      dragDelta = 0; resetAuto();
    });
    wrap.addEventListener('mouseleave', () => { isDragging = false; });
    wrap.addEventListener('touchstart', e => { dragStart = e.touches[0].clientX; }, { passive:true });
    wrap.addEventListener('touchend', e => {
      const delta = e.changedTouches[0].clientX - dragStart;
      if (delta < -50) goTo(current + 1);
      else if (delta > 50) goTo(current - 1);
      resetAuto();
    });
  }

  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => goTo(current), 150); });
  startAuto(); goTo(0);
})();

/* ---- MOBILE MENU ----------------------------------------- */
(function initMobileMenu() {
  const burger = document.querySelector('.nav-burger');
  const overlay = document.querySelector('.mobile-overlay');
  if (!burger || !overlay) return;
  function close() {
    overlay.classList.remove('open'); overlay.style.display = 'none';
    burger.classList.remove('open'); burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  burger.addEventListener('click', () => {
    const isOpen = !overlay.classList.contains('open');
    overlay.classList.toggle('open', isOpen); overlay.style.display = isOpen ? 'flex' : 'none';
    burger.classList.toggle('open', isOpen); burger.setAttribute('aria-expanded', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });
  overlay.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();

/* ---- SMOOTH ANCHOR SCROLL -------------------------------- */
(function initAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -70, duration: 1.2 });
      else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();

/* ---- LEAD FORM ------------------------------------------- */
(function initLeadForm() {
  const form = document.getElementById('leadForm');
  const btn = document.getElementById('formBtn');
  const successEl = document.getElementById('formSuccess');
  if (!form) return;
  const phoneField = document.getElementById('f-wpp');
  if (phoneField) {
    phoneField.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 11);
      if (v.length >= 7)      v = '(' + v.slice(0,2) + ') ' + v.slice(2,7) + '-' + v.slice(7);
      else if (v.length >= 3) v = '(' + v.slice(0,2) + ') ' + v.slice(2);
      e.target.value = v;
    });
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    btn?.classList.add('loading');
    const body = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await fetch('api/leads.php', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      if (res.ok) {
        form.style.display = 'none';
        if (successEl) successEl.removeAttribute('hidden');
        if (typeof gtag === 'function') gtag('event', 'lead', { event_category: 'form' });
      } else throw new Error();
    } catch {
      const msg = encodeURIComponent('Olá! Me chamo ' + (body.nome||'') + ' e gostaria de um orçamento para ' + (body.servico||'') + '.');
      window.open('https://wa.me/5551994687074?text=' + msg, '_blank');
      btn?.classList.remove('loading');
    }
  });
})();

/* ---- BLOG POSTS LOADER ----------------------------------- */
(function loadBlogPosts() {
  const grid = document.getElementById('blogGrid');
  if (!grid) return;
  fetch('api/posts.php?limit=3')
    .then(r => r.json())
    .then(posts => {
      if (!posts?.length) { grid.innerHTML = '<p style="color:var(--text-3);font-size:14px;grid-column:1/-1">Em breve novos artigos.</p>'; return; }
      grid.innerHTML = posts.map(p =>
        '<article class="blog-card reveal-card">' +
        '<div class="blog-card-img-wrap"><img class="blog-card-img" src="' + (p.image||'assets/images/blog-placeholder.jpg') + '" alt="' + p.title + '" loading="lazy"></div>' +
        '<div class="blog-card-body"><p class="blog-card-cat">' + (p.category||'Dicas') + '</p>' +
        '<h3 class="blog-card-title"><a href="/blog/' + p.slug + '">' + p.title + '</a></h3>' +
        '<p class="blog-card-excerpt">' + p.excerpt + '</p>' +
        '<div class="blog-card-meta"><span>' + p.date + '</span><span>' + (p.readTime||'3 min de leitura') + '</span></div>' +
        '</div></article>'
      ).join('');
      if (typeof ScrollTrigger !== 'undefined') {
        ScrollTrigger.batch(grid.querySelectorAll('.blog-card'), {
          start: 'top 92%', once: true,
          onEnter: batch => gsap.fromTo(batch, { opacity:0, y:40 }, { opacity:1, y:0, duration:0.65, ease:'power3.out', stagger:0.1 }),
        });
      }
    })
    .catch(() => {
      grid.innerHTML = [
        ['Dicas','Como proteger a pintura do seu carro no inverno','O inverno pode ser agressivo para a pintura. Saiba como protegê-la.'],
        ['Tecnologia','Vitrificação vs. Cera: qual vale mais a pena?','Entenda as diferenças e o melhor custo-benefício para seu carro.'],
        ['Manutenção','Martelinho de Ouro: quando usar e quando não usar','A técnica PDR é incrível para certos amassados, mas não é universal.'],
      ].map(([cat,title,exc]) =>
        '<article class="blog-card"><div class="blog-card-img-wrap" style="background:var(--bg-elevated)"></div>' +
        '<div class="blog-card-body"><p class="blog-card-cat">' + cat + '</p><h3 class="blog-card-title">' + title + '</h3>' +
        '<p class="blog-card-excerpt">' + exc + '</p></div></article>'
      ).join('');
    });
})();

/* ---- BACK TO TOP — IntersectionObserver (sem scroll listener) ---- */
(function initBackTop() {
  const btn = document.getElementById('backTop');
  if (!btn) return;
  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'position:absolute;top:600px;left:0;width:1px;height:1px;pointer-events:none;';
  document.body.prepend(sentinel);
  new IntersectionObserver(([e]) => btn.classList.toggle('visible', !e.isIntersecting)).observe(sentinel);
  btn.addEventListener('click', () => {
    if (lenis) lenis.scrollTo(0, { duration: 1.2 });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

/* ---- FOOTER YEAR ----------------------------------------- */
const ftYear = document.getElementById('ftYear');
if (ftYear) ftYear.textContent = new Date().getFullYear();

/* ---- ACTIVE NAV LINK ---- */
(function initActiveNav() {
  const navSections = document.querySelectorAll('section[id]');
  const links = document.querySelectorAll('.nav-links a[href^="#"]');
  if (!navSections.length || !links.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      links.forEach(a => { a.style.color = a.getAttribute('href') === '#' + entry.target.id ? 'var(--text)' : ''; });
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  navSections.forEach(s => obs.observe(s));
})();
