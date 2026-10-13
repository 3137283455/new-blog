"""Self-hosted HTTP service. Place behind HTTPS Nginx in production."""
import csv
import hashlib
import hmac
import io
import json
import mimetypes
import os
import re
import threading
import logging
import time
import tarfile
from datetime import datetime
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from .accounting import summarize, history, period, DEFAULTS
from .storage import Store

ROOT = Path(__file__).resolve().parent.parent


class BoundedHTTPServer(ThreadingHTTPServer):
    """Bound concurrent work for a small personal monitoring deployment."""
    daemon_threads = True

    def __init__(self, *args, **kwargs):
        self.slots = threading.BoundedSemaphore(4)
        super().__init__(*args, **kwargs)

    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            self.shutdown_request(request)
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


def load_env(path):
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip() and not line.lstrip().startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


class Application:
    def __init__(self, data_dir, password, user="admin", base="/traffic", public_url="", secure=True):
        if len(password) < 16 or password.startswith("replace-"):
            raise ValueError("请先生成 .env；管理密码至少 16 个字符")
        if base and not re.fullmatch(r"(/[a-zA-Z0-9_-]+)+", base):
            raise ValueError("BASE_PATH 格式无效")
        self.store, self.user, self.base = Store(data_dir), user, base
        self.public_url, self.secure = public_url.rstrip("/"), secure
        with self.store.connect() as db:
            previous = db.execute("SELECT value FROM metadata WHERE key='admin_auth'").fetchone()
            saved = json.loads(previous[0]) if previous else None
            self.salt = bytes.fromhex(saved["salt"]) if saved else os.urandom(16)
            self.password_hash = self.hash_password(password)
            if saved and (saved["hash"] != self.password_hash.hex() or saved["user"] != user):
                db.execute("DELETE FROM sessions")
            identity = {"salt": self.salt.hex(), "hash": self.password_hash.hex(), "user": user}
            db.execute("INSERT INTO metadata VALUES ('admin_auth',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (json.dumps(identity),))
        self.attempts, self.ingest_hits, self.lock = {}, {}, threading.Lock()

    def ingest_allowed(self, node_id):
        with self.lock:
            now = time.time()
            self.ingest_hits = {k: [t for t in v if now - t < 60] for k, v in self.ingest_hits.items() if any(now - t < 60 for t in v)}
            if len(self.ingest_hits) > 1000:
                return False
            hits = self.ingest_hits.setdefault(node_id, [])
            if len(hits) >= 60:
                return False
            hits.append(now)
            return True

    def hash_password(self, value):
        return hashlib.scrypt(value.encode(), salt=self.salt, n=16384, r=8, p=1)

    def login_allowed(self, ip):
        with self.lock:
            now = time.time()
            self.attempts = {k: [t for t in v if now - t < 600] for k, v in self.attempts.items() if any(now - t < 600 for t in v)}
            hits = self.attempts.setdefault(ip, [])
            if len(hits) >= 10:
                return False
            hits.append(now)
            return True

    def view(self, node, now=None, details=True):
        now = int(time.time()) if now is None else now
        rows = self.store.buckets(node["id"])
        current = period(node["config"], now)[0].date().isoformat()
        config = self.store.effective_config(node["id"], node["config"], current)
        summary = summarize(config, rows, now, node["last_received"])
        sources = self.store.sources(node["id"])
        summary["source_review"] = any(r["review_needed"] for r in sources)
        if summary["source_review"]:
            summary["reliable"] = False
        # A first heartbeat proves connectivity even before vnStat has a completed bucket.
        connection = ("waiting" if node["last_received"] is None else
                      "offline" if now - node["last_received"] > 900 else
                      "collecting" if summary["last_sample"] is None else
                      "delayed" if summary["stale"] else "online")
        result = {**node, "config": config, "summary": summary, "connection": connection,
                  "agent": self.store.agent_info(node["id"])}
        if not details:
            return result
        months = []
        point = now
        for _ in range(12):
            cycle = period(node["config"], point)[0].date().isoformat()
            cfg = self.store.effective_config(node["id"], node["config"], cycle)
            m = summarize(cfg, rows, point, node["last_received"])
            months.append({k: m[k] for k in ("cycle", "start", "end", "rx", "tx", "used", "complete", "baseline_applied", "recorded_buckets")})
            point = m["start"] - 1
        return {**result, "daily": history(config, rows, now, 90),
                "months": months, "sources": sources, "alerts": self.store.record_alerts(node["id"], summary, now)}


def handler_for(app):
    class Handler(BaseHTTPRequestHandler):
        server_version = "TrafficMonitor"

        def setup(self):
            super().setup()
            self.connection.settimeout(15)

        def log_message(self, fmt, *args):
            # Do not log cookies, tokens, request bodies, query strings, or user-supplied paths.
            pass

        def send(self, code, content=b"", content_type="application/json; charset=utf-8", headers=None):
            if isinstance(content, (dict, list)):
                content = json.dumps(content, ensure_ascii=False).encode()
            elif isinstance(content, str):
                content = content.encode()
            self.send_response(code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'")
            for k, v in (headers or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(content)

        def cookie(self, token, max_age=604800):
            return f"traffic_session={token}; Path={app.base or '/'}; HttpOnly; SameSite=Strict; Max-Age={max_age}" + ("; Secure" if app.secure else "")

        def session_token(self):
            try:
                c = SimpleCookie(self.headers.get("Cookie", ""))
                return c["traffic_session"].value if "traffic_session" in c else ""
            except Exception:
                return ""

        def authorized(self):
            if self.blog_authenticated():
                return True
            if not app.store.authenticated(self.session_token()):
                self.send(401, {"error": "请先登录"})
                return False
            return True

        def blog_authenticated(self):
            expected = os.environ.get("TRAFFIC_BRIDGE_KEY", "")
            incoming = self.headers.get("X-Blog-Traffic-Key", "")
            return bool(expected and incoming and hmac.compare_digest(expected, incoming))

        def body(self):
            if self.headers.get("Transfer-Encoding"):
                raise ValueError("不支持分块请求体")
            n = int(self.headers.get("Content-Length", "0"))
            if not 0 < n <= 2_000_000:
                raise ValueError("请求体必须介于 1 字节与 2MB 之间")
            if self.headers.get_content_type() != "application/json":
                raise ValueError("需要 JSON 请求")
            value = json.loads(self.rfile.read(n))
            if not isinstance(value, dict):
                raise ValueError("请求格式无效")
            return value

        def route(self):
            parsed = urlsplit(self.path)
            if parsed.path == app.base:
                self.send(308, headers={"Location": app.base + "/"})
                return None
            if not parsed.path.startswith(app.base + "/"):
                self.send(404, {"error": "页面不存在"})
                return None
            return parsed.path[len(app.base):]

        def do_GET(self):
            try:
                self.get()
            except (BrokenPipeError, ConnectionResetError):
                pass
            except Exception as exc:
                logging.error("GET failed (%s)", type(exc).__name__)
                self.send(500, {"error": "读取失败，请检查服务日志或重试"})

        def get(self):
            path = self.route()
            if path is None:
                return
            if path == "/api/health":
                self.send(200, {"status": "ok"})
            elif path == "/api/session":
                origin = self.headers.get("X-Blog-Public-Origin", app.public_url) if self.blog_authenticated() else app.public_url
                self.send(200, {"authenticated": self.blog_authenticated() or app.store.authenticated(self.session_token()), "user": app.user,
                                "ingest_url": origin + app.base + "/api/ingest" if origin else ""})
            elif path == "/api/nodes":
                if self.authorized():
                    self.send(200, {"nodes": [app.view(n) for n in app.store.nodes()], "defaults": DEFAULTS, "now": int(time.time())})
            elif path == "/api/fleet":
                if self.authorized():
                    self.send(200, {"nodes": [app.view(n, details=False) for n in app.store.nodes()], "now": int(time.time())})
            elif re.fullmatch(r"/api/nodes/[a-f0-9]{16}", path):
                if self.authorized():
                    node = next((n for n in app.store.nodes() if n["id"] == path.split("/")[3]), None)
                    self.send(200, app.view(node)) if node else self.send(404, {"error": "节点不存在"})
            elif re.fullmatch(r"/api/nodes/[a-f0-9]{16}/export", path):
                if not self.authorized():
                    return
                node_id = path.split("/")[3]
                node = next((n for n in app.store.nodes() if n["id"] == node_id), None)
                if not node:
                    self.send(404, {"error": "节点不存在"})
                    return
                stream = io.StringIO()
                writer = csv.writer(stream)
                writer.writerow(["date", "rx_bytes", "tx_bytes", "usage_bytes", "recorded_5min_buckets"])
                for r in app.view(node)["daily"]:
                    writer.writerow([r[k] for k in ("date", "rx", "tx", "used", "samples")])
                self.send(200, "\ufeff" + stream.getvalue(), "text/csv; charset=utf-8", {"Content-Disposition": 'attachment; filename="traffic-daily.csv"'})
            elif path in ("/", "/app.js", "/style.css"):
                file = ROOT / "web" / ({"/": "index.html"}.get(path, path[1:]))
                self.send(200, file.read_bytes(), mimetypes.guess_type(file.name)[0] + "; charset=utf-8")
            else:
                self.send(404, {"error": "页面不存在"})

        def do_POST(self):
            try:
                self.post()
            except PermissionError:
                self.send(401, {"error": "上报认证失败"})
            except KeyError:
                self.send(404, {"error": "节点不存在或参数缺失"})
            except (ValueError, TypeError, json.JSONDecodeError) as e:
                self.send(400, {"error": str(e)[:160]})
            except (BrokenPipeError, ConnectionResetError):
                pass
            except Exception as exc:
                logging.error("POST failed (%s)", type(exc).__name__)
                self.send(500, {"error": "保存失败，请重试"})

        def post(self):
            path = self.route()
            if path is None:
                return
            data = self.body()
            if path == "/api/ingest":
                bearer = self.headers.get("Authorization", "")
                if not bearer.startswith("Bearer "):
                    raise PermissionError()
                if not isinstance(data.get("node_id"), str) or not re.fullmatch(r"[a-f0-9]{16}", data["node_id"]):
                    raise ValueError("节点 ID 格式无效")
                if not app.store.valid_token(data["node_id"], bearer[7:]):
                    raise PermissionError()
                if not app.ingest_allowed(data["node_id"]):
                    self.send(429, {"error": "上报频率过高，请稍后重试"})
                    return
                count = app.store.ingest(data["node_id"], bearer[7:], data["generation"], data["buckets"], agent=data.get("agent"))
                node = next(n for n in app.store.nodes() if n["id"] == data["node_id"])
                view = app.view(node, details=False)
                app.store.record_alerts(node["id"], view["summary"], int(time.time()))
                self.send(200, {"accepted": count})
                return
            # Custom headers cannot be submitted by cross-origin forms; no CORS is enabled.
            if self.headers.get("X-Traffic-Request") != "1":
                self.send(403, {"error": "请求来源无效"})
                return
            origin = self.headers.get("Origin")
            expected = app.public_url or ("http://" + self.headers.get("Host", ""))
            if origin and origin != expected and not self.blog_authenticated():
                self.send(403, {"error": "请求来源与 PUBLIC_URL 不匹配"})
                return
            if path == "/api/login":
                if not app.login_allowed(self.client_address[0]):
                    self.send(429, {"error": "尝试次数过多，请 10 分钟后重试"})
                    return
                pw = data.get("password", "")
                if not isinstance(pw, str) or len(pw) > 512:
                    raise ValueError("密码格式无效")
                good = hmac.compare_digest(app.hash_password(pw), app.password_hash)
                if data.get("user") != app.user or not good:
                    self.send(401, {"error": "账号或密码错误"})
                else:
                    self.send(200, {"ok": True}, headers={"Set-Cookie": self.cookie(app.store.session())})
                return
            if not self.authorized():
                return
            if path == "/api/logout":
                app.store.logout(self.session_token())
                self.send(200, {"ok": True}, headers={"Set-Cookie": self.cookie("", 0)})
            elif path == "/api/nodes":
                node_id, token = app.store.create_node(data)
                self.send(201, {"node_id": node_id, "token": token})
            elif re.fullmatch(r"/api/nodes/[a-f0-9]{16}/package", path):
                node_id = path.split("/")[3]
                token = data.get("token", "")
                if not isinstance(token, str) or not app.store.valid_token(node_id, token):
                    raise PermissionError()
                node = next(n for n in app.store.nodes() if n["id"] == node_id)
                origin = self.headers.get("X-Blog-Public-Origin", app.public_url) if self.blog_authenticated() else app.public_url
                origin = origin or ("http://" + self.headers.get("Host", ""))
                config = (f"INGEST_URL={origin}{app.base}/api/ingest\nNODE_ID={node_id}\nINGEST_TOKEN={token}\n"
                          f"INTERFACE={node['config']['interface']}\nSTATE_DIR=/var/lib/traffic-agent\n")
                buf = io.BytesIO()
                with tarfile.open(fileobj=buf, mode="w:gz") as archive:
                    for name in ("agent/collector.py", "deploy/install-agent.sh", "deploy/traffic-agent.service", "deploy/traffic-agent.timer"):
                        archive.add(ROOT / name, arcname=name, recursive=False)
                    info = tarfile.TarInfo("traffic-agent.env")
                    raw = config.encode()
                    info.size, info.mode = len(raw), 0o600
                    archive.addfile(info, io.BytesIO(raw))
                self.send(200, buf.getvalue(), "application/gzip", {"Content-Disposition": f'attachment; filename="traffic-agent-{node_id}.tar.gz"'})
            elif re.fullmatch(r"/api/nodes/[a-f0-9]{16}/settings", path):
                app.store.update_node(path.split("/")[3], data)
                self.send(200, {"ok": True})
            elif re.fullmatch(r"/api/nodes/[a-f0-9]{16}/rotate", path):
                self.send(200, {"token": app.store.rotate(path.split("/")[3])})
            elif re.fullmatch(r"/api/nodes/[a-f0-9]{16}/ack-sources", path):
                app.store.acknowledge_sources(path.split("/")[3])
                self.send(200, {"ok": True})
            else:
                self.send(404, {"error": "接口不存在"})
    return Handler


def main():
    load_env(ROOT / ".env")
    app = Application(os.environ.get("DATA_DIR", str(ROOT / "data")), os.environ.get("ADMIN_PASSWORD", ""),
                      os.environ.get("ADMIN_USER", "admin"), os.environ.get("BASE_PATH", "/traffic").rstrip("/"),
                      os.environ.get("PUBLIC_URL", ""), os.environ.get("COOKIE_SECURE", "true").lower() == "true")
    if os.environ.get("BOOTSTRAP_FILE"):
        for node in json.loads(Path(os.environ["BOOTSTRAP_FILE"]).read_text(encoding="utf-8")):
            app.store.bootstrap_node(node["id"], node["token"], node["config"])
    host, port = os.environ.get("LISTEN_HOST", "127.0.0.1"), int(os.environ.get("PORT", "8098"))
    httpd = BoundedHTTPServer((host, port), handler_for(app))
    httpd.daemon_threads = True
    print(f"Traffic Monitor listening on http://{host}:{port}{app.base}/", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
