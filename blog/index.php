<?php
// Blog listing page
$postsDir = __DIR__ . '/../data/posts/';
$posts = [];

if (is_dir($postsDir)) {
    $files = glob($postsDir . '*.json');
    if ($files) {
        foreach ($files as $f) {
            $data = json_decode(file_get_contents($f), true);
            if ($data && ($data['published'] ?? true)) {
                $posts[] = $data;
            }
        }
        // Sort by date descending
        usort($posts, fn($a, $b) => strtotime($b['date'] ?? '0') - strtotime($a['date'] ?? '0'));
    }
}

// Pagination
$perPage = 9;
$page    = max(1, (int)($_GET['page'] ?? 1));
$total   = count($posts);
$pages   = max(1, (int)ceil($total / $perPage));
$posts   = array_slice($posts, ($page - 1) * $perPage, $perPage);

$category = htmlspecialchars($_GET['cat'] ?? '', ENT_QUOTES, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog — Aliança Centro Automotivo</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32x32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/apple-touch-icon.png">
  <meta name="theme-color" content="#CC1A1A">
  <meta name="description" content="Dicas, novidades e curiosidades automotivas do blog da Aliança Centro Automotivo em Porto Alegre.">
  <link rel="canonical" href="https://centroautoalianca.com.br/blog">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
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
    .blog-page-hero { padding: calc(var(--nav-h) + 80px) 0 64px; text-align: center; background: var(--bg-2); border-bottom: 1px solid var(--border-s); }
    .blog-page-hero h1 { font-size: clamp(40px, 6vw, 68px); font-weight: 800; letter-spacing: -2px; }
    .blog-page-hero h1 em { color: var(--red); font-style: normal; }
    .blog-page-hero p { color: var(--text-2); font-size: 18px; margin-top: 12px; }
    .blog-main { padding: 80px 0 100px; }
    .blog-categories { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 56px; }
    .cat-btn { padding: 7px 18px; border-radius: 999px; font-size: 13px; font-weight: 600; border: 1.5px solid var(--border); color: var(--text-2); background: transparent; cursor: pointer; transition: all 0.2s; font-family: var(--font); }
    .cat-btn:hover, .cat-btn.active { background: var(--red-glow); border-color: rgba(216,59,33,0.4); color: var(--red); }
    .blog-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
    .empty-state { grid-column: 1/-1; text-align: center; padding: 60px 0; color: var(--text-2); }
    .pagination { display: flex; justify-content: center; gap: 8px; margin-top: 60px; }
    .pag-btn { padding: 9px 18px; border-radius: 8px; border: 1.5px solid var(--border); color: var(--text-2); font-size: 14px; font-weight: 600; background: transparent; cursor: pointer; transition: all 0.2s; text-decoration: none; font-family: var(--font); }
    .pag-btn:hover, .pag-btn.active { background: var(--red); border-color: var(--red); color: #fff; }
    @media (max-width: 1024px) { .blog-list { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 640px)  { .blog-list { grid-template-columns: 1fr; } }
  </style>
</head>
<body>

  <!-- NAV -->
  <nav id="navbar" class="scrolled">
    <div class="nav-inner">
      <a href="/" class="nav-logo" aria-label="Aliança Centro Automotivo">
        <img src="/assets/images/logo-red.png" alt="Aliança Centro Automotivo" class="nav-logo-img" height="46">
      </a>
      <ul class="nav-links">
        <li><a href="/#servicos">Serviços</a></li>
        <li><a href="/#sobre">Sobre</a></li>
        <li><a href="/#depoimentos">Depoimentos</a></li>
        <li><a href="/blog" style="color:var(--text)">Blog</a></li>
        <li><a href="/#contato">Contato</a></li>
      </ul>
      <a href="/#orcamento" class="nav-cta">Orçamento Grátis</a>
      <button class="nav-burger" aria-label="Menu"><span></span><span></span><span></span></button>
    </div>
  </nav>

  <div class="mobile-overlay"><nav class="mobile-nav"><ul>
    <li><a href="/#servicos">Serviços</a></li>
    <li><a href="/#sobre">Sobre</a></li>
    <li><a href="/#depoimentos">Depoimentos</a></li>
    <li><a href="/blog">Blog</a></li>
    <li><a href="/#contato">Contato</a></li>
  </ul><a href="/#orcamento" class="btn btn-primary">Orçamento Grátis</a></nav></div>

  <!-- HERO -->
  <section class="blog-page-hero">
    <div class="container">
      <span class="tag">Blog</span>
      <h1>Dicas e novidades<br><em>automotivas</em></h1>
      <p>Conteúdo especializado para quem ama cuidar do carro</p>
    </div>
  </section>

  <!-- BLOG MAIN -->
  <main class="blog-main">
    <div class="container">

      <!-- Categories -->
      <?php
        // Collect all categories
        $allCats = [];
        $allPostsForCats = [];
        if (is_dir($postsDir)) {
          foreach (glob($postsDir . '*.json') as $f) {
            $d = json_decode(file_get_contents($f), true);
            if ($d && ($d['published'] ?? true)) $allPostsForCats[] = $d;
          }
        }
        foreach ($allPostsForCats as $p) {
          $c = $p['category'] ?? 'Geral';
          $allCats[$c] = ($allCats[$c] ?? 0) + 1;
        }
      ?>
      <?php if (!empty($allCats)): ?>
      <div class="blog-categories">
        <a href="/blog" class="cat-btn <?= !$category ? 'active' : '' ?>">Todos (<?= count($allPostsForCats) ?>)</a>
        <?php foreach ($allCats as $cat => $cnt): ?>
          <a href="/blog?cat=<?= urlencode($cat) ?>" class="cat-btn <?= $category === $cat ? 'active' : '' ?>"><?= htmlspecialchars($cat) ?> (<?= $cnt ?>)</a>
        <?php endforeach; ?>
      </div>
      <?php endif; ?>

      <!-- Posts grid -->
      <div class="blog-list">
        <?php if (empty($posts)): ?>
          <div class="empty-state">
            <p>Nenhum artigo publicado ainda. Volte em breve!</p>
            <a href="/" class="btn btn-ghost" style="margin-top:24px">Voltar ao início</a>
          </div>
        <?php else: ?>
          <?php foreach ($posts as $p): ?>
          <article class="blog-card reveal-card">
            <div class="blog-card-img-wrap">
              <?php if (!empty($p['image'])): ?>
                <img class="blog-card-img" src="<?= htmlspecialchars($p['image']) ?>" alt="<?= htmlspecialchars($p['title']) ?>" loading="lazy">
              <?php else: ?>
                <div style="aspect-ratio:16/9;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="4" fill="transparent"/><path d="M5 30 L12 18 L18 24 L25 14 L35 30Z" fill="#CC1A1A" opacity="0.3"/></svg>
                </div>
              <?php endif; ?>
            </div>
            <div class="blog-card-body">
              <p class="blog-card-cat"><?= htmlspecialchars($p['category'] ?? 'Dicas') ?></p>
              <h2 class="blog-card-title">
                <a href="/blog/<?= htmlspecialchars($p['slug']) ?>"><?= htmlspecialchars($p['title']) ?></a>
              </h2>
              <p class="blog-card-excerpt"><?= htmlspecialchars($p['excerpt'] ?? '') ?></p>
              <div class="blog-card-meta">
                <span><?= htmlspecialchars(date('d/m/Y', strtotime($p['date'] ?? 'now'))) ?></span>
                <?php if (!empty($p['readTime'])): ?>
                  <span>· <?= htmlspecialchars($p['readTime']) ?></span>
                <?php endif; ?>
              </div>
            </div>
          </article>
          <?php endforeach; ?>
        <?php endif; ?>
      </div>

      <!-- Pagination -->
      <?php if ($pages > 1): ?>
      <nav class="pagination" aria-label="Paginação">
        <?php if ($page > 1): ?>
          <a href="?page=<?= $page - 1 ?>" class="pag-btn">← Anterior</a>
        <?php endif; ?>
        <?php for ($i = 1; $i <= $pages; $i++): ?>
          <a href="?page=<?= $i ?>" class="pag-btn <?= $i === $page ? 'active' : '' ?>"><?= $i ?></a>
        <?php endfor; ?>
        <?php if ($page < $pages): ?>
          <a href="?page=<?= $page + 1 ?>" class="pag-btn">Próxima →</a>
        <?php endif; ?>
      </nav>
      <?php endif; ?>

    </div>
  </main>

  <!-- Footer mini -->
  <footer style="padding:40px 0;border-top:1px solid var(--border-s);text-align:center">
    <div class="container">
      <p style="font-size:13px;color:var(--text-3)">&copy; <?= date('Y') ?> Aliança Centro Automotivo · <a href="/" style="color:var(--text-2)">Voltar ao site</a></p>
    </div>
  </footer>

  <a href="https://wa.me/5551994687074?text=Olá!%20Vim%20pelo%20blog%20e%20gostaria%20de%20um%20orçamento." class="wpp-float" target="_blank" rel="noopener" aria-label="WhatsApp">
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M13 2C7 2 2 7 2 13c0 1.95.53 3.78 1.45 5.35L2 24l5.82-1.42A10.93 10.93 0 0013 24C19 24 24 19 24 13S19 2 13 2z" fill="white"/><path d="M9 9.5c0 0-.5-.5-1.1 0C7.3 10.1 7 10.8 7 11.2c0 2.2 2 4.8 4.8 6.3 0 0 .5.3 1.2.3s1.6-.4 1.7-1.1c0-.4-.4-.9-.9-1.2l-.9-.6s-.5-.3-.9 0l-.4.4s-.9-.8-1.7-1.7l.4-.4c.4-.4 0-.9 0-.9L9 10.7S8.5 10.2 9 9.5z" fill="#25D366"/></svg>
  </a>

  <script src="/assets/js/main.js"></script>
</body>
</html>
