import assert from 'node:assert/strict';
import test from 'node:test';
import { toast } from '../../src/shared/ui/toast';

test('global toast deduplicates messages, caps the visible stack and clears cleanly', () => {
  toast.clear();
  toast.success('保存成功');
  toast.success('保存成功');
  assert.equal(toast.snapshot().length, 1);

  toast.info('开始处理');
  toast.warning('需要确认');
  toast.error('处理失败');
  const items = toast.snapshot();
  assert.equal(items.length, 3);
  assert.deepEqual(items.map((item) => item.kind), ['info', 'warning', 'error']);

  toast.dismiss(items[1].id);
  assert.equal(toast.snapshot().length, 2);
  toast.clear();
  assert.deepEqual(toast.snapshot(), []);
});
