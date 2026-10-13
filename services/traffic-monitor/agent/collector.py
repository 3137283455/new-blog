"""One-shot vnStat collector, run by systemd timer. No third-party Python packages."""
import hashlib
import json
import logging
import os
import sqlite3
import subprocess
import time
import platform
from datetime import datetime
from pathlib import Path
from urllib.request import Request, ProxyHandler, build_opener, HTTPRedirectHandler
from urllib.parse import urlsplit

log = logging.getLogger("traffic-agent")


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def parse_vnstat(data, interface, now=None):
    now = int(time.time()) if now is None else now
    if data.get("jsonversion") not in ("2", "2.0", 2):
        raise ValueError("Unsupported vnStat JSON schema (expected version 2)")
    matches = [i for i in data.get("interfaces", []) if i.get("name") == interface]
    if len(matches) != 1:
        raise ValueError("Configured interface missing in vnStat")
    iface = matches[0]
    generation = hashlib.sha256(json.dumps({"interface": interface, "created": iface.get("created")},sort_keys=True).encode()).hexdigest()[:24]
    rows = []
    for r in iface.get("traffic", {}).get("fiveminute", []):
        # vnStat v2 JSON provides epoch timestamps; date/time are display-only local time.
        if type(r.get("timestamp")) is not int:
            raise ValueError("vnStat timestamp missing; use vnStat 2.x with epoch JSON timestamps")
        start = r["timestamp"]
        if start % 300 or start + 300 > now:
            continue
        if any(type(r.get(k)) is not int or r[k] < 0 for k in ("rx", "tx")):
            raise ValueError("Invalid vnStat counters")
        rows.append({"start": start, "rx": r["rx"], "tx": r["tx"]})
    return generation, rows


def open_spool(path):
    db = sqlite3.connect(path, timeout=20)
    db.execute("PRAGMA journal_mode=WAL")
    db.executescript("""CREATE TABLE IF NOT EXISTS spool (
      generation TEXT NOT NULL, start INTEGER NOT NULL, rx INTEGER NOT NULL, tx INTEGER NOT NULL,
      sent INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(generation,start));""")
    return db


def queue(db, generation, rows):
    with db:
        db.executemany("""INSERT INTO spool(generation,start,rx,tx) VALUES(?,?,?,?)
          ON CONFLICT(generation,start) DO UPDATE SET
            sent=CASE WHEN spool.rx != excluded.rx OR spool.tx != excluded.tx THEN 0 ELSE spool.sent END,
            rx=excluded.rx,tx=excluded.tx""",[(generation,r["start"],r["rx"],r["tx"]) for r in rows])


def deliver(db, url, node_id, token, opener=None, agent=None):
    if urlsplit(url).scheme != "https" and os.environ.get("ALLOW_HTTP_LOCAL_TEST") != "true":
        raise ValueError("HTTPS is required for ingest")
    if urlsplit(url).username or urlsplit(url).password:
        raise ValueError("Do not put credentials in the endpoint URL")
    opener = opener or build_opener(ProxyHandler({}), NoRedirect())  # Never inherit proxies or forward secrets on redirects.
    count = 0
    # Bound one timer run; pending records remain on disk for the next run.
    for _ in range(30):
        first = db.execute("SELECT generation FROM spool WHERE sent=0 ORDER BY start LIMIT 1").fetchone()
        if not first:
            if count == 0:
                payload = {"node_id":node_id,"generation":"heartbeat","buckets":[], "agent": agent or {}}
                send(opener,url,token,payload)
            break
        generation = first[0]
        batch = db.execute("SELECT start,rx,tx FROM spool WHERE sent=0 AND generation=? ORDER BY start LIMIT 1000",(generation,)).fetchall()
        payload = {"node_id": node_id, "generation": generation, "agent": agent or {}, "buckets": [{"start":r[0],"rx":r[1],"tx":r[2]} for r in batch]}
        send(opener,url,token,payload)
        with db:
            db.executemany("UPDATE spool SET sent=1 WHERE generation=? AND start=?",[(generation,r[0]) for r in batch])
        count += len(batch)
    with db:
        # Never prune unsent samples. 400-day server acceptance bounds deliberate archival retention.
        db.execute("DELETE FROM spool WHERE sent=1 AND start<?",(int(time.time())-90*86400,))
    return count


def send(opener,url,token,payload):
    request = Request(url,data=json.dumps(payload,separators=(",", ":")).encode(),headers={"Content-Type":"application/json","Authorization":"Bearer "+token},method="POST")
    with opener.open(request,timeout=20) as response:
        result = json.loads(response.read(4096))
        if response.status != 200 or result.get("accepted") != len(payload["buckets"]):
            raise RuntimeError("Server did not acknowledge complete batch")


def main():
    logging.basicConfig(level=logging.INFO,format="%(levelname)s %(message)s")
    try:
        interface = os.environ["INTERFACE"]
        state = Path(os.environ.get("STATE_DIR","/var/lib/traffic-agent"));state.mkdir(parents=True,exist_ok=True)
        result = subprocess.run(["vnstat","--json","f","0","-i",interface],capture_output=True,check=True,text=True,timeout=30)
        generation,rows = parse_vnstat(json.loads(result.stdout),interface)
        db = open_spool(state / "spool.sqlite3")
        try:
            queue(db,generation,rows)
            info = {"hostname": platform.node()[:160], "os": platform.freedesktop_os_release().get("PRETTY_NAME", "Linux")[:160],
                    "interface": interface, "version": "0.2.0"}
            count = deliver(db,os.environ["INGEST_URL"],os.environ["NODE_ID"],os.environ["INGEST_TOKEN"], agent=info)
            log.info("Collected %d buckets; acknowledged %d",len(rows),count)
        finally:
            db.close()
    except Exception as exc:
        # Exception text may contain endpoint URLs or credentials. Log only the exception class.
        log.error("Collection failed (%s); queued data retained. Check environment and connectivity.",type(exc).__name__)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
