<?php
declare(strict_types=1);
ini_set('display_errors', '0');
require_once __DIR__ . '/contact-lib.php';
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function respond(int $status, array $body): void {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'POST'], true)) { header('Allow: GET, POST'); respond(405, ['error' => 'Méthode non autorisée.']); }
if ($method === 'POST') {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== 'https://kartrivals.fr' && $origin !== 'https://www.kartrivals.fr') respond(403, ['error' => 'Rechargez le formulaire depuis kartrivals.fr.']);
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 16000) respond(413, ['error' => 'Votre demande est trop longue.']);
    if (strpos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) respond(415, ['error' => 'Format non accepté.']);
}
session_name('kr_contact');
session_set_cookie_params(['lifetime' => 0, 'path' => '/api/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
if (!session_start()) respond(503, ['error' => 'Le formulaire est momentanément indisponible. Contactez contact@kartrivals.fr.']);
if (!isset($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
if ($method === 'GET') respond(200, ['csrf' => $_SESSION['csrf']]);
$raw = file_get_contents('php://input', false, null, 0, 16001);
if (strlen((string)$raw) > 16000) respond(413, ['error' => 'Votre demande est trop longue.']);
$input = json_decode((string)$raw, true);
if (!is_array($input)) respond(400, ['error' => 'Format de demande invalide.']);
if (!is_string($input['csrf'] ?? null) || !hash_equals($_SESSION['csrf'], $input['csrf'])) respond(403, ['error' => 'Votre session a expiré. Rechargez la page puis réessayez.']);
if (!empty($input['company_fax'])) respond(422, ['error' => 'Impossible de transmettre ce formulaire. Contactez contact@kartrivals.fr.']);
try { $data = contact_validate($input); }
catch (InvalidArgumentException $error) { respond(422, ['error' => $error->getMessage()]); }
$fingerprint = hash('sha256', json_encode($data));
$previous = $_SESSION['last_request'] ?? [];
if (($previous['hash'] ?? '') === $fingerprint && ($previous['time'] ?? 0) > time() - 600) {
    respond(200, ['ok' => true, 'reference' => $previous['reference']]);
}
try {
    $base = contact_private_directory(dirname(__DIR__, 2) . '/.kart-rivals-contact');
    contact_cleanup($base, time());
    if (!contact_limit($base, (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'), time())) {
        header('Retry-After: 3600'); respond(429, ['error' => 'Trop de demandes récentes. Réessayez dans une heure ou écrivez à contact@kartrivals.fr.']);
    }
    $reference = 'KR-' . gmdate('Ymd') . '-' . strtoupper(bin2hex(random_bytes(5)));
    $record = ['reference' => $reference, 'created_at' => gmdate('c'), 'notification' => 'pending', 'request' => $data];
    $path = $base . '/' . $reference . '.json';
    contact_save($path, $record);
    $sent = function_exists('mail') && contact_mail($data, $reference, static function ($to, $subject, $body, $headers) { return @mail($to, $subject, $body, $headers); });
    $record['notification'] = $sent ? 'accepted_by_mail_server' : 'failed';
    contact_save($path, $record);
    if (!$sent) respond(503, ['error' => 'La notification n’a pas pu être envoyée. Écrivez à contact@kartrivals.fr en précisant la référence ' . $reference . '.']);
    $_SESSION['last_request'] = ['hash' => $fingerprint, 'time' => time(), 'reference' => $reference];
    respond(200, ['ok' => true, 'reference' => $reference]);
} catch (Throwable $error) {
    // Do not include applicant data or server paths in output or logs.
    error_log('Kart Rivals contact: processing unavailable');
    respond(503, ['error' => 'Le formulaire est momentanément indisponible. Écrivez à contact@kartrivals.fr.']);
}
