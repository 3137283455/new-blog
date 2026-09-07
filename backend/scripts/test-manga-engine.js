const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const sharp = require("sharp");
const { transformImage } = require("../dist/modules/manga/images/transform");
const { createImageApi } = require("../dist/modules/manga/images/image-api");
const { loadSourceImage } = require("../dist/modules/manga/images/pipeline");
const {
  readLimitedBody,
  imageBytes,
} = require("../dist/modules/manga/images/binary");
const { invokeSource } = require("../dist/modules/manga/runtime/invocation");
const { loadExactChapter } = require("../dist/modules/manga/runtime/chapter");

const pixelFixture = async (width = 7, height = 23) => {
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      pixels.set(
        [(x * 11) % 256, (y * 9) % 256, (x + y) % 256, 80 + (y % 176)],
        i,
      );
    }
  const bytes = await sharp(pixels, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
  return { pixels, bytes, width, height };
};
const decode = (bytes) => sharp(bytes).ensureAlpha().raw().toBuffer();
const direct = (callback, args, receiver) =>
  Promise.resolve(callback.apply(receiver, args));
const dependencies = (comic, fetcher) => ({
  comic,
  invoke: direct,
  validateUrl: (value) => new URL(value).toString(),
  fetch: fetcher,
});
const url = "https://images.example/page.png";
const page = { purpose: "page", comicId: "book-123", chapterId: "chapter-456" };

test("strip rearrangement reconstructs every RGBA pixel, including remainder rows", async () => {
  for (const height of [20, 23]) {
    const fixture = await pixelFixture(7, height);
    const count = 4,
      base = Math.floor(height / count),
      remainder = height % count;
    const shuffled = Buffer.alloc(fixture.pixels.length);
    // Original top block is the enlarged last encoded block. Independent encoder.
    for (let block = 0; block < count; block++) {
      const length = base + (block === count - 1 ? remainder : 0);
      const sourceRow = height - block * base - length;
      fixture.pixels.copy(
        shuffled,
        block * base * 7 * 4,
        sourceRow * 7 * 4,
        (sourceRow + length) * 7 * 4,
      );
    }
    const encoded = await sharp(shuffled, {
      raw: { width: 7, height, channels: 4 },
    })
      .png()
      .toBuffer();
    assert.notDeepEqual(await decode(encoded), fixture.pixels);
    const script = `function modifyImage(image) {
      const result = Image.empty(image.width, image.height);
      const size = Math.floor(image.height / ${count});
      let target = 0;
      for (let block = ${count} - 1; block >= 0; block--) {
        const length = size + (block === ${count} - 1 ? image.height % ${count} : 0);
        result.fillImageRangeAt(0, target, image, 0, block * size, image.width, length);
        target += length;
      }
      return result;
    }`;
    const result = await transformImage(encoded, script);
    assert.deepEqual(
      [result.width, result.height, result.contentType],
      [7, height, "image/png"],
    );
    assert.deepEqual(await decode(result.bytes), fixture.pixels);
  }
});

test("ordinary wide and tall images are returned byte-for-byte, not cropped/resized", async () => {
  for (const [width, height] of [
    [300, 17],
    [3, 6000],
  ]) {
    const fixture = await pixelFixture(width, height);
    const result = await transformImage(fixture.bytes);
    assert.deepEqual(result.bytes, fixture.bytes);
    assert.deepEqual([result.width, result.height], [width, height]);
  }
});

test("GIF bytes and frames remain untouched without modifyImage", async () => {
  const frames = Buffer.from([255, 0, 0, 255, 0, 255, 0, 255]);
  const gif = await sharp(frames, {
    raw: { width: 1, height: 2, channels: 4, pageHeight: 1 },
  })
    .gif({ delay: [100, 200], loop: 0 })
    .toBuffer();
  assert.equal((await sharp(gif).metadata()).pages, 2);
  const result = await transformImage(gif);
  assert.equal(result.contentType, "image/gif");
  assert.deepEqual(result.bytes, gif);
});

test("Image copy/rotate match coordinate semantics, bounds are enforced", () => {
  const { Image, dataOf } = createImageApi();
  const image = new Image(
    2,
    3,
    Buffer.from([1, 2, 3, 4, 5, 6].flatMap((value) => [value, 0, 0, 255])),
  );
  assert.deepEqual(
    [...dataOf(image.copyAndRotate90())].filter((_, i) => i % 4 === 0),
    [5, 3, 1, 6, 4, 2],
  );
  const copy = image.copyRange(1, 1, 1, 2);
  assert.deepEqual(
    [...dataOf(copy)].filter((_, i) => i % 4 === 0),
    [4, 6],
  );
  const output = Image.empty(2, 3);
  output.fillImageAt(0, 0, image);
  assert.deepEqual(dataOf(output), dataOf(image));
  assert.throws(() => image.copyRange(1, 0, 2, 1), /边界/);
  assert.throws(() => Image.empty(1e9, 1e9), /像素/);
  assert.throws(() => image.copyRange(0.5, 0, 1, 1), /整数/);
});

test("invalid image/script fails explicitly and does not return scrambled original", async () => {
  const fixture = await pixelFixture();
  await assert.rejects(transformImage(Buffer.from("<html>blocked</html>")));
  await assert.rejects(
    transformImage(
      fixture.bytes,
      'function modifyImage(image) { throw new Error("bad rule") }',
    ),
    /bad rule/,
  );
  await assert.rejects(
    transformImage(
      fixture.bytes,
      "function modifyImage(image) { return null }",
    ),
    /Image/,
  );
  await assert.rejects(
    transformImage(
      fixture.bytes,
      "function modifyImage(image) { return Image.empty(999999,999999) }",
    ),
    /像素/,
  );
});

test("worker runaway rule is terminated; next image still succeeds", async () => {
  const fixture = await pixelFixture();
  await assert.rejects(
    transformImage(
      fixture.bytes,
      "function modifyImage(image) { while(true) {} }",
    ),
    /timed out|超时/,
  );
  assert.deepEqual((await transformImage(fixture.bytes)).bytes, fixture.bytes);
});

test("active and pre-aborted worker requests cancel without poisoning queue", async () => {
  const fixture = await pixelFixture();
  await assert.rejects(
    transformImage(fixture.bytes, undefined, AbortSignal.abort()),
    /取消/,
  );
  const controller = new AbortController();
  const pending = transformImage(
    fixture.bytes,
    "function modifyImage(image) { while(true) {} }",
    controller.signal,
  );
  controller.abort();
  await assert.rejects(pending, /取消/);
  assert.deepEqual((await transformImage(fixture.bytes)).bytes, fixture.bytes);
});

test("page handler receives complete IDs and its receiver; thumbnail has separate contract", async () => {
  const fixture = await pixelFixture();
  const calls = [];
  const comic = {
    flag: "receiver",
    onImageLoad(...args) {
      calls.push([this.flag, ...args]);
      return { headers: { Referer: "https://source.example/" } };
    },
    onThumbnailLoad(...args) {
      calls.push(["cover", ...args]);
      return {
        modifyImage: "invalid script",
        onLoadFailed() {
          throw Error("must not call");
        },
      };
    },
  };
  const deps = dependencies(comic, async () => new Response(fixture.bytes));
  await loadSourceImage(url, page, deps);
  await loadSourceImage(url, { purpose: "thumbnail" }, deps);
  assert.deepEqual(calls, [
    ["receiver", url, page.comicId, page.chapterId],
    ["cover", url],
  ]);
});

test("onResponse cross-realm buffers decode with correct MIME; null retains unconsumed bytes", async () => {
  const fixture = await pixelFixture();
  for (const mode of ["buffer", "null"]) {
    const comic = {
      onImageLoad() {
        return {
          onResponse() {
            return mode === "buffer"
              ? vm.runInNewContext("new Uint8Array(bytes).buffer", {
                  bytes: [...fixture.bytes],
                })
              : null;
          },
        };
      },
    };
    const result = await loadSourceImage(
      url,
      page,
      dependencies(
        comic,
        async () =>
          new Response(
            mode === "buffer" ? Buffer.from("encrypted") : fixture.bytes,
            { headers: { "content-type": "application/octet-stream" } },
          ),
      ),
    );
    assert.equal(result.contentType, "image/png");
    assert.deepEqual(result.bytes, fixture.bytes);
  }
});

test("transport, HTTP, decoder and callback failures use bounded page fallback", async () => {
  const fixture = await pixelFixture();
  for (const mode of ["transport", "http", "decode", "callback"]) {
    let requests = 0,
      retries = 0;
    const comic = {
      onImageLoad() {
        return {
          ...(mode === "callback"
            ? {
                onResponse() {
                  throw Error("decrypt failed");
                },
              }
            : {}),
          onLoadFailed() {
            retries++;
            return { url: "https://images.example/fallback.png" };
          },
        };
      },
    };
    const result = await loadSourceImage(
      url,
      page,
      dependencies(comic, async () => {
        requests++;
        if (requests > 1) return new Response(fixture.bytes);
        if (mode === "transport") throw Error("offline");
        if (mode === "http") return new Response("no", { status: 403 });
        return new Response(mode === "decode" ? "not an image" : fixture.bytes);
      }),
    );
    assert.deepEqual(result.bytes, fixture.bytes);
    assert.deepEqual([requests, retries], [2, 1]);
  }
  let requests = 0;
  const config = {
    onLoadFailed() {
      return config;
    },
  };
  await assert.rejects(
    loadSourceImage(
      url,
      page,
      dependencies({ onImageLoad: () => config }, async () => {
        requests++;
        return new Response("no", { status: 403 });
      }),
    ),
  );
  assert.equal(requests, 3);
});

test("thumbnail and client cancellation never run page fallbacks", async () => {
  let retries = 0;
  const config = {
    onLoadFailed() {
      retries++;
      return {};
    },
  };
  const comic = { onImageLoad: () => config, onThumbnailLoad: () => config };
  await assert.rejects(
    loadSourceImage(
      url,
      { purpose: "thumbnail" },
      dependencies(comic, async () => new Response("no", { status: 403 })),
    ),
  );
  await assert.rejects(
    loadSourceImage(
      url,
      { ...page, signal: AbortSignal.abort() },
      dependencies(comic, async () => {
        throw Error("must not fetch");
      }),
    ),
  );
  assert.equal(retries, 0);
});

test("redirects validate each destination and drop credentials across origins", async () => {
  const fixture = await pixelFixture();
  const seen = [];
  const deps = dependencies(
    {
      onImageLoad: () => ({
        headers: { Authorization: "test-only", Cookie: "test-only" },
      }),
    },
    async (target, init) => {
      seen.push([target, new Headers(init.headers)]);
      return seen.length === 1
        ? new Response(null, {
            status: 302,
            headers: { location: "https://cdn.example/final.png" },
          })
        : new Response(fixture.bytes);
    },
  );
  await loadSourceImage(url, page, deps);
  assert.equal(seen.length, 2);
  assert.equal(seen[0][1].get("authorization"), "test-only");
  assert.equal(seen[1][1].get("authorization"), null);
  assert.equal(seen[1][1].get("cookie"), null);
  let validates = 0;
  await assert.rejects(
    loadSourceImage(url, page, {
      ...deps,
      validateUrl(value) {
        if (++validates > 2) throw Error("blocked destination");
        return String(value);
      },
      fetch: async () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1/no" },
        }),
    }),
    /blocked destination/,
  );
});

test("streaming byte limits enforce undeclared and declared oversized bodies", async () => {
  await assert.rejects(readLimitedBody(new Response("12345"), 4), /限制/);
  await assert.rejects(
    readLimitedBody(
      new Response("1", { headers: { "content-length": "100" } }),
      4,
    ),
    /限制/,
  );
  assert.deepEqual(
    await readLimitedBody(new Response("1234"), 4),
    Buffer.from("1234"),
  );
  assert.throws(() => imageBytes("not binary"));
});

test("concurrent VM calls keep lexical args through await and clean temporary slots", async () => {
  const context = vm.createContext({ setTimeout });
  const expression =
    "(async () => { await new Promise(resolve => setTimeout(resolve, __venera_args__[1])); return __venera_args__[0]; })()";
  const results = await Promise.all([
    invokeSource(context, expression, ["first", 30], "fixture"),
    invokeSource(context, expression, ["second", 1], "fixture"),
  ]);
  assert.deepEqual(results, ["first", "second"]);
  assert.equal(
    Object.keys(context).some((key) => key.startsWith("__boke_invocation_")),
    false,
  );
  await assert.rejects(
    invokeSource(context, '(() => { throw Error("sync") })()', [], "fixture"),
    /sync/,
  );
  await assert.rejects(
    invokeSource(context, "new Promise(() => {})", [], "fixture", 10),
    /超时/,
  );
  assert.equal(
    Object.keys(context).some((key) => key.startsWith("__boke_invocation_")),
    false,
  );
});

test("chapter failure/empty results never substitute adjacent chapter", async () => {
  for (const fail of [true, false]) {
    const calls = [];
    const result = await loadExactChapter(
      "comic",
      "wanted",
      async (...args) => {
        calls.push(args);
        if (fail) throw Error("failed");
        return { images: [] };
      },
    );
    assert.deepEqual(calls, [["comic", "wanted"]]);
    assert.equal(result.chapter_id, "wanted");
    assert.ok(result.error);
    assert.deepEqual(result.pages, []);
  }
  const result = await loadExactChapter("comic", "wanted", async () => ({
    images: [url, { url: url + "?2" }],
    title: "chapter title",
  }));
  assert.deepEqual(result.pages, [url, url + "?2"]);
  assert.equal(result.error, "");
});
