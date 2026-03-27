<?php
require_once __DIR__ . '/../config.php';

$slug = preg_replace('/[^a-z0-9-]/', '', strtolower($_GET['slug'] ?? ''));
if (empty($slug)) {
    header('Location: /blog');
    exit;
}

$file = POSTS_DIR . $slug . '.json';
if (!file_exists($file)) {
    http_response_code(404);
    $post = null;
} else {
    $post = json_decode(file_get_contents($file), true);
    if (!$post || ($post['status'] ?? '') !== 'published') {
        http_response_code(404);
        $post = null;
    }
}

// Posts relacionados
$related = [];
if ($post) {
    $all = glob(POSTS_DIR . '*.json') ?: [];
    foreach ($all as $f) {
        if (basename($f) === $slug . '.json') continue;
        $p = json_decode(file_get_contents($f), true);
        if ($p && ($p['status'] ?? '') === 'published' && ($p['category'] ?? '') === ($post['category'] ?? '')) {
            $related[] = $p;
            if (count($related) >= 3) break;
        }
    }
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <?php if ($post): ?>
  <title><?= htmlspecialchars($post['title']) ?> — Aliança Centro Automotivo</title>
  <meta name="description" content="<?= htmlspecialchars($post['excerpt'] ?? '') ?>" />
  <link rel="canonical" href="<?= SITE_URL ?>/blog/<?= htmlspecialchars($slug) ?>" />
  <meta property="og:type"        content="article" />
  <meta property="og:title"       content="<?= htmlspecialchars($post['title']) ?>" />
  <meta property="og:description" content="<?= htmlspecialchars($post['excerpt'] ?? '') ?>" />
  <?php if (!empty($post['image_url'])): ?>
  <meta property="og:image" content="<?= htmlspecialchars($post['image_url']) ?>" />
  <?php endif; ?>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "<?= addslashes($post['title']) ?>",
    "datePublished": "<?= $post['published_at'] ?>",
    "dateModified": "<?= $post['updated_at'] ?? $post['published_at'] ?>",
    "author": { "@type": "Organization", "name": "<?= addslashes($post['author'] ?? COMPANY_NAME) ?>" },
    "publisher": { "@type": "Organization", "name": "<?= COMPANY_NAME ?>", "url": "<?= SITE_URL ?>" }
  }
  </script>
  <?php else: ?>
  <title>Post não encontrado — Aliança Centro Automotivo</title>
  <?php endif; ?>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
  <link rel="stylesheet" href="/assets/css/style.css" />
  <style>
    .post-hero {
      background: var(--black);
      padding: 130px 0 60px;
      border-bottom: 1px solid rgba(219,13,21,0.2);
    }
    .post-breadcrumb {
      font-size: 0.8rem;
      color: rgba(255,255,255,0.4);
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .post-breadcrumb a { color: rgba(255,255,255,0.4); transition: var(--transition); }
    .post-breadcrumb a:hover { color: var(--red); }
    .post-breadcrumb i { font-size: 0.6rem; }
    .post-hero h1 {
      font-size: clamp(1.75rem, 4vw, 3rem);
      font-weight: 800;
      color: var(--white);
      line-height: 1.2;
      margin-bottom: 20px;
      max-width: 820px;
    }
    .post-meta {
      display: flex;
      gap: 20px;
      align-items: center;
      flex-wrap: wrap;
    }
    .post-meta-item { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: rgba(255,255,255,0.5); }
    .post-meta-item i { color: var(--red); font-size: 0.8rem; }
    .post-layout {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 56px;
      padding: 64px 0 80px;
    }
    .post-cover {
      width: 100%;
      max-height: 480px;
      object-fit: cover;
      border-radius: var(--radius-lg);
      margin-bottom: 40px;
    }
    .post-body {
      font-size: 1rem;
      line-height: 1.85;
      color: #374151;
    }
    .post-body h2 { font-size: 1.5rem; font-weight: 700; color: var(--black); margin: 36px 0 16px; }
    .post-body h3 { font-size: 1.2rem; font-weight: 600; color: var(--black); margin: 28px 0 12px; }
    .post-body p  { margin-bottom: 18px; }
    .post-body ul, .post-body ol { margin: 0 0 18px 24px; }
    .post-body li { margin-bottom: 8px; }
    .post-body strong { color: var(--black); }
    .post-body a { color: var(--red); }
    .post-body blockquote {
      border-left: 4px solid var(--red);
      padding: 16px 24px;
      margin: 24px 0;
      background: var(--light);
      border-radius: 0 var(--radius) var(--radius) 0;
      font-style: italic;
      color: var(--gray);
    }
    .post-body img { border-radius: var(--radius); margin: 24px 0; }
    .post-tags { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 40px; padding-top: 32px; border-top: 1px solid #e5e7eb; }
    .post-tag {
      font-size: 0.78rem;
      font-weight: 600;
      background: var(--light);
      color: var(--gray);
      padding: 5px 12px;
      border-radius: 100px;
    }
    .post-share {
      margin-top: 32px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .post-share span { font-size: 0.85rem; font-weight: 600; color: var(--gray); }
    .share-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 18px;
      border-radius: var(--radius);
      font-size: 0.8rem;
      font-weight: 600;
      transition: var(--transition);
      color: var(--white);
    }
    .share-btn.whatsapp { background: #25D366; }
    .share-btn.whatsapp:hover { background: #1ebe5d; }
    /* Sidebar */
    .post-sidebar { position: sticky; top: 100px; height: fit-content; }
    .sidebar-card {
      background: var(--light);
      border-radius: var(--radius-lg);
      padding: 28px;
      margin-bottom: 24px;
    }
    .sidebar-card h4 { font-size: 0.9rem; font-weight: 700; color: var(--black); margin-bottom: 20px; border-bottom: 2px solid var(--red); padding-bottom: 12px; }
    .sidebar-related a {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      align-items: flex-start;
    }
    .sidebar-related a:last-child { margin-bottom: 0; }
    .sidebar-related-img {
      width: 70px; height: 55px;
      object-fit: cover;
      border-radius: var(--radius);
      flex-shrink: 0;
    }
    .sidebar-related-placeholder {
      width: 70px; height: 55px;
      background: var(--dark-3);
      border-radius: var(--radius);
      flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .sidebar-related-title { font-size: 0.82rem; font-weight: 600; color: var(--black); line-height: 1.4; }
    .sidebar-related-date  { font-size: 0.72rem; color: var(--gray); margin-top: 4px; }
    .sidebar-cta { background: var(--red); border-radius: var(--radius-lg); padding: 28px; text-align: center; }
    .sidebar-cta h4 { color: var(--white); font-size: 1rem; margin-bottom: 10px; border: none; }
    .sidebar-cta p  { color: rgba(255,255,255,0.8); font-size: 0.82rem; margin-bottom: 20px; }
    /* 404 */
    .post-404 { text-align: center; padding: 100px 0; }
    .post-404 i { font-size: 4rem; color: #d1d5db; margin-bottom: 24px; }
    .post-404 h2 { font-size: 1.5rem; color: var(--black); margin-bottom: 12px; }
    .post-404 p  { color: var(--gray); margin-bottom: 32px; }
    @media (max-width: 768px) {
      .post-layout { grid-template-columns: 1fr; }
      .post-sidebar { position: static; }
    }
  </style>
</head>
<body>

<header id="header" class="scrolled">
  <div class="container">
    <div class="header-inner">
      <a href="/" class="logo"><img src="/assets/images/logo-white.png" alt="Aliança Centro Automotivo" /></a>
      <nav class="nav-menu">
        <a href="/">Início</a>
        <a href="/#servicos">Serviços</a>
        <a href="/#sobre">Sobre</a>
        <a href="/#orcamento">Orçamento</a>
        <a href="/blog" class="active">Blog</a>
        <a href="/#footer">Contato</a>
      </nav>
      <div class="nav-cta">
        <a href="https://wa.me/<?= COMPANY_WHATSAPP ?>?text=Olá!" class="btn btn-primary" target="_blank" rel="noopener">
          <i class="fa-brands fa-whatsapp"></i> WhatsApp
        </a>
      </div>
      <button class="hamburger" aria-label="Menu"><span></span><span></span><span></span></button>
    </div>
  </div>
</header>

<?php if (!$post): ?>
  <div class="container">
    <div class="post-404" style="padding-top:160px">
      <i class="fa-regular fa-file-circle-xmark"></i>
      <h2>Post não encontrado</h2>
      <p>O artigo que você está procurando não existe ou foi removido.</p>
      <a href="/blog" class="btn btn-primary">
        <i class="fa-solid fa-arrow-left"></i> Voltar para o Blog
      </a>
    </div>
  </div>
<?php else: ?>

<div class="post-hero">
  <div class="container">
    <div class="post-breadcrumb">
      <a href="/">Início</a>
      <i class="fa-solid fa-chevron-right"></i>
      <a href="/blog">Blog</a>
      <i class="fa-solid fa-chevron-right"></i>
      <span><?= htmlspecialchars($post['category'] ?? 'Geral') ?></span>
    </div>
    <h1><?= htmlspecialchars($post['title']) ?></h1>
    <div class="post-meta">
      <?php if (!empty($post['published_at'])): ?>
      <div class="post-meta-item">
        <i class="fa-regular fa-calendar"></i>
        <?= date('d \d\e F \d\e Y', strtotime($post['published_at'])) ?>
      </div>
      <?php endif; ?>
      <?php if (!empty($post['author'])): ?>
      <div class="post-meta-item">
        <i class="fa-regular fa-user"></i>
        <?= htmlspecialchars($post['author']) ?>
      </div>
      <?php endif; ?>
      <?php if (!empty($post['category'])): ?>
      <div class="post-meta-item">
        <span class="blog-card-cat"><?= htmlspecialchars($post['category']) ?></span>
      </div>
      <?php endif; ?>
    </div>
  </div>
</div>

<div class="container">
  <div class="post-layout">
    <main>
      <?php if (!empty($post['image_url'])): ?>
        <img class="post-cover" src="<?= htmlspecialchars($post['image_url']) ?>" alt="<?= htmlspecialchars($post['title']) ?>" />
      <?php endif; ?>

      <div class="post-body">
        <?= $post['content'] ?>
      </div>

      <?php if (!empty($post['tags'])): ?>
      <div class="post-tags">
        <?php foreach ($post['tags'] as $tag): ?>
          <span class="post-tag">#<?= htmlspecialchars($tag) ?></span>
        <?php endforeach; ?>
      </div>
      <?php endif; ?>

      <div class="post-share">
        <span>Compartilhar:</span>
        <a class="share-btn whatsapp"
           href="https://wa.me/?text=<?= urlencode($post['title'] . ' - ' . SITE_URL . '/blog/' . $slug) ?>"
           target="_blank" rel="noopener">
          <i class="fa-brands fa-whatsapp"></i> WhatsApp
        </a>
      </div>
    </main>

    <aside class="post-sidebar">
      <div class="sidebar-cta">
        <h4>Precisa de um orçamento?</h4>
        <p>Nossa equipe está pronta para te atender hoje mesmo.</p>
        <a href="https://wa.me/<?= COMPANY_WHATSAPP ?>?text=Olá!%20Vi%20o%20blog%20e%20quero%20um%20orçamento."
           class="btn btn-whatsapp" style="width:100%;justify-content:center" target="_blank" rel="noopener">
          <i class="fa-brands fa-whatsapp"></i> Falar agora
        </a>
      </div>

      <?php if (!empty($related)): ?>
      <div class="sidebar-card">
        <h4>Artigos relacionados</h4>
        <div class="sidebar-related">
          <?php foreach ($related as $r): ?>
          <a href="/blog/<?= htmlspecialchars($r['slug']) ?>">
            <?php if (!empty($r['image_url'])): ?>
              <img class="sidebar-related-img" src="<?= htmlspecialchars($r['image_url']) ?>"
                   alt="<?= htmlspecialchars($r['title']) ?>" loading="lazy" />
            <?php else: ?>
              <div class="sidebar-related-placeholder">
                <i class="fa-regular fa-newspaper" style="font-size:1.2rem;color:var(--red);opacity:0.4"></i>
              </div>
            <?php endif; ?>
            <div>
              <div class="sidebar-related-title"><?= htmlspecialchars($r['title']) ?></div>
              <div class="sidebar-related-date">
                <?= !empty($r['published_at']) ? date('d/m/Y', strtotime($r['published_at'])) : '' ?>
              </div>
            </div>
          </a>
          <?php endforeach; ?>
        </div>
      </div>
      <?php endif; ?>

      <div class="sidebar-card">
        <h4>Contato</h4>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;gap:10px;align-items:center;font-size:0.85rem;color:var(--gray)">
            <i class="fa-solid fa-phone" style="color:var(--red)"></i>
            <a href="tel:<?= preg_replace('/\D/', '', COMPANY_PHONE) ?>" style="color:var(--gray)"><?= COMPANY_PHONE ?></a>
          </div>
          <div style="display:flex;gap:10px;align-items:center;font-size:0.85rem;color:var(--gray)">
            <i class="fa-solid fa-location-dot" style="color:var(--red)"></i>
            <span><?= COMPANY_ADDRESS ?></span>
          </div>
          <div style="display:flex;gap:10px;align-items:center;font-size:0.85rem;color:var(--gray)">
            <i class="fa-regular fa-clock" style="color:var(--red)"></i>
            <span>Seg–Sex: 08h–13h / 13h30–18h20</span>
          </div>
        </div>
      </div>
    </aside>
  </div>
</div>

<?php endif; ?>

<a href="https://wa.me/<?= COMPANY_WHATSAPP ?>" class="whatsapp-float" target="_blank" rel="noopener">
  <span class="whatsapp-float-label">Fale conosco!</span>
  <div class="whatsapp-float-btn">
    <div class="wa-pulse"></div>
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.532 5.847L.057 23.882l6.198-1.625A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.806 9.806 0 0 1-5.012-1.374l-.36-.213-3.68.965.981-3.591-.234-.369A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/>
    </svg>
  </div>
</a>

<script src="/assets/js/main.js" defer></script>
</body>
</html>
