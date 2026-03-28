<?php
/**
 * Lead Capture API
 * POST /api/leads.php
 *
 * Recebe dados do formulário de orçamento, salva em CSV e
 * envia notificação por e-mail + (opcional) WhatsApp via 360dialog ou Twilio.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://centroautoalianca.com.br');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST')    { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

// ---- Load config ----
$configFile = __DIR__ . '/../config.php';
if (file_exists($configFile)) require_once $configFile;

// ---- Parse input ----
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data) $data = $_POST; // fallback for form-encoded

// ---- Sanitize ----
function clean(string $v, int $max = 255): string {
    return substr(trim(strip_tags($v)), 0, $max);
}

$nome     = clean($data['nome']     ?? '');
$whatsapp = clean($data['whatsapp'] ?? '');
$email    = filter_var(trim($data['email'] ?? ''), FILTER_SANITIZE_EMAIL);
$servico  = clean($data['servico']  ?? '');
$mensagem = clean($data['mensagem'] ?? '', 1000);

// ---- Validate ----
if (!$nome || !$whatsapp || !$servico) {
    http_response_code(422);
    echo json_encode(['error' => 'Campos obrigatórios ausentes: nome, whatsapp, servico']);
    exit;
}

// ---- Save to CSV ----
$csvFile = __DIR__ . '/../data/leads.csv';
$isNew   = !file_exists($csvFile);
$fh      = fopen($csvFile, 'a');
if ($fh) {
    if ($isNew) fputcsv($fh, ['data','nome','whatsapp','email','servico','mensagem','ip']);
    fputcsv($fh, [
        date('Y-m-d H:i:s'),
        $nome, $whatsapp, $email, $servico, $mensagem,
        $_SERVER['REMOTE_ADDR'] ?? '',
    ]);
    fclose($fh);
}

// ---- Send notification email ----
$toEmail   = defined('LEAD_EMAIL')    ? LEAD_EMAIL    : (defined('COMPANY_EMAIL') ? COMPANY_EMAIL : 'comercial@centroautoalianca.com.br');
$fromEmail = defined('COMPANY_EMAIL') ? COMPANY_EMAIL : 'noreply@centroautoalianca.com.br';

$subject = "Novo orçamento: {$nome} — {$servico}";
$body = "Novo pedido de orçamento recebido:\n\n"
      . "Nome:       {$nome}\n"
      . "WhatsApp:   {$whatsapp}\n"
      . "E-mail:     {$email}\n"
      . "Serviço:    {$servico}\n"
      . "Mensagem:   {$mensagem}\n\n"
      . "Data/hora:  " . date('d/m/Y H:i') . "\n"
      . "IP:         " . ($_SERVER['REMOTE_ADDR'] ?? '-');

$headers  = "From: {$fromEmail}\r\n";
$headers .= "Reply-To: {$email}\r\n";
$headers .= "X-Mailer: PHP/" . phpversion();

@mail($toEmail, $subject, $body, $headers);

// ---- Webhook n8n (opcional) ----
if (defined('N8N_LEAD_WEBHOOK') && N8N_LEAD_WEBHOOK) {
    $payload = json_encode([
        'nome' => $nome, 'whatsapp' => $whatsapp, 'email' => $email,
        'servico' => $servico, 'mensagem' => $mensagem,
        'data' => date('Y-m-d H:i:s'),
    ]);
    $ctx = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => "Content-Type: application/json\r\n",
        'content' => $payload,
        'timeout' => 5,
        'ignore_errors' => true,
    ]]);
    @file_get_contents(N8N_LEAD_WEBHOOK, false, $ctx);
}

// ---- Respond ----
http_response_code(200);
echo json_encode([
    'success' => true,
    'message' => 'Orçamento recebido! Entraremos em contato em breve.',
]);
