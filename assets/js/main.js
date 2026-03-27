/* ============================================================
   Aliança Centro Automotivo — JavaScript Principal
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── Header Scroll ──────────────────────────────────────────
  const header = document.getElementById('header');
  const onScroll = () => {
    if (window.scrollY > 60) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── Mobile Menu ────────────────────────────────────────────
  const hamburger = document.querySelector('.hamburger');
  const navMenu   = document.querySelector('.nav-menu');
  const navLinks  = document.querySelectorAll('.nav-menu a');

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      navMenu.classList.toggle('open');
      document.body.style.overflow = navMenu.classList.contains('open') ? 'hidden' : '';
    });
  }

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      hamburger?.classList.remove('open');
      navMenu?.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  // ── Active Nav Link no Scroll ──────────────────────────────
  const sections   = document.querySelectorAll('section[id]');
  const navAnchors = document.querySelectorAll('.nav-menu a[href^="#"]');

  const updateActiveNav = () => {
    let current = '';
    sections.forEach(section => {
      const top = section.offsetTop - 120;
      if (window.scrollY >= top) current = section.id;
    });
    navAnchors.forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === `#${current}`);
    });
  };
  window.addEventListener('scroll', updateActiveNav, { passive: true });

  // ── Reveal on Scroll ───────────────────────────────────────
  const reveals = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  reveals.forEach(el => revealObserver.observe(el));

  // ── Counter Animation ──────────────────────────────────────
  const counters = document.querySelectorAll('.stat-number[data-target]');

  const animateCounter = (el) => {
    const target   = parseInt(el.dataset.target);
    const suffix   = el.dataset.suffix || '';
    const prefix   = el.dataset.prefix || '';
    const duration = 1800;
    const step     = 16;
    const increment = target / (duration / step);
    let current    = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      el.textContent = prefix + Math.floor(current).toLocaleString('pt-BR') + suffix;
    }, step);
  };

  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        counters.forEach(animateCounter);
        statsObserver.disconnect();
      }
    });
  }, { threshold: 0.5 });

  const statsSection = document.getElementById('stats');
  if (statsSection) statsObserver.observe(statsSection);

  // ── Lead Form ──────────────────────────────────────────────
  const leadForm = document.getElementById('lead-form');

  if (leadForm) {
    leadForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const btn = leadForm.querySelector('.form-submit');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83"/></svg> Enviando...';
      btn.disabled = true;

      const data = {
        name:    leadForm.querySelector('[name="name"]').value.trim(),
        phone:   leadForm.querySelector('[name="phone"]').value.trim(),
        email:   leadForm.querySelector('[name="email"]').value.trim(),
        service: leadForm.querySelector('[name="service"]').value,
        message: leadForm.querySelector('[name="message"]').value.trim(),
      };

      try {
        const res = await fetch('/api/lead.php', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(data),
        });
        const json = await res.json();

        if (json.success) {
          showToast('success', 'Orçamento enviado!', 'Entraremos em contato em breve pelo WhatsApp ou e-mail.');
          leadForm.reset();
        } else {
          showToast('error', 'Erro ao enviar', json.message || 'Tente novamente ou entre em contato pelo WhatsApp.');
        }
      } catch {
        showToast('error', 'Erro de conexão', 'Verifique sua internet e tente novamente.');
      } finally {
        btn.innerHTML = originalText;
        btn.disabled  = false;
      }
    });
  }

  // ── Phone Mask ─────────────────────────────────────────────
  const phoneInput = document.querySelector('input[name="phone"]');
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 11) v = v.slice(0, 11);
      if (v.length > 7) {
        v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
      } else if (v.length > 2) {
        v = `(${v.slice(0,2)}) ${v.slice(2)}`;
      }
      e.target.value = v;
    });
  }

  // ── Toast ──────────────────────────────────────────────────
  window.showToast = (type, title, message) => {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const iconMap = {
      success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`,
      error:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`,
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${iconMap[type] || iconMap.error}</div>
      <div class="toast-content">
        <strong>${title}</strong>
        <p>${message}</p>
      </div>`;

    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('show'));
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 5000);
  };

  // ── Smooth Scroll for Anchors ──────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const offset = header ? header.offsetHeight + 12 : 80;
        const top    = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

});
