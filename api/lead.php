<?php
// ============================================================
// API — Captação de Leads
// POST /api/lead.php
// Body JSON: { name, phone, email, service, message }
// ============================================================

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . (defined('SITE_URL') ? SITE_URL : '*'));
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido.']);
    exit;
}

require_once __DIR__ . '/../config.php';

// Ler body
$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

// Fallback para form-data
if (empty($data)) {
    $data = $_POST;
}

// Validar campos obrigatórios
$name    = trim($data['name']    ?? '');
$phone   = trim($data['phone']   ?? '');
$email   = trim($data['email']   ?? '');
$service = trim($data['service'] ?? '');
$message = trim($data['message'] ?? '');

$errors = [];
if (strlen($name) < 2)   $errors[] = 'Nome inválido.';
if (strlen($phone) < 8)  $errors[] = 'Telefone inválido.';
if (!empty($email) && !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'E-mail inválido.';
if (empty($service))     $errors[] = 'Selecione um serviço.';

if (!empty($errors)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => implode(' ', $errors)]);
    exit;
}

// Sanitize
$name    = htmlspecialchars($name,    ENT_QUOTES, 'UTF-8');
$phone   = htmlspecialchars($phone,   ENT_QUOTES, 'UTF-8');
$email   = htmlspecialchars($email,   ENT_QUOTES, 'UTF-8');
$service = htmlspecialchars($service, ENT_QUOTES, 'UTF-8');
$message = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');

$date    = date('d/m/Y H:i');
$ip      = $_SERVER['REMOTE_ADDR'] ?? 'N/A';

$results = [];

// ── 1. Enviar e-mail ────────────────────────────────────────
$subject = "[Lead] Novo orçamento — {$service}";
$body    = <<<EMAIL
Novo lead recebido em {$date}

Nome:    {$name}
Telefone: {$phone}
E-mail:  {$email}
Serviço: {$service}

Mensagem:
{$message}

---
IP: {$ip}
EMAIL;

$headers  = "From: noreply@centroautoalianca.com.br\r\n";
$headers .= "Reply-To: {$email}\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

$emailSent = mail(LEAD_EMAIL, $subject, $body, $headers);
$results['email'] = $emailSent;

// ── 2. Disparar webhook n8n ─────────────────────────────────
if (!empty(N8N_LEAD_WEBHOOK)) {
    $payload = json_encode([
        'name'    => $name,
        'phone'   => $phone,
        'email'   => $email,
        'service' => $service,
        'message' => $message,
        'date'    => $date,
        'source'  => 'website',
    ]);

    $ch = curl_init(N8N_LEAD_WEBHOOK);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $webhookRes = curl_exec($ch);
    $results['webhook'] = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
}

// ── 3. Gravar lead em log local (backup) ────────────────────
$logDir  = __DIR__ . '/../data/leads/';
if (!is_dir($logDir)) {
    mkdir($logDir, 0750, true);
}
$logFile = $logDir . 'leads.jsonl';
$logLine = json_encode([
    'created_at' => date('c'),
    'name'       => $name,
    'phone'      => $phone,
    'email'      => $email,
    'service'    => $service,
    'message'    => $message,
]) . "\n";
file_put_contents($logFile, $logLine, FILE_APPEND | LOCK_EX);

// ── Resposta ────────────────────────────────────────────────
echo json_encode([
    'success' => true,
    'message' => 'Orçamento enviado com sucesso! Entraremos em contato em breve.',
]);
