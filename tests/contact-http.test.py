"""Exercise the PHP endpoint with mail() replaced by /bin/true; no mail is sent."""
import json
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

php = str(Path(sys.argv[1]).resolve())
root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='kr-http-') as temp:
    base = Path(temp)
    shutil.copytree(root / 'public/api', base / 'public/api')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
    process = subprocess.Popen([php, '-d', 'sendmail_path=/bin/true', '-d', 'session.save_path=' + temp, '-S', f'127.0.0.1:{port}', '-t', str(base/'public')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    cookie = ''
    def request(payload=None, origin='https://kartrivals.fr', method=None):
        headers = {'Origin': origin, 'Cookie': cookie, 'Content-Type':'application/json'}
        req = urllib.request.Request(f'http://127.0.0.1:{port}/api/contact.php', data=json.dumps(payload).encode() if payload is not None else None, headers=headers, method=method)
        try: response = urllib.request.urlopen(req)
        except urllib.error.HTTPError as error: response = error
        return response.status, json.loads(response.read()), response.headers
    try:
        for attempt in range(30):
            try:
                status, session, headers = request(); break
            except urllib.error.URLError: time.sleep(.1)
        else: raise RuntimeError('PHP test server did not start')
        assert status == 200 and len(session['csrf']) == 64, (status, session)
        assert all(flag in headers['Set-Cookie'].lower() for flag in ['secure', 'httponly', 'samesite=strict'])
        cookie = headers['Set-Cookie'].split(';')[0]
        payload = {'csrf':session['csrf'],'type':'update','karting':'Circuit de test','city':'Angers','name':'Contact test','role':'Direction','email':'manager@example.com','phone':'','website':'','message':'Merci de mettre notre fiche de circuit à jour.','acknowledgement':'yes'}
        assert request(payload,origin='https://untrusted.example')[0] == 403
        assert request(dict(payload,csrf='wrong'))[0] == 403
        assert request(dict(payload,email='invalid'))[0] == 422
        assert request(dict(payload,company_fax='bot'))[0] == 422
        code, success, _ = request(payload)
        assert code == 200 and success['ok'], (code, success)
        assert request(payload)[1]['reference'] == success['reference']
        files = list((base/'.kart-rivals-contact').glob('KR-*.json'))
        assert len(files) == 1, 'No duplicate mail request'
        assert json.loads(files[0].read_text())['notification'] == 'accepted_by_mail_server'
        assert request(method='PUT')[0] == 405
        print('PASS: HTTP sessions/CSRF/origin validation, invalid fields, honeypot, successful mocked send, persistence, deduplication. No real email sent.')
    finally:
        process.terminate(); process.wait(timeout=5)
