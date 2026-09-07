import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mangaSourceBackup, parseMangaSourceFile } from '../../src/features/admin/source-files';
const venera = {
  schema: 'boke-venera-repositories',
  version: 1,
  config: { repositories: [{ url: 'fixture', sources: [] }] },
};
const manga = { id: 'manga', kinds: ['manga'] },
  book = { id: 'book', kinds: ['book'] };
test('manga source backup round-trips both formats without unrelated source defaults', () => {
  const backup = mangaSourceBackup(
    { sources: [manga, book], defaults: { manga: 'manga' } },
    venera,
  );
  assert.deepEqual(backup.config.sources, [manga]);
  const plan = parseMangaSourceFile(backup);
  assert.equal(plan.sources[0].source.id, 'manga');
  assert.deepEqual(plan.venera, venera);
});
test('source import accepts independent Venera files and skips unrelated source kinds', () => {
  assert.deepEqual(parseMangaSourceFile(venera).venera, venera);
  const result = parseMangaSourceFile({
    schema: 'boke-content-search-source-bundle',
    version: 1,
    config: { sources: [manga, book] },
  });
  assert.equal(result.skipped, 1);
  assert.equal(result.sources.length, 1);
  assert.throws(
    () => parseMangaSourceFile({ schema: 'boke-content-search-source', version: 1 }),
    /不完整/,
  );
  assert.throws(() => parseMangaSourceFile({ ...venera, version: 2 }), /Venera/);
});
