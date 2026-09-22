"""Vitacom local CMS. Run: python admin-server.py (loopback access only)."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from html.parser import HTMLParser
import base64, hashlib, hmac, json, mimetypes, os, secrets, shutil, threading, time
from urllib.parse import urlparse, unquote

ROOT = Path(__file__).resolve().parent
PRIVATE = ROOT / '.vitacom-admin'
PRIVATE.mkdir(exist_ok=True)
LOCK = threading.Lock()
SESSIONS = {}
ATTEMPTS = []
PORT = int(os.environ.get('VITACOM_ADMIN_PORT', '8766'))
ORIGIN = f'http://127.0.0.1:{PORT}'

def read(path, default=None):
    return json.loads(path.read_text('utf-8')) if path.exists() else default

def write(path, data):
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    temp.replace(path)

def state():
    return read(ROOT / 'content.json', {'version': 1, 'revision': 0, 'pages': {}, 'theme': {}})

def activity(action, detail=''):
    entries = read(PRIVATE / 'activity.json', [])
    entries.insert(0, {'at': time.strftime('%Y-%m-%d %H:%M:%S'), 'action': action, 'detail': detail})
    write(PRIVATE / 'activity.json', entries[:200])

class PageAudit(HTMLParser):
    def __init__(self):
        super().__init__(); self.title=''; self.in_title=False; self.description=''; self.images=[]; self.links=[]
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag=='title': self.in_title=True
        if tag=='meta' and attrs.get('name','').lower()=='description': self.description=attrs.get('content','').strip()
        if tag=='img': self.images.append((attrs.get('src',''),attrs.get('alt')))
        if tag=='a': self.links.append(attrs.get('href',''))
    def handle_endtag(self, tag):
        if tag=='title': self.in_title=False
    def handle_data(self, data):
        if self.in_title: self.title+=data

def site_health():
    current=state(); issues=[]; pages=[]; checked_links=0; checked_images=0
    for slug in ('index','products','services'):
        path=ROOT/f'{slug}.html'; parser=PageAudit()
        if not path.exists():
            issues.append({'level':'error','page':slug,'title':'Fail halaman tiada','detail':f'{slug}.html tidak ditemui.'}); continue
        parser.feed(path.read_text('utf-8',errors='replace'))
        config=current.get('pages',{}).get(slug,{})
        title=config.get('title',parser.title.strip()); description=config.get('description',parser.description)
        if not title: issues.append({'level':'error','page':slug,'title':'Tajuk halaman tiada','detail':'Tambah tajuk melalui Tetapan halaman / SEO.'})
        elif len(title)>65: issues.append({'level':'warning','page':slug,'title':'Tajuk SEO agak panjang','detail':f'{len(title)} aksara; sasarkan sekitar 30–65.'})
        if not description: issues.append({'level':'warning','page':slug,'title':'Penerangan SEO tiada','detail':'Tambah penerangan melalui Tetapan halaman / SEO.'})
        elif len(description)>170: issues.append({'level':'warning','page':slug,'title':'Penerangan SEO agak panjang','detail':f'{len(description)} aksara; sasarkan sekitar 120–170.'})
        # Empty alt is valid for decorative images; only a missing attribute is an issue.
        missing_alt=sum(alt is None for _,alt in parser.images); checked_images+=len(parser.images)
        if missing_alt: issues.append({'level':'warning','page':slug,'title':'Gambar tiada penerangan alt','detail':f'{missing_alt} gambar perlu penerangan untuk aksesibiliti dan carian.'})
        for value in [src for src,_ in parser.images]+parser.links:
            if not value or value.startswith(('#','mailto:','tel:','javascript:')): continue
            parsed=urlparse(value)
            if parsed.scheme in ('http','https'): continue
            checked_links+=1; target=(ROOT/parsed.path.lstrip('/')).resolve()
            if parsed.path and target.is_relative_to(ROOT) and not target.exists(): issues.append({'level':'error','page':slug,'title':'Pautan atau fail tidak ditemui','detail':value})
        pages.append({'slug':slug,'title':title or slug,'descriptionLength':len(description or ''),'images':len(parser.images),'links':len(parser.links)})
    errors=sum(i['level']=='error' for i in issues); warnings=sum(i['level']=='warning' for i in issues); score=max(0,100-errors*15-warnings*5)
    uploads=ROOT/'assets'/'uploads'; upload_files=[p for p in uploads.rglob('*') if p.is_file()] if uploads.exists() else []; usage=shutil.disk_usage(ROOT)
    return {'score':score,'status':'Baik' if score>=90 else 'Perlu perhatian' if score>=65 else 'Kritikal','issues':issues,'pages':pages,'checkedLinks':checked_links,'checkedImages':checked_images,'revision':current.get('revision',0),'uploads':len(upload_files),'uploadBytes':sum(p.stat().st_size for p in upload_files),'diskFree':usage.free,'server':'Vitacom Studio Local 1.1'}

def valid_url(value, image=False):
    if not isinstance(value, str) or len(value) > 3000 or any(ord(c) < 32 for c in value):
        return False
    parsed = urlparse(value)
    if value.startswith('//') or '\\' in value:
        return False
    return parsed.scheme in (('', 'https', 'http') if image else ('', 'https', 'http', 'mailto', 'tel'))

def validate(data):
    if not isinstance(data, dict) or data.get('version') != 1:
        raise ValueError('Format kandungan tidak sah.')
    pages = data.get('pages', {})
    if not isinstance(pages, dict) or any(p not in ('index', 'products', 'services') for p in pages):
        raise ValueError('Halaman tidak sah.')
    theme = data.get('theme', {})
    if not isinstance(theme, dict) or any(k not in ('accent', 'font') for k in theme):
        raise ValueError('Tema tidak sah.')
    import re
    settings = data.get('settings', {})
    if not isinstance(settings, dict) or any(k not in ('announcement', 'announcementEnabled', 'announcementLink', 'announcementLabel') for k in settings):
        raise ValueError('Tetapan website tidak sah.')
    for key in ('announcement', 'announcementLabel'):
        if key in settings and (not isinstance(settings[key], str) or len(settings[key]) > 500): raise ValueError('Pengumuman maksimum 500 aksara.')
    if 'announcementEnabled' in settings and not isinstance(settings['announcementEnabled'], bool): raise ValueError('Status pengumuman tidak sah.')
    if 'announcementLink' in settings and not valid_url(settings['announcementLink']): raise ValueError('Pautan pengumuman tidak sah.')
    if theme.get('accent') and not re.fullmatch(r'#[0-9a-fA-F]{6}', theme['accent']):
        raise ValueError('Warna tidak sah.')
    if theme.get('font') and theme['font'] not in ('Inter', 'Arial', 'Georgia'):
        raise ValueError('Font tidak sah.')
    for page in pages.values():
        if not isinstance(page, dict): raise ValueError('Halaman tidak sah.')
        if len(json.dumps(page)) > 1000000: raise ValueError('Kandungan terlalu besar.')
        for key in ('title', 'description'):
            if key in page and (not isinstance(page[key], str) or len(page[key]) > 2000): raise ValueError('Metadata terlalu panjang.')
        for key, patch in page.get('fields', {}).items():
            if not re.fullmatch(r'[til]\d+', key) or not isinstance(patch, dict): raise ValueError('Medan tidak sah.')
            if 'text' in patch and (not isinstance(patch['text'], str) or len(patch['text']) > 20000): raise ValueError('Teks terlalu panjang.')
            for attr in ('src', 'href'):
                if attr in patch and not valid_url(patch[attr], attr == 'src'): raise ValueError('Pautan tidak sah. Gunakan HTTP, HTTPS atau pautan laman.')
            if 'alt' in patch and not isinstance(patch['alt'], str): raise ValueError('Alt tidak sah.')
            if patch.get('color') and not re.fullmatch(r'#[0-9a-fA-F]{6}', patch['color']): raise ValueError('Warna teks tidak sah.')
            if patch.get('size') and (not isinstance(patch['size'], (int, float)) or not 10 <= patch['size'] <= 120): raise ValueError('Saiz teks mestilah 10–120.')
        for key, section in page.get('sections', {}).items():
            if not re.fullmatch(r's\d+', key) or not isinstance(section, dict): raise ValueError('Seksyen tidak sah.')
        if not isinstance(page.get('order', []), list) or any(not re.fullmatch(r's\d+', s) for s in page.get('order', [])): raise ValueError('Susunan tidak sah.')
        if not isinstance(page.get('custom', []), list) or len(page.get('custom', [])) > 30: raise ValueError('Maksimum 30 seksyen tambahan.')
        for block in page.get('custom', []):
            if not isinstance(block, dict): raise ValueError('Blok tidak sah.')
            for key in ('title', 'text', 'button', 'alt', 'id'):
                if key in block and (not isinstance(block[key], str) or len(block[key]) > 20000): raise ValueError('Blok terlalu panjang.')
            for key in ('image', 'href'):
                if block.get(key) and not valid_url(block[key], key == 'image'): raise ValueError('Pautan blok tidak sah.')
    return data

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        pass

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def json(self, code, data, cookie=None):
        raw = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        if cookie: self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(raw)

    def authorized(self):
        return SESSIONS.get(self.session_token(), 0) > time.time()

    def session_token(self):
        cookies = dict(x.strip().split('=', 1) for x in self.headers.get('Cookie', '').split(';') if '=' in x)
        return cookies.get('vitacom_session')

    def host_valid(self):
        return self.headers.get('Host') in (f'127.0.0.1:{PORT}', f'localhost:{PORT}')

    def do_GET(self):
        if not self.host_valid(): return self.json(403, {'error': 'Host tidak dibenarkan.'})
        path = unquote(urlparse(self.path).path)
        if path == '/api/session':
            return self.json(200, {'authenticated': self.authorized(), 'setup': not (PRIVATE / 'auth.json').exists()})
        if path.startswith('/api/'):
            if not self.authorized(): return self.json(401, {'error': 'Sila log masuk.'})
            if path == '/api/state': return self.json(200, state())
            if path == '/api/history': return self.json(200, read(PRIVATE / 'history.json', []))
            if path == '/api/activity': return self.json(200, read(PRIVATE / 'activity.json', []))
            if path == '/api/site-health': return self.json(200, site_health())
            if path == '/api/account':
                return self.json(200, {'name': read(PRIVATE / 'profile.json', {}).get('name', 'Admin Vitacom'), 'sessions': sum(expiry > time.time() for expiry in list(SESSIONS.values())), 'expiresAt': SESSIONS.get(self.session_token()), 'passwordChangedAt': read(PRIVATE / 'profile.json', {}).get('passwordChangedAt')})
            if path == '/api/media':
                files = [{'src': p.relative_to(ROOT).as_posix(), 'name': p.name, 'size': p.stat().st_size, 'modified': p.stat().st_mtime} for p in (ROOT / 'assets').rglob('*') if p.is_file() and p.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp', '.gif')]
                return self.json(200, files)
            return self.json(404, {'error': 'Tidak ditemui.'})
        if path == '/': path = '/index.html'
        if path == '/admin': path = '/admin.html'
        resolved = (ROOT / path.lstrip('/')).resolve()
        allowed = resolved.is_relative_to(ROOT) and not any(p.startswith('.') for p in Path(path).parts if p != '/') and resolved.suffix.lower() in ('.html', '.css', '.js', '.json', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico', '.svg', '.woff2')
        if not allowed or not resolved.is_file(): return self.json(404, {'error': 'Fail tidak ditemui.'})
        self.path = path
        super().do_GET()

    def do_POST(self):
        if not self.host_valid() or self.headers.get('Origin') not in (ORIGIN, f'http://localhost:{PORT}'):
            return self.json(403, {'error': 'Permintaan bukan dari halaman admin ini.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 8 * 1024 * 1024: return self.json(413, {'error': 'Fail terlalu besar. Maksimum gambar 5 MB.'})
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict): raise ValueError('Permintaan tidak sah.')
            path = urlparse(self.path).path
            with LOCK:
                if path in ('/api/setup', '/api/login'):
                    now = time.time()
                    ATTEMPTS[:] = [t for t in ATTEMPTS if now-t < 300]
                    if len(ATTEMPTS) >= 10: return self.json(429, {'error': 'Terlalu banyak percubaan. Cuba lagi dalam 5 minit.'})
                    ATTEMPTS.append(now)
                    password = body.get('password', '')
                    if not isinstance(password, str) or not 10 <= len(password) <= 200: raise ValueError('Kata laluan mesti 10–200 aksara.')
                    auth = read(PRIVATE / 'auth.json')
                    if path == '/api/setup':
                        if auth: return self.json(409, {'error': 'Akaun sudah wujud. Sila log masuk.'})
                        salt = secrets.token_hex(16)
                        digest = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 600000).hex()
                        write(PRIVATE / 'auth.json', {'salt': salt, 'hash': digest})
                    else:
                        if not auth: return self.json(400, {'error': 'Sediakan akaun dahulu.'})
                        digest = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(auth['salt']), 600000).hex()
                        if not hmac.compare_digest(auth['hash'], digest): return self.json(401, {'error': 'Kata laluan tidak betul.'})
                    ATTEMPTS.clear()
                    token = secrets.token_urlsafe(32)
                    SESSIONS[token] = now + 8*3600
                    activity('Akaun dicipta' if path == '/api/setup' else 'Log masuk')
                    return self.json(200, {'ok': True}, f'vitacom_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800')
                if not self.authorized(): return self.json(401, {'error': 'Sesi tamat. Sila log masuk semula.'})
                if path == '/api/profile':
                    name = body.get('name', '')
                    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80: raise ValueError('Nama mesti 1–80 aksara.')
                    profile = read(PRIVATE / 'profile.json', {})
                    profile['name'] = name.strip()
                    write(PRIVATE / 'profile.json', profile)
                    activity('Profil dikemas kini')
                    return self.json(200, {'ok': True})
                if path == '/api/revoke-sessions':
                    current_token = self.session_token()
                    for token in list(SESSIONS):
                        if token != current_token: del SESSIONS[token]
                    activity('Sesi lain ditamatkan')
                    return self.json(200, {'ok': True})
                if path == '/api/password':
                    now = time.time()
                    ATTEMPTS[:] = [t for t in ATTEMPTS if now-t < 300]
                    if len(ATTEMPTS) >= 10: return self.json(429, {'error': 'Terlalu banyak percubaan. Cuba lagi dalam 5 minit.'})
                    ATTEMPTS.append(now)
                    old, new = body.get('currentPassword'), body.get('newPassword')
                    if not isinstance(old, str) or len(old) > 200 or not isinstance(new, str) or not 10 <= len(new) <= 200: raise ValueError('Kata laluan baharu mesti 10–200 aksara.')
                    auth = read(PRIVATE / 'auth.json')
                    digest = hashlib.pbkdf2_hmac('sha256', old.encode(), bytes.fromhex(auth['salt']), 600000).hex()
                    if not hmac.compare_digest(auth['hash'], digest): return self.json(400, {'error': 'Kata laluan semasa tidak betul.'})
                    if old == new: raise ValueError('Gunakan kata laluan yang berbeza.')
                    salt = secrets.token_hex(16)
                    write(PRIVATE / 'auth.json', {'salt': salt, 'hash': hashlib.pbkdf2_hmac('sha256', new.encode(), bytes.fromhex(salt), 600000).hex()})
                    profile = read(PRIVATE / 'profile.json', {})
                    profile['passwordChangedAt'] = time.strftime('%Y-%m-%d %H:%M:%S')
                    write(PRIVATE / 'profile.json', profile)
                    SESSIONS.clear()
                    token = secrets.token_urlsafe(32)
                    SESSIONS[token] = now + 8*3600
                    ATTEMPTS.clear()
                    activity('Kata laluan ditukar', 'Semua sesi lama ditamatkan.')
                    return self.json(200, {'ok': True}, f'vitacom_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800')
                if path == '/api/validate':
                    return self.json(200, validate(body.get('state')))
                if path == '/api/logout':
                    activity('Log keluar')
                    for token in list(SESSIONS):
                        if token in self.headers.get('Cookie', ''): del SESSIONS[token]
                    return self.json(200, {'ok': True}, 'vitacom_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
                if path == '/api/save':
                    incoming = validate(body.get('state'))
                    current = state()
                    if body.get('revision') != current['revision']: return self.json(409, {'error': 'Kandungan telah berubah di sesi lain. Eksport draf dahulu, kemudian muat semula.'})
                    history = read(PRIVATE / 'history.json', [])
                    history.insert(0, {'at': time.strftime('%Y-%m-%d %H:%M:%S'), 'state': current})
                    incoming['revision'] = current['revision'] + 1
                    write(ROOT / 'content.json', incoming)
                    if (ROOT / 'dist').exists(): write(ROOT / 'dist/content.json', incoming)
                    write(PRIVATE / 'history.json', history[:20])
                    activity('Website disimpan', f"Versi {incoming['revision']}")
                    return self.json(200, incoming)
                if path == '/api/upload':
                    raw = base64.b64decode(body.get('data', ''), validate=True)
                    if len(raw) > 5*1024*1024: raise ValueError('Maksimum gambar 5 MB.')
                    ext = '.png' if raw.startswith(b'\x89PNG\r\n\x1a\n') else '.jpg' if raw.startswith(b'\xff\xd8\xff') else '.gif' if raw.startswith((b'GIF87a', b'GIF89a')) else '.webp' if raw.startswith(b'RIFF') and raw[8:12] == b'WEBP' else None
                    if not ext: raise ValueError('Gunakan gambar PNG, JPG, GIF atau WebP.')
                    rel = 'assets/uploads/' + secrets.token_hex(12) + ext
                    for folder in (ROOT, ROOT / 'dist'):
                        destination = folder / rel
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        destination.write_bytes(raw)
                    activity('Gambar dimuat naik', rel)
                    return self.json(200, {'src': rel, 'name': rel.split('/')[-1]})
            self.json(404, {'error': 'Tidak ditemui.'})
        except (ValueError, TypeError, KeyError, AttributeError) as error:
            self.json(400, {'error': str(error) or 'Permintaan tidak sah.'})
        except Exception:
            self.json(500, {'error': 'Tidak dapat menyimpan. Semak ruang cakera dan cuba lagi.'})

if __name__ == '__main__':
    print(f'Vitacom Admin: {ORIGIN}/admin.html', flush=True)
    print('Local access only. Ctrl+C to stop.', flush=True)
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
