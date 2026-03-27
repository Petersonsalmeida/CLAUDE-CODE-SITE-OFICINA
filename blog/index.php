<?php
require_once __DIR__ . '/../config.php';

// Paginação
$per_page    = 9;
$page        = max(1, (int)($_GET['page'] ?? 1));
$category    = trim($_GET['categoria'] ?? '');

// Carregar todos os posts
$all_posts = [];
if (is_dir(POSTS_DIR)) {
    $files = glob(POSTS_DIR . '*.json') ?: [];
    foreach ($files as $file) {
        $post = json_decode(file_get_contents($file), true);
        if ($post && ($post['status'] ?? 'published') === 'published') {
            $all_posts[] = $post;
        }
    }
    usort($all_posts, fn($a, $b) => strtotime($b['published_at']) - strtotime($a['published_at']));
}

// Filtrar por categoria
if (!empty($category)) {
    $all_posts = array_filter($all_posts, fn($p) => strtolower($p['category'] ?? '') === strtolower($category));
    $all_posts = array_values($all_posts);
}

// Categorias únicas
$categories = array_unique(array_map(fn($p) => $p['category'] ?? 'Geral', array_filter($all_posts, fn($p) => !empty($p['category']))));
sort($categories);

// Paginação
$total       = count($all_posts);
$total_pages = max(1, (int)ceil($total / $per_page));
$page        = min($page, $total_pages);
$offset      = ($page - 1) * $per_page;
$posts       = array_slice($all_posts, $offset, $per_page);
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blog — Aliança Centro Automotivo</title>
  <meta name="description" content="Dicas de cuidados automotivos, novidades e artigos especializados do Aliança Centro Automotivo de Porto Alegre." />
  <link rel="canonical" href="<?= SITE_URL ?>/blog" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
  <link rel="stylesheet" href="/assets/css/style.css" />
  <style>
    .blog-page-hero {
      background: var(--black);
      padding: 140px 0 64px;
      text-align: center;
      border-bottom: 1px solid rgba(219,13,21,0.2);
    }
    .blog-page-hero h1 { color: var(--white); margin-bottom: 12px; }
    .blog-page-hero p  { color: rgba(255,255,255,0.5); max-width: 500px; margin: 0 auto; }
    .blog-filters {
      padding: 40px 0 16px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filter-label { font-size: 0.8rem; color: var(--gray); font-weight: 600; margin-right: 4px; }
    .filter-btn {
      font-size: 0.78rem;
      font-weight: 600;
      padding: 7px 16px;
      border-radius: 100px;
      border: 1px solid #e5e7eb;
      background: transparent;
      color: var(--gray);
      cursor: pointer;
      transition: var(--transition);
      font-family: var(--font);
    }
    .filter-btn:hover, .filter-btn.active {
      background: var(--red);
      border-color: var(--red);
      color: var(--white);
    }
    .blog-section { padding: 0 0 80px; }
    .blog-count { font-size: 0.85rem; color: var(--gray); margin-bottom: 32px; }
    .pagination {
      display: flex;
      gap: 8px;
      justify-content: center;
      margin-top: 56px;
      flex-wrap: wrap;
    }
    .pagination a, .pagination span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px; height: 40px;
      border-radius: var(--radius);
      font-size: 0.85rem;
      font-weight: 600;
      border: 1px solid #e5e7eb;
      color: var(--gray);
      transition: var(--transition);
    }
    .pagination a:hover { border-color: var(--red); color: var(--red); }
    .pagination span.current { background: var(--red); border-color: var(--red); color: var(--white); }
  </style>
</head>
<body>

<header id="header" class="scrolled">
  <div class="container">
    <div class="header-inner">
      <a href="/" class="logo">
        <img src="/assets/images/logo-white.png" alt="Aliança Centro Automotivo" />
      </a>
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

<div class="blog-page-hero">
  <div class="container">
    <span class="section-tag">Dicas & Novidades</span>
    <h1 class="section-title">Blog</h1>
    <p>Artigos sobre cuidados automotivos, dicas de manutenção e novidades do setor.</p>
  </div>
</div>

<section class="blog-section">
  <div class="container">
    <?php if (!empty($categories)): ?>
    <div class="blog-filters">
      <span class="filter-label">Filtrar:</span>
      <a href="/blog" class="filter-btn <?= empty($category) ? 'active' : '' ?>">Todos</a>
      <?php foreach ($categories as $cat): ?>
        <a href="/blog?categoria=<?= urlencode(strtolower($cat)) ?>"
           class="filter-btn <?= strtolower($category) === strtolower($cat) ? 'active' : '' ?>">
          <?= htmlspecialchars($cat) ?>
        </a>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>

    <?php if ($total > 0): ?>
      <p class="blog-count"><?= $total ?> artigo<?= $total !== 1 ? 's' : '' ?> encontrado<?= $total !== 1 ? 's' : '' ?></p>
    <?php endif; ?>

    <div class="blog-grid">
      <?php if (empty($posts)): ?>
        <div class="blog-empty">
          <i class="fa-regular fa-newspaper" style="font-size:3rem;color:#d1d5db;display:block;margin:0 auto 16px"></i>
          <p style="font-size:1rem;font-weight:600;color:#374151;margin-bottom:8px">Nenhum artigo publicado ainda.</p>
          <p style="font-size:0.875rem">Volte em breve para novidades!</p>
        </div>
      <?php else: ?>
        <?php foreach ($posts as $post): ?>
        <a href="/blog/<?= htmlspecialchars($post['slug']) ?>" class="blog-card">
          <?php if (!empty($post['image_url'])): ?>
            <img class="blog-card-img" src="<?= htmlspecialchars($post['image_url']) ?>"
                 alt="<?= htmlspecialchars($post['title']) ?>" loading="lazy" />
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
            <h2 class="blog-card-title"><?= htmlspecialchars($post['title']) ?></h2>
            <p class="blog-card-excerpt"><?= htmlspecialchars($post['excerpt'] ?? '') ?></p>
            <span class="blog-card-link">Ler artigo <i class="fa-solid fa-arrow-right"></i></span>
          </div>
        </a>
        <?php endforeach; ?>
      <?php endif; ?>
    </div>

    <?php if ($total_pages > 1): ?>
    <nav class="pagination" aria-label="Paginação">
      <?php if ($page > 1): ?>
        <a href="?page=<?= $page - 1 ?><?= !empty($category) ? '&categoria=' . urlencode($category) : '' ?>">
          <i class="fa-solid fa-chevron-left" style="font-size:0.7rem"></i>
        </a>
      <?php endif; ?>
      <?php for ($p = 1; $p <= $total_pages; $p++): ?>
        <?php if ($p === $page): ?>
          <span class="current"><?= $p ?></span>
        <?php else: ?>
          <a href="?page=<?= $p ?><?= !empty($category) ? '&categoria=' . urlencode($category) : '' ?>"><?= $p ?></a>
        <?php endif; ?>
      <?php endfor; ?>
      <?php if ($page < $total_pages): ?>
        <a href="?page=<?= $page + 1 ?><?= !empty($category) ? '&categoria=' . urlencode($category) : '' ?>">
          <i class="fa-solid fa-chevron-right" style="font-size:0.7rem"></i>
        </a>
      <?php endif; ?>
    </nav>
    <?php endif; ?>
  </div>
</section>

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
