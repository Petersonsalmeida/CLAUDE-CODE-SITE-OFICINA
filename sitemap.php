<?php
header('Content-Type: application/xml; charset=utf-8');
echo '<?xml version="1.0" encoding="UTF-8"?>';

$base = 'https://centroautoalianca.com.br';
$today = date('Y-m-d');

$static = [
  ['loc' => '/',       'priority' => '1.0', 'freq' => 'monthly'],
  ['loc' => '/blog/',  'priority' => '0.8', 'freq' => 'weekly'],
];

// Coletar posts do blog
$posts = [];
$dir = __DIR__ . '/data/posts/';
if (is_dir($dir)) {
  foreach (glob($dir . '*.json') as $file) {
    $p = json_decode(file_get_contents($file), true);
    if ($p && !empty($p['slug'])) {
      $posts[] = [
        'loc'      => '/blog/' . $p['slug'],
        'date'     => $p['date'] ?? $today,
        'priority' => '0.7',
        'freq'     => 'monthly',
      ];
    }
  }
}
?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<?php foreach ($static as $url): ?>
  <url>
    <loc><?= $base . $url['loc'] ?></loc>
    <lastmod><?= $today ?></lastmod>
    <changefreq><?= $url['freq'] ?></changefreq>
    <priority><?= $url['priority'] ?></priority>
  </url>
<?php endforeach; ?>
<?php foreach ($posts as $url): ?>
  <url>
    <loc><?= $base . $url['loc'] ?></loc>
    <lastmod><?= $url['date'] ?></lastmod>
    <changefreq><?= $url['freq'] ?></changefreq>
    <priority><?= $url['priority'] ?></priority>
  </url>
<?php endforeach; ?>
</urlset>
