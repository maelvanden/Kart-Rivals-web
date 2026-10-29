<?php
declare(strict_types=1);
require __DIR__ . '/../public/api/contact-lib.php';
function check(bool $condition, string $label): void { if (!$condition) throw new RuntimeException($label); }
$valid = ['type'=>'update','karting'=>'Circuit de test','city'=>'Angers','name'=>'Contact test','role'=>'Direction','email'=>'manager@example.com','phone'=>'','website'=>'https://example.com/','message'=>'Merci de modifier les informations de notre circuit.','acknowledgement'=>'yes'];
$data = contact_validate($valid);
check($data['type'] === 'update', 'valid request');
foreach ([['email'=>"attacker@example.com\r\nBcc: other@example.com"],['email'=>['invalid']],['website'=>'javascript:alert(1)'],['website'=>'https://user:pass@example.com'],['message'=>'court'],['acknowledgement'=>'no'],['type'=>'admin'],['karting'=>str_repeat('x',161)]] as $change) {
    $rejected = false;
    try { contact_validate(array_replace($valid,$change)); } catch (InvalidArgumentException $e) {$rejected=true;}
    check($rejected, 'Reject invalid request: '.json_encode($change));
}
$captured=[];
$sent=contact_mail($data,'KR-TEST',static function(...$args) use (&$captured) {$captured=$args;return true;});
check($sent && $captured[0]==='contact@kartrivals.fr','fixed destination');
check(strpos($captured[3],'From: Kart Rivals <contact@kartrivals.fr>')!==false,'fixed sender');
check(strpos($captured[3],'Reply-To: manager@example.com')!==false,'reply-to');
check(strpos(base64_decode($captured[2]),'modifier les informations')!==false,'message content');
check(!contact_mail($data,'KR-TEST',static function(...$args) {return false;}),'transport failure');
$dir=sys_get_temp_dir().'/kr-contact-test-'.bin2hex(random_bytes(6));
try {
    contact_private_directory($dir);
    for($i=0;$i<5;$i++)check(contact_limit($dir,'192.0.2.1',100000),'first five');
    check(!contact_limit($dir,'192.0.2.1',100001),'sixth limited');
    check(contact_limit($dir,'192.0.2.2',100001),'separate IP');
    check(contact_limit($dir,'192.0.2.1',103601),'hour expiration');
    contact_save($dir.'/KR-TEST.json',['request'=>$data]);
    check(json_decode(file_get_contents($dir.'/KR-TEST.json'),true)['request']['karting']==='Circuit de test','private persistence');
    touch($dir.'/KR-TEST.json',100000-91*86400);
    contact_cleanup($dir,100000);
    check(!file_exists($dir.'/KR-TEST.json'),'retention cleanup');
} finally { foreach(glob($dir.'/*')?:[] as $path)unlink($path); if(is_dir($dir))rmdir($dir); }
echo "PASS: validation, header injection, fixed mail recipient, transport failure, private storage, rate limiting, retention. No real email sent.\n";
