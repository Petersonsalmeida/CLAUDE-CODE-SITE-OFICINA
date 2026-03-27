<?php
require_once __DIR__ . '/config.php';

// Carregar posts recentes para o blog preview
$recent_posts = [];
if (is_dir(POSTS_DIR)) {
    $files = glob(POSTS_DIR . '*.json');
    if ($files) {
        usort($files, fn($a, $b) => filemtime($b) - filemtime($a));
        foreach (array_slice($files, 0, 3) as $file) {
            $post = json_decode(file_get_contents($file), true);
            if ($post && ($post['status'] ?? 'published') === 'published') {
                $recent_posts[] = $post;
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aliança Centro Automotivo | Estética Automotiva em Porto Alegre</title>
  <meta name="description" content="Especialistas em estética automotiva em Porto Alegre. Chapeação, pintura, martelinho de ouro, vitrificação, película e muito mais. Solicite seu orçamento!" />
  <meta name="keywords" content="estética automotiva, chapeação, pintura automotiva, martelinho de ouro, vitrificação, película, higienização, Porto Alegre" />
  <link rel="canonical" href="<?= SITE_URL ?>" />

  <!-- Open Graph -->
  <meta property="og:type"        content="website" />
  <meta property="og:url"         content="<?= SITE_URL ?>" />
  <meta property="og:title"       content="Aliança Centro Automotivo" />
  <meta property="og:description" content="Especialistas em estética automotiva em Porto Alegre." />
  <meta property="og:image"       content="<?= SITE_URL ?>/assets/images/og-image.jpg" />

  <!-- Schema.org Local Business -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "AutoRepair",
    "name": "<?= COMPANY_NAME ?>",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Rua Aliança, 70",
      "addressLocality": "Porto Alegre",
      "addressRegion": "RS",
      "addressCountry": "BR"
    },
    "telephone": "<?= COMPANY_PHONE ?>",
    "email": "<?= COMPANY_EMAIL ?>",
    "url": "<?= SITE_URL ?>",
    "openingHours": "Mo-Fr 08:00-13:00, Mo-Fr 13:30-18:20"
  }
  </script>

  <!-- Fonts & Icons -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
  <link rel="stylesheet" href="/assets/css/style.css" />
</head>
<body>

<!-- ══════════════════════════════════════════════════════════
     HEADER
══════════════════════════════════════════════════════════ -->
<header id="header">
  <div class="container">
    <div class="header-inner">
      <a href="/" class="logo">
        <img src="/assets/images/logo-white.png" alt="Aliança Centro Automotivo" />
      </a>

      <nav class="nav-menu" role="navigation" aria-label="Menu principal">
        <a href="#hero">Início</a>
        <a href="#servicos">Serviços</a>
        <a href="#sobre">Sobre</a>
        <a href="#orcamento">Orçamento</a>
        <a href="#blog">Blog</a>
        <a href="#footer">Contato</a>
      </nav>

      <div class="nav-cta">
        <a href="https://wa.me/<?= COMPANY_WHATSAPP ?>?text=Olá!%20Gostaria%20de%20solicitar%20um%20orçamento."
           class="btn btn-primary" target="_blank" rel="noopener">
          <i class="fa-brands fa-whatsapp"></i> WhatsApp
        </a>
      </div>

      <button class="hamburger" aria-label="Abrir menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</header>

<!-- ══════════════════════════════════════════════════════════
     HERO
══════════════════════════════════════════════════════════ -->
<section id="hero">
  <div class="hero-bg"></div>
  <div class="hero-grid"></div>

  <div class="container">
    <div class="hero-content">
      <div class="hero-badge">
        <i class="fa-solid fa-shield-halved" style="font-size:0.8rem"></i>
        Especialistas em Estética Automotiva
      </div>

      <h1 class="hero-title">
        O cuidado que<br />seu carro <span>merece</span>
      </h1>

      <p class="hero-subtitle">
        Transformamos seu veículo com excelência e precisão em cada detalhe.
        Chapeação, pintura, vitrificação e muito mais — tudo em um só lugar.
      </p>

      <div class="hero-ctas">
        <a href="#orcamento" class="btn btn-primary">
          <i class="fa-solid fa-clipboard-check"></i>
          Solicitar Orçamento
        </a>
        <a href="#servicos" class="btn btn-outline">
          Nossos Serviços
          <i class="fa-solid fa-arrow-right"></i>
        </a>
      </div>

      <div class="hero-trust">
        <div class="trust-item">
          <i class="fa-solid fa-circle-check" style="color:var(--red)"></i>
          Equipe qualificada
        </div>
        <div class="trust-item">
          <i class="fa-solid fa-circle-check" style="color:var(--red)"></i>
          Orçamento sem compromisso
        </div>
        <div class="trust-item">
          <i class="fa-solid fa-circle-check" style="color:var(--red)"></i>
          Produtos premium
        </div>
      </div>
    </div>
  </div>

  <div class="hero-visual">
    <svg class="hero-shield" viewBox="0 0 200 230" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M100 5 L185 40 L185 115 C185 165 100 225 100 225 C100 225 15 165 15 115 L15 40 Z"
            stroke="white" stroke-width="4" fill="none"/>
    </svg>
  </div>

  <div class="hero-line"></div>
</section>

<!-- ══════════════════════════════════════════════════════════
     STATS
══════════════════════════════════════════════════════════ -->
<section id="stats">
  <div class="container">
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-number" data-target="10" data-suffix="+">0+</div>
        <div class="stat-label">Anos de Experiência</div>
      </div>
      <div class="stat-item">
        <div class="stat-number" data-target="3000" data-suffix="+">0+</div>
        <div class="stat-label">Veículos Atendidos</div>
      </div>
      <div class="stat-item">
        <div class="stat-number" data-target="7" data-suffix="">0</div>
        <div class="stat-label">Serviços Especializados</div>
      </div>
      <div class="stat-item">
        <div class="stat-number" data-target="100" data-suffix="%">0%</div>
        <div class="stat-label">Satisfação Garantida</div>
      </div>
    </div>
  </div>
</section>

<!-- ══════════════════════════════════════════════════════════
     SERVIÇOS
══════════════════════════════════════════════════════════ -->
<section id="servicos">
  <div class="container">
    <div class="services-header reveal">
      <span class="section-tag text-red">O que fazemos</span>
      <h2 class="section-title text-white">Nossos <span class="text-red">Serviços</span></h2>
      <p class="section-subtitle" style="color:rgba(255,255,255,0.5)">
        Soluções completas em estética automotiva com tecnologia, precisão e os melhores materiais do mercado.
      </p>
    </div>

    <div class="services-grid">
      <?php
      $services = [
        ['icon' => 'fa-car-burst',     'title' => 'Chapeação',          'desc' => 'Reparamos amassados, cortes e danos estruturais na lataria com técnica e precisão, devolvendo a forma original ao seu veículo.'],
        ['icon' => 'fa-paint-roller',  'title' => 'Pintura Automotiva', 'desc' => 'Pintura completa ou parcial com tintas de alta qualidade, garantindo acabamento impecável e durabilidade prolongada.'],
        ['icon' => 'fa-hammer',        'title' => 'Martelinho de Ouro', 'desc' => 'Técnica especializada que remove amassados leves sem necessidade de pintura, preservando a pintura original do veículo.'],
        ['icon' => 'fa-gem',           'title' => 'Espelhamento',       'desc' => 'Polimento e espelhamento profissional que devolve o brilho intenso à pintura, eliminando riscos superficiais e oxidação.'],
        ['icon' => 'fa-shield',        'title' => 'Vitrificação',       'desc' => 'Proteção cerâmica de alta durabilidade que cria uma camada protetora invisível sobre a pintura, repelindo água e sujeira.'],
        ['icon' => 'fa-spray-can',     'title' => 'Higienização',       'desc' => 'Limpeza profunda completa do interior do veículo, eliminando bactérias, ácaros e odores com produtos especializados.'],
        ['icon' => 'fa-film',          'title' => 'Película Automotiva','desc' => 'Aplicação de película de proteção de pintura (PPF) ou insulfilm, protegendo contra riscos, UV e garantindo privacidade.'],
      ];
      foreach ($services as $i => $s):
      ?>
      <div class="service-card reveal reveal-delay-<?= ($i % 4) + 1 ?>">
        <div class="service-icon">
          <i class="fa-solid <?= $s['icon'] ?>" style="font-size:1.4rem"></i>
        </div>
        <h3 class="service-title"><?= $s['title'] ?></h3>
        <p class="service-desc"><?= $s['desc'] ?></p>
      </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- ══════════════════════════════════════════════════════════
     SOBRE
══════════════════════════════════════════════════════════ -->
<section id="sobre">
  <div class="container">
    <div class="sobre-grid">
      <div class="sobre-img reveal">
        <?php if (file_exists(__DIR__ . '/assets/images/sobre.jpg')): ?>
          <img src="/assets/images/sobre.jpg" alt="Aliança Centro Automotivo" loading="lazy" />
        <?php else: ?>
          <div class="sobre-img-placeholder">
            <i class="fa-solid fa-image" style="font-size:3rem;color:var(--red);opacity:0.4"></i>
            <span>Adicione uma foto da oficina</span>
          </div>
        <?php endif; ?>
        <div class="sobre-badge-img">
          <strong>+10</strong>
          <span>Anos de Experiência</span>
        </div>
      </div>

      <div class="sobre-content reveal reveal-delay-2">
        <span class="section-tag">Quem somos</span>
        <h2 class="section-title">
          Tradição e <span class="text-red">excelência</span><br />em cada detalhe
        </h2>
        <p class="sobre-text">
          A Aliança Centro Automotivo é referência em estética automotiva em Porto Alegre, localizada no bairro Jardim Lindóia. Com uma equipe altamente qualificada e apaixonada pelo que faz, entregamos resultados que superam expectativas.
        </p>
        <p class="sobre-text">
          Utilizamos apenas produtos e equipamentos de primeira linha, garantindo acabamento profissional e durabilidade em cada serviço. Do martelinho de ouro à vitrificação cerâmica, seu carro está em mãos certas.
        </p>

        <div class="sobre-features">
          <div class="feature-item">
            <i class="fa-solid fa-circle-check" style="color:var(--red)"></i>
            Equipe especializada
          </div>
          <div class="feature-item">
            <i class="fa-solid fa-circle-check" style="color:var(--red)"></i>
            Produtos premium
          </div>
          <div class="feature-item">
            <i class="fa-solid fa-circle-check" style="color:var(--red)"></i>
            Atendimento personalizado
          </div>
          <div class="feature-item">
            <i class="fa-solid fa-circle-check" style="color:var(--red)"></i>
            Garantia nos serviços
          </div>
          <div class="feature-item">
            <i class="fa-solid fa-circle-check" style="color:var(--red)"></i>
            Orçamento transparente
          </div>
          <div class="feature-item">
            <i class="fa-solid fa-circle-check" style="color:var(--red)"></i>
            Prazo garantido
          </div>
        </div>

        <a href="https://wa.me/<?= COMPANY_WHATSAPP ?>?text=Olá!%20Quero%20conhecer%20os%20serviços%20da%20Aliança."
           class="btn btn-primary" target="_blank" rel="noopener">
          <i class="fa-brands fa-whatsapp"></i>
          Fale Conosco
        </a>
      </div>
    </div>
  </div>
</section>

<!-- ══════════════════════════════════════════════════════════
     ORÇAMENTO (LEAD FORM)
══════════════════════════════════════════════════════════ -->
<section id="orcamento">
  <div class="container">
    <div class="orcamento-grid">
      <div class="orcamento-info reveal">
        <span class="section-tag">Solicite agora</span>
        <h2 class="section-title text-white">
          Orçamento <span class="text-red">gratuito</span><br />e sem compromisso
        </h2>
        <p class="section-subtitle" style="color:rgba(255,255,255,0.5)">
          Preencha o formulário e nossa equipe entrará em contato rapidamente pelo WhatsApp ou e-mail.
        </p>

        <div class="orcamento-items">
          <div class="orcamento-item">
            <div class="orcamento-item-icon">
              <i class="fa-solid fa-bolt" style="color:var(--red)"></i>
            </div>
            <div class="orcamento-item-text">
              <strong>Resposta rápida</strong>
              <span>Retornamos em até 2 horas no horário comercial</span>
            </div>
          </div>
          <div class="orcamento-item">
            <div class="orcamento-item-icon">
              <i class="fa-solid fa-lock" style="color:var(--red)"></i>
            </div>
            <div class="orcamento-item-text">
              <strong>Seus dados estão seguros</strong>
              <span>Não compartilhamos suas informações com terceiros</span>
            </div>
          </div>
          <div class="orcamento-item">
            <div class="orcamento-item-icon">
              <i class="fa-solid fa-handshake" style="color:var(--red)"></i>
            </div>
            <div class="orcamento-item-text">
              <strong>Zero compromisso</strong>
              <span>O orçamento é totalmente gratuito e sem obrigação</span>
            </div>
          </div>
        </div>
      </div>

      <div class="reveal reveal-delay-2">
        <form class="lead-form" id="lead-form" novalidate>
          <h3>Solicitar Orçamento</h3>
          <p>Preencha os campos abaixo e retornamos em breve.</p>

          <div class="form-row">
            <div class="form-group">
              <label for="name">Nome completo *</label>
              <input type="text" id="name" name="name" placeholder="Seu nome" required />
            </div>
            <div class="form-group">
              <label for="phone">WhatsApp *</label>
              <input type="tel" id="phone" name="phone" placeholder="(51) 9 9999-9999" required />
            </div>
          </div>

          <div class="form-group">
            <label for="email">E-mail</label>
            <input type="email" id="email" name="email" placeholder="seu@email.com" />
          </div>

          <div class="form-group">
            <label for="service">Serviço desejado *</label>
            <select id="service" name="service" required>
              <option value="" disabled selected>Selecione um serviço</option>
              <option value="Chapeação">Chapeação</option>
              <option value="Pintura Automotiva">Pintura Automotiva</option>
              <option value="Martelinho de Ouro">Martelinho de Ouro</option>
              <option value="Espelhamento">Espelhamento</option>
              <option value="Vitrificação">Vitrificação</option>
              <option value="Higienização">Higienização</option>
              <option value="Película Automotiva">Película Automotiva</option>
              <option value="Outros / Não sei">Outros / Não sei</option>
            </select>
          </div>

          <div class="form-group">
            <label for="message">Descreva o problema ou dúvida</label>
            <textarea id="message" name="message" placeholder="Ex: Meu carro tem um amassado no para-lama direito..."></textarea>
          </div>

          <button type="submit" class="btn btn-primary form-submit">
            <i class="fa-solid fa-paper-plane"></i>
            Enviar Orçamento
          </button>

          <p class="form-note">
            <i class="fa-solid fa-lock" style="font-size:0.7rem"></i>
            Seus dados são confidenciais e nunca serão compartilhados.
          </p>
        </form>
      </div>
    </div>
  </div>
</section>

<!-- ══════════════════════════════════════════════════════════
     BLOG
══════════════════════════════════════════════════════════ -->
<section id="blog">
  <div class="container">
    <div class="blog-header reveal">
      <div>
        <span class="section-tag">Dicas & Novidades</span>
        <h2 class="section-title">Nosso <span class="text-red">Blog</span></h2>
      </div>
      <a href="/blog" class="btn btn-dark">
        Ver todos os artigos
        <i class="fa-solid fa-arrow-right"></i>
      </a>
    </div>

    <div class="blog-grid">
      <?php if (empty($recent_posts)): ?>
        <div class="blog-empty">
          <i class="fa-regular fa-newspaper" style="font-size:3rem;color:#d1d5db;display:block;margin:0 auto 16px"></i>
          <p style="font-size:1rem;font-weight:600;color:#374151;margin-bottom:8px">Em breve, novidades aqui!</p>
          <p style="font-size:0.875rem">Nosso blog estará no ar em breve com dicas de cuidados automotivos.</p>
        </div>
      <?php else: ?>
        <?php foreach ($recent_posts as $i => $post): ?>
        <a href="/blog/<?= htmlspecialchars($post['slug']) ?>" class="blog-card reveal reveal-delay-<?= $i + 1 ?>">
          <?php if (!empty($post['image_url'])): ?>
            <img class="blog-card-img" src="<?= htmlspecialchars($post['image_url']) ?>" alt="<?= htmlspecialchars($post['title']) ?>" loading="lazy" />
          <?php else: ?>
            <div class="blog-card-img-placeholder">
              <i class="fa-regular fa-newspaper" style="font-size:2.5rem"></i>
            </div>
          <?php endif; ?>
          <div class="blog-card-body">
            <div class="blog-card-meta">
              <?php if (!empty($post['category'])): ?>
                <span class="blog-card-cat"><?= htmlspecialchars($post['category']) ?></span>
              <?php endif; ?>
              <span class="blog-card-date">
                <?= !empty($post['published_at']) ? date('d/m/Y', strtotime($post['published_at'])) : '' ?>
              </span>
            </div>
            <h3 class="blog-card-title"><?= htmlspecialchars($post['title']) ?></h3>
            <p class="blog-card-excerpt"><?= htmlspecialchars($post['excerpt'] ?? '') ?></p>
            <span class="blog-card-link">
              Ler artigo <i class="fa-solid fa-arrow-right"></i>
            </span>
          </div>
        </a>
        <?php endforeach; ?>
      <?php endif; ?>
    </div>
  </div>
</section>

<!-- ══════════════════════════════════════════════════════════
     DEPOIMENTOS
══════════════════════════════════════════════════════════ -->
<section id="depoimentos">
  <div class="container">
    <div class="reveal" style="text-align:center;margin-bottom:0">
      <span class="section-tag">O que dizem nossos clientes</span>
      <h2 class="section-title text-white">Depoimentos</h2>
    </div>

    <div class="testimonials-grid">
      <?php
      $testimonials = [
        ['name' => 'Carlos M.',    'car' => 'VW Polo 2022',       'stars' => 5, 'text' => 'Serviço impecável! Levei meu carro com um amassado grande e ficou como novo. Equipe super atenciosa e prazo cumprido. Recomendo demais!'],
        ['name' => 'Ana Paula S.', 'car' => 'Honda HR-V 2021',    'stars' => 5, 'text' => 'Fiz vitrificação e higienização. O resultado superou minhas expectativas. O carro parece que saiu da concessionária. Atendimento de primeira!'],
        ['name' => 'Ricardo F.',   'car' => 'Toyota Corolla 2020','stars' => 5, 'text' => 'Fiz a pintura completa do veículo. Profissionalismo do início ao fim. Transparência total no orçamento e qualidade excepcional no acabamento.'],
      ];
      foreach ($testimonials as $i => $t):
      ?>
      <div class="testimonial-card reveal reveal-delay-<?= $i + 1 ?>">
        <div class="stars">
          <?php for ($s = 0; $s < $t['stars']; $s++): ?>
            <i class="fa-solid fa-star" style="color:#f59e0b;font-size:0.9rem"></i>
          <?php endfor; ?>
        </div>
        <p class="testimonial-text">"<?= $t['text'] ?>"</p>
        <div class="testimonial-author">
          <div class="author-avatar"><?= strtoupper(substr($t['name'], 0, 1)) ?></div>
          <div>
            <div class="author-name"><?= $t['name'] ?></div>
            <div class="author-car"><?= $t['car'] ?></div>
          </div>
        </div>
      </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- ══════════════════════════════════════════════════════════
     CTA FINAL
══════════════════════════════════════════════════════════ -->
<section id="cta-final">
  <div class="container">
    <div class="cta-inner reveal">
      <h2>Pronto para transformar seu veículo?</h2>
      <p>Entre em contato agora e solicite seu orçamento gratuito. Atendemos de segunda a sexta.</p>
      <div class="cta-btns">
        <a href="https://wa.me/<?= COMPANY_WHATSAPP ?>?text=Olá!%20Gostaria%20de%20um%20orçamento."
           class="btn btn-whatsapp" target="_blank" rel="noopener">
          <i class="fa-brands fa-whatsapp"></i>
          Chamar no WhatsApp
        </a>
        <a href="#orcamento" class="btn btn-outline">
          <i class="fa-solid fa-clipboard-check"></i>
          Preencher Formulário
        </a>
      </div>
    </div>
  </div>
</section>

<!-- ══════════════════════════════════════════════════════════
     FOOTER
══════════════════════════════════════════════════════════ -->
<footer id="footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="logo">
          <img src="/assets/images/logo-white.png" alt="Aliança Centro Automotivo" />
        </div>
        <p>
          Especialistas em estética automotiva em Porto Alegre.
          Qualidade, precisão e cuidado em cada serviço.
        </p>
        <div class="social-links">
          <a href="https://www.instagram.com/<?= COMPANY_INSTAGRAM ?>" class="social-link" target="_blank" rel="noopener" aria-label="Instagram">
            <i class="fa-brands fa-instagram"></i>
          </a>
          <a href="https://wa.me/<?= COMPANY_WHATSAPP ?>" class="social-link" target="_blank" rel="noopener" aria-label="WhatsApp">
            <i class="fa-brands fa-whatsapp"></i>
          </a>
          <a href="https://www.google.com/maps/search/Aliança+Centro+Automotivo+Porto+Alegre" class="social-link" target="_blank" rel="noopener" aria-label="Google Maps">
            <i class="fa-brands fa-google"></i>
          </a>
        </div>
      </div>

      <div class="footer-col">
        <h4>Serviços</h4>
        <ul class="footer-links">
          <li><a href="#servicos"><i class="fa-solid fa-chevron-right" style="font-size:0.65rem"></i> Chapeação</a></li>
          <li><a href="#servicos"><i class="fa-solid fa-chevron-right" style="font-size:0.65rem"></i> Pintura Automotiva</a></li>
          <li><a href="#servicos"><i class="fa-solid fa-chevron-right" style="font-size:0.65rem"></i> Martelinho de Ouro</a></li>
          <li><a href="#servicos"><i class="fa-solid fa-chevron-right" style="font-size:0.65rem"></i> Espelhamento</a></li>
          <li><a href="#servicos"><i class="fa-solid fa-chevron-right" style="font-size:0.65rem"></i> Vitrificação</a></li>
          <li><a href="#servicos"><i class="fa-solid fa-chevron-right" style="font-size:0.65rem"></i> Higienização</a></li>
          <li><a href="#servicos"><i class="fa-solid fa-chevron-right" style="font-size:0.65rem"></i> Película Automotiva</a></li>
        </ul>
      </div>

      <div class="footer-col">
        <h4>Navegação</h4>
        <ul class="footer-links">
          <li><a href="#hero"><i class="fa-solid fa-chevron-right" style="font-size:0.65rem"></i> Início</a></li>
          <li><a href="#sobre"><i class="fa-solid fa-chevron-right" style="font-size:0.65rem"></i> Sobre nós</a></li>
          <li><a href="#orcamento"><i class="fa-solid fa-chevron-right" style="font-size:0.65rem"></i> Orçamento</a></li>
          <li><a href="/blog"><i class="fa-solid fa-chevron-right" style="font-size:0.65rem"></i> Blog</a></li>
        </ul>
      </div>

      <div class="footer-col">
        <h4>Contato</h4>
        <div class="footer-contact-list">
          <div class="footer-contact-item">
            <i class="fa-solid fa-location-dot" style="font-size:0.9rem;margin-top:3px"></i>
            <span><?= COMPANY_ADDRESS ?></span>
          </div>
          <div class="footer-contact-item">
            <i class="fa-brands fa-whatsapp" style="font-size:0.9rem"></i>
            <span>
              <a href="https://wa.me/<?= COMPANY_WHATSAPP ?>" style="color:rgba(255,255,255,0.5)" target="_blank" rel="noopener">
                <?= COMPANY_PHONE ?>
              </a>
            </span>
          </div>
          <div class="footer-contact-item">
            <i class="fa-solid fa-envelope" style="font-size:0.9rem"></i>
            <span>
              <a href="mailto:<?= COMPANY_EMAIL ?>" style="color:rgba(255,255,255,0.5)">
                <?= COMPANY_EMAIL ?>
              </a>
            </span>
          </div>
        </div>

        <h4 style="margin-top:28px">Horários</h4>
        <div class="footer-hours">
          <div class="footer-hours-row">
            <span class="day">Seg – Sex</span>
            <span class="time">08h00 – 13h00</span>
          </div>
          <div class="footer-hours-row">
            <span class="day"></span>
            <span class="time">13h30 – 18h20</span>
          </div>
          <div class="footer-hours-row">
            <span class="day">Sábado</span>
            <span class="time" style="color:var(--gray-light)">Fechado</span>
          </div>
        </div>
      </div>
    </div>

    <div class="footer-bottom">
      <p>© <?= date('Y') ?> <?= COMPANY_NAME ?>. Todos os direitos reservados.</p>
      <p>Desenvolvido com <i class="fa-solid fa-heart" style="color:var(--red);font-size:0.7rem"></i></p>
    </div>
  </div>
</footer>

<!-- ══════════════════════════════════════════════════════════
     WHATSAPP FLUTUANTE
══════════════════════════════════════════════════════════ -->
<a href="https://wa.me/<?= COMPANY_WHATSAPP ?>?text=Olá!%20Gostaria%20de%20um%20orçamento."
   class="whatsapp-float" target="_blank" rel="noopener" aria-label="WhatsApp">
  <span class="whatsapp-float-label">Fale conosco!</span>
  <div class="whatsapp-float-btn">
    <div class="wa-pulse"></div>
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.532 5.847L.057 23.882l6.198-1.625A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.806 9.806 0 0 1-5.012-1.374l-.36-.213-3.68.965.981-3.591-.234-.369A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/>
    </svg>
  </div>
</a>

<script src="/assets/js/main.js" defer></script>
</body>
</html>
