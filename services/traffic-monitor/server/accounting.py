"""Byte-based accounting; all time buckets are UTC, billing uses an IANA zone."""
import calendar
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

DEFAULTS = {
    "name": "日本 VPS", "quota": 100, "unit": "GB", "direction": "sum",
    "reset_day": 1, "timezone": "Asia/Shanghai", "confirmed": False,
    "baseline_bytes": 0, "baseline_cycle": "", "baseline_known": False, "baseline_cutover": 0,
    "provider": "", "region": "", "host": "", "ssh_port": 22, "interface": "auto",
    "notes": "", "archived": False, "quota_mode": "limited",
    # Existing nodes keep their push collector; new UI nodes select SSH explicitly.
    "collection_mode": "agent", "ssh_user": "traffic-monitor", "ssh_fingerprint": "",
}


def validate_config(data):
    c = {**DEFAULTS, **data}
    if not isinstance(c["name"], str) or not 1 <= len(c["name"].strip()) <= 80:
        raise ValueError("名称需要 1–80 个字符")
    c["name"] = c["name"].strip()
    for key, limit in (("provider", 80), ("region", 80), ("host", 253), ("notes", 500)):
        if not isinstance(c[key], str) or len(c[key]) > limit or any(ord(x) < 32 for x in c[key]):
            raise ValueError("服务器资料格式无效")
        c[key] = c[key].strip()
    import re
    if c["host"] and not re.fullmatch(r"[a-zA-Z0-9.:-]+", c["host"]):
        raise ValueError("地址请填写 IP 或域名，不包含密码、协议或路径")
    if type(c["ssh_port"]) is not int or not 1 <= c["ssh_port"] <= 65535:
        raise ValueError("SSH 端口必须为 1–65535")
    if c["collection_mode"] not in ("ssh", "agent"):
        raise ValueError("采集方式无效")
    if not isinstance(c["ssh_user"], str) or c["ssh_user"] == "root" or not re.fullmatch(r"[a-z_][a-z0-9_-]{0,31}", c["ssh_user"]):
        raise ValueError("SSH 查询用户名无效")
    if not isinstance(c["ssh_fingerprint"], str) or (c["ssh_fingerprint"] and not re.fullmatch(r"SHA256:[A-Za-z0-9+/]{43}", c["ssh_fingerprint"])):
        raise ValueError("请填写 SHA256 格式的 SSH 主机指纹")
    if c["collection_mode"] == "ssh":
        import ipaddress
        try:
            ipaddress.ip_address(c["host"])
        except ValueError:
            if not c["host"] or any(not re.fullmatch(r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?", label) for label in c["host"].rstrip('.').split('.')):
                raise ValueError("SSH 拉取需要有效的 VPS IP 或域名")
    if not isinstance(c["interface"], str) or not re.fullmatch(r"[a-zA-Z0-9_.:-]{1,40}", c["interface"]):
        raise ValueError("网卡名称无效")
    if type(c["archived"]) is not bool or c["quota_mode"] not in ("limited", "unknown", "unlimited"):
        raise ValueError("节点状态或额度类型无效")
    if c["quota_mode"] == "unknown":
        c["confirmed"] = False
    if isinstance(c["quota"], bool) or not isinstance(c["quota"], (float, int)) or not 0 < c["quota"] <= 1000000:
        raise ValueError("套餐额度必须大于 0 且不超过 1000000")
    if c["unit"] not in ("GB", "GiB") or c["direction"] not in ("rx", "tx", "sum", "max"):
        raise ValueError("流量单位或计算方式无效")
    if int(c["quota"] * (10**9 if c["unit"] == "GB" else 2**30)) < 1:
        raise ValueError("套餐额度至少为 1 字节")
    if type(c["reset_day"]) is not int or not 1 <= c["reset_day"] <= 31:
        raise ValueError("重置日必须为 1–31")
    if not isinstance(c["timezone"], str):
        raise ValueError("时区无效")
    try:
        ZoneInfo(c["timezone"])
    except (KeyError, ValueError):
        raise ValueError("请填写有效的 IANA 时区") from None
    if type(c["baseline_bytes"]) is not int or not 0 <= c["baseline_bytes"] <= 10**18:
        raise ValueError("期初用量无效")
    for key in ("confirmed", "baseline_known"):
        if type(c[key]) is not bool:
            raise ValueError("确认选项无效")
    if not isinstance(c["baseline_cycle"], str) or len(c["baseline_cycle"]) > 10:
        raise ValueError("期初账期无效")
    if c["baseline_cycle"]:
        datetime.strptime(c["baseline_cycle"], "%Y-%m-%d")
    if type(c["baseline_cutover"]) is not int or c["baseline_cutover"] < 0 or c["baseline_cutover"] % 300:
        raise ValueError("期初交接时间必须对齐 5 分钟")
    if c["baseline_known"] and (not c["baseline_cycle"] or not c["baseline_cutover"]):
        raise ValueError("补录期初用量需要选择账期与交接时间")
    if c["baseline_known"] and c["direction"] == "max":
        raise ValueError("取大模式暂不支持单值期初补录，请从完整账期开始统计")
    if c["baseline_known"]:
        start, end = period(c, c["baseline_cutover"])
        if start.date().isoformat() != c["baseline_cycle"] or not start.timestamp() <= c["baseline_cutover"] < end.timestamp():
            raise ValueError("交接时间必须位于所选账期内")
    return {k: c[k] for k in DEFAULTS}


def amount(rx, tx, direction):
    return {"rx": rx, "tx": tx, "sum": rx + tx, "max": max(rx, tx)}[direction]


def period(config, now=None):
    zone = ZoneInfo(config["timezone"])
    now = datetime.fromtimestamp(now, zone) if now is not None else datetime.now(zone)

    def anchor(year, month):
        day = min(config["reset_day"], calendar.monthrange(year, month)[1])
        return datetime(year, month, day, tzinfo=zone)

    start = anchor(now.year, now.month)
    if now < start:
        prev = now.replace(day=1) - timedelta(days=1)
        start = anchor(prev.year, prev.month)
    year, month = (start.year + 1, 1) if start.month == 12 else (start.year, start.month + 1)
    end = anchor(year, month)
    return start, end


def summarize(config, buckets, now, last_received=None):
    start, end = period(config, now)
    s, e = int(start.timestamp()), int(end.timestamp())
    baseline_applies = (config["baseline_known"] and config["baseline_cycle"] == start.date().isoformat()
                        and s <= config["baseline_cutover"] < min(e, now + 1))
    cutover = config["baseline_cutover"] if baseline_applies else s
    rows = [b for b in buckets if cutover <= b["start"] < min(e, now)]
    rx, tx = sum(b["rx"] for b in rows), sum(b["tx"] for b in rows)
    baseline = config["baseline_bytes"] if baseline_applies else 0
    used = amount(rx, tx, config["direction"]) + baseline
    quota = int(config["quota"] * (10**9 if config["unit"] == "GB" else 2**30))
    last_sample = max((b["start"] + 300 for b in buckets), default=None)
    stale = last_received is None or now - last_received > 900 or last_sample is None or now - last_sample > 900
    # Allow normal vnStat flush/timer latency. Completeness is through the newest sample,
    # while the separate stale flag prevents old records being presented as current.
    until = min(now // 300 * 300, e)
    if not stale and last_sample is not None:
        until = min(until, last_sample)
    expected = max(0, (until - cutover) // 300)
    completed = {b["start"] for b in rows if b["start"] + 300 <= now}
    missing = max(0, expected - len(completed))
    uncovered = missing
    complete = uncovered == 0 and bool(rows or baseline_applies)
    reliable = config["confirmed"] and complete and not stale
    quota_known = config.get("quota_mode", "limited") == "limited"
    return {
        "start": s, "end": e, "cycle": start.date().isoformat(),
        "rx": rx, "tx": tx, "used": used, "quota": quota if quota_known else None,
        "remaining": max(0, quota - used) if quota_known else None, "overage": max(0, used - quota) if quota_known else 0,
        "percent": round(used / quota * 100, 2) if quota_known else None, "quota_known": quota_known,
        "days_left": max(0, (end.date() - datetime.fromtimestamp(now, ZoneInfo(config["timezone"])).date()).days),
        "missing_buckets": uncovered, "complete": complete, "stale": stale,
        "recorded_buckets": len(rows),
        "reliable": reliable, "last_received": last_received, "last_sample": last_sample,
        "accounted_until": until,
        "baseline_applied": baseline, "rules_confirmed": config["confirmed"],
    }


def history(config, buckets, now, days=30):
    zone = ZoneInfo(config["timezone"])
    today = datetime.fromtimestamp(now, zone).date()
    grouped = {}
    for b in buckets:
        day = datetime.fromtimestamp(b["start"], zone).date()
        key = day.isoformat()
        row = grouped.setdefault(key, {"date": key, "rx": 0, "tx": 0, "samples": 0})
        row["rx"] += b["rx"]
        row["tx"] += b["tx"]
        row["samples"] += 1
    output = []
    for n in range(days - 1, -1, -1):
        key = (today - timedelta(days=n)).isoformat()
        row = grouped.get(key, {"date": key, "rx": 0, "tx": 0, "samples": 0})
        output.append({**row, "used": amount(row["rx"], row["tx"], config["direction"])})
    return output
