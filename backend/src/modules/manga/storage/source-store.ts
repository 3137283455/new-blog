import type Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { serialize, deserialize } from "node:v8";

export type StateArea = "data" | "settings" | "cookies";
export type ScriptIdentity = {
  id: string;
  script_url: string;
  version: string;
};
export const SOURCE_STORAGE_TABLES = [
  "manga_source_state",
  "manga_source_scripts",
] as const;

export function migrateSourceStorage(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS manga_source_state (
      source_id TEXT NOT NULL, area TEXT NOT NULL, state_key TEXT NOT NULL,
      payload BLOB NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY(source_id, area, state_key)
    );
    CREATE TABLE IF NOT EXISTS manga_source_scripts (
      source_id TEXT PRIMARY KEY, script_url TEXT NOT NULL, version TEXT NOT NULL,
      sha256 TEXT NOT NULL, code TEXT NOT NULL, fetched_at TEXT NOT NULL
    );
  `);
}

/** Persistence boundary; source sessions are private and never part of public settings. */
export class SourceStore {
  private ready = false;
  constructor(private readonly db: Database.Database) {}
  private ensure() {
    if (!this.ready) {
      migrateSourceStorage(this.db);
      this.ready = true;
    }
  }

  readArea(sourceId: string, area: StateArea): Map<string, unknown> {
    this.ensure();
    const rows = this.db
      .prepare(
        "SELECT state_key,payload FROM manga_source_state WHERE source_id=? AND area=?",
      )
      .all(sourceId, area) as Array<{ state_key: string; payload: Buffer }>;
    const values = new Map<string, unknown>();
    for (const row of rows) {
      try {
        values.set(row.state_key, deserialize(row.payload));
      } catch {
        throw new Error(`漫画源 ${sourceId} 的持久化状态损坏；未覆盖原数据`);
      }
    }
    return values;
  }

  write(sourceId: string, area: StateArea, key: string, value: unknown) {
    this.ensure();
    if (!key || key.length > 500)
      throw new Error("源状态键必须为 1–500 个字符");
    let payload: Buffer;
    try {
      payload = serialize(value);
    } catch {
      throw new Error("源状态不能包含函数等不可序列化对象");
    }
    if (payload.length > 4 * 1024 * 1024)
      throw new Error("单个源状态超过 4MiB 限制");
    this.db.transaction(() => {
      const size = this.db
        .prepare(
          "SELECT COUNT(*) AS count, COALESCE(SUM(length(payload)),0) AS bytes FROM manga_source_state WHERE source_id=? AND NOT (area=? AND state_key=?)",
        )
        .get(sourceId, area, key) as { count: number; bytes: number };
      if (size.count >= 2000 || size.bytes + payload.length > 32 * 1024 * 1024)
        throw new Error("源状态存储超过限制");
      this.db
        .prepare(
          `INSERT INTO manga_source_state(source_id,area,state_key,payload,updated_at) VALUES (?,?,?,?,?)
        ON CONFLICT(source_id,area,state_key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`,
        )
        .run(sourceId, area, key, payload, new Date().toISOString());
    })();
  }

  delete(sourceId: string, area: StateArea, key: string) {
    this.ensure();
    return (
      this.db
        .prepare(
          "DELETE FROM manga_source_state WHERE source_id=? AND area=? AND state_key=?",
        )
        .run(sourceId, area, key).changes > 0
    );
  }

  readScript(identity: ScriptIdentity): string | undefined {
    this.ensure();
    const row = this.db
      .prepare(
        "SELECT code,sha256 FROM manga_source_scripts WHERE source_id=? AND script_url=? AND version=?",
      )
      .get(identity.id, identity.script_url, identity.version) as
      { code: string; sha256: string } | undefined;
    if (!row) return undefined;
    if (createHash("sha256").update(row.code).digest("hex") !== row.sha256)
      throw new Error("源脚本缓存校验失败；请重新同步仓库");
    return row.code;
  }

  writeScript(identity: ScriptIdentity, code: string) {
    this.ensure();
    if (Buffer.byteLength(code) > 2 * 1024 * 1024)
      throw new Error("源脚本超过 2MiB 限制");
    this.db
      .prepare(
        `INSERT INTO manga_source_scripts(source_id,script_url,version,sha256,code,fetched_at) VALUES (?,?,?,?,?,?)
      ON CONFLICT(source_id) DO UPDATE SET script_url=excluded.script_url,version=excluded.version,sha256=excluded.sha256,code=excluded.code,fetched_at=excluded.fetched_at`,
      )
      .run(
        identity.id,
        identity.script_url,
        identity.version,
        createHash("sha256").update(code).digest("hex"),
        code,
        new Date().toISOString(),
      );
  }

  invalidateScripts(sourceIds: string[]) {
    this.ensure();
    const remove = this.db.prepare(
      "DELETE FROM manga_source_scripts WHERE source_id=?",
    );
    this.db.transaction(() => sourceIds.forEach((id) => remove.run(id)))();
  }
}

export class PersistentSourceMap extends Map<string, unknown> {
  constructor(
    private readonly store: SourceStore,
    private readonly sourceId: string,
    private readonly area: StateArea,
  ) {
    super();
    for (const [key, value] of store.readArea(sourceId, area))
      super.set(key, value);
  }
  override set(key: string, value: unknown) {
    this.store.write(this.sourceId, this.area, key, value);
    return super.set(key, value);
  }
  override delete(key: string) {
    this.store.delete(this.sourceId, this.area, key);
    return super.delete(key);
  }
  override clear() {
    for (const key of this.keys()) this.delete(key);
  }
}
