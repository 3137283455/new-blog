#!/usr/bin/env bash
set -euo pipefail
if [[ "$EUID" != 0 ]]; then echo 'Run with sudo on the monitored Debian VPS.' >&2; exit 1; fi
if [[ ! -s /etc/traffic-agent.env ]]; then
  echo 'First install the downloaded config at /etc/traffic-agent.env, mode 600, and set INTERFACE.' >&2; exit 1
fi
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
apt-get update
apt-get install -y vnstat python3 ca-certificates iproute2
getent group vnstat >/dev/null || groupadd --system vnstat
id traffic-agent >/dev/null 2>&1 || useradd --system --user-group --home-dir /var/lib/traffic-agent --shell /usr/sbin/nologin traffic-agent
usermod -a -G vnstat traffic-agent
install -d -m 755 /opt/traffic-agent
install -m 644 "$ROOT/agent/collector.py" /opt/traffic-agent/collector.py
chmod 600 /etc/traffic-agent.env
# Retain 72 hours for catch-up; local spool retains unacknowledged records longer.
cp -an /etc/vnstat.conf /etc/vnstat.conf.before-traffic-monitor
python3 - <<'PY'
from pathlib import Path
import re
p=Path('/etc/vnstat.conf')
text=p.read_text()
active=re.findall(r'(?m)^\s*5MinuteHours\s+(-?\d+)\s*$',text)
retention=int(active[-1]) if active else 48
retention=retention if retention == -1 or retention > 72 else 72
for key,value in [('5MinuteHours',str(retention)),('TrafficlessEntries','1')]:
    pattern=rf'(?m)^\s*[;#]?\s*{key}\s+.*$'
    line=f'{key} {value}'
    text=re.sub(pattern,line,text) if re.search(pattern,text) else text+'\n'+line+'\n'
p.write_text(text)
PY
# Use JSON/parser validation instead of sourcing downloaded configuration as shell code.
INTERFACE_NAME="$(python3 - <<'PY'
import re, json, subprocess
from pathlib import Path
settings=dict(line.split('=',1) for line in Path('/etc/traffic-agent.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
name=settings.get('INTERFACE','').strip()
if name in ('', 'auto'):
    for address in ('1.1.1.1', '2606:4700:4700::1111'):
        result=subprocess.run(['ip','-j','route','get',address],capture_output=True,text=True)
        if result.returncode == 0:
            routes=json.loads(result.stdout)
            name=routes[0].get('dev','') if routes else ''
            if name:break
    if not name or name.startswith(('lo','tun','docker','veth','br-')):
        raise SystemExit('Cannot detect public interface; set INTERFACE manually')
    env=Path('/etc/traffic-agent.env')
    text=env.read_text()
    line='INTERFACE='+name
    text=re.sub(r'(?m)^INTERFACE=.*$',line,text) if re.search(r'(?m)^INTERFACE=',text) else text+'\n'+line+'\n'
    env.write_text(text)
if not re.fullmatch(r'[a-zA-Z0-9_.:-]{1,40}',name):raise SystemExit('Invalid INTERFACE')
if not Path('/sys/class/net',name).exists():raise SystemExit('INTERFACE does not exist; check ip route get 1.1.1.1')
print(name)
PY
)"
systemctl enable --now vnstat
vnstat --add -i "$INTERFACE_NAME" || vnstat --json -i "$INTERFACE_NAME" >/dev/null
# Restart ONLY the traffic statistics daemon. SSH, Xray and firewall remain untouched.
systemctl restart vnstat
chgrp -R vnstat /var/lib/vnstat
chmod g+rx /var/lib/vnstat
find /var/lib/vnstat -maxdepth 1 -type f -exec chmod g+r {} +
install -m 644 "$ROOT/deploy/traffic-agent.service" /etc/systemd/system/traffic-agent.service
install -m 644 "$ROOT/deploy/traffic-agent.timer" /etc/systemd/system/traffic-agent.timer
systemctl daemon-reload
systemctl enable --now traffic-agent.timer
systemctl start traffic-agent.service
echo 'Collector installed. Check: systemctl status traffic-agent.timer; journalctl -u traffic-agent.service -n 20'
