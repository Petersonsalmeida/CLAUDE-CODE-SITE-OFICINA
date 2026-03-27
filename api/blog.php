<?php
// ============================================================
// API — Blog (para automação via n8n)
// POST /api/blog.php         → criar/atualizar post
// DELETE /api/blog.php?slug= → remover post
//
// Autenticação: Header "Authorization: Bearer SEU_TOKEN"
//
// Body POST (JSON):
// {
//   "title":        "Título do post",
//   "slug":         "titulo-do-post",        ← opcional, gerado automaticamente
//   "excerpt":      "Resumo curto",
//   "content":      "<p>HTML do post</p>",
//   "category":     "Dicas",
//   "tags":         ["tag1", "tag2"],
//   "image_url":    "https://...",            ← opcional
//   "author":       "Aliança",               ← opcional
//   "status":       "published",             ← published | draft
//   "published_at": "2026-03-27T10:00:00"   ← opcional, usa now()
// }
// ============================================================

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config.php';

// ── Autenticação ────────────────────────────────────────────
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$token      = '';
if (str_starts_with($authHeader, 'Bearer ')) {
    $token = substr($authHeader, 7);
}
// Fallback para query param (menos seguro, apenas para testes)
if (empty($token)) {
    $token = $_GET['token'] ?? '';
}

if ($token !== BLOG_API_TOKEN || empty($token)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Não autorizado.']);
    exit;
}

// ── Garantir diretório de posts ─────────────────────────────
if (!is_dir(POSTS_DIR)) {
    mkdir(POSTS_DIR, 0750, true);
}

$method = $_SERVER['REQUEST_METHOD'];

// ════════════════════════════════════════════════════════════
// GET — Listar posts (para debug n8n)
// ════════════════════════════════════════════════════════════
if ($method === 'GET') {
    $files = glob(POSTS_DIR . '*.json') ?: [];
    usort($files, fn($a, $b) => filemtime($b) - filemtime($a));
    $posts = array_map(fn($f) => json_decode(file_get_contents($f), true), $files);
    echo json_encode(['success' => true, 'posts' => $posts, 'total' => count($posts)]);
    exit;
}

// ════════════════════════════════════════════════════════════
// POST — Criar ou atualizar post
// ════════════════════════════════════════════════════════════
if ($method === 'POST') {
    $raw  = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (empty($data) || !isset($data['title'])) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Campo "title" é obrigatório.']);
        exit;
    }

    // Gerar slug se não fornecido
    $title = trim($data['title']);
    $slug  = !empty($data['slug']) ? slugify($data['slug']) : slugify($title);

    if (empty($slug)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Slug inválido.']);
        exit;
    }

    $post = [
        'slug'         => $slug,
        'title'        => $title,
        'excerpt'      => trim($data['excerpt'] ?? ''),
        'content'      => $data['content'] ?? '',
        'category'     => trim($data['category'] ?? 'Geral'),
        'tags'         => is_array($data['tags'] ?? null) ? $data['tags'] : [],
        'image_url'    => trim($data['image_url'] ?? ''),
        'author'       => trim($data['author'] ?? 'Aliança Centro Automotivo'),
        'status'       => in_array($data['status'] ?? '', ['published', 'draft']) ? $data['status'] : 'published',
        'published_at' => !empty($data['published_at']) ? $data['published_at'] : date('c'),
        'updated_at'   => date('c'),
    ];

    $file     = POSTS_DIR . $slug . '.json';
    $isNew    = !file_exists($file);
    $written  = file_put_contents($file, json_encode($post, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    if ($written === false) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Erro ao salvar o post.']);
        exit;
    }

    http_response_code($isNew ? 201 : 200);
    echo json_encode([
        'success'  => true,
        'message'  => $isNew ? 'Post criado com sucesso.' : 'Post atualizado com sucesso.',
        'slug'     => $slug,
        'url'      => SITE_URL . '/blog/' . $slug,
        'is_new'   => $isNew,
    ]);
    exit;
}

// ════════════════════════════════════════════════════════════
// DELETE — Remover post
// ════════════════════════════════════════════════════════════
if ($method === 'DELETE') {
    $slug = slugify($_GET['slug'] ?? '');
    if (empty($slug)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Slug inválido.']);
        exit;
    }
    $file = POSTS_DIR . $slug . '.json';
    if (!file_exists($file)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Post não encontrado.']);
        exit;
    }
    unlink($file);
    echo json_encode(['success' => true, 'message' => 'Post removido.']);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Método não permitido.']);

// ── Função auxiliar ──────────────────────────────────────────
function slugify(string $text): string {
    $text = mb_strtolower(trim($text), 'UTF-8');
    $text = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
    $text = preg_replace('/[^a-z0-9\s-]/', '', $text);
    $text = preg_replace('/[\s-]+/', '-', $text);
    return trim($text, '-');
}
