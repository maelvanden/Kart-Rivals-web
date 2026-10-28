"""Export public track seed data only; never connect to the live application database.
Usage: python scripts/import-circuits.py /path/to/KART-RIVALS
Replays static seed INSERTs and literal UPDATEs in a disposable in-memory SQLite DB.
"""
import hashlib
import json
import re
import sqlite3
import subprocess
import sys
from pathlib import Path

source = Path(sys.argv[1]).resolve()
root = Path(__file__).resolve().parents[1]
# Keep SQL strings intact while removing comments and function bodies.
TOKEN = re.compile(r"'(?:[^']|'')*'|\$\$[\s\S]*?\$\$|--[^\n]*|/\*[\s\S]*?\*/|;|[^'$;/\-]+|.")
def statements(text):
    parts = []
    for match in TOKEN.finditer(text):
        token = match.group()
        if token.startswith(('--', '/*')):
            parts.append(' ')
        elif token == ';':
            yield ''.join(parts).strip()
            parts = []
        else:
            parts.append(token)

columns = 'name address postal_code city region is_indoor length_m kart_power is_verified location created_by website phone description booking_url instagram_url facebook_url tiktok_url youtube_url layout_url location_approx'.split()
db = sqlite3.connect(':memory:')
db.row_factory = sqlite3.Row
db.execute('CREATE TABLE tracks (' + ','.join(columns) + ')')
db.execute('CREATE UNIQUE INDEX identity ON tracks(lower(name),lower(city))')
used = []
for path in sorted((source / 'supabase/migrations').glob('*.sql')):
    for stmt in statements(path.read_text()):
        # Deliberately exclude runtime functions, admin changes, grants and private tables.
        if not re.match(r'^(insert into public\.tracks\s*\(|update public\.tracks set\s)', stmt, re.I):
            continue
        if stmt.startswith('update') and not ('where lower(name)' in stmt or 'set location_approx = true' in stmt):
            raise ValueError('Review new static UPDATE before importing: ' + path.name)
        stmt = stmt.replace('public.tracks', 'tracks')
        stmt = re.sub(r'extensions\.st_setsrid\(extensions\.st_makepoint\(([-\d.]+),\s*([-\d.]+)\),\s*4326\)::extensions\.geography', r"'\1,\2'", stmt)
        db.execute(stmt)
        used.append(path.name)

regions = (source / 'src/lib/regions.ts').read_text()
departments = dict(re.findall(r"'(\d{2})': '([^']+)'", regions))
by_department = {}
for name, codes in re.findall(r"\{ name: '([^']+)', departments: \[([^\]]+)\]", regions):
    for code in re.findall(r"'(\d{2})'", codes):
        by_department[code] = name
tracks = []
for raw in db.execute('SELECT * FROM tracks ORDER BY lower(name), city'):
    row = dict(raw)
    lng, lat = map(float, row['location'].split(','))
    assert -6 < lng < 10 and 41 < lat < 52, row['name']
    postal = row['postal_code']
    assert re.fullmatch(r'\d{5}', postal), row['name']
    department = postal[:2]
    assert department in departments and department in by_department, department
    track = {key: row[key] for key in ['name', 'address', 'postal_code', 'city', 'length_m', 'kart_power', 'website', 'phone', 'description', 'booking_url']}
    track.update(id=hashlib.sha256((row['name'].lower()+'|'+row['city'].lower()).encode()).hexdigest()[:16],
                 lat=lat, lng=lng, is_indoor=bool(row['is_indoor']), location_approx=bool(row['location_approx']),
                 department=department, department_name=departments[department], region=by_department[department])
    for key in ['website', 'booking_url']:
        assert track[key] is None or track[key].startswith(('https://', 'http://')), (row['name'], key)
    tracks.append(track)
assert len(tracks) > 300
assert len({t['id'] for t in tracks}) == len(tracks)
sha = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
payload = {'source': 'https://github.com/maelvanden/KART-RIVALS', 'sourceCommit': sha, 'sourceFiles': sorted(set(used)), 'tracks': tracks}
(root / 'public/data/circuits.json').write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'{len(tracks)} circuits, {len(set(t["department"] for t in tracks))} départements, {sum(t["location_approx"] for t in tracks)} positions approximatives. Source: {sha}')
