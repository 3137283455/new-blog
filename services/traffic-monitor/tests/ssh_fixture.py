"""Test-only encrypted SSH server. Paramiko is never a production dependency."""
import argparse
import base64
import hashlib
import io
import json
import logging
import signal
import socket
import threading
import time
from pathlib import Path


class SSHFixture:
    def __init__(self, public_key, handshake_delay=0, query_delay=0):
        self.public_key = public_key.split()[1]
        self.handshake_delay, self.query_delay = handshake_delay, query_delay
        self.fail_auth = False
        self.auth_delay, self.session_delay = 0, 0
        self.exit_code, self.stdout, self.stderr = 0, None, b''
        self.commands, self.sessions = [], []
        self.stop = threading.Event()

    def __enter__(self):
        import paramiko
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, NoEncryption
        logging.getLogger('paramiko').setLevel(logging.CRITICAL)
        encoded = Ed25519PrivateKey.generate().private_bytes(Encoding.PEM, PrivateFormat.OpenSSH, NoEncryption()).decode()
        host_key = paramiko.Ed25519Key.from_private_key(io.StringIO(encoded))
        self.fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(host_key.asbytes()).digest()).decode().rstrip('=')
        fixture = self

        class Server(paramiko.ServerInterface):
            def get_allowed_auths(self, username):
                return 'publickey'

            def check_auth_publickey(self, username, key):
                if fixture.stop.wait(fixture.auth_delay):
                    return paramiko.AUTH_FAILED
                valid = not fixture.fail_auth and username == 'traffic-monitor' and key.get_base64() == fixture.public_key
                return paramiko.AUTH_SUCCESSFUL if valid else paramiko.AUTH_FAILED

            def check_channel_request(self, kind, chanid):
                if fixture.stop.wait(fixture.session_delay):
                    return paramiko.OPEN_FAILED_ADMINISTRATIVELY_PROHIBITED
                return paramiko.OPEN_SUCCEEDED if kind == 'session' else paramiko.OPEN_FAILED_ADMINISTRATIVELY_PROHIBITED

            def check_channel_exec_request(self, channel, command):
                fixture.commands.append(command.decode())
                def respond():
                    if fixture.stop.wait(max(.05, fixture.query_delay)):
                        return
                    start = int(time.time()) // 300 * 300 - 300
                    raw = fixture.stdout if fixture.stdout is not None else json.dumps({
                        'jsonversion': '2', 'interfaces': [{'name': 'eth0', 'created': {'timestamp': 1},
                        'traffic': {'fiveminute': [{'timestamp': start, 'rx': 777, 'tx': 888}]}}]}).encode()
                    try:
                        channel.sendall(raw)
                        if fixture.stderr:
                            channel.send_stderr(fixture.stderr)
                        channel.send_exit_status(fixture.exit_code)
                        channel.shutdown_write()
                        channel.close()
                    except (EOFError, OSError):
                        pass
                threading.Thread(target=respond, daemon=True).start()
                return True

        self.listener = socket.socket()
        self.listener.bind(('127.0.0.1', 0))
        self.listener.listen()
        self.listener.settimeout(.2)
        self.port = self.listener.getsockname()[1]

        def handle(client):
            transport = paramiko.Transport(client)
            self.sessions.append(transport)
            try:
                if self.stop.wait(self.handshake_delay):
                    return
                transport.add_server_key(host_key)
                transport.start_server(server=Server())
                while transport.is_active() and not self.stop.wait(.05):
                    pass
            except (EOFError, OSError, paramiko.SSHException):
                pass
            finally:
                transport.close()

        def accept():
            while not self.stop.is_set():
                try:
                    client, _ = self.listener.accept()
                except socket.timeout:
                    continue
                except OSError:
                    return
                threading.Thread(target=handle, args=(client,), daemon=True).start()

        self.worker = threading.Thread(target=accept, daemon=True)
        self.worker.start()
        return self

    def __exit__(self, *args):
        self.stop.set()
        self.listener.close()
        for transport in self.sessions:
            transport.close()
        self.worker.join(2)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--public-key', required=True)
    parser.add_argument('--handshake-delay', type=float, default=0)
    parser.add_argument('--query-delay', type=float, default=0)
    args = parser.parse_args()
    with SSHFixture(Path(args.public_key).read_text(), args.handshake_delay, args.query_delay) as server:
        signal.signal(signal.SIGTERM, lambda *_: server.stop.set())
        print(json.dumps({'port': server.port, 'fingerprint': server.fingerprint}), flush=True)
        while not server.stop.wait(.2):
            pass
