<?php
/**
 * Blog Posts API
 *
 * GET  /api/posts.php?limit=3&cat=Dicas    → lista posts
 * POST /api/posts.php  (auth via X-API-Key) → cria post (para automação)
 *
 * Estrutura de um post (JSON):
 * {
 *   "slug":      "meu-post",
 *   "title":     "Título do Post",
 *   "excerpt":   "Resumo breve em 1-2 frases.",
 *   "content":   "<p>Conteúdo HTML aqui…</p>",
 *   "image":     "https://…/imagem.jpg",
 *   "category":  "Dicas",
 *   "date":      "2025-06-15",
 *   "readTime":  "4 min de leitura",
 *   "published": true
 * }
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$postsDir = __DIR__ . '/../data/posts/';

// ================================================================
// GET — list posts
// ================================================================
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $limit  = min(50, max(1, (int)($_GET['limit']  ?? 10)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));
    $cat    = trim($_GET['cat'] ?? '');

    $posts = [];
    if (is_dir($postsDir)) {
        foreach (glob($postsDir . '*.json') as $f) {
            $d = json_decode(file_get_contents($f), true);
            if (!$d || !($d['published'] ?? true)) continue;
            if ($cat && strcasecmp($d['category'] ?? '', $cat) !== 0) continue;
            // Strip full content from listing
            unset($d['content']);
            $posts[] = $d;
        }
    }
    usort($posts, fn($a, $b) => strtotime($b['date'] ?? '0') - strtotime($a['date'] ?? '0'));
    $total  = count($posts);
    $posts  = array_slice($posts, $offset, $limit);

    echo json_encode([
        'total'  => $total,
        'posts'  => array_values($posts),
    ]);
    exit;
}

// ================================================================
// POST — create post (automation endpoint)
// ================================================================
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Auth check
    $configFile = __DIR__ . '/../config.php';
    if (file_exists($configFile)) require_once $configFile;

    $expectedKey = defined('BLOG_API_KEY') ? BLOG_API_KEY : 'change-me-in-config';
    $sentKey     = $_SERVER['HTTP_X_API_KEY'] ?? '';
    if (!hash_equals($expectedKey, $sentKey)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $raw  = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!$data) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON body']);
        exit;
    }

    // Required fields
    $title = trim($data['title'] ?? '');
    $slug  = trim($data['slug']  ?? '');
    if (!$title || !$slug) {
        http_response_code(422);
        echo json_encode(['error' => 'title and slug are required']);
        exit;
    }

    // Sanitize slug
    $slug = strtolower(preg_replace('/[^a-z0-9_-]/', '', $slug));
    $file = $postsDir . $slug . '.json';

    // Build post object
    $post = [
        'slug'      => $slug,
        'title'     => $title,
        'excerpt'   => $data['excerpt']   ?? '',
        'content'   => $data['content']   ?? '',
        'image'     => $data['image']     ?? '',
        'category'  => $data['category']  ?? 'Dicas',
        'date'      => $data['date']      ?? date('Y-m-d'),
        'readTime'  => $data['readTime']  ?? '',
        'published' => (bool)($data['published'] ?? true),
    ];

    if (!is_dir($postsDir)) mkdir($postsDir, 0755, true);
    file_put_contents($file, json_encode($post, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

    http_response_code(201);
    echo json_encode(['success' => true, 'slug' => $slug]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
