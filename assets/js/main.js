/* ============================================================
   ALIANÇA CENTRO AUTOMOTIVO — Main JavaScript
   GSAP ScrollTrigger · Lenis Smooth Scroll · Interactivity
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
    duration: 1.0,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 0.8,
    touchMultiplier: 1.5,
  });
  // Use ONLY GSAP ticker — no separate RAF loop to avoid double-call
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

  /* ---- Hero V2 animation ---- */
  // Stagger hero title lines
  document.querySelectorAll('.hh-line').forEach((line, i) => {
    gsap.to(line, {
      opacity: 1, y: 0,
      duration: 0.85,
      ease: 'power3.out',
      delay: 1.6 + i * 0.15,
    });
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

  /* ---- Scroll-triggered reveals ---- */
  // .reveal-up — slide up + fade
  document.querySelectorAll('.reveal-up').forEach(el => {
    const delay = parseFloat(el.dataset.delay || 0) * 0.1;
    gsap.fromTo(el,
      { opacity: 0, y: 36 },
      {
        opacity: 1, y: 0,
        duration: 0.85,
        ease: 'power3.out',
        delay,
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          toggleActions: 'play none none none',
        }
      }
    );
  });

  // .reveal-right — slide from right
  document.querySelectorAll('.reveal-right').forEach(el => {
    gsap.fromTo(el,
      { opacity: 0, x: 56 },
      {
        opacity: 1, x: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 82%',
          toggleActions: 'play none none none',
        }
      }
    );
  });

  // .reveal-card — staggered cards
  document.querySelectorAll('.service-card.reveal-card').forEach((el, i) => {
    gsap.fromTo(el,
      { opacity: 0, y: 48 },
      {
        opacity: 1, y: 0,
        duration: 0.7,
        ease: 'power3.out',
        delay: (i % 3) * 0.08,
        scrollTrigger: {
          trigger: el,
          start: 'top 90%',
          toggleActions: 'play none none none',
        }
      }
    );
  });

  // .reveal-stat — stats
  document.querySelectorAll('.reveal-stat').forEach((el, i) => {
    gsap.fromTo(el,
      { opacity: 0, y: 24 },
      {
        opacity: 1, y: 0,
        duration: 0.65,
        ease: 'power3.out',
        delay: i * 0.1,
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none',
        }
      }
    );
  });

  /* ---- Parallax on about image ---- */
  const aboutImg = document.querySelector('.about-img-frame');
  if (aboutImg) {
    gsap.fromTo(aboutImg,
      { y: 0 },
      {
        y: -40,
        ease: 'none',
        scrollTrigger: {
          trigger: '.section-about',
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        }
      }
    );
  }

  /* ---- Hero car parallax on scroll ---- */
  const heroCar = document.querySelector('.hero-visual');
  if (heroCar) {
    gsap.to(heroCar, {
      y: 80,
      opacity: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      }
    });
  }

  /* ---- Stat numbers scale on enter ---- */
  document.querySelectorAll('.stat-num').forEach(el => {
    gsap.fromTo(el,
      { scale: 0.7, opacity: 0 },
      {
        scale: 1, opacity: 1,
        duration: 0.6,
        ease: 'back.out(1.7)',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none',
        }
      }
    );
  });

  /* ---- Service cards 3D tilt ---- */
  document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      gsap.to(card, {
        rotateY: dx * 6,
        rotateX: -dy * 6,
        duration: 0.3,
        ease: 'power2.out',
        transformPerspective: 800,
      });
    });
    card.addEventListener('mouseleave', () => {
      gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.5, ease: 'elastic.out(1, 0.6)' });
    });
  });

  /* ---- Nav background colour shift on scroll ---- */
  ScrollTrigger.create({
    start: 60,
    onEnter: () => document.getElementById('navbar')?.classList.add('scrolled'),
    onLeaveBack: () => document.getElementById('navbar')?.classList.remove('scrolled'),
  });

  /* ---- Section background colour scroll shift ---- */
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
      onEnter: () => gsap.to('body', { backgroundColor: bg, duration: 0.6, ease: 'power2.inOut' }),
      onLeave: () => gsap.to('body', { backgroundColor: '#000', duration: 0.4 }),
      onEnterBack: () => gsap.to('body', { backgroundColor: bg, duration: 0.6 }),
      onLeaveBack: () => gsap.to('body', { backgroundColor: '#000', duration: 0.4 }),
    });
  });

  /* ---- Process step numbers draw in ---- */
  document.querySelectorAll('.step-num').forEach((el, i) => {
    gsap.fromTo(el,
      { opacity: 0, scale: 0.5 },
      {
        opacity: 1, scale: 1,
        duration: 0.6,
        ease: 'back.out(1.5)',
        delay: i * 0.15,
        scrollTrigger: {
          trigger: '.section-process',
          start: 'top 75%',
          toggleActions: 'play none none none',
        }
      }
    );
  });

})();

/* ---- COUNTER ANIMATION ----------------------------------- */
(function initCounters() {
  const counters = document.querySelectorAll('.count');
  if (!counters.length) return;

  const formatNum = (n) => n >= 1000 ? (n / 1000).toFixed(0) + '.000' : n.toString();

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.target, 10);
      const dur = 2000;
      const start = performance.now();

      function step(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / dur, 1);
        // Ease out cubic
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(ease * target);
        el.textContent = formatNum(current);
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = formatNum(target);
      }
      requestAnimationFrame(step);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });

  counters.forEach(c => observer.observe(c));
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

  let current = 0;
  let autoTimer;
  let isDragging = false;
  let dragStart = 0;
  let dragDelta = 0;

  // Build dots
  cards.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 't-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Depoimento ${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
    dotsContainer.appendChild(dot);
  });

  function getVisible() {
    const w = window.innerWidth;
    if (w <= 768) return 1;
    if (w <= 1024) return 2;
    return 3;
  }

  function goTo(idx) {
    const vis = getVisible();
    const max = Math.max(0, cards.length - vis);
    current = Math.max(0, Math.min(idx, max));
    const cardW = cards[0].offsetWidth + 20; // gap = 20px
    if (typeof gsap !== 'undefined') {
      gsap.to(track, { x: -current * cardW, duration: 0.65, ease: 'power3.out' });
    } else {
      track.style.transform = `translateX(${-current * cardW}px)`;
    }
    // Update dots
    dotsContainer.querySelectorAll('.t-dot').forEach((d, i) => {
      d.classList.toggle('active', i === current);
    });
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  prevBtn?.addEventListener('click', () => { prev(); resetAuto(); });
  nextBtn?.addEventListener('click', () => { next(); resetAuto(); });

  // Auto-advance
  function startAuto() { autoTimer = setInterval(next, 5000); }
  function resetAuto() { clearInterval(autoTimer); startAuto(); }

  // Drag / swipe
  const wrap = track.closest('.testimonials-wrap');
  if (wrap) {
    wrap.addEventListener('mousedown', e => { isDragging = true; dragStart = e.clientX; });
    wrap.addEventListener('mousemove', e => { if (isDragging) dragDelta = e.clientX - dragStart; });
    wrap.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      if (dragDelta < -50) next();
      else if (dragDelta > 50) prev();
      dragDelta = 0;
      resetAuto();
    });
    wrap.addEventListener('mouseleave', () => { if (isDragging) { isDragging = false; dragDelta = 0; } });

    // Touch
    wrap.addEventListener('touchstart', e => { dragStart = e.touches[0].clientX; }, { passive: true });
    wrap.addEventListener('touchend', e => {
      const delta = e.changedTouches[0].clientX - dragStart;
      if (delta < -50) next();
      else if (delta > 50) prev();
      resetAuto();
    });
  }

  // Recalc on resize
  window.addEventListener('resize', () => goTo(current));

  startAuto();
  goTo(0);
})();

/* ---- MOBILE MENU ----------------------------------------- */
(function initMobileMenu() {
  const burger = document.querySelector('.nav-burger');
  const overlay = document.querySelector('.mobile-overlay');
  if (!burger || !overlay) return;

  function toggle() {
    const isOpen = !overlay.classList.contains('open');
    overlay.classList.toggle('open', isOpen);
    overlay.style.display = isOpen ? 'flex' : 'none';
    burger.classList.toggle('open', isOpen);
    burger.setAttribute('aria-expanded', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }
  function close() {
    overlay.classList.remove('open');
    overlay.style.display = 'none';
    burger.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  burger.addEventListener('click', toggle);
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
      if (lenis) {
        lenis.scrollTo(target, { offset: -70, duration: 1.4 });
      } else {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
})();

/* ---- LEAD FORM ------------------------------------------- */
(function initLeadForm() {
  const form = document.getElementById('leadForm');
  const btn = document.getElementById('formBtn');
  const successEl = document.getElementById('formSuccess');
  if (!form) return;

  // Phone mask
  const phoneField = document.getElementById('f-wpp');
  if (phoneField) {
    phoneField.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 11);
      if (v.length >= 7)
        v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
      else if (v.length >= 3)
        v = `(${v.slice(0,2)}) ${v.slice(2)}`;
      e.target.value = v;
    });
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }

    btn?.classList.add('loading');

    const data = new FormData(form);
    const body = Object.fromEntries(data.entries());

    try {
      const res = await fetch('api/leads.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        form.style.display = 'none';
        if (successEl) successEl.removeAttribute('hidden');
        // Track conversion (optional, replace with your analytics)
        if (typeof gtag === 'function') gtag('event', 'lead', { event_category: 'form' });
      } else {
        throw new Error('Erro no servidor');
      }
    } catch (err) {
      // Fallback: open WhatsApp with prefilled message
      const nome = body.nome || '';
      const servico = body.servico || '';
      const msg = encodeURIComponent(`Olá! Me chamo ${nome} e gostaria de um orçamento para ${servico}.`);
      window.open(`https://wa.me/5551994687074?text=${msg}`, '_blank');
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
      if (!posts || !posts.length) {
        grid.innerHTML = `<p style="color:var(--text-3);font-size:14px;grid-column:1/-1">Em breve novos artigos. Fique ligado!</p>`;
        return;
      }
      grid.innerHTML = posts.map(p => `
        <article class="blog-card reveal-card">
          <div class="blog-card-img-wrap">
            <img class="blog-card-img" src="${p.image || 'assets/images/blog-placeholder.jpg'}" alt="${p.title}" loading="lazy">
          </div>
          <div class="blog-card-body">
            <p class="blog-card-cat">${p.category || 'Dicas'}</p>
            <h3 class="blog-card-title"><a href="/blog/${p.slug}">${p.title}</a></h3>
            <p class="blog-card-excerpt">${p.excerpt}</p>
            <div class="blog-card-meta">
              <span>${p.date}</span>
              <span>${p.readTime || '3 min de leitura'}</span>
            </div>
          </div>
        </article>
      `).join('');

      // Animate newly added cards
      if (typeof gsap !== 'undefined') {
        grid.querySelectorAll('.blog-card').forEach((card, i) => {
          gsap.fromTo(card,
            { opacity: 0, y: 40 },
            {
              opacity: 1, y: 0,
              duration: 0.7,
              ease: 'power3.out',
              delay: i * 0.1,
              scrollTrigger: { trigger: card, start: 'top 90%' }
            }
          );
        });
      }
    })
    .catch(() => {
      // Show placeholder cards on API error
      grid.innerHTML = `
        <article class="blog-card reveal-card">
          <div class="blog-card-img-wrap" style="background:var(--bg-elevated)"></div>
          <div class="blog-card-body">
            <p class="blog-card-cat">Dicas</p>
            <h3 class="blog-card-title">Como proteger a pintura do seu carro no inverno</h3>
            <p class="blog-card-excerpt">O inverno pode ser agressivo para a pintura do seu veículo. Saiba como protegê-la com medidas simples e eficazes.</p>
            <div class="blog-card-meta"><span>Em breve</span></div>
          </div>
        </article>
        <article class="blog-card reveal-card">
          <div class="blog-card-img-wrap" style="background:var(--bg-elevated)"></div>
          <div class="blog-card-body">
            <p class="blog-card-cat">Tecnologia</p>
            <h3 class="blog-card-title">Vitrificação vs. Cera: qual vale mais a pena?</h3>
            <p class="blog-card-excerpt">Entenda as diferenças entre vitrificação cerâmica e cera tradicional e qual é o melhor custo-benefício para seu carro.</p>
            <div class="blog-card-meta"><span>Em breve</span></div>
          </div>
        </article>
        <article class="blog-card reveal-card">
          <div class="blog-card-img-wrap" style="background:var(--bg-elevated)"></div>
          <div class="blog-card-body">
            <p class="blog-card-cat">Manutenção</p>
            <h3 class="blog-card-title">Martelinho de Ouro: quando usar e quando não usar</h3>
            <p class="blog-card-excerpt">A técnica PDR é incrível para certos tipos de amassados, mas não funciona em todos os casos. Veja quando vale a pena.</p>
            <div class="blog-card-meta"><span>Em breve</span></div>
          </div>
        </article>
      `;
    });
})();

/* ---- BACK TO TOP ----------------------------------------- */
(function initBackTop() {
  const btn = document.getElementById('backTop');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 600);
  }, { passive: true });

  btn.addEventListener('click', () => {
    if (lenis) lenis.scrollTo(0, { duration: 1.2 });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

/* ---- FOOTER YEAR ----------------------------------------- */
const ftYear = document.getElementById('ftYear');
if (ftYear) ftYear.textContent = new Date().getFullYear();

/* ---- ACTIVE NAV LINK ON SCROLL --------------------------- */
(function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const links = document.querySelectorAll('.nav-links a[href^="#"]');
  if (!sections.length || !links.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      links.forEach(a => {
        a.style.color = a.getAttribute('href') === '#' + entry.target.id
          ? 'var(--text)'
          : '';
      });
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => observer.observe(s));
})();
