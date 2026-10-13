import hashlib
import json
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from .accounting import validate_config, DEFAULTS

SCHEMA = """
CREATE TABLE IF NOT EXISTS nodes (
 id TEXT PRIMARY KEY, config TEXT NOT NULL, token_hash TEXT NOT NULL,
 created INTEGER NOT NULL, last_received INTEGER
);
CREATE TABLE IF NOT EXISTS buckets (
 node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
 start INTEGER NOT NULL, rx INTEGER NOT NULL, tx INTEGER NOT NULL,
 generation TEXT NOT NULL, PRIMARY KEY(node_id, start)
);
CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS agents (
 node_id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE, info TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ssh_polls (
 node_id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
 last_attempt INTEGER NOT NULL, last_success INTEGER, error TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS baselines (
 node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
 cycle TEXT NOT NULL, bytes INTEGER NOT NULL, cutover INTEGER NOT NULL,
 PRIMARY KEY(node_id,cycle)
);
CREATE TABLE IF NOT EXISTS sources (
 node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
 generation TEXT NOT NULL, first_seen INTEGER NOT NULL, review_needed INTEGER NOT NULL,
 PRIMARY KEY(node_id,generation)
);
CREATE TABLE IF NOT EXISTS alerts (
 node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
 cycle TEXT NOT NULL, threshold INTEGER NOT NULL, created INTEGER NOT NULL,
 PRIMARY KEY(node_id, cycle, threshold)
);
"""


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


class Store:
    def __init__(self, directory):
        Path(directory).mkdir(parents=True, exist_ok=True, mode=0o700)
        self.path = str(Path(directory) / "traffic.sqlite3")
        with self.connect() as db:
            db.executescript(SCHEMA)
        Path(self.path).chmod(0o600)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=20)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA foreign_keys=ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    def create_node(self, config):
        config = validate_config(config)
        node_id, token = secrets.token_hex(8), secrets.token_urlsafe(32)
        with self.connect() as db:
            db.execute("INSERT INTO nodes VALUES (?,?,?,?,NULL)",
                       (node_id, json.dumps(config), digest(token), int(time.time())))
        return node_id, token

    def bootstrap_node(self, node_id, token, config):
        """Import a saved identity once; never overwrite existing settings or rotated tokens."""
        import re
        if not re.fullmatch(r"[a-f0-9]{16}", node_id) or not isinstance(token, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{32,200}", token):
            raise ValueError("保存的节点凭据无效")
        config = validate_config(config)
        with self.connect() as db:
            return bool(db.execute("INSERT OR IGNORE INTO nodes VALUES (?,?,?,?,NULL)",
                        (node_id, json.dumps(config), digest(token), int(time.time()))).rowcount)

    def agent_info(self, node_id):
        with self.connect() as db:
            row = db.execute("SELECT info FROM agents WHERE node_id=?", (node_id,)).fetchone()
        return json.loads(row[0]) if row else {}

    @staticmethod
    def validate_agent(info):
        if not isinstance(info, dict):
            raise ValueError("采集器信息无效")
        result = {}
        for key in ("hostname", "os", "interface", "version"):
            value = info.get(key, "")
            if not isinstance(value, str) or len(value) > 160 or any(ord(c) < 32 for c in value):
                raise ValueError("采集器信息格式无效")
            result[key] = value
        return result

    def nodes(self):
        with self.connect() as db:
            return [{"id": r["id"], "config": {**DEFAULTS, **json.loads(r["config"])}, "created": r["created"], "last_received": r["last_received"]}
                    for r in db.execute("SELECT * FROM nodes ORDER BY created,id")]

    def update_node(self, node_id, config):
        c = validate_config(config)
        with self.connect() as db:
            if not db.execute("UPDATE nodes SET config=? WHERE id=?", (json.dumps(c), node_id)).rowcount:
                raise KeyError("节点不存在")
            if c["baseline_cycle"]:
                if c["baseline_known"]:
                    db.execute("INSERT INTO baselines VALUES (?,?,?,?) ON CONFLICT(node_id,cycle) DO UPDATE SET bytes=excluded.bytes,cutover=excluded.cutover",
                               (node_id, c["baseline_cycle"], c["baseline_bytes"], c["baseline_cutover"]))
                else:
                    db.execute("DELETE FROM baselines WHERE node_id=? AND cycle=?", (node_id, c["baseline_cycle"]))

    def delete_node(self, node_id, confirm_name):
        with self.connect() as db:
            row = db.execute("SELECT config FROM nodes WHERE id=?", (node_id,)).fetchone()
            if row is None:
                raise KeyError("节点不存在")
            if not isinstance(confirm_name, str) or confirm_name != json.loads(row["config"])["name"]:
                raise ValueError("请输入完整节点名称确认删除；名称可能已被修改")
            # Foreign keys remove only this node's samples, baselines, sources and alerts.
            db.execute("DELETE FROM nodes WHERE id=?", (node_id,))

    def effective_config(self, node_id, config, cycle):
        with self.connect() as db:
            row = db.execute("SELECT * FROM baselines WHERE node_id=? AND cycle=?", (node_id, cycle)).fetchone()
        if row:
            return {**config, "baseline_cycle": cycle, "baseline_bytes": row["bytes"], "baseline_cutover": row["cutover"], "baseline_known": True}
        return {**config, "baseline_known": False}

    def rotate(self, node_id):
        token = secrets.token_urlsafe(32)
        with self.connect() as db:
            if not db.execute("UPDATE nodes SET token_hash=? WHERE id=?", (digest(token), node_id)).rowcount:
                raise KeyError("节点不存在")
        return token

    def valid_token(self, node_id, token):
        with self.connect() as db:
            row = db.execute("SELECT token_hash FROM nodes WHERE id=?", (node_id,)).fetchone()
        return row is not None and secrets.compare_digest(row[0], digest(token))

    def ingest(self, node_id, token, generation, buckets, now=None, agent=None):
        return self._ingest(node_id, token, generation, buckets, now, agent)

    def ingest_ssh(self, node_id, expected_config, generation, buckets, now=None, agent=None):
        return self._ingest(node_id, None, generation, buckets, now, agent, expected_config)

    def ssh_status(self, node_id):
        with self.connect() as db:
            row = db.execute("SELECT last_attempt,last_success,error FROM ssh_polls WHERE node_id=?", (node_id,)).fetchone()
        return dict(row) if row else {"last_attempt": None, "last_success": None, "error": ""}

    def record_ssh_poll(self, node_id, error=""):
        now = int(time.time())
        with self.connect() as db:
            db.execute("""INSERT INTO ssh_polls SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM nodes WHERE id=?) ON CONFLICT(node_id) DO UPDATE SET
              last_attempt=excluded.last_attempt, last_success=COALESCE(excluded.last_success,ssh_polls.last_success), error=excluded.error""",
                       (node_id, now, None if error else now, error, node_id))

    def _ingest(self, node_id, token, generation, buckets, now=None, agent=None, ssh_config=None):
        now = int(time.time()) if now is None else now
        info = self.validate_agent(agent) if agent is not None else None
        if not isinstance(generation, str) or not 1 <= len(generation) <= 160:
            raise ValueError("采集来源无效")
        if not isinstance(buckets, list) or len(buckets) > 1000:
            raise ValueError("每批最多 1000 个时间段")
        for b in buckets:
            if not isinstance(b, dict) or any(type(b.get(k)) is not int for k in ("start", "rx", "tx")):
                raise ValueError("流量记录必须是整数")
            if b["start"] % 300 or not now - 400 * 86400 <= b["start"] <= now - 300:
                raise ValueError("时间段无效或尚未结束")
            if not 0 <= b["rx"] <= 10**15 or not 0 <= b["tx"] <= 10**15:
                raise ValueError("流量数值超出范围")
        with self.connect() as db:
            row = db.execute("SELECT token_hash,config FROM nodes WHERE id=?", (node_id,)).fetchone()
            if row is None:
                raise PermissionError("节点不存在")
            current = {**DEFAULTS, **json.loads(row["config"])}
            if ssh_config is not None:
                keys = ("collection_mode", "host", "ssh_port", "ssh_user", "ssh_fingerprint", "interface", "archived")
                if current["collection_mode"] != "ssh" or current["archived"] or any(current[k] != ssh_config[k] for k in keys):
                    raise PermissionError("SSH 节点设置已变更，请重新拉取")
            elif current["collection_mode"] != "agent" or not secrets.compare_digest(row["token_hash"], digest(token)):
                raise PermissionError("上报认证失败")
            if buckets:
                has_source = bool(db.execute("SELECT 1 FROM sources WHERE node_id=? LIMIT 1", (node_id,)).fetchone())
                db.execute("INSERT OR IGNORE INTO sources VALUES (?,?,?,?)", (node_id, generation, now, int(has_source)))
            # Absolute bucket snapshots are idempotent, and delayed smaller snapshots never subtract usage.
            db.executemany("""INSERT INTO buckets VALUES (?,?,?,?,?)
              ON CONFLICT(node_id,start) DO UPDATE SET
                rx=MAX(buckets.rx,excluded.rx), tx=MAX(buckets.tx,excluded.tx)
              """, [(node_id, b["start"], b["rx"], b["tx"], generation) for b in buckets])
            db.execute("UPDATE nodes SET last_received=? WHERE id=?", (now, node_id))
            if info is not None:
                db.execute("INSERT INTO agents VALUES (?,?) ON CONFLICT(node_id) DO UPDATE SET info=excluded.info",
                           (node_id, json.dumps(info)))
        return len(buckets)

    def sources(self, node_id):
        with self.connect() as db:
            return [dict(r) for r in db.execute("SELECT generation,first_seen,review_needed FROM sources WHERE node_id=? ORDER BY first_seen", (node_id,))]

    def acknowledge_sources(self, node_id):
        with self.connect() as db:
            if not db.execute("SELECT 1 FROM nodes WHERE id=?", (node_id,)).fetchone():
                raise KeyError("节点不存在")
            db.execute("UPDATE sources SET review_needed=0 WHERE node_id=?", (node_id,))

    def buckets(self, node_id):
        with self.connect() as db:
            return [dict(r) for r in db.execute("SELECT start,rx,tx FROM buckets WHERE node_id=? AND start>=? ORDER BY start", (node_id, int(time.time()) - 400*86400))]

    def record_alerts(self, node_id, summary, now):
        # Incomplete data is a lower bound: a known threshold breach is still actionable.
        if summary.get("rules_confirmed", summary["reliable"]) and summary.get("quota_known", True):
            with self.connect() as db:
                for t in (80, 90, 95):
                    if summary["percent"] >= t:
                        db.execute("INSERT OR IGNORE INTO alerts VALUES (?,?,?,?)", (node_id, summary["cycle"], t, now))
        with self.connect() as db:
            return [dict(r) for r in db.execute("SELECT cycle,threshold,created FROM alerts WHERE node_id=? ORDER BY created DESC,threshold DESC LIMIT 30", (node_id,))]

    def session(self):
        token = secrets.token_urlsafe(32)
        with self.connect() as db:
            db.execute("DELETE FROM sessions WHERE expires<?", (int(time.time()),))
            db.execute("INSERT INTO sessions VALUES (?,?)", (digest(token), int(time.time()) + 7 * 86400))
        return token

    def authenticated(self, token):
        with self.connect() as db:
            return bool(db.execute("SELECT 1 FROM sessions WHERE hash=? AND expires>?", (digest(token), int(time.time()))).fetchone())

    def logout(self, token):
        with self.connect() as db:
            db.execute("DELETE FROM sessions WHERE hash=?", (digest(token),))
