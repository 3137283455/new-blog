import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readerSettings, defaultReaderSettings } from '../../src/features/manga/reader-settings';
test('reader settings preserve all modes and clamp untrusted stored dimensions', () => {
  assert.deepEqual(readerSettings(null), defaultReaderSettings);
  assert.deepEqual(
    readerSettings({
      mode: 'double',
      direction: 'rtl',
      theme: 'paper',
      width: 9000,
      gap: -5,
      numbers: true,
    }),
    { mode: 'double', direction: 'rtl', theme: 'paper', width: 1400, gap: 0, numbers: true },
  );
  assert.equal(readerSettings({ mode: 'invalid', width: 'NaN' }).width, 980);
  assert.equal(readerSettings({ mode: 'paged' }).mode, 'paged');
});
