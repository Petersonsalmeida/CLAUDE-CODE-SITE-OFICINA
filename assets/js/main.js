/* ============================================================
   ALIANÇA CENTRO AUTOMOTIVO — Main JavaScript
   v4 — Rewrite: a11y, robustez, performance
   Modelo Opus 4.7 — limpo, modular, sem dependências extras
   ============================================================ */

'use strict';

/* ═══════════════ UTILITIES ═══════════════ */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isTouchOnly = () =>
  window.matchMedia('(hover: none)').matches;

const debounce = (fn, wait = 150) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

/** Escapa HTML antes de inserir conteúdo dinâmico — previne XSS */
const esc = (str = '') => String(str)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');


/* ═══════════════ LOADER ═══════════════ */

(() => {
  const loader = $('#loader');
  if (!loader) return;
  window.addEventListener('load', () => {
    setTimeout(() => loader.classList.add('done'), prefersReducedMotion() ? 0 : 1400);
  });
})();


/* ═══════════════ LENIS SMOOTH SCROLL ═══════════════ */

let lenis = null;

(() => {
  if (typeof Lenis === 'undefined' || prefersReducedMotion()) return;

  lenis = new Lenis({
    duration:        0.75,
    easing:          t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel:     true,
    wheelMultiplier: 1.1,
    touchMultiplier: 1.5,
  });

  if (typeof gsap !== 'undefined') {
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = time => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  if (typeof ScrollTrigger !== 'undefined') {
    lenis.on('scroll', ScrollTrigger.update);
  }
})();


/* ═══════════════ SCROLL REVEALS ═══════════════
   Um único IntersectionObserver para todas as classes de reveal.
   Stagger baseado em posição vertical (não em ordem do DOM).
   ------------------------------------------------------------ */

(() => {
  const CONFIG = {
    '.reveal-up':    { transform: 'translateY(36px)' },
    '.reveal-right': { transform: 'translateX(56px)' },
    '.reveal-card':  { transform: 'translateY(48px)' },
    '.reveal-stat':  { transform: 'translateY(24px)' },
    '.step-num':     { transform: 'scale(0.5)' },
    '.stat-num':     { transform: 'scale(0.7)' },
  };

  const items = Object.entries(CONFIG).flatMap(([sel, style]) =>
    $$(sel).map(el => ({ el, style })),
  );
  if (!items.length) return;

  /* Reduced motion: aplica o estado final e sai */
  if (prefersReducedMotion()) {
    items.forEach(({ el }) => { el.style.opacity = '1'; });
    return;
  }

  /* Estado inicial inline */
  items.forEach(({ el, style }) => {
    el.style.opacity    = '0';
    el.style.transform  = style.transform;
    el.style.transition = 'none';
  });

  const observer = new IntersectionObserver((entries, obs) => {
    /* Agrupa elementos visíveis e faz stagger pela ordem vertical */
    const visible = entries
      .filter(e => e.isIntersecting)
      .sort((a, b) =>
        a.target.getBoundingClientRect().top -
        b.target.getBoundingClientRect().top,
      );

    visible.forEach((entry, i) => {
      const el    = entry.target;
      const delay = Math.min(i * 70, 350);
      el.style.transition =
        `opacity 0.7s ease ${delay}ms, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms`;
      el.style.opacity   = '1';
      el.style.transform = 'none';
      obs.unobserve(el);
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -60px 0px' });

  items.forEach(({ el }) => observer.observe(el));
})();


/* ═══════════════ GSAP: HERO + PARALLAX + NAV + SECTION BGS ═══════════════ */

(() => {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  /* ─── Hero timeline (mais claro que delays empilhados) ─── */
  const tl = gsap.timeline({
    defaults: { ease: 'power3.out' },
    delay:    prefersReducedMotion() ? 0 : 1.4, /* aguarda loader */
  });

  $$('.hh-line').forEach((line, i) =>
    tl.to(line, {
      opacity: 1, y: 0, duration: 0.85,
      onComplete: () => { line.style.willChange = 'auto'; },
    }, i === 0 ? 0 : '<0.15'),
  );

  tl.fromTo('.hero-kicker',        { opacity:0, y:14 },        { opacity:1, y:0, duration:0.65 }, 0)
    .fromTo('.hero-desc',          { opacity:0, y:18 },        { opacity:1, y:0, duration:0.65 }, 0.5)
    .fromTo('.hero-actions',       { opacity:0, y:18 },        { opacity:1, y:0, duration:0.65 }, 0.65)
    .fromTo('.hero-emblem',        { opacity:0, scale:0.88 },  { opacity:1, scale:1, duration:1.1, ease:'back.out(1.4)' }, 0.25)
    .fromTo('.emblem-ring--outer', { opacity:0 },              { opacity:1, duration:1.2 }, 0.5)
    .fromTo('.emblem-ring--inner', { opacity:0 },              { opacity:1, duration:1.2 }, 0.7);

  $$('.hero-stat').forEach((el, i) =>
    tl.to(el, { opacity:1, y:0, duration:0.55, ease:'power2.out' }, 0.8 + i * 0.15),
  );

  /* ─── Parallax about (1 ST) ─── */
  const aboutImg = $('.about-img-frame');
  if (aboutImg && !prefersReducedMotion()) {
    gsap.fromTo(aboutImg, { y: 0 }, {
      y: -30, ease: 'none',
      scrollTrigger: {
        trigger: '.section-about',
        start:   'top bottom',
        end:     'bottom top',
        scrub:   1.5,
      },
    });
  }

  /* ─── Nav scrolled state (1 ST) ─── */
  const navbar = $('#navbar');
  if (navbar) {
    ScrollTrigger.create({
      start:       60,
      onEnter:     () => navbar.classList.add('scrolled'),
      onLeaveBack: () => navbar.classList.remove('scrolled'),
    });
  }

  /* ─── Section backgrounds (7 ST) ─── */
  const BGS = {
    'section-services':     '#050505',
    'section-stats':        '#000',
    'section-about':        '#050505',
    'section-process':      '#000',
    'section-testimonials': '#050505',
    'section-lead':         '#000',
    'section-blog':         '#050505',
  };

  Object.entries(BGS).forEach(([cls, bg]) => {
    const node = $(`.${cls}`);
    if (!node) return;
    ScrollTrigger.create({
      trigger:     node,
      start:       'top 60%',
      end:         'bottom 40%',
      onEnter:     () => node.style.setProperty('--section-bg', bg),
      onLeave:     () => node.style.setProperty('--section-bg', '#000'),
      onEnterBack: () => node.style.setProperty('--section-bg', bg),
      onLeaveBack: () => node.style.setProperty('--section-bg', '#000'),
    });
  });

  /* ─── Service cards 3D tilt (apenas desktop com hover real) ─── */
  if (!prefersReducedMotion() && !isTouchOnly()) {
    $$('.service-card').forEach(card => {
      gsap.set(card, { transformPerspective: 800 });
      const rotY = gsap.quickTo(card, 'rotateY', { duration: 0.35, ease: 'power2.out' });
      const rotX = gsap.quickTo(card, 'rotateX', { duration: 0.35, ease: 'power2.out' });

      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        rotY(((e.clientX - r.left - r.width  / 2) / (r.width  / 2)) *  6);
        rotX(((e.clientY - r.top  - r.height / 2) / (r.height / 2)) * -6);
      });
      card.addEventListener('mouseleave', () => { rotY(0); rotX(0); });
    });
  }
})();


/* ═══════════════ COUNTERS ═══════════════ */

(() => {
  const counters = $$('.count');
  if (!counters.length) return;

  const nf = new Intl.NumberFormat('pt-BR');

  const animate = el => {
    const target = parseInt(el.dataset.target, 10) || 0;
    const start  = performance.now();
    const step   = now => {
      const p = Math.min((now - start) / 2000, 1);
      el.textContent = nf.format(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      obs.unobserve(e.target);
      if (prefersReducedMotion()) {
        e.target.textContent = nf.format(+e.target.dataset.target || 0);
      } else {
        animate(e.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(c => io.observe(c));
})();


/* ═══════════════ TESTIMONIALS CAROUSEL ═══════════════ */

(() => {
  const track = $('#tTrack');
  if (!track) return;

  const cards  = $$('.tcard', track);
  const dotsEl = $('.t-dots');
  const wrap   = track.closest('.testimonials-wrap');
  const prev   = $('.t-prev');
  const next   = $('.t-next');
  if (!cards.length || !dotsEl) return;

  const AUTO_MS = 5000;
  let current = 0, timer = null, paused = false;

  const visibleCount = () =>
    window.innerWidth <= 768  ? 1 :
    window.innerWidth <= 1024 ? 2 : 3;

  const goTo = idx => {
    const max = Math.max(0, cards.length - visibleCount());
    current   = idx < 0 ? max : idx > max ? 0 : idx;
    const cardW = cards[0].offsetWidth + 20;

    if (typeof gsap !== 'undefined') {
      gsap.to(track, { x: -current * cardW, duration: 0.65, ease: 'power3.out' });
    } else {
      track.style.transform = `translateX(${-current * cardW}px)`;
    }

    $$('.t-dot', dotsEl).forEach((d, i) => {
      const active = i === current;
      d.classList.toggle('active', active);
      d.setAttribute('aria-selected', String(active));
    });
  };

  /* Build dots */
  cards.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 't-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label',    `Ir para depoimento ${i + 1}`);
    dot.setAttribute('role',          'tab');
    dot.setAttribute('aria-selected', String(i === 0));
    dot.addEventListener('click', () => { goTo(i); restartTimer(); });
    dotsEl.appendChild(dot);
  });

  const startTimer   = () => { stopTimer(); timer = setInterval(() => { if (!paused) goTo(current + 1); }, AUTO_MS); };
  const stopTimer    = () => { if (timer) clearInterval(timer); timer = null; };
  const restartTimer = () => { if (!document.hidden) startTimer(); };

  /* Pausa ao hover/focus (UX) */
  wrap?.addEventListener('mouseenter', () => { paused = true; });
  wrap?.addEventListener('mouseleave', () => { paused = false; });
  wrap?.addEventListener('focusin',    () => { paused = true; });
  wrap?.addEventListener('focusout',   () => { paused = false; });

  /* Pausa quando aba oculta (economiza bateria) */
  document.addEventListener('visibilitychange', () => {
    document.hidden ? stopTimer() : startTimer();
  });

  /* Arrows */
  prev?.addEventListener('click', () => { goTo(current - 1); restartTimer(); });
  next?.addEventListener('click', () => { goTo(current + 1); restartTimer(); });

  /* Keyboard nav (setas ← →) */
  document.addEventListener('keydown', e => {
    if (!wrap?.matches(':hover, :focus-within')) return;
    if (e.key === 'ArrowRight') { goTo(current + 1); restartTimer(); }
    if (e.key === 'ArrowLeft')  { goTo(current - 1); restartTimer(); }
  });

  /* Swipe (touch + mouse drag) */
  if (wrap) {
    let startX = 0, delta = 0, dragging = false;
    const begin = x => { dragging = true; startX = x; delta = 0; };
    const move  = x => { if (dragging) delta = x - startX; };
    const end   = () => {
      if (!dragging) return;
      dragging = false;
      if      (delta < -50) goTo(current + 1);
      else if (delta >  50) goTo(current - 1);
      restartTimer();
    };
    wrap.addEventListener('mousedown',  e => begin(e.clientX));
    wrap.addEventListener('mousemove',  e => move(e.clientX));
    wrap.addEventListener('mouseup',    end);
    wrap.addEventListener('mouseleave', () => { dragging = false; });
    wrap.addEventListener('touchstart', e => begin(e.touches[0].clientX), { passive: true });
    wrap.addEventListener('touchmove',  e => move(e.touches[0].clientX),  { passive: true });
    wrap.addEventListener('touchend',   end);
  }

  window.addEventListener('resize', debounce(() => goTo(current), 150));

  goTo(0);
  startTimer();
})();


/* ═══════════════ MOBILE MENU ═══════════════ */

(() => {
  const burger  = $('.nav-burger');
  const overlay = $('.mobile-overlay');
  if (!burger || !overlay) return;

  let lastFocused = null;

  const open = () => {
    lastFocused = document.activeElement;
    overlay.classList.add('open');
    overlay.style.display = 'flex';
    burger.classList.add('open');
    burger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    $('a', overlay)?.focus();
  };

  const close = () => {
    overlay.classList.remove('open');
    overlay.style.display = 'none';
    burger.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    lastFocused?.focus?.();
  };

  burger.addEventListener('click', () => {
    overlay.classList.contains('open') ? close() : open();
  });
  $$('a', overlay).forEach(a => a.addEventListener('click', close));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });
})();


/* ═══════════════ ANCHOR SMOOTH SCROLL ═══════════════ */

(() => {
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -70, duration: 1.2 });
      else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();


/* ═══════════════ LEAD FORM ═══════════════ */

(() => {
  const form = $('#leadForm');
  if (!form) return;

  const btn       = $('#formBtn');
  const successEl = $('#formSuccess');
  const errorEl   = $('#formError');
  const phone     = $('#f-wpp');

  phone?.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length >= 7)      v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    else if (v.length >= 3) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
    e.target.value = v;
  });

  const showError = msg => {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.removeAttribute('hidden');
    setTimeout(() => errorEl.setAttribute('hidden', ''), 5000);
  };

  const whatsappFallback = data => {
    const msg = encodeURIComponent(
      `Olá! Me chamo ${data.nome || ''} e gostaria de um orçamento` +
      (data.servico ? ` para ${data.servico}` : '') + '.',
    );
    window.open(`https://wa.me/5551994687074?text=${msg}`, '_blank', 'noopener');
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }

    btn?.classList.add('loading');
    btn?.setAttribute('disabled', '');

    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch('api/leads.php', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      form.style.display = 'none';
      successEl?.removeAttribute('hidden');
      if (typeof gtag === 'function') gtag('event', 'lead', { event_category: 'form' });
    } catch (err) {
      console.warn('[leadForm] envio falhou — fallback WhatsApp:', err.message);
      showError('Não conseguimos enviar. Abrindo WhatsApp…');
      whatsappFallback(data);
    } finally {
      btn?.classList.remove('loading');
      btn?.removeAttribute('disabled');
    }
  });
})();


/* ═══════════════ BLOG POSTS LOADER ═══════════════ */

(() => {
  const grid = $('#blogGrid');
  if (!grid) return;

  const renderPost = p => `
    <article class="blog-card">
      <div class="blog-card-img-wrap">
        <img class="blog-card-img"
             src="${esc(p.image || 'assets/images/blog-placeholder.jpg')}"
             alt="${esc(p.title)}" loading="lazy">
      </div>
      <div class="blog-card-body">
        <p class="blog-card-cat">${esc(p.category || 'Dicas')}</p>
        <h3 class="blog-card-title"><a href="/blog/${esc(p.slug)}">${esc(p.title)}</a></h3>
        <p class="blog-card-excerpt">${esc(p.excerpt)}</p>
        <div class="blog-card-meta">
          <span>${esc(p.date)}</span>
          <span>${esc(p.readTime || '3 min de leitura')}</span>
        </div>
      </div>
    </article>`;

  const FALLBACK = [
    { cat:'Dicas',      title:'Como proteger a pintura do seu carro no inverno', exc:'O inverno pode ser agressivo para a pintura. Saiba como protegê-la.' },
    { cat:'Tecnologia', title:'Vitrificação vs. Cera: qual vale mais a pena?',    exc:'Entenda as diferenças e o melhor custo-benefício para seu carro.' },
    { cat:'Manutenção', title:'Martelinho de Ouro: quando usar e quando não usar', exc:'A técnica PDR é incrível para certos amassados, mas não é universal.' },
  ];

  const renderFallback = () => FALLBACK.map(p => `
    <article class="blog-card">
      <div class="blog-card-img-wrap" style="background:var(--bg-elevated)"></div>
      <div class="blog-card-body">
        <p class="blog-card-cat">${esc(p.cat)}</p>
        <h3 class="blog-card-title">${esc(p.title)}</h3>
        <p class="blog-card-excerpt">${esc(p.exc)}</p>
      </div>
    </article>`).join('');

  const revealCards = () => {
    $$('.blog-card', grid).forEach((el, i) => {
      el.style.opacity    = '0';
      el.style.transform  = 'translateY(48px)';
      el.style.transition = 'none';
      new IntersectionObserver(([entry], obs) => {
        if (!entry.isIntersecting) return;
        obs.unobserve(el);
        const delay = Math.min(i * 100, 300);
        el.style.transition =
          `opacity 0.65s ease ${delay}ms, transform 0.65s cubic-bezier(0.22,1,0.36,1) ${delay}ms`;
        el.style.opacity   = '1';
        el.style.transform = 'translateY(0)';
      }, { threshold: 0.05 }).observe(el);
    });
  };

  fetch('api/posts.php?limit=3')
    .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
    .then(posts => {
      if (!posts?.length) {
        grid.innerHTML =
          '<p style="color:var(--text-3);font-size:14px;grid-column:1/-1">Em breve novos artigos.</p>';
        return;
      }
      grid.innerHTML = posts.map(renderPost).join('');
      revealCards();
    })
    .catch(err => {
      console.warn('[blog] falhou, exibindo fallback:', err.message);
      grid.innerHTML = renderFallback();
    });
})();


/* ═══════════════ BACK TO TOP ═══════════════ */

(() => {
  const btn = $('#backTop');
  if (!btn) return;

  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'position:absolute;top:600px;left:0;width:1px;height:1px;pointer-events:none';
  document.body.prepend(sentinel);

  new IntersectionObserver(([entry]) => {
    btn.classList.toggle('visible', !entry.isIntersecting);
  }).observe(sentinel);

  btn.addEventListener('click', () => {
    if (lenis) lenis.scrollTo(0, { duration: 1.2 });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();


/* ═══════════════ FOOTER YEAR ═══════════════ */

(() => {
  const el = $('#ftYear');
  if (el) el.textContent = String(new Date().getFullYear());
})();


/* ═══════════════ ACTIVE NAV LINK ═══════════════ */

(() => {
  const sections = $$('section[id]');
  const links    = $$('.nav-links a[href^="#"]');
  if (!sections.length || !links.length) return;

  const linkMap = new Map();
  links.forEach(a => {
    const id = a.getAttribute('href').slice(1);
    if (id) linkMap.set(id, a);
  });

  const clearActive = () => links.forEach(a => a.classList.remove('active'));

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      clearActive();
      linkMap.get(e.target.id)?.classList.add('active');
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => obs.observe(s));
})();
