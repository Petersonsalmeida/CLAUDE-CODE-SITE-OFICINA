<?php
// Individual blog post page
$slug = preg_replace('/[^a-z0-9_-]/', '', strtolower($_GET['slug'] ?? ''));
if (!$slug) { header('Location: /blog'); exit; }

$file = __DIR__ . '/../data/posts/' . $slug . '.json';
if (!file_exists($file)) {
    http_response_code(404);
    $post = null;
} else {
    $post = json_decode(file_get_contents($file), true);
    if (!$post || !($post['published'] ?? true)) {
        http_response_code(404);
        $post = null;
    }
}

// Get related posts
$related = [];
if ($post && is_dir(__DIR__ . '/../data/posts/')) {
    foreach (glob(__DIR__ . '/../data/posts/*.json') as $f) {
        if (basename($f) === $slug . '.json') continue;
        $d = json_decode(file_get_contents($f), true);
        if ($d && ($d['published'] ?? true) && ($d['category'] ?? '') === ($post['category'] ?? '')) {
            $related[] = $d;
        }
    }
    $related = array_slice($related, 0, 3);
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <?php if ($post): ?>
  <title><?= htmlspecialchars($post['title']) ?> — Aliança Centro Automotivo</title>
  <meta name="description" content="<?= htmlspecialchars($post['excerpt'] ?? '') ?>">
  <meta property="og:title" content="<?= htmlspecialchars($post['title']) ?>">
  <meta property="og:description" content="<?= htmlspecialchars($post['excerpt'] ?? '') ?>">
  <?php if (!empty($post['image'])): ?>
  <meta property="og:image" content="<?= htmlspecialchars($post['image']) ?>">
  <?php endif; ?>
  <link rel="canonical" href="https://centroautoalianca.com.br/blog/<?= htmlspecialchars($slug) ?>">
  <?php else: ?>
  <title>Post não encontrado — Aliança Centro Automotivo</title>
  <?php endif; ?>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32x32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/apple-touch-icon.png">
  <meta name="theme-color" content="#CC1A1A">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">
  <!-- Google Analytics GA4 -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-S9CEX8HTG3"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-S9CEX8HTG3');
  </script>
  <link rel="stylesheet" href="/assets/css/style.css">
  <style>
    .post-hero { padding: calc(var(--nav-h) + 60px) 0 0; background: var(--bg-2); }
    .post-meta-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 24px; }
    .post-cat { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--red); }
    .post-date, .post-read { font-size: 13px; color: var(--text-3); }
    .post-sep { color: var(--text-3); }
    .post-title { font-size: clamp(32px, 5.5vw, 62px); font-weight: 800; letter-spacing: -2px; line-height: 1.1; margin-bottom: 20px; max-width: 840px; }
    .post-excerpt { font-size: 20px; color: var(--text-2); line-height: 1.6; max-width: 700px; margin-bottom: 48px; }
    .post-cover { width: 100%; aspect-ratio: 21/9; object-fit: cover; border-radius: var(--radius-lg) var(--radius-lg) 0 0; max-height: 520px; }
    .post-cover-placeholder { width: 100%; aspect-ratio: 21/9; max-height: 520px; background: var(--bg-elevated); border-radius: var(--radius-lg) var(--radius-lg) 0 0; display: flex; align-items: center; justify-content: center; }
    .post-body { max-width: 740px; margin: 0 auto; padding: 64px 0 100px; }
    .post-content { font-size: 17px; line-height: 1.78; color: var(--text-2); }
    .post-content h2 { font-size: 28px; font-weight: 700; color: var(--text); letter-spacing: -0.5px; margin: 48px 0 16px; }
    .post-content h3 { font-size: 22px; font-weight: 700; color: var(--text); letter-spacing: -0.3px; margin: 36px 0 12px; }
    .post-content p { margin-bottom: 22px; }
    .post-content strong { color: var(--text); font-weight: 600; }
    .post-content em { color: var(--text); }
    .post-content a { color: var(--red); text-decoration: underline; text-underline-offset: 3px; }
    .post-content ul, .post-content ol { margin: 20px 0 24px 24px; display: flex; flex-direction: column; gap: 10px; }
    .post-content ul { list-style: disc; }
    .post-content ol { list-style: decimal; }
    .post-content li { line-height: 1.6; }
    .post-content blockquote { border-left: 3px solid var(--red); padding: 16px 24px; margin: 32px 0; background: var(--red-glow-s); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; font-style: italic; color: var(--text); }
    .post-content img { width: 100%; border-radius: var(--radius); margin: 28px 0; }
    .post-content code { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 5px; padding: 2px 7px; font-size: 0.9em; color: var(--red); }
    .post-content pre { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 20px; overflow-x: auto; margin: 28px 0; }
    .post-cta { background: var(--bg-card); border: 1px solid var(--border-s); border-radius: var(--radius-lg); padding: 40px; text-align: center; margin: 48px 0; }
    .post-cta h3 { font-size: 22px; font-weight: 700; margin-bottom: 10px; }
    .post-cta p { color: var(--text-2); margin-bottom: 24px; }
    .post-share { display: flex; align-items: center; gap: 12px; margin-top: 48px; padding-top: 32px; border-top: 1px solid var(--border-s); flex-wrap: wrap; }
    .post-share span { font-size: 13px; color: var(--text-3); font-weight: 600; }
    .share-btn { display: inline-flex; align-items: center; gap: 8px; padding: 8px 18px; border-radius: var(--radius-full); border: 1.5px solid var(--border); color: var(--text-2); font-size: 13px; font-weight: 600; transition: all 0.2s; }
    .share-btn:hover { border-color: var(--red); color: var(--red); background: var(--red-glow-s); }
    .related-section { background: var(--bg-2); padding: 80px 0; border-top: 1px solid var(--border-s); }
    .related-section h2 { font-size: 28px; font-weight: 700; margin-bottom: 32px; }
    .not-found { text-align: center; padding: calc(var(--nav-h) + 100px) 24px 100px; }
    .not-found h1 { font-size: 56px; font-weight: 900; color: var(--red); margin-bottom: 16px; }
    .not-found p { color: var(--text-2); font-size: 18px; margin-bottom: 32px; }
  </style>
</head>
<body>

  <nav id="navbar" class="scrolled">
    <div class="nav-inner">
      <a href="/" class="nav-logo" aria-label="Aliança Centro Automotivo">
        <picture>
          <source srcset="/assets/images/logo-05.webp" type="image/webp">
          <img src="/assets/images/logo-05.png" alt="Aliança Centro Automotivo" class="nav-logo-img" width="120" height="46">
        </picture>
      </a>
      <ul class="nav-links">
        <li><a href="/#servicos">Serviços</a></li>
        <li><a href="/#sobre">Sobre</a></li>
        <li><a href="/blog" style="color:var(--text)">Blog</a></li>
        <li><a href="/#contato">Contato</a></li>
      </ul>
      <a href="/#orcamento" class="nav-cta">Orçamento Grátis</a>
      <button class="nav-burger" aria-label="Menu"><span></span><span></span><span></span></button>
    </div>
  </nav>

  <?php if (!$post): ?>
    <div class="not-found">
      <h1>404</h1>
      <p>Este post não foi encontrado ou foi removido.</p>
      <a href="/blog" class="btn btn-primary">Ver todos os posts</a>
    </div>
  <?php else: ?>

  <!-- POST HERO -->
  <section class="post-hero">
    <div class="container">
      <div class="post-meta-row">
        <a href="/blog?cat=<?= urlencode($post['category'] ?? '') ?>" class="post-cat"><?= htmlspecialchars($post['category'] ?? 'Dicas') ?></a>
        <span class="post-sep">·</span>
        <span class="post-date"><?= date('d \d\e F \d\e Y', strtotime($post['date'] ?? 'now')) ?></span>
        <?php if (!empty($post['readTime'])): ?>
        <span class="post-sep">·</span>
        <span class="post-read"><?= htmlspecialchars($post['readTime']) ?></span>
        <?php endif; ?>
      </div>
      <h1 class="post-title"><?= htmlspecialchars($post['title']) ?></h1>
      <?php if (!empty($post['excerpt'])): ?>
      <p class="post-excerpt"><?= htmlspecialchars($post['excerpt']) ?></p>
      <?php endif; ?>
    </div>
    <?php if (!empty($post['image'])): ?>
    <img class="post-cover" src="<?= htmlspecialchars($post['image']) ?>" alt="<?= htmlspecialchars($post['title']) ?>">
    <?php else: ?>
    <div class="post-cover-placeholder">
      <svg width="60" height="60" viewBox="0 0 60 60" fill="none"><path d="M5 45 L18 22 L28 34 L38 18 L55 45Z" fill="#CC1A1A" opacity="0.2"/><circle cx="42" cy="16" r="6" fill="#CC1A1A" opacity="0.3"/></svg>
    </div>
    <?php endif; ?>
  </section>

  <!-- POST CONTENT -->
  <main>
    <div class="container">
      <article class="post-body">
        <div class="post-content">
          <?= $post['content'] ?? '<p>Conteúdo em breve.</p>' ?>
        </div>

        <!-- Inline CTA -->
        <div class="post-cta">
          <h3>Gostou do conteúdo?</h3>
          <p>Solicite um orçamento gratuito e cuide do seu carro com quem entende.</p>
          <a href="/#orcamento" class="btn btn-primary">Solicitar Orçamento Grátis</a>
        </div>

        <!-- Share -->
        <div class="post-share">
          <span>Compartilhar:</span>
          <a class="share-btn" href="https://wa.me/?text=<?= urlencode($post['title'] . ' - https://centroautoalianca.com.br/blog/' . $slug) ?>" target="_blank" rel="noopener">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5A6.5 6.5 0 001.5 8c0 1.2.33 2.33.9 3.3L1.5 14.5l3.27-.87A6.5 6.5 0 108 1.5z" stroke="currentColor" stroke-width="1.3"/></svg>
            WhatsApp
          </a>
          <button class="share-btn" onclick="navigator.clipboard.writeText(window.location.href).then(()=>alert('Link copiado!'))">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M5 11H4a2 2 0 01-2-2V4a2 2 0 012-2h5a2 2 0 012 2v1" stroke="currentColor" stroke-width="1.3"/></svg>
            Copiar link
          </button>
        </div>

        <!-- Back to blog -->
        <div style="margin-top: 40px;">
          <a href="/blog" class="btn btn-ghost">← Voltar ao Blog</a>
        </div>
      </article>
    </div>

    <!-- Related posts -->
    <?php if (!empty($related)): ?>
    <section class="related-section">
      <div class="container">
        <h2>Posts relacionados</h2>
        <div class="blog-grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">
          <?php foreach ($related as $r): ?>
          <article class="blog-card">
            <div class="blog-card-img-wrap">
              <?php if (!empty($r['image'])): ?>
                <img class="blog-card-img" src="<?= htmlspecialchars($r['image']) ?>" alt="<?= htmlspecialchars($r['title']) ?>" loading="lazy">
              <?php else: ?>
                <div style="aspect-ratio:16/9;background:var(--bg-elevated)"></div>
              <?php endif; ?>
            </div>
            <div class="blog-card-body">
              <p class="blog-card-cat"><?= htmlspecialchars($r['category'] ?? 'Dicas') ?></p>
              <h3 class="blog-card-title"><a href="/blog/<?= htmlspecialchars($r['slug']) ?>"><?= htmlspecialchars($r['title']) ?></a></h3>
              <p class="blog-card-excerpt"><?= htmlspecialchars($r['excerpt'] ?? '') ?></p>
            </div>
          </article>
          <?php endforeach; ?>
        </div>
      </div>
    </section>
    <?php endif; ?>
  </main>

  <?php endif; ?>

  <footer style="padding:40px 0;border-top:1px solid var(--border-s);text-align:center">
    <div class="container">
      <p style="font-size:13px;color:var(--text-3)">&copy; <?= date('Y') ?> Aliança Centro Automotivo · <a href="/" style="color:var(--text-2)">Voltar ao site</a></p>
    </div>
  </footer>

  <a href="https://wa.me/5551994687074" class="wpp-float" target="_blank" rel="noopener" aria-label="WhatsApp">
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M13 2C7 2 2 7 2 13c0 1.95.53 3.78 1.45 5.35L2 24l5.82-1.42A10.93 10.93 0 0013 24C19 24 24 19 24 13S19 2 13 2z" fill="white"/><path d="M9 9.5c0 0-.5-.5-1.1 0C7.3 10.1 7 10.8 7 11.2c0 2.2 2 4.8 4.8 6.3 0 0 .5.3 1.2.3s1.6-.4 1.7-1.1c0-.4-.4-.9-.9-1.2l-.9-.6s-.5-.3-.9 0l-.4.4s-.9-.8-1.7-1.7l.4-.4c.4-.4 0-.9 0-.9L9 10.7S8.5 10.2 9 9.5z" fill="#25D366"/></svg>
  </a>

  <script src="/assets/js/main.js"></script>
</body>
</html>
