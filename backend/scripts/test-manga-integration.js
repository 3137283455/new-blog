const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const express = require("express");
const sharp = require("sharp");

// This process never opens the user's database, and every remote request is stubbed.
process.env.DB_PATH = ":memory:";
const db = require("../dist/config/database").default;
const controller = require("../dist/controllers/content-sources");

test("public manga endpoints preserve context through runtime, media worker and response", async () => {
  const sourceId = "venera:" + "fixture-long-source-".repeat(4);
  const comicId = "comic/" + "c".repeat(190);
  const chapterId = "episode/" + "e".repeat(190);
  const imageUrl = "https://fixture.example/page.png";
  const repository =
    "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/index.json";
  const scriptUrl = new URL("test-fixture.js", repository).toString();
  db.exec(
    "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT, type TEXT, description TEXT)",
  );
  db.prepare("INSERT INTO settings(key,value) VALUES (?,?)").run(
    "venera_source_repositories",
    JSON.stringify({
      version: 1,
      repositories: [
        {
          url: repository,
          sources: [
            {
              id: sourceId,
              file_name: "test-fixture.js",
              script_url: scriptUrl,
              name: "Isolated fixture",
            },
          ],
        },
      ],
    }),
  );
  const raw = Buffer.from([
    255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255,
  ]);
  const encoded = await sharp(raw, {
    raw: { width: 2, height: 2, channels: 4 },
  })
    .png()
    .toBuffer();
  const script = `class Fixture extends ComicSource {
    async init() { await new Promise(resolve => setTimeout(resolve, 20)); this.ready = true; }
    search = { load: async () => { if (!this.ready) throw Error('not initialized'); return { comics: [{ id: ${JSON.stringify(comicId)}, title: 'Fixture' }] }; } };
    comic = {
      loadInfo: async id => ({ title: 'Fixture', chapters: { [${JSON.stringify(chapterId)}]: 'Wanted chapter' } }),
      loadEp: async (id, ep) => { if (ep === 'failed') throw Error('upstream unavailable'); if (id !== ${JSON.stringify(comicId)} || ep !== ${JSON.stringify(chapterId)}) throw Error('truncated IDs'); return { images: [${JSON.stringify(imageUrl)}] }; },
      onImageLoad: async (url, id, ep) => {
        if (!this.ready || id !== ${JSON.stringify(comicId)} || ep !== ${JSON.stringify(chapterId)}) throw Error('missing context');
        return { headers: { 'X-Fixture-Episode': ep }, onResponse: bytes => bytes,
          modifyImage: 'function modifyImage(image) { const result = Image.empty(image.width,image.height); result.fillImageAt(0,0,image.copyRange(0,1,2,1)); result.fillImageAt(0,1,image.copyRange(0,0,2,1)); return result; }' };
      },
      onThumbnailLoad: url => ({ url })
    };
  }`;
  const originalFetch = global.fetch;
  let scripts = 0;
  const seen = [];
  global.fetch = async (target, init) => {
    if (String(target) === scriptUrl) {
      scripts++;
      return new Response(script);
    }
    if (String(target) === imageUrl) {
      seen.push(new Headers(init.headers).get("X-Fixture-Episode"));
      return new Response(encoded, {
        headers: { "content-type": "application/octet-stream" },
      });
    }
    throw Error("Unexpected remote request in isolated test");
  };
  const app = express();
  app.get("/media", controller.media);
  app.get("/search", controller.search);
  app.get("/:kind/:source/:id/chapter/:chapterId", controller.chapter);
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const origin = `http://127.0.0.1:${server.address().port}`;
    const params = new URLSearchParams({
      source: sourceId,
      url: imageUrl,
      kind: "manga",
      purpose: "page",
      comic_id: comicId,
      chapter_id: chapterId,
    });
    const images = await Promise.all(
      [1, 2].map(() => originalFetch(`${origin}/media?${params}`)),
    );
    for (const response of images) {
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "image/png");
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      const actual = await sharp(Buffer.from(await response.arrayBuffer()))
        .raw()
        .toBuffer();
      assert.deepEqual(
        actual,
        Buffer.concat([raw.subarray(8), raw.subarray(0, 8)]),
      );
    }
    assert.equal(
      scripts,
      1,
      "concurrent requests initialize exactly one runtime",
    );
    assert.deepEqual(seen, [chapterId, chapterId]);
    const chapterUrl = `${origin}/manga/${encodeURIComponent(sourceId)}/${encodeURIComponent(comicId)}/chapter/`;
    const chapter = await (
      await originalFetch(chapterUrl + encodeURIComponent(chapterId))
    ).json();
    assert.equal(chapter.data.reader.chapter_id, chapterId);
    assert.deepEqual(chapter.data.reader.pages, [imageUrl]);
    const failed = await (await originalFetch(chapterUrl + "failed")).json();
    assert.equal(failed.data.reader.chapter_id, "failed");
    assert.ok(failed.data.reader.error);
    const search = await (
      await originalFetch(
        `${origin}/search?${new URLSearchParams({ kind: "manga", source: sourceId, q: "test" })}`,
      )
    ).json();
    assert.equal(search.data.items[0].external_id, comicId);
    params.delete("comic_id");
    assert.equal(
      (await originalFetch(`${origin}/media?${params}`)).status,
      400,
    );
    params.set("purpose", "thumbnail");
    const cover = await originalFetch(`${origin}/media?${params}`);
    assert.deepEqual(Buffer.from(await cover.arrayBuffer()), encoded);
  } finally {
    global.fetch = originalFetch;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }
});
