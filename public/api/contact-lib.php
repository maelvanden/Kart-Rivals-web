<?php
declare(strict_types=1);

// No database credentials or customer-supplied mail headers are used.
function contact_validate(array $input): array {
    $limits = ['type' => 30, 'karting' => 160, 'city' => 120, 'name' => 120,
        'role' => 120, 'email' => 254, 'phone' => 40, 'website' => 500, 'message' => 3000];
    $data = [];
    foreach ($limits as $key => $limit) {
        if (isset($input[$key]) && !is_string($input[$key])) {
            throw new InvalidArgumentException('Un champ est invalide.');
        }
        $value = trim((string)($input[$key] ?? ''));
        if (!preg_match('//u', $value) || preg_match_all('/./us', $value) > $limit || strpos($value, "\0") !== false) {
            throw new InvalidArgumentException('Un champ est trop long ou invalide.');
        }
        $data[$key] = $value;
    }
    foreach (['karting', 'city', 'name', 'role', 'email', 'message'] as $key) {
        if ($data[$key] === '') throw new InvalidArgumentException('Complétez tous les champs obligatoires.');
    }
    if (!in_array($data['type'], ['partnership', 'update', 'both'], true)) {
        throw new InvalidArgumentException('Choisissez le type de demande.');
    }
    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $data['email'])) {
        throw new InvalidArgumentException('Indiquez une adresse e-mail valide.');
    }
    if (preg_match_all('/./us', $data['message']) < 20) throw new InvalidArgumentException('Précisez votre demande en au moins 20 caractères.');
    if ($data['website'] !== '') {
        $url = parse_url($data['website']);
        if (!$url || !in_array(strtolower($url['scheme'] ?? ''), ['http', 'https'], true) || empty($url['host']) || isset($url['user']) || isset($url['pass']) || !filter_var($data['website'], FILTER_VALIDATE_URL)) {
            throw new InvalidArgumentException('Le site du karting doit être une adresse http ou https valide.');
        }
    }
    if (($input['acknowledgement'] ?? '') !== 'yes') {
        throw new InvalidArgumentException('Confirmez que vous êtes autorisé à représenter ce karting.');
    }
    return $data;
}

function contact_private_directory(string $base): string {
    if (is_link($base)) throw new RuntimeException('Invalid storage');
    if (!is_dir($base) && !mkdir($base, 0700, true) && !is_dir($base)) throw new RuntimeException('Storage unavailable');
    @chmod($base, 0700);
    if (!is_writable($base)) throw new RuntimeException('Storage unavailable');
    return $base;
}

function contact_limit(string $base, string $ip, int $now): bool {
    $keyPath = $base . '/key';
    $keyFile = fopen($keyPath, 'c+');
    if (!$keyFile || !flock($keyFile, LOCK_EX)) throw new RuntimeException('Rate limit unavailable');
    @chmod($keyPath, 0600);
    $key = stream_get_contents($keyFile);
    if (!$key) { $key = bin2hex(random_bytes(32)); ftruncate($keyFile, 0); rewind($keyFile); fwrite($keyFile, $key); fflush($keyFile); }
    flock($keyFile, LOCK_UN); fclose($keyFile);
    $path = $base . '/rate-' . hash_hmac('sha256', $ip, $key) . '.json';
    $file = fopen($path, 'c+');
    if (!$file || !flock($file, LOCK_EX)) throw new RuntimeException('Rate limit unavailable');
    @chmod($path, 0600);
    $state = json_decode(stream_get_contents($file), true) ?: [];
    $attempts = array_values(array_filter($state, static function ($time) use ($now) { return is_int($time) && $time > $now - 3600; }));
    $allowed = count($attempts) < 5;
    if ($allowed) $attempts[] = $now;
    ftruncate($file, 0); rewind($file); fwrite($file, json_encode($attempts)); fflush($file);
    flock($file, LOCK_UN); fclose($file);
    return $allowed;
}

function contact_cleanup(string $base, int $now): void {
    // Retain requests for 90 days; expire throttling metadata after 24 h.
    foreach (glob($base . '/*.json') ?: [] as $path) {
        if (!is_file($path) || is_link($path)) continue;
        $age = substr(basename($path), 0, 5) === 'rate-' ? 86400 : 90 * 86400;
        $modified = filemtime($path);
        if ($modified !== false && $modified < $now - $age) @unlink($path);
    }
}

function contact_save(string $path, array $record): void {
    $json = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);
    if (file_put_contents($path, $json . "\n", LOCK_EX) === false) throw new RuntimeException('Storage unavailable');
    @chmod($path, 0600);
}

function contact_mail(array $data, string $reference, callable $send): bool {
    $labels = ['partnership' => 'Partenariat', 'update' => 'Mise a jour de fiche', 'both' => 'Partenariat et mise a jour'];
    $body = "Nouvelle demande karting — Kart Rivals\nRéférence : " . $reference . "\n\n";
    $names = ['type' => 'Demande', 'karting' => 'Karting', 'city' => 'Ville', 'name' => 'Contact', 'role' => 'Fonction', 'email' => 'E-mail', 'phone' => 'Téléphone', 'website' => 'Site'];
    foreach ($names as $key => $label) $body .= $label . ' : ' . ($key === 'type' ? $labels[$data[$key]] : $data[$key]) . "\n";
    $body .= "\nMessage :\n" . $data['message'] . "\n\nLe demandeur déclare être autorisé à représenter ce karting.\nVérifiez son identité avant toute modification ou attribution d’accès dans l’application.\n";
    // IONOS requires a sender on a domain in this hosting contract.
    $headers = [
        'From: Kart Rivals <contact@kartrivals.fr>',
        'Reply-To: ' . $data['email'],
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
    ];
    return (bool)$send('contact@kartrivals.fr', '[Kart Rivals] ' . $labels[$data['type']] . ' - ' . $reference,
        chunk_split(base64_encode($body)), implode("\r\n", $headers));
}
