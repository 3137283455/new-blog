import base64
import hashlib
import json
import os
import sys
import tempfile
import time
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.accounting import validate_config
from server.storage import Store
from server.ssh_pull import SSHPoller, PullError, run_bounded


class SSHTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='traffic-ssh-test-')
        self.addCleanup(self.temp.cleanup)
        self.store = Store(self.temp.name)
        self.poller = SSHPoller(self.store)
        blob = b'fixture-host-public-key'
        self.hostkey = base64.b64encode(blob).decode()
        self.fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(blob).digest()).decode().rstrip('=')
        self.config = validate_config({'name': 'SSH fixture', 'collection_mode': 'ssh', 'host': '203.0.113.42',
                                       'ssh_port': 3101, 'ssh_fingerprint': self.fingerprint})
        self.node, self.token = self.store.create_node(self.config)
        self.poller.directory.mkdir()
        self.poller.key.touch()
        self.start = int(time.time()) // 300 * 300 - 300
        self.raw = {'jsonversion': '2', 'interfaces': [{'name': 'eth0', 'created': {'timestamp': 1},
                    'traffic': {'fiveminute': [{'timestamp': self.start, 'rx': 123, 'tx': 456}]}}]}
        self.calls = []

    def remote(self, args, **kwargs):
        self.calls.append(args)
        if args[0] == 'ssh-keyscan':
            return f'[203.0.113.42]:3101 ssh-ed25519 {self.hostkey}\n'
        return json.dumps(self.raw)

    def test_pull_uses_pinned_key_and_deduplicates(self):
        with patch('server.ssh_pull.run_bounded', side_effect=self.remote):
            self.assertEqual(self.poller.pull(self.node)['samples'], 1)
            self.poller.pull(self.node)
        self.assertEqual(len(self.store.buckets(self.node)), 1)
        self.assertEqual(self.store.buckets(self.node)[0]['tx'], 456)
        self.assertEqual(self.store.ssh_status(self.node)['error'], '')
        command = self.calls[1]
        self.assertIn('StrictHostKeyChecking=yes', command)
        self.assertIn('BatchMode=yes', command)
        self.assertIn('IdentityAgent=none', command)
        self.assertIn('traffic-monitor@203.0.113.42', command)
        self.assertEqual(command[-1], 'vnstat --json f --limit 0')
        self.assertTrue(self.store.ssh_status(self.node)['last_success'])

    def test_wrong_fingerprint_never_attempts_login(self):
        with patch('server.ssh_pull.run_bounded', return_value='host ssh-ed25519 YWJj\n') as run:
            with self.assertRaisesRegex(PullError, '指纹不匹配'):
                self.poller.pull(self.node)
        self.assertEqual(run.call_count, 1)
        self.assertEqual(self.store.buckets(self.node), [])
        self.assertIn('指纹不匹配', self.store.ssh_status(self.node)['error'])

    def test_missing_fingerprint_requires_setup(self):
        self.store.update_node(self.node, {**self.config, 'ssh_fingerprint': ''})
        with patch('server.ssh_pull.run_bounded') as run:
            with self.assertRaisesRegex(PullError, '主机指纹'):
                self.poller.pull(self.node)
        run.assert_not_called()

    def test_stale_inflight_settings_cannot_write(self):
        def changed(args, **kwargs):
            data = self.remote(args, **kwargs)
            if args[0] == 'ssh':
                self.store.update_node(self.node, {**self.config, 'archived': True})
            return data
        with patch('server.ssh_pull.run_bounded', side_effect=changed):
            with self.assertRaises(PullError):
                self.poller.pull(self.node)
        self.assertEqual(self.store.buckets(self.node), [])

    def test_invalid_data_is_not_recorded(self):
        self.raw['interfaces'][0]['traffic']['fiveminute'][0]['tx'] = -1
        with patch('server.ssh_pull.run_bounded', side_effect=self.remote):
            with self.assertRaises(PullError):
                self.poller.pull(self.node)
        self.assertEqual(self.store.buckets(self.node), [])

    def test_ssh_node_rejects_push_token(self):
        with self.assertRaises(PermissionError):
            self.store.ingest(self.node, self.token, 'spoof', [], agent={})

    def test_validation_blocks_options_commands_and_root(self):
        for config in ({'host': '-oProxyCommand=bad'}, {'host': 'example.com;id'}, {'ssh_user': 'root'},
                       {'ssh_user': 'user;id'}, {'ssh_port': 0}, {'ssh_fingerprint': 'bad'}):
            with self.assertRaises(ValueError):
                validate_config({**self.config, **config})

    def test_old_nodes_stay_in_push_mode(self):
        legacy, token = self.store.create_node({'name': 'existing'})
        self.assertEqual(next(n for n in self.store.nodes() if n['id'] == legacy)['config']['collection_mode'], 'agent')
        self.store.ingest(legacy, token, 'legacy', [])

    def test_scheduler_pulls_without_browser(self):
        received = threading.Event()
        with patch.object(self.poller, 'pull', side_effect=lambda node_id: received.set()) as pull:
            self.poller.start()
            try:
                self.assertTrue(received.wait(2))
                pull.assert_called_once_with(self.node)
            finally:
                self.poller.stop.set()

    def test_setup_never_exposes_private_key(self):
        with patch.object(self.poller, 'public_key', return_value='ssh-ed25519 YWJj'):
            setup = self.poller.setup(self.config)
        self.assertIn('restrict,command=', setup)
        self.assertIn("SSH_USER='traffic-monitor'", setup)
        self.assertNotIn('PRIVATE KEY', setup)
        self.assertNotIn(self.token, setup)

    def test_process_limits_and_no_shell(self):
        self.assertEqual(run_bounded([sys.executable, '-c', "print('ok')"]).strip(), 'ok')
        with self.assertRaisesRegex(PullError, '输出过大'):
            run_bounded([sys.executable, '-c', "print('x' * 1000)"], limit=100)
        with self.assertRaisesRegex(PullError, '超时'):
            run_bounded([sys.executable, '-c', 'import time; time.sleep(3)'], timeout=.1)

    def test_real_local_key_generation_persists(self):
        self.poller.key.unlink()
        public = self.poller.public_key()
        self.assertTrue(public.startswith('ssh-ed25519 '))
        self.assertEqual(public, self.poller.public_key())
        self.assertIn('PRIVATE KEY', self.poller.key.read_text())


if __name__ == '__main__':
    unittest.main()
