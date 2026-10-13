"""Encrypted, host-key-pinned SSH reads. No passwords or private keys enter the UI."""
import base64
import hashlib
import json
import os
import re
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from agent.collector import parse_vnstat

SSH_QUERY_TIMEOUT = 20


def ssh_timeout_progress(stderr):
    """Translate client milestones, never return raw debug lines, banners or paths."""
    stage, detail = "SSH 建连", "尚未建立 SSH 连接"
    milestones = (
        ("connection established", "SSH 协议握手", "TCP 已连接，等待 SSH 服务端响应"),
        ("remote protocol version", "SSH 密钥协商", "已收到 SSH 服务端版本，等待加密协商"),
        ("ssh2_msg_newkeys received", "公钥认证", "加密协商已完成，等待公钥认证结果"),
        ("offering public key:", "公钥认证", "已提交查询公钥，等待服务端确认"),
        ("server accepts key:", "公钥认证", "服务端已认可查询公钥，等待签名认证完成"),
        ("authenticated to ", "SSH 会话建立", "公钥登录已成功，等待远端创建查询会话"),
        ("authentication succeeded (publickey)", "SSH 会话建立", "公钥登录已成功，等待远端创建查询会话"),
        ("channel 0: new session", "SSH 会话建立", "公钥登录已成功，等待远端创建查询会话"),
        ("channel 0: send open", "SSH 会话建立", "公钥登录已成功，等待远端创建查询会话"),
        ("sending command:", "SSH 查询启动", "公钥登录已成功，已发送查询请求，等待远端确认执行"),
        ("exec request accepted on channel", "远端 vnStat 查询", "远端已接受查询请求，等待 vnStat 返回并结束"),
        ("rtype exit-status", "SSH 查询收尾", "远端查询已退出，等待 SSH 关闭输出通道"),
    )
    for line in stderr.decode("utf-8", errors="replace").splitlines():
        # Remote banners/command output cannot be used as local protocol evidence.
        if not line.startswith(("debug1: ", "debug2: ", "debug3: ")):
            continue
        message = line.lower()
        for marker, next_stage, next_detail in milestones:
            if marker in message:
                stage, detail = next_stage, next_detail
                break
    return stage, detail


class PullError(ValueError):
    def __init__(self, message, stage="SSH 拉取", code="pull_failed", detail="", exit_code=None):
        self.stage, self.code, self.detail, self.exit_code = stage, code, detail, exit_code
        suffix = f"；退出码 {exit_code}" if exit_code is not None else ""
        if detail:
            suffix += "；" + detail
        super().__init__(f"[{stage}] {message}{suffix}")

    def response(self):
        return {"error": str(self), "stage": self.stage, "error_code": self.code,
                "detail": self.detail, "exit_code": self.exit_code}


def safe_error_detail(stderr, stdout=b""):
    """Expose useful SSH/vnStat errors, never arbitrary remote output or key material."""
    text = (stderr + b"\n" + stdout).decode("utf-8", errors="replace")
    if "PRIVATE KEY" in text or "-----BEGIN" in text:
        return "错误输出包含敏感内容，已隐藏"
    text = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", text)
    text = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", "", text)
    markers = ("permission denied", "connection refused", "connection timed out", "no route to host",
               "could not resolve", "connection closed", "connection reset", "host key verification failed",
               "no matching", "unable to negotiate", "bad configuration", "bad owner or permissions",
               "unprotected private key", "invalid format", "error in libcrypto", "no such file",
               "command not found", "failed to open database", "unable to open database", "not found",
               "bad ssh2", "bad port", "unsupported option", "unknown option", "bad permissions")
    lines = [line.strip() for line in text.splitlines()
             if not line.startswith(("debug1: ", "debug2: ", "debug3: "))
             and any(m in line.lower() for m in markers)]
    detail = " / ".join(lines[:2])
    detail = re.sub(r"(?i)\b(token|password|secret|passphrase)\s*[=:]\s*\S+", r"\1=[已隐藏]", detail)
    return detail[:400]


def run_bounded(args, timeout=8, limit=2_000_000, stage="本地命令"):
    """Bound runtime AND output; never execute a local shell or log raw SSH output."""
    with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
        try:
            proc = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=out, stderr=err,
                                    **({"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {}))
        except FileNotFoundError:
            raise PullError("博客服务器缺少 OpenSSH 客户端，请安装 openssh-client", stage, "client_missing") from None
        try:
            deadline = time.monotonic() + timeout
            while proc.poll() is None:
                if time.monotonic() > deadline:
                    # Stop first, then inspect bounded local SSH diagnostics. The old
                    # path discarded stderr precisely when it was needed most.
                    proc.kill()
                    proc.wait()
                    err.seek(0)
                    error = err.read(limit)
                    failure_stage, detail = (ssh_timeout_progress(error) if args[0] == "ssh"
                                             else (stage, safe_error_detail(error)))
                    raise PullError(f"操作超时：等待超过 {timeout:g} 秒，已停止本次操作",
                                    failure_stage, "timeout", detail)
                if os.fstat(out.fileno()).st_size > limit or os.fstat(err.fileno()).st_size > limit:
                    raise PullError("SSH 输出过大，已停止读取", stage, "output_limit")
                time.sleep(.05)
            out.seek(0)
            err.seek(0)
            data, error = out.read(limit + 1), err.read(limit + 1)
            if len(data) > limit or len(error) > limit:
                raise PullError("SSH 输出过大，已停止读取", stage, "output_limit")
            if proc.returncode:
                detail = safe_error_detail(error, data)
                if args[0] == "ssh-keyscan":
                    raise PullError("未能取得主机密钥，尚未进行用户登录", stage, "keyscan_failed", detail, proc.returncode)
                if args[0] == "ssh" and proc.returncode == 255:
                    if b"Permission denied" in error:
                        raise PullError("公钥认证被拒绝，请核对本节点接入授权", "公钥认证", "authentication_failed", detail, proc.returncode)
                    if b"REMOTE HOST IDENTIFICATION" in error or b"Host key verification failed" in error:
                        raise PullError("SSH 主机密钥校验失败，未放行连接", "主机指纹校验", "host_key_failed", detail, proc.returncode)
                    failure_stage, progress = ssh_timeout_progress(error)
                    raise PullError("SSH 客户端连接、会话或协商失败", failure_stage, "ssh_connection_failed",
                                    progress + ("；" + detail if detail else ""), proc.returncode)
                if args[0] == "ssh":
                    raise PullError("远端查询命令执行失败", "远端 vnStat 查询", "remote_command_failed", detail, proc.returncode)
                raise PullError("命令执行失败", stage, "command_failed", detail, proc.returncode)
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
                run_bounded(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "blog-traffic-readonly", "-f", str(self.key)], stage="生成本地查询密钥")
                self.key.chmod(0o600)
            # Derive from the actual private key; do not trust a stale .pub file.
            return ' '.join(run_bounded(["ssh-keygen", "-y", "-f", str(self.key)], stage="读取本地查询公钥").split()[:2])

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
            raise PullError("请先在 VPS 执行接入命令，并填写输出的 SHA256 主机指纹", "接入配置检查", "fingerprint_missing")
        known = self.directory / (node["id"] + ".known_hosts")
        alias = f"traffic-{node['id']}"
        # Cached public keys are reused only when they still match the saved fingerprint.
        # The SSH client verifies the actual server on every connection, including cached ones.
        if known.exists() and known.stat().st_size <= 4096:
            saved = known.read_text(encoding="ascii").split()
            if len(saved) == 3 and saved[0] == alias and saved[1] == "ssh-ed25519" and self._fingerprint(saved[2]) == c["ssh_fingerprint"]:
                return known
        scanned = run_bounded(["ssh-keyscan", "-T", "10", "-t", "ed25519", "-p", str(c["ssh_port"]), c["host"]], timeout=12, stage="主机密钥扫描")
        found_key = False
        for line in scanned.splitlines():
            parts = line.split()
            if len(parts) != 3 or parts[1] != "ssh-ed25519":
                continue
            fingerprint = self._fingerprint(parts[2])
            if not fingerprint:
                continue
            found_key = True
            if fingerprint == c["ssh_fingerprint"]:
                self.directory.mkdir(mode=0o700, parents=True, exist_ok=True)
                known.write_text(f"{alias} ssh-ed25519 {parts[2]}\n", encoding="ascii")
                known.chmod(0o600)
                return known
        if not found_key:
            raise PullError("扫描未返回有效的 ED25519 主机密钥，尚未进行用户登录", "主机密钥扫描", "keyscan_empty")
        raise PullError("SSH 主机指纹不匹配，已拒绝连接；请从 VPS 控制台核实，不要盲目替换", "主机指纹校验", "fingerprint_mismatch")

    @staticmethod
    def _fingerprint(encoded):
        try:
            blob = base64.b64decode(encoded, validate=True)
        except ValueError:
            return ""
        return "SHA256:" + base64.b64encode(hashlib.sha256(blob).digest()).decode().rstrip("=")

    def pull(self, node_id):
        if not self.lock.acquire(blocking=False):
            raise PullError("另一个节点正在拉取，请稍后重试", "拉取排队", "busy")
        try:
            node = next((n for n in self.store.nodes() if n["id"] == node_id), None)
            if node is None:
                raise KeyError("节点不存在")
            c = node["config"]
            if c["collection_mode"] != "ssh" or c["archived"]:
                raise PullError("节点不是启用中的 SSH 拉取节点")
            try:
                if not self.key.exists():
                    raise PullError("请先打开 SSH 接入说明，生成查询公钥并配置 VPS", "本地密钥检查", "key_missing")
                known = self._known_host(node)
                # Debug output stays local and is translated to a fixed allowlist of
                # milestones on failure; no raw trace or key paths enter the UI.
                command = ["ssh", "-vv", "-F", os.devnull, "-T", "-i", str(self.key), "-p", str(c["ssh_port"])]
                for option in ("BatchMode=yes", "IdentitiesOnly=yes", "IdentityAgent=none", "PasswordAuthentication=no",
                               "PreferredAuthentications=publickey", "KbdInteractiveAuthentication=no", "GSSAPIAuthentication=no",
                               # Some NAT paths mishandle the CS1 marking OpenSSH uses
                               # for non-interactive sessions. No cryptography is changed.
                               "IPQoS=none", "ServerAliveInterval=5", "ServerAliveCountMax=2",
                               "StrictHostKeyChecking=yes", "CheckHostIP=no", "ConnectTimeout=10", "ConnectionAttempts=1",
                               "ClearAllForwardings=yes", "ForwardAgent=no", "HostKeyAlgorithms=ssh-ed25519",
                               f"HostKeyAlias=traffic-{node_id}", f'UserKnownHostsFile="{known.as_posix()}"', f"GlobalKnownHostsFile={os.devnull}"):
                    command.extend(["-o", option])
                # The VPS authorized_keys additionally forces the exact interface-bound command.
                command.extend([f"{c['ssh_user']}@{c['host']}", "vnstat --json f --limit 0"])
                output = run_bounded(command, timeout=SSH_QUERY_TIMEOUT, stage="SSH 登录与查询")
                try:
                    raw = json.loads(output)
                except (ValueError, TypeError):
                    raise PullError("SSH 命令已结束，但返回内容不是 vnStat JSON", "解析查询结果", "invalid_json") from None
                if not isinstance(raw, dict):
                    raise PullError("vnStat 返回格式无效，请检查远端查询命令", "解析查询结果", "invalid_vnstat_data")
                interfaces = raw.get("interfaces", [])
                if not isinstance(interfaces, list) or len(interfaces) != 1 or not isinstance(interfaces[0], dict):
                    raise PullError("vnStat 必须仅返回一张公网网卡，请重新执行接入命令", "解析查询结果", "invalid_interface_data")
                interface = interfaces[0].get("name", "")
                if c["interface"] != "auto" and interface != c["interface"]:
                    raise PullError("返回网卡与节点设置不一致，请重新执行接入命令", "解析查询结果", "interface_mismatch")
                try:
                    generation, rows = parse_vnstat(raw, interface)
                except (ValueError, TypeError, KeyError, AttributeError):
                    raise PullError("vnStat JSON 版本、时间段或流量字段无效", "解析查询结果", "invalid_vnstat_data") from None
                # 72-hour retention can exceed the ingest batch size; persist in bounded chunks.
                info = {"interface": interface, "version": "SSH / vnStat", "hostname": "", "os": ""}
                for offset in range(0, max(1, len(rows)), 1000):
                    self.store.ingest_ssh(node_id, c, generation, rows[offset:offset + 1000], agent=info)
                self.store.record_ssh_poll(node_id)
                return {"ok": True, "samples": len(rows), "interface": interface}
            except (PullError, ValueError, TypeError, KeyError, PermissionError, AttributeError, OSError) as exc:
                failure = exc if isinstance(exc, PullError) else PullError(
                    "本地密钥、数据权限或节点设置已变更，请重试并检查博客服务权限",
                    "保存查询结果" if isinstance(exc, PermissionError) else "本地数据处理", "local_data_failed")
                self.store.record_ssh_poll(node_id, str(failure))
                raise failure from None
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
