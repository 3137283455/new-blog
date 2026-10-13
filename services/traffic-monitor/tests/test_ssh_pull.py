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
from server.ssh_pull import SSHPoller, PullError, run_bounded, safe_error_detail


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

    def test_validated_cache_skips_second_scan_but_keeps_strict_checking(self):
        with patch('server.ssh_pull.run_bounded', side_effect=self.remote):
            self.poller.pull(self.node)
            self.poller.pull(self.node)
        scans = [call for call in self.calls if call[0] == 'ssh-keyscan']
        self.assertEqual(len(scans), 1)
        self.assertIn('10', scans[0])
        self.assertIn('StrictHostKeyChecking=yes', self.calls[-1])

    def test_empty_scan_is_not_fingerprint_mismatch(self):
        with patch('server.ssh_pull.run_bounded', return_value=''):
            with self.assertRaises(PullError) as error:
                self.poller.pull(self.node)
        self.assertEqual(error.exception.code, 'keyscan_empty')
        self.assertEqual(error.exception.stage, '主机密钥扫描')

    def test_changed_saved_fingerprint_invalidates_cache(self):
        with patch('server.ssh_pull.run_bounded', side_effect=self.remote):
            self.poller.pull(self.node)
            self.store.update_node(self.node, {**self.config, 'ssh_fingerprint': 'SHA256:' + 'A' * 43})
            with self.assertRaises(PullError) as error:
                self.poller.pull(self.node)
        self.assertEqual(error.exception.code, 'fingerprint_mismatch')
        self.assertEqual(len([call for call in self.calls if call[0] == 'ssh']), 1)

    def test_stage_and_exit_code_survive_status_and_response(self):
        failure = PullError('扫描失败', '主机密钥扫描', 'keyscan_failed', 'Connection closed by remote host', 1)
        with patch('server.ssh_pull.run_bounded', side_effect=failure):
            with self.assertRaises(PullError) as error:
                self.poller.pull(self.node)
        self.assertIs(error.exception, failure)
        self.assertEqual(error.exception.response()['error_code'], 'keyscan_failed')
        self.assertEqual(error.exception.response()['exit_code'], 1)
        self.assertIn('主机密钥扫描', self.store.ssh_status(self.node)['error'])

    def test_error_detail_does_not_dump_secrets_or_arbitrary_output(self):
        self.assertEqual(safe_error_detail(b'', b'arbitrary-private-token'), '')
        self.assertNotIn('secret-data', safe_error_detail(b'-----BEGIN OPENSSH PRIVATE KEY-----\nsecret-data'))
        self.assertNotIn('sensitive', safe_error_detail(b'Permission denied; token=sensitive'))
        self.assertIn('Failed to open database', safe_error_detail(b'', b'Error: Failed to open database vnstat.db'))

    def test_non_json_has_parse_stage(self):
        def non_json(args, **kwargs):
            return self.remote(args, **kwargs) if args[0] == 'ssh-keyscan' else 'login banner, not JSON'
        with patch('server.ssh_pull.run_bounded', side_effect=non_json):
            with self.assertRaises(PullError) as error:
                self.poller.pull(self.node)
        self.assertEqual(error.exception.code, 'invalid_json')

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

    def test_delete_requires_name_and_preserves_other_nodes(self):
        other, token = self.store.create_node({'name': 'keep me'})
        with patch('server.ssh_pull.run_bounded', side_effect=self.remote):
            self.poller.pull(self.node)
        with self.store.connect() as db:
            db.execute('INSERT INTO baselines VALUES (?,?,?,?)', (self.node, '2026-10-01', 123, self.start))
            db.execute('INSERT INTO alerts VALUES (?,?,?,?)', (self.node, '2026-10-01', 80, self.start))
        for name in (None, '', 'wrong name'):
            with self.assertRaises(ValueError):
                self.store.delete_node(self.node, name)
        self.assertEqual(len(self.store.nodes()), 2)
        self.store.delete_node(self.node, self.config['name'])
        self.assertEqual([n['id'] for n in self.store.nodes()], [other])
        self.assertFalse(self.store.valid_token(self.node, self.token))
        self.assertTrue(self.store.valid_token(other, token))
        with self.store.connect() as db:
            for table in ('buckets', 'sources', 'agents', 'baselines', 'alerts', 'ssh_polls'):
                self.assertEqual(db.execute(f'SELECT count(*) FROM {table} WHERE node_id=?', (self.node,)).fetchone()[0], 0)
        # A late poll cannot resurrect the deleted node, its status, or samples.
        self.store.record_ssh_poll(self.node, 'late failure')
        with self.assertRaises(PermissionError):
            self.store.ingest_ssh(self.node, self.config, 'late', [])
        self.assertIsNone(self.store.ssh_status(self.node)['last_attempt'])
        with self.assertRaises(KeyError):
            self.store.delete_node(self.node, self.config['name'])

    def test_delete_during_poll_cannot_resurrect_node(self):
        def deleted(args, **kwargs):
            result = self.remote(args, **kwargs)
            if args[0] == 'ssh':
                self.store.delete_node(self.node, self.config['name'])
            return result
        with patch('server.ssh_pull.run_bounded', side_effect=deleted):
            with self.assertRaises(PullError):
                self.poller.pull(self.node)
        self.assertEqual(self.store.nodes(), [])
        self.assertIsNone(self.store.ssh_status(self.node)['last_attempt'])


if __name__ == '__main__':
    unittest.main()
