"""Encrypted, host-key-pinned SSH reads. No passwords or private keys enter the UI."""
import base64
import hashlib
import json
import os
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from agent.collector import parse_vnstat


class PullError(ValueError):
    pass


def run_bounded(args, timeout=8, limit=2_000_000):
    """Bound runtime AND output; never execute a local shell or log raw SSH output."""
    with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
        try:
            proc = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=out, stderr=err,
                                    **({"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {}))
        except FileNotFoundError:
            raise PullError("博客服务器缺少 OpenSSH 客户端，请安装 openssh-client") from None
        try:
            deadline = time.monotonic() + timeout
            while proc.poll() is None:
                if time.monotonic() > deadline:
                    raise PullError("SSH 连接超时，请检查 IP、NAT 外部端口和防火墙")
                if os.fstat(out.fileno()).st_size > limit or os.fstat(err.fileno()).st_size > limit:
                    raise PullError("SSH 输出过大，已停止读取")
                time.sleep(.05)
            out.seek(0)
            err.seek(0)
            data, error = out.read(limit + 1), err.read(limit + 1)
            if len(data) > limit or len(error) > limit:
                raise PullError("SSH 输出过大，已停止读取")
            if proc.returncode:
                if b"Permission denied" in error:
                    raise PullError("SSH 密钥认证失败，请在 VPS 执行本节点的接入命令")
                if b"REMOTE HOST IDENTIFICATION" in error or b"Host key verification failed" in error:
                    raise PullError("SSH 主机密钥校验失败，请核对 VPS 的主机指纹")
                raise PullError("SSH 查询失败，请检查端口、接入命令与 vnStat 运行状态")
            return data.decode("utf-8")
        finally:
            if proc.poll() is None:
                proc.kill()
            proc.wait()


class SSHPoller:
    def __init__(self, store):
        self.store = store
        self.directory = Path(store.path).parent / "ssh"
        self.key = self.directory / "id_ed25519"
        self.lock = threading.Lock()
        self.key_lock = threading.Lock()
        self.stop = threading.Event()

    def public_key(self):
        with self.key_lock:
            self.directory.mkdir(mode=0o700, parents=True, exist_ok=True)
            self.directory.chmod(0o700)
            if not self.key.exists():
                run_bounded(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "blog-traffic-readonly", "-f", str(self.key)])
                self.key.chmod(0o600)
            # Derive from the actual private key; do not trust a stale .pub file.
            return ' '.join(run_bounded(["ssh-keygen", "-y", "-f", str(self.key)]).split()[:2])

    def setup(self, config):
        public = self.public_key()
        script = (Path(__file__).resolve().parent.parent / "deploy/install-ssh-node.sh").read_text(encoding="utf-8")
        # All three values come from validated config/keygen, not arbitrary shell input.
        return ('if [ "$(id -u)" -eq 0 ]; then TRAFFIC_SUDO=; else TRAFFIC_SUDO=sudo; fi\n'
                "$TRAFFIC_SUDO bash -s <<'BLOG_TRAFFIC_SETUP'\n"
                f"PUBLIC_KEY='{public}'\nSSH_USER='{config['ssh_user']}'\nINTERFACE='{config['interface']}'\n"
                + script + "\nBLOG_TRAFFIC_SETUP")

    def _known_host(self, node):
        c = node["config"]
        if not c["ssh_fingerprint"]:
            raise PullError("请先在 VPS 执行接入命令，并填写输出的 SHA256 主机指纹")
        scanned = run_bounded(["ssh-keyscan", "-T", "3", "-t", "ed25519", "-p", str(c["ssh_port"]), c["host"]], timeout=4)
        for line in scanned.splitlines():
            parts = line.split()
            if len(parts) != 3 or parts[1] != "ssh-ed25519":
                continue
            try:
                blob = base64.b64decode(parts[2], validate=True)
            except ValueError:
                continue
            fingerprint = "SHA256:" + base64.b64encode(hashlib.sha256(blob).digest()).decode().rstrip("=")
            if fingerprint == c["ssh_fingerprint"]:
                self.directory.mkdir(mode=0o700, parents=True, exist_ok=True)
                known = self.directory / (node["id"] + ".known_hosts")
                known.write_text(f"traffic-{node['id']} ssh-ed25519 {parts[2]}\n", encoding="ascii")
                known.chmod(0o600)
                return known
        raise PullError("SSH 主机指纹不匹配，已拒绝连接；请从 VPS 控制台核实，不要盲目替换")

    def pull(self, node_id):
        if not self.lock.acquire(blocking=False):
            raise PullError("另一个节点正在拉取，请稍后重试")
        try:
            node = next((n for n in self.store.nodes() if n["id"] == node_id), None)
            if node is None:
                raise KeyError("节点不存在")
            c = node["config"]
            if c["collection_mode"] != "ssh" or c["archived"]:
                raise PullError("节点不是启用中的 SSH 拉取节点")
            try:
                if not self.key.exists():
                    raise PullError("请先打开 SSH 接入说明，生成查询公钥并配置 VPS")
                known = self._known_host(node)
                command = ["ssh", "-F", os.devnull, "-T", "-i", str(self.key), "-p", str(c["ssh_port"])]
                for option in ("BatchMode=yes", "IdentitiesOnly=yes", "IdentityAgent=none", "PasswordAuthentication=no",
                               "StrictHostKeyChecking=yes", "CheckHostIP=no", "ConnectTimeout=4", "ConnectionAttempts=1",
                               "ClearAllForwardings=yes", "ForwardAgent=no", "HostKeyAlgorithms=ssh-ed25519",
                               f"HostKeyAlias=traffic-{node_id}", f'UserKnownHostsFile="{known.as_posix()}"', f"GlobalKnownHostsFile={os.devnull}"):
                    command.extend(["-o", option])
                # The VPS authorized_keys additionally forces the exact interface-bound command.
                command.extend([f"{c['ssh_user']}@{c['host']}", "vnstat --json f --limit 0"])
                raw = json.loads(run_bounded(command, timeout=9))
                if not isinstance(raw, dict):
                    raise PullError("vnStat 返回格式无效，请检查远端查询命令")
                interfaces = raw.get("interfaces", [])
                if len(interfaces) != 1:
                    raise PullError("vnStat 必须仅返回一张公网网卡，请重新执行接入命令")
                interface = interfaces[0].get("name", "")
                if c["interface"] != "auto" and interface != c["interface"]:
                    raise PullError("返回网卡与节点设置不一致，请重新执行接入命令")
                generation, rows = parse_vnstat(raw, interface)
                # 72-hour retention can exceed the ingest batch size; persist in bounded chunks.
                info = {"interface": interface, "version": "SSH / vnStat", "hostname": "", "os": ""}
                for offset in range(0, max(1, len(rows)), 1000):
                    self.store.ingest_ssh(node_id, c, generation, rows[offset:offset + 1000], agent=info)
                self.store.record_ssh_poll(node_id)
                return {"ok": True, "samples": len(rows), "interface": interface}
            except (PullError, ValueError, TypeError, KeyError, PermissionError, AttributeError, OSError) as exc:
                message = str(exc) if isinstance(exc, PullError) else "返回数据无效或节点设置已变更，请检查 vnStat 并重试"
                self.store.record_ssh_poll(node_id, message)
                raise PullError(message) from None
        finally:
            self.lock.release()

    def start(self):
        def work():
            while not self.stop.is_set():
                try:
                    for node in self.store.nodes():
                        if self.stop.is_set():
                            return
                        if node["config"]["collection_mode"] == "ssh" and not node["config"]["archived"]:
                            try:
                                self.pull(node["id"])
                            except Exception:
                                pass  # Sanitized per-node failure is exposed in the admin, not secrets in logs.
                except Exception:
                    pass  # A temporary database error must not stop the scheduler permanently.
                finally:
                    self.stop.wait(300)
        threading.Thread(target=work, daemon=True, name="traffic-ssh-poll").start()
