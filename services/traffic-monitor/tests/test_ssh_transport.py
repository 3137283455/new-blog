"""Optional real OpenSSH client / encrypted loopback server test (no real VPS).

Install paramiko in a test environment to run this; production does not need it.
"""
import base64
import hashlib
import importlib.util
import json
import logging
import socket
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.storage import Store
from server.ssh_pull import SSHPoller, PullError, run_bounded
from ssh_fixture import SSHFixture


@unittest.skipUnless(importlib.util.find_spec('paramiko'), 'optional: install paramiko for real SSH transport test')
class TransportTest(unittest.TestCase):
    def test_slow_real_handshake_and_stage_specific_failures(self):
        with tempfile.TemporaryDirectory(prefix='traffic-ssh-slow-') as directory:
            store = Store(directory)
            poller = SSHPoller(store)
            public = poller.public_key()
            with SSHFixture(public, handshake_delay=3.5) as fixture:
                node, _ = store.create_node({'name': 'slow handshake', 'collection_mode': 'ssh', 'host': '127.0.0.1',
                                            'ssh_port': fixture.port, 'ssh_fingerprint': fixture.fingerprint})
                self.assertEqual(poller.pull(node)['samples'], 1)
                fixture.handshake_delay = 0
                fixture.fail_auth = True
                with self.assertRaises(PullError) as rejected:
                    poller.pull(node)
                self.assertEqual(rejected.exception.code, 'authentication_failed')
                fixture.fail_auth = False
                fixture.exit_code = 1
                fixture.stdout = b'Error: Failed to open database vnstat.db in read-only mode.'
                with self.assertRaises(PullError) as remote:
                    poller.pull(node)
                self.assertEqual(remote.exception.stage, '远端 vnStat 查询')
                self.assertEqual(remote.exception.code, 'remote_command_failed')
                self.assertEqual(remote.exception.exit_code, 1)
                self.assertIn('Failed to open database', remote.exception.detail)
                fixture.exit_code = 0
                fixture.stdout = b'invalid JSON banner'
                with self.assertRaises(PullError) as invalid:
                    poller.pull(node)
                self.assertEqual(invalid.exception.code, 'invalid_json')

    def test_real_encrypted_pull_and_host_mismatch(self):
        import paramiko
        logging.getLogger('paramiko').setLevel(logging.CRITICAL)
        with tempfile.TemporaryDirectory(prefix='traffic-ssh-transport-') as directory:
            store = Store(str(Path(directory) / 'data with spaces'))
            poller = SSHPoller(store)
            public = poller.public_key()
            hostfile = Path(directory) / 'hostkey'
            run_bounded(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-f', str(hostfile)])
            hostkey = paramiko.Ed25519Key.from_private_key_file(str(hostfile))
            fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(hostkey.asbytes()).digest()).decode().rstrip('=')
            start = int(time.time()) // 300 * 300 - 300
            raw = json.dumps({'jsonversion': '2', 'interfaces': [{'name': 'eth0', 'created': {'timestamp': 1},
                              'traffic': {'fiveminute': [{'timestamp': start, 'rx': 120, 'tx': 340}]}}]}).encode()
            commands = []
            sessions = []

            class Server(paramiko.ServerInterface):
                def get_allowed_auths(self, username):
                    return 'publickey'

                def check_auth_publickey(self, username, key):
                    return paramiko.AUTH_SUCCESSFUL if username == 'traffic-monitor' and key.get_base64() == public.split()[1] else paramiko.AUTH_FAILED

                def check_channel_request(self, kind, chanid):
                    return paramiko.OPEN_SUCCEEDED if kind == 'session' else paramiko.OPEN_FAILED_ADMINISTRATIVELY_PROHIBITED

                def check_channel_exec_request(self, channel, command):
                    commands.append(command.decode())
                    def respond():
                        time.sleep(.05)  # Let Paramiko acknowledge the exec request first.
                        channel.sendall(raw)
                        channel.send_exit_status(0)
                        channel.shutdown_write()
                        channel.close()
                    threading.Thread(target=respond, daemon=True).start()
                    return True

            listener = socket.socket()
            listener.bind(('127.0.0.1', 0))
            listener.listen()
            listener.settimeout(.2)
            stop = threading.Event()

            def handle(client):
                transport = paramiko.Transport(client)
                sessions.append(transport)
                try:
                    transport.add_server_key(hostkey)
                    transport.start_server(server=Server())
                    while transport.is_active() and not stop.wait(.05):
                        pass
                except (EOFError, OSError, paramiko.SSHException):
                    pass  # ssh-keyscan disconnects after discovering the server key.
                finally:
                    transport.close()

            def accept():
                while not stop.is_set():
                    try:
                        client, _ = listener.accept()
                    except socket.timeout:
                        continue
                    except OSError:
                        return
                    threading.Thread(target=handle, args=(client,), daemon=True).start()

            worker = threading.Thread(target=accept, daemon=True)
            worker.start()
            try:
                node, _ = store.create_node({'name': 'loopback', 'collection_mode': 'ssh', 'host': '127.0.0.1',
                                            'ssh_port': listener.getsockname()[1], 'ssh_fingerprint': fingerprint})
                self.assertEqual(poller.pull(node)['samples'], 1)
                self.assertEqual(store.buckets(node)[0]['tx'], 340)
                self.assertEqual(commands, ['vnstat --json f --limit 0'])
                config = store.nodes()[0]['config']
                store.update_node(node, {**config, 'ssh_fingerprint': 'SHA256:' + 'A' * 43})
                with self.assertRaisesRegex(PullError, '指纹不匹配'):
                    poller.pull(node)
                self.assertEqual(len(commands), 1)
            finally:
                stop.set()
                listener.close()
                for transport in sessions:
                    transport.close()
                worker.join(2)


if __name__ == '__main__':
    unittest.main()
