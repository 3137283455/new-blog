#!/usr/bin/env bash
# Run on the monitored Debian/Ubuntu VPS, with PUBLIC_KEY / SSH_USER / INTERFACE set.
set -euo pipefail
[[ "$EUID" == 0 ]] || { echo 'Run with sudo/root.' >&2; exit 1; }
[[ "$PUBLIC_KEY" =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+$ ]] || { echo 'Invalid public key'; exit 1; }
[[ "$SSH_USER" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]] || exit 1
if id "$SSH_USER" >/dev/null 2>&1; then
  [[ "$(getent passwd "$SSH_USER" | cut -d: -f5)" == 'Blog traffic read-only' ]] || { echo 'Choose a dedicated unused query username; existing accounts are not modified.'; exit 1; }
fi
apt-get update
apt-get install -y vnstat python3 iproute2
if [[ "$INTERFACE" == auto ]]; then
  INTERFACE="$(ip -j route get 1.1.1.1 | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["dev"])')"
fi
[[ "$INTERFACE" =~ ^[a-zA-Z0-9_.:-]{1,40}$ && -d "/sys/class/net/$INTERFACE" ]] || { echo 'Invalid interface'; exit 1; }
[[ ! "$INTERFACE" =~ ^(lo|tun|docker|veth|br-) ]] || { echo 'Select the public interface manually'; exit 1; }
getent group vnstat >/dev/null || groupadd --system vnstat
if ! id "$SSH_USER" >/dev/null 2>&1; then
  useradd --system --user-group --create-home --comment 'Blog traffic read-only' --home-dir "/var/lib/$SSH_USER" --shell /bin/sh "$SSH_USER"
  # An unusable random password hash, but not a locked account (which can block public keys).
  usermod -p "$(python3 -c 'import secrets; print(secrets.token_hex(32))')" "$SSH_USER"
fi
[[ "$(id -u "$SSH_USER")" != 0 ]] || { echo 'Do not use root for statistics'; exit 1; }
usermod -a -G vnstat "$SSH_USER"
python3 - <<'PY'
from pathlib import Path
import re
p = Path('/etc/vnstat.conf')
text = p.read_text()
active = re.findall(r'(?m)^\s*5MinuteHours\s+(-?\d+)\s*$', text)
retention = int(active[-1]) if active else 48
retention = retention if retention == -1 or retention > 72 else 72
for key, value in [('5MinuteHours', str(retention)), ('TrafficlessEntries', '1')]:
    pattern = rf'(?m)^\s*[;#]?\s*{key}\s+.*$'
    text = re.sub(pattern, f'{key} {value}', text) if re.search(pattern, text) else text + f'\n{key} {value}\n'
p.write_text(text)
PY
systemctl enable --now vnstat
vnstat --add -i "$INTERFACE" || vnstat --json -i "$INTERFACE" >/dev/null
systemctl restart vnstat
chgrp -R vnstat /var/lib/vnstat
chmod g+rx /var/lib/vnstat
find /var/lib/vnstat -maxdepth 1 -type f -exec chmod g+r {} +
QUERY_HOME="$(getent passwd "$SSH_USER" | cut -d: -f6)"
install -d -m 700 -o "$SSH_USER" -g "$(id -gn "$SSH_USER")" "$QUERY_HOME/.ssh"
KEY_LINE="restrict,command=\"$(command -v vnstat) --json f --limit 0 -i $INTERFACE\" $PUBLIC_KEY blog-traffic-readonly"
touch "$QUERY_HOME/.ssh/authorized_keys"
# Keep unrelated keys, replace only this blog's query key entry.
PUBLIC_KEY="$PUBLIC_KEY" KEY_LINE="$KEY_LINE" KEY_FILE="$QUERY_HOME/.ssh/authorized_keys" python3 - <<'PY'
import os
from pathlib import Path
p = Path(os.environ['KEY_FILE'])
key = os.environ['PUBLIC_KEY'].split()[1]
lines = [line for line in p.read_text().splitlines() if key not in line.split() and not line.endswith(' blog-traffic-readonly')]
p.write_text('\n'.join(lines + [os.environ['KEY_LINE']]) + '\n')
PY
chown "$SSH_USER:$(id -gn "$SSH_USER")" "$QUERY_HOME/.ssh/authorized_keys"
chmod 600 "$QUERY_HOME/.ssh/authorized_keys"
echo 'Ready. Paste this SHA256 host fingerprint into the blog node setup:'
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256
echo "Read-only user: $SSH_USER; interface: $INTERFACE. SSH, proxy and firewall services were not restarted."
