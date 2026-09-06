const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const Database = require("better-sqlite3");
const {
  SourceStore,
  PersistentSourceMap,
} = require("../dist/modules/manga/storage/source-store");

test("source state is durable across map/store reconstruction and isolated by source/area", () => {
  const db = new Database(":memory:");
  try {
    const store = new SourceStore(db);
    const state = new PersistentSourceMap(store, "source-a", "data");
    state.set(
      "value",
      vm.runInNewContext(
        '({ map: new Map([["a", 1]]), bytes: new Uint8Array([1,2,3]).buffer })',
      ),
    );
    new PersistentSourceMap(store, "source-a", "settings").set(
      "quality",
      "original",
    );
    new PersistentSourceMap(store, "source-a", "cookies").set(
      "https://example.com",
      [{ name: "session", value: "fixture-private" }],
    );
    new PersistentSourceMap(store, "source-b", "data").set(
      "value",
      "different",
    );
    const restored = new SourceStore(db);
    assert.deepEqual(
      [...restored.readArea("source-a", "data").get("value").map],
      [["a", 1]],
    );
    assert.deepEqual(
      [
        ...new Uint8Array(
          restored.readArea("source-a", "data").get("value").bytes,
        ),
      ],
      [1, 2, 3],
    );
    assert.equal(
      restored.readArea("source-a", "settings").get("quality"),
      "original",
    );
    assert.equal(
      restored.readArea("source-a", "cookies").get("https://example.com")[0]
        .value,
      "fixture-private",
    );
    assert.equal(
      restored.readArea("source-b", "data").get("value"),
      "different",
    );
    state.delete("value");
    assert.equal(restored.readArea("source-a", "data").has("value"), false);
  } finally {
    db.close();
  }
});

test("source state rejects invalid/oversize writes without changing the previous value", () => {
  const db = new Database(":memory:");
  try {
    const state = new PersistentSourceMap(
      new SourceStore(db),
      "fixture",
      "data",
    );
    state.set("value", "original");
    assert.throws(() => state.set("value", () => {}), /序列化/);
    assert.throws(
      () => state.set("value", "x".repeat(4 * 1024 * 1024 + 1)),
      /4MiB/,
    );
    assert.equal(state.get("value"), "original");
    assert.equal(
      new SourceStore(db).readArea("fixture", "data").get("value"),
      "original",
    );
  } finally {
    db.close();
  }
});

test("script cache checks source URL/version/hash, and refresh does not delete source data", () => {
  const db = new Database(":memory:");
  try {
    const store = new SourceStore(db);
    const id = {
      id: "fixture",
      version: "1",
      script_url: "https://example.com/source.js",
    };
    store.writeScript(id, "original");
    store.write("fixture", "data", "remember", true);
    assert.equal(new SourceStore(db).readScript(id), "original");
    assert.equal(store.readScript({ ...id, version: "2" }), undefined);
    assert.equal(
      store.readScript({ ...id, script_url: "https://example.com/changed.js" }),
      undefined,
    );
    db.prepare("UPDATE manga_source_scripts SET code=?").run("tampered");
    assert.throws(() => store.readScript(id), /校验/);
    store.invalidateScripts(["fixture"]);
    assert.equal(store.readScript(id), undefined);
    assert.equal(store.readArea("fixture", "data").get("remember"), true);
  } finally {
    db.close();
  }
});

test("repository update/backup roundtrip preserves toggles and never exports private state", async () => {
  process.env.DB_PATH = ":memory:";
  const db = require("../dist/config/database").default;
  db.exec(
    "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT, type TEXT, description TEXT)",
  );
  const servicePath = require.resolve("../dist/services/venera-sources");
  let service = require(servicePath);
  const originalFetch = global.fetch;
  const repository =
    "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/index.json";
  let scripts = 0;
  const sourceCode = `class Fixture extends ComicSource {
    settings = { quality: { title: 'Quality', type: 'select', default: 'low', options: ['low','high'] } };
    init() { this.saveData('count', (this.loadData('count') || 0) + 1); Network.setCookies('https://fixture.example', [{name:'session',value:'private-fixture'}]); }
    search = { load: async () => ({comics:[{ id: 'fixture', title: this.loadSetting('quality') + ':' + this.loadData('count') }]}) };
    comic = { loadInfo: async () => ({}), loadEp: async () => ({images:[]}) };
  }`;
  global.fetch = async (url) => {
    if (String(url) === repository)
      return new Response(
        JSON.stringify([
          { fileName: "fixture.js", name: "Fixture", version: "1" },
        ]),
      );
    if (String(url) === new URL("fixture.js", repository).toString()) {
      scripts++;
      return new Response(sourceCode);
    }
    throw Error("unexpected remote URL");
  };
  try {
    await service.importVeneraRepository(repository);
    service.setVeneraSourceEnabled("venera:fixture", false);
    await service.importVeneraRepository(repository);
    assert.equal(service.getVeneraSources().length, 0);
    const snapshot = service.exportVeneraConfiguration();
    service.removeVeneraRepository(repository);
    service.importVeneraConfiguration(snapshot);
    assert.equal(service.getVeneraSources().length, 0);
    service.setVeneraSourceEnabled("venera:fixture", true);
    assert.equal(
      (await service.searchVeneraSource("venera:fixture", "test")).items[0]
        .title,
      "low:1",
    );
    await service.saveVeneraSourceSettings("venera:fixture", {
      quality: "high",
    });
    delete require.cache[servicePath];
    service = require(servicePath);
    assert.equal(
      (await service.searchVeneraSource("venera:fixture", "test")).items[0]
        .title,
      "high:2",
    );
    assert.equal(
      scripts,
      1,
      "valid script cache survives a runtime module restart",
    );
    const exported = JSON.stringify(service.exportVeneraConfiguration());
    assert.equal(exported.includes("private-fixture"), false);
    assert.equal(exported.includes("quality"), false);
    const before = exported;
    assert.throws(
      () =>
        service.importVeneraConfiguration({
          ...snapshot,
          config: {
            repositories: [
              { url: "https://evil.example/index.json", sources: [] },
            ],
          },
        }),
      /仓库/,
    );
    assert.equal(JSON.stringify(service.exportVeneraConfiguration()), before);
    await assert.rejects(
      service.saveVeneraSourceSettings("venera:fixture", { notDefined: 1 }),
      /未定义/,
    );
  } finally {
    global.fetch = originalFetch;
    db.close();
  }
});
