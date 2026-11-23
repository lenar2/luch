#!/usr/bin/env python3
"""LUCH Home R7: public, bounded read-only website check. No AI bridge or host tools.
No third-party dependencies. Public service is entirely isolated from LUCH Core.
"""
from __future__ import annotations
import datetime as dt
import hashlib, hmac, html, http.client, ipaddress, json, os, pathlib, re
import secrets, signal, socket, sqlite3, ssl, threading, time, urllib.parse
from collections import defaultdict, deque
from contextlib import contextmanager
from html.parser import HTMLParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = pathlib.Path(__file__).resolve().parent.parent
WWW = HERE / "frontend"
DB = pathlib.Path(os.environ.get("LUCH_HOME_DB", "/state/home.sqlite"))
PORT = int(os.environ.get("PORT", "8080"))
PUBLIC_ORIGIN = "https://luch.lenarsalimov.ru"
MAX_BODY = 2048
SESSION_AGE = 14 * 86400
PBKDF_ROUNDS = 260000
rate_lock = threading.Lock()
rates: dict[str, deque] = defaultdict(deque)
db_setup_lock = threading.Lock()
site_semaphore = threading.BoundedSemaphore(6)

@contextmanager
def connect_db():
    c = sqlite3.connect(DB, timeout=8)
    try:
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA busy_timeout=8000")
        c.execute("PRAGMA foreign_keys=ON")
        with c:
            yield c
    finally:
        c.close()

def initialize():
    DB.parent.mkdir(parents=True, exist_ok=True)
    with db_setup_lock, connect_db() as c:
        c.execute("PRAGMA journal_mode=WAL")
        c.executescript("""
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
          salt BLOB NOT NULL, password_hash BLOB NOT NULL, created INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
          digest TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          csrf TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
        CREATE TABLE IF NOT EXISTS grants (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          origin TEXT NOT NULL, active INTEGER NOT NULL, created INTEGER NOT NULL,
          revoked INTEGER
        );
        CREATE INDEX IF NOT EXISTS grants_by_user ON grants(user_id, active);
        CREATE TABLE IF NOT EXISTS checks (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          grant_id TEXT NOT NULL REFERENCES grants(id),
          origin TEXT NOT NULL, at INTEGER NOT NULL,
          result TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS checks_by_user ON checks(user_id, at DESC);
        CREATE TABLE IF NOT EXISTS activity (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          event TEXT NOT NULL, detail TEXT NOT NULL, at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS activity_by_user ON activity(user_id, at DESC);
        """)
        c.execute("DELETE FROM sessions WHERE expires < ?", (int(time.time()),))
        # Public beta retention: bound activity and audit data to 90 days.
        cutoff=int(time.time())-90*86400
        c.execute("DELETE FROM checks WHERE at < ?", (cutoff,))
        c.execute("DELETE FROM activity WHERE at < ?", (cutoff,))

def limited(key, n, period):
    now = time.monotonic()
    with rate_lock:
        q = rates[key]
        while q and now - q[0] > period:
            q.popleft()
        if len(q) >= n:
            return True
        q.append(now)
        # cap growing unique keys for public traffic
        if len(rates) > 12000:
            for k in list(rates)[:2000]:
                if not rates[k] or now-rates[k][-1] > 180:
                    del rates[k]
        return False

def normalized_origin(raw):
    if not isinstance(raw, str) or len(raw) > 260:
        raise ValueError("Enter a public HTTPS website address.")
    raw = raw.strip()
    if not raw:
        raise ValueError("Enter a website address.")
    if "://" not in raw:
        raw = "https://" + raw
    try:
        u = urllib.parse.urlsplit(raw)
        hostname = (u.hostname or "").rstrip(".").lower()
    except ValueError:
        raise ValueError("Enter a valid website address.")
    if u.scheme.lower() != "https" or u.username or u.password or u.query or u.fragment:
        raise ValueError("Only a public HTTPS hostname is supported, without credentials or query.")
    if u.path not in ("", "/") or not hostname or ":" in hostname:
        raise ValueError("Enter a website origin, such as https://example.com.")
    try:
        if u.port not in (None, 443):
            raise ValueError("Only standard HTTPS port 443 is supported.")
    except ValueError:
        raise ValueError("Only standard HTTPS port 443 is supported.")
    try:
        host = hostname.encode("idna").decode("ascii")
    except (UnicodeError, ValueError):
        raise ValueError("Invalid website hostname.")
    if len(host) > 253 or "." not in host or any(len(p) < 1 or len(p) > 63 for p in host.split(".")):
        raise ValueError("Enter a public DNS website name.")
    if not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]*[a-z0-9])", host):
        raise ValueError("Invalid public domain name.")
    if any(p.startswith("-") or p.endswith("-") for p in host.split(".")):
        raise ValueError("Invalid domain name.")
    if host.endswith((".local", ".localhost", ".internal", ".test", ".invalid", ".onion", ".example", ".arpa")):
        raise ValueError("Private or reserved hostnames are not supported.")
    try:
        ipaddress.ip_address(host)
        raise ValueError("Direct IP addresses are not supported.")
    except ValueError as exc:
        if str(exc) == "Direct IP addresses are not supported.":
            raise
    return "https://" + host

def validated_ip(host):
    try:
        info = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM, proto=socket.IPPROTO_TCP)
    except (socket.gaierror, TimeoutError):
        raise ValueError("Unable to resolve the website address.")
    ips = []
    for entry in info:
        raw = entry[4][0]
        ip = ipaddress.ip_address(raw)
        if not ip.is_global:
            raise ValueError("Private or reserved network targets are blocked.")
        if raw not in ips:
            ips.append(raw)
    if not ips:
        raise ValueError("No public HTTPS endpoint found.")
    # Prefer public IPv4 endpoints: avoids unusable IPv6-only routes in the deployment network.
    ips.sort(key=lambda value: (ipaddress.ip_address(value).version != 4, value))
    return ips[:8]

class PublicPinnedHTTPS(http.client.HTTPSConnection):
    def __init__(self, hostname, address, timeout=7):
        super().__init__(hostname, port=443, timeout=timeout, context=ssl.create_default_context())
        self.address = address
    def connect(self):
        # A validated, pinned public IP: no DNS re-resolution on connect.
        sock = socket.create_connection((self.address, 443), timeout=self.timeout)
        try:
            self.sock = self._context.wrap_socket(sock, server_hostname=self.host)
        except Exception:
            sock.close()
            raise

class PageInfo(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title_parts = []
        self.in_title = False
        self.has_viewport = False
        self.lang = ""
        self.description = False
    def handle_starttag(self, tag, attrs):
        a = {k.lower(): v or "" for k,v in attrs if k}
        if tag == "title":
            self.in_title = True
        elif tag == "html":
            self.lang = (a.get("lang") or "")[:20]
        elif tag == "meta":
            self.has_viewport |= a.get("name", "").lower() == "viewport" and bool(a.get("content"))
            self.description |= a.get("name", "").lower() == "description" and bool(a.get("content"))
    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
    def handle_data(self, data):
        if self.in_title and sum(len(x) for x in self.title_parts) < 200:
            self.title_parts.append(data[:200])

def check_public_website(origin):
    hostname = origin[8:]
    ips = validated_ip(hostname)
    # The public site's own IP is not hairpin-reachable from its Docker network.
    # For THIS exact public hostname only, optionally use the trusted local Caddy
    # edge while still validating the public DNS and the domain's TLS certificate.
    # Never allow caller-controlled internal hostnames, ports or paths.
    if (hostname == "luch.lenarsalimov.ru" and
            os.environ.get("LUCH_HOME_SELF_EDGE") == "zagonx_caddy"):
        edge_addresses = socket.getaddrinfo("zagonx_caddy", 443, family=socket.AF_INET,
                                             type=socket.SOCK_STREAM)
        if not edge_addresses:
            raise ValueError("LUCH public edge is not available.")
        ips = [edge_addresses[0][4][0]]
    started = time.monotonic()
    conn = None
    try:
        conn = PublicPinnedHTTPS(hostname, ips[0])
        conn.request("GET", "/", headers={
            "Host": hostname, "User-Agent": "LUCH-Home-R7/1.0 (public website check)",
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.7",
            "Accept-Encoding": "identity", "Connection": "close"
        })
        reply = conn.getresponse()
        status = int(reply.status)
        ctype = (reply.getheader("Content-Type") or "").lower()[:120]
        content = reply.read(98304)
        elapsed = round((time.monotonic() - started) * 1000)
        html_ok = "text/html" in ctype or "application/xhtml+xml" in ctype
        page = PageInfo()
        if html_ok:
            try:
                page.feed(content.decode("utf-8", errors="replace"))
            except Exception:
                pass
        title = html.unescape(" ".join(page.title_parts).strip())[:180]
        observations = []
        if 200 <= status < 300:
            observations.append("Website responded successfully.")
        elif 300 <= status < 400:
            observations.append("Website returned a redirect; redirects were not followed.")
        else:
            observations.append("Website returned a non-success HTTP status.")
        if html_ok and not page.has_viewport:
            observations.append("No mobile viewport meta tag was found in the inspected HTML.")
        if html_ok and not title:
            observations.append("No HTML title was found in the inspected content.")
        if not html_ok:
            observations.append("Response was not HTML; page metadata was not inspected.")
        return {
            "origin": origin, "checked_at": int(time.time()), "http_status": status,
            "page_title": title or None, "mobile_viewport": page.has_viewport if html_ok else None,
            "page_language": page.lang or None, "meta_description": page.description if html_ok else None,
            "elapsed_ms": elapsed, "content_type": ctype, "bytes_examined": len(content),
            "sha256_prefix": hashlib.sha256(content).hexdigest()[:24],
            "observations": observations,
            "scope": "GET / over TLS; public hostname only; first 96 KiB; no redirects or page JavaScript"
        }
    except (TimeoutError, OSError, ssl.SSLError, http.client.HTTPException) as exc:
        raise ValueError("Unable to establish a verified HTTPS response for this website.")
    finally:
        if conn:
            conn.close()

def add_event(c, user_id, event, detail):
    c.execute("INSERT INTO activity(id,user_id,event,detail,at) VALUES (?,?,?,?,?)",
              (secrets.token_hex(12), user_id, event, detail[:140], int(time.time())))

class BoundedServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    def __init__(self, addr, handler):
        self.slots = threading.BoundedSemaphore(48)
        super().__init__(addr, handler)
    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            request.close()
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.slots.release()
            raise
    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.slots.release()

class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(12)  # Slow clients cannot exhaust threads indefinitely.
    server_version = "LUCH-Home"
    sys_version = ""
    protocol_version = "HTTP/1.1"
    def log_message(self, fmt, *args):
        # No path/query/body/password or session token in logs.
        print(json.dumps({"at":int(time.time()),"method":self.command,"code":args[1] if len(args)>1 else "-", "event":"http"}), flush=True)

    def send_payload(self, status, ctype, data, cookie=None):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
        self.send_header("Content-Security-Policy",
                         "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(data)

    def json(self, code, payload, cookie=None):
        data = json.dumps(payload,ensure_ascii=False,separators=(",",":")).encode("utf-8")
        self.send_payload(code, "application/json; charset=utf-8", data, cookie)

    def problem(self, code, message):
        self.json(code, {"ok":False, "error":message})

    def session(self, c):
        cookie = self.headers.get("Cookie","")
        m = re.search(r"(?:^|;)\s*luch_home_sid=([A-Za-z0-9_-]{30,100})(?:;|$)",cookie)
        if not m:
            return None
        digest = hashlib.sha256(m.group(1).encode()).hexdigest()
        row = c.execute("""SELECT sessions.digest, sessions.csrf, sessions.expires, users.id AS uid, users.username
                           FROM sessions JOIN users ON users.id=sessions.user_id
                           WHERE sessions.digest=? AND sessions.expires>=?""",
                        (digest,int(time.time()))).fetchone()
        return row

    def ip_key(self):
        # Outer Caddy normalizes X-Forwarded-For, and the inner site proxy
        # passes it as X-LUCH-Client-IP. Use the LAST valid forwarded IP so
        # client-supplied prefixes cannot bypass per-IP account rate limits.
        forwarded=(self.headers.get("X-LUCH-Client-IP") or "").split(",")
        for raw in reversed(forwarded):
            try:
                return str(ipaddress.ip_address(raw.strip()))
            except ValueError:
                continue
        return self.client_address[0]

    def post_body(self):
        if self.headers.get("Transfer-Encoding"):
            raise ValueError("Chunked requests are not supported.")
        try:
            n=int(self.headers.get("Content-Length","0"))
        except ValueError:
            n=0
        if not 1 <= n <= MAX_BODY or self.headers.get("Content-Type","").split(";")[0].strip() != "application/json":
            raise ValueError("Invalid or oversized JSON request.")
        try:
            data=json.loads(self.rfile.read(n))
        except (ValueError, UnicodeDecodeError):
            raise ValueError("Invalid JSON.")
        if not isinstance(data, dict):
            raise ValueError("Expected an object.")
        return data

    def check_origin(self):
        return self.headers.get("Origin") == PUBLIC_ORIGIN and self.headers.get("Sec-Fetch-Site","same-origin") in ("same-origin","none")

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        if path == "/healthz":
            try:
                with connect_db() as c:c.execute("SELECT 1").fetchone()
                return self.json(200,{"ok":True,"service":"luch-home-r7","ai_connected":False})
            except Exception:
                return self.problem(503,"Service unavailable.")
        if path in ("/","/index.html","/app.css","/app.js","/mark.svg","/brand-wordmark.svg"):
            name="index.html" if path in ("/","/index.html") else path[1:]
            f=WWW/name
            if not f.is_file() or f.is_symlink():
                return self.problem(404,"Not found.")
            mime={"html":"text/html; charset=utf-8","css":"text/css; charset=utf-8",
                  "js":"application/javascript; charset=utf-8","svg":"image/svg+xml"}
            data=f.read_bytes()
            return self.send_payload(200,mime[name.split(".")[-1]],data)
        if path == "/api/state":
            with connect_db() as c:
                s=self.session(c)
                if not s:
                    return self.json(200,{"ok":True,"authenticated":False,"ai_connected":False,
                                          "public_signup":True,"workflow":"website_check"})
                grant=c.execute("SELECT id,origin,created FROM grants WHERE user_id=? AND active=1 ORDER BY created DESC LIMIT 1",(s["uid"],)).fetchone()
                rows=c.execute("SELECT id,origin,at,result FROM checks WHERE user_id=? ORDER BY at DESC LIMIT 12",(s["uid"],)).fetchall()
                events=c.execute("SELECT event,detail,at FROM activity WHERE user_id=? ORDER BY at DESC LIMIT 20",(s["uid"],)).fetchall()
                return self.json(200,{"ok":True,"authenticated":True,"username":s["username"],"csrf":s["csrf"],
                    "grant":dict(grant) if grant else None,
                    "checks":[{"id":r["id"],"at":r["at"],"origin":r["origin"],"result":json.loads(r["result"])} for r in rows],
                    "events":[dict(e) for e in events],
                    "ai_connected":False,"workflow":"website_check"})
        return self.problem(404,"Not found.")

    def do_POST(self):
        path=urllib.parse.urlsplit(self.path).path
        if path not in ("/api/register","/api/login","/api/logout","/api/delete-account","/api/consent","/api/revoke","/api/check"):
            return self.problem(404,"Not found.")
        if not self.check_origin():
            return self.problem(403,"Request origin not authorized.")
        ip=self.ip_key()
        if limited("global:post",220,60) or limited("ip:"+ip+":"+path,24,60):
            return self.problem(429,"Too many requests. Try again later.")
        try:
            data=self.post_body()
        except ValueError as e:
            return self.problem(400,str(e))
        if path in ("/api/register","/api/login"):
            return self.auth(path,data,ip)
        with connect_db() as c:
            s=self.session(c)
            if not s:
                return self.problem(401,"Sign in to continue.")
            if not hmac.compare_digest(self.headers.get("X-LUCH-CSRF",""),s["csrf"]):
                return self.problem(403,"Session validation failed. Refresh and try again.")
            if path == "/api/logout":
                with c:
                    c.execute("DELETE FROM sessions WHERE digest=?",(s["digest"],))
                return self.json(200,{"ok":True},
                    "luch_home_sid=; Path=/home; HttpOnly; Secure; SameSite=Lax; Max-Age=0")
            if path == "/api/delete-account":
                if set(data)!={"username"} or data.get("username","").lower()!=s["username"]:
                    return self.problem(400,"Enter your exact username to delete the account.")
                with c:
                    c.execute("DELETE FROM users WHERE id=?",(s["uid"],))
                return self.json(200,{"ok":True,"deleted":True},
                    "luch_home_sid=; Path=/home; HttpOnly; Secure; SameSite=Lax; Max-Age=0")
            if path == "/api/consent":
                if set(data)!={"origin"}:
                    return self.problem(400,"Expected a website address.")
                try:
                    origin=normalized_origin(data["origin"])
                    validated_ip(origin[8:])  # Fail closed on reserved networks before granting.
                except ValueError as e:
                    return self.problem(400,str(e))
                with c:
                    c.execute("UPDATE grants SET active=0, revoked=? WHERE user_id=? AND active=1",(int(time.time()),s["uid"]))
                    grant_id=secrets.token_hex(16)
                    c.execute("INSERT INTO grants(id,user_id,origin,active,created) VALUES(?,?,?,?,?)",
                              (grant_id,s["uid"],origin,1,int(time.time())))
                    add_event(c,s["uid"],"CONSENT_GRANTED","Public HTTPS check: "+origin)
                return self.json(200,{"ok":True,"grant":{"id":grant_id,"origin":origin}})
            if path == "/api/revoke":
                with c:
                    rows=c.execute("UPDATE grants SET active=0,revoked=? WHERE user_id=? AND active=1",
                                   (int(time.time()),s["uid"])).rowcount
                    if rows:add_event(c,s["uid"],"ACCESS_REVOKED","Website inspection permission revoked.")
                return self.json(200,{"ok":True,"revoked":bool(rows)})
            if path == "/api/check":
                if data:
                    return self.problem(400,"The active website permission is used automatically.")
                if limited("user:"+s["uid"]+":check",15,3600) or limited("user:"+s["uid"]+":daily",50,86400):
                    return self.problem(429,"Website check limit reached. Try again later.")
                grant=c.execute("SELECT id,origin FROM grants WHERE user_id=? AND active=1 ORDER BY created DESC LIMIT 1",
                                (s["uid"],)).fetchone()
                if not grant:
                    return self.problem(403,"Grant website inspection permission first.")
                if not site_semaphore.acquire(False):
                    return self.problem(503,"Website checks are busy. Try again later.")
                try:
                    # DNS is validated afresh and TLS is pinned to the checked public IP.
                    result=check_public_website(grant["origin"])
                except ValueError as e:
                    return self.problem(422,str(e))
                finally:
                    site_semaphore.release()
                # Reject stale in-flight check if owner revoked or switched scope while it ran.
                row=c.execute("SELECT active FROM grants WHERE id=? AND user_id=?",(grant["id"],s["uid"])).fetchone()
                if not row or row["active"] != 1:
                    return self.problem(403,"Permission was revoked before the result was recorded.")
                check_id=secrets.token_hex(16)
                with c:
                    c.execute("INSERT INTO checks(id,user_id,grant_id,origin,at,result) VALUES (?,?,?,?,?,?)",
                              (check_id,s["uid"],grant["id"],grant["origin"],int(time.time()),json.dumps(result)))
                    add_event(c,s["uid"],"WEBSITE_CHECK",f'{grant["origin"]} · HTTP {result["http_status"]}')
                return self.json(200,{"ok":True,"check_id":check_id,"result":result})
        return self.problem(404,"Not found.")

    def auth(self,path,data,ip):
        if set(data)!={"username","password"}:
            return self.problem(400,"Username and password are required.")
        raw=data.get("username","")
        password=data.get("password","")
        if not isinstance(raw,str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{3,27}",raw):
            return self.problem(400,"Username must be 4–28 letters, numbers, underscores or hyphens.")
        if not isinstance(password,str) or not 12<=len(password)<=128 or len(password.encode("utf-8"))>300:
            return self.problem(400,"Use a unique password of 12–128 characters.")
        username=raw.lower()
        if path=="/api/register" and (limited("global:signup",35,3600) or limited("ip:"+ip+":signup",4,86400)):
            return self.problem(429,"Account creation limit reached. Try again later.")
        if limited("auth:"+ip+":"+username,7,300):
            return self.problem(429,"Too many attempts. Try again later.")
        salt=None
        with connect_db() as c:
            if path=="/api/register":
                if c.execute("SELECT 1 FROM users WHERE username=?",(username,)).fetchone():
                    return self.problem(409,"Username is already in use.")
                salt=secrets.token_bytes(24)
                digest=hashlib.pbkdf2_hmac("sha256",password.encode(),salt,PBKDF_ROUNDS)
                user_id=secrets.token_hex(16)
                try:
                    with c:
                        c.execute("INSERT INTO users(id,username,salt,password_hash,created) VALUES(?,?,?,?,?)",
                                  (user_id,username,salt,digest,int(time.time())))
                        add_event(c,user_id,"ACCOUNT_CREATED","Account created without an email address.")
                except sqlite3.IntegrityError:
                    return self.problem(409,"Username is already in use.")
            else:
                user=c.execute("SELECT id,salt,password_hash FROM users WHERE username=?",(username,)).fetchone()
                salt=user["salt"] if user else b"\0"*24
                digest=hashlib.pbkdf2_hmac("sha256",password.encode(),salt,PBKDF_ROUNDS)
                if not user or not hmac.compare_digest(digest,user["password_hash"]):
                    return self.problem(401,"Username or password is incorrect.")
                user_id=user["id"]
            sid=secrets.token_urlsafe(42)
            csrf=secrets.token_urlsafe(30)
            with c:
                c.execute("INSERT INTO sessions(digest,user_id,csrf,created,expires) VALUES(?,?,?,?,?)",
                          (hashlib.sha256(sid.encode()).hexdigest(),user_id,csrf,int(time.time()),int(time.time())+SESSION_AGE))
                add_event(c,user_id,"SIGNED_IN","Session created.")
            return self.json(200,{"ok":True,"authenticated":True,"username":username,"csrf":csrf},
                f"luch_home_sid={sid}; Path=/home; HttpOnly; Secure; SameSite=Lax; Max-Age={SESSION_AGE}")

if __name__=="__main__":
    initialize()
    httpd=BoundedServer(("0.0.0.0",PORT),Handler)
    def stop(signum,frame):
        threading.Thread(target=httpd.shutdown,daemon=True).start()
    signal.signal(signal.SIGTERM,stop)
    signal.signal(signal.SIGINT,stop)
    print(json.dumps({"service":"LUCH Home R7","port":PORT,"mode":"public website check; no AI or privileged relay"}),flush=True)
    httpd.serve_forever(poll_interval=.2)
    httpd.server_close()
