import db from "../../config/database";
import { sourceStore } from "./storage/database-store";
import { readLimitedBody } from "./images/binary";

export const DEFAULT_VENERA_REPOSITORY =
  "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/index.json";

export type VeneraSourceRecord = {
  id: string;
  key: string;
  name: string;
  version: string;
  description: string;
  file_name: string;
  script_url: string;
  repository_url: string;
  enabled: boolean;
};

export type VeneraRepository = {
  url: string;
  name: string;
  updated_at: string;
  sources: VeneraSourceRecord[];
};

export type VeneraRepositoryConfig = {
  version: 1;
  repositories: VeneraRepository[];
};
const SETTING_KEY = "venera_source_repositories";
export let sourceConfigurationRevision = 0;

export function clean(value: unknown, max = 500) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}
function slug(value: unknown) {
  return clean(value, 120)
    .toLowerCase()
    .replace(/\.js$/i, "")
    .replace(/[^a-z0-9_-]+/g, "-");
}
function allowedRepositoryUrl(value: unknown) {
  try {
    const url = new URL(clean(value, 2000));
    if (url.protocol !== "https:") return "";
    const jsdelivr =
      url.hostname === "cdn.jsdelivr.net" &&
      /^\/gh\/venera-app\/venera-configs@[^/]+\/index\.json$/i.test(
        url.pathname,
      );
    const github =
      url.hostname === "raw.githubusercontent.com" &&
      /^\/venera-app\/venera-configs\/[^/]+\/index\.json$/i.test(url.pathname);
    return jsdelivr || github ? url.toString() : "";
  } catch {
    return "";
  }
}
function allowedScriptUrl(value: unknown) {
  try {
    const url = new URL(clean(value, 2000));
    if (
      url.protocol !== "https:" ||
      !url.pathname.toLowerCase().endsWith(".js")
    )
      return "";
    const jsdelivr =
      url.hostname === "cdn.jsdelivr.net" &&
      /^\/gh\/venera-app\/venera-configs@[^/]+\//i.test(url.pathname);
    const github =
      url.hostname === "raw.githubusercontent.com" &&
      /^\/venera-app\/venera-configs\/[^/]+\//i.test(url.pathname);
    return jsdelivr || github ? url.toString() : "";
  } catch {
    return "";
  }
}
function normalizeConfig(value: unknown): VeneraRepositoryConfig {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as any)
      : {};
  const repositories = (Array.isArray(raw.repositories) ? raw.repositories : [])
    .slice(0, 8)
    .flatMap((repository: any) => {
      const url = allowedRepositoryUrl(repository?.url);
      if (!url) return [];
      const sources = (
        Array.isArray(repository?.sources) ? repository.sources : []
      )
        .slice(0, 100)
        .flatMap((item: any) => {
          const scriptUrl = allowedScriptUrl(item?.script_url);
          const fileName = clean(item?.file_name, 180);
          const id = clean(
            item?.id || `venera:${slug(fileName || item?.key)}`,
            180,
          );
          if (!id.startsWith("venera:") || !scriptUrl || !fileName) return [];
          return [
            {
              id,
              key: clean(item?.key || slug(fileName), 120),
              name: clean(item?.name || item?.key || fileName, 160),
              version: clean(item?.version || "0.0.0", 40),
              description: clean(item?.description, 500),
              file_name: fileName,
              script_url: scriptUrl,
              repository_url: url,
              enabled: item?.enabled !== false,
            } as VeneraSourceRecord,
          ];
        });
      return [
        {
          url,
          name: clean(repository?.name || "Venera 官方源仓库", 120),
          updated_at: clean(repository?.updated_at, 60),
          sources,
        },
      ];
    });
  return { version: 1, repositories };
}
export function getVeneraRepositoryConfig(): VeneraRepositoryConfig {
  const row = db
    .prepare("SELECT value FROM settings WHERE key=?")
    .get(SETTING_KEY) as any;
  if (!row?.value) return { version: 1, repositories: [] };
  try {
    return normalizeConfig(JSON.parse(row.value));
  } catch {
    return { version: 1, repositories: [] };
  }
}
function saveConfig(config: VeneraRepositoryConfig) {
  const normalized = normalizeConfig(config);
  db.prepare(
    "INSERT OR REPLACE INTO settings (key,value,type,description) VALUES (?,?,'json','Venera JavaScript 漫画源仓库')",
  ).run(SETTING_KEY, JSON.stringify(normalized));
  sourceConfigurationRevision++;
  return normalized;
}
export async function fetchLimited(
  url: string,
  maxBytes: number,
  timeout = 20000,
) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json,text/javascript,text/plain,*/*",
      "User-Agent": "new-blog-venera/1.0",
    },
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`Venera 源仓库 HTTP ${response.status}`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new Error("Venera 源文件超过大小限制");
  return (await readLimitedBody(response, maxBytes)).toString("utf8");
}
export async function importVeneraRepository(input: unknown) {
  const url = allowedRepositoryUrl(input);
  if (!url)
    throw new Error(
      "目前仅允许导入 venera-app/venera-configs 的 jsDelivr 或 GitHub Raw 索引",
    );
  const text = await fetchLimited(url, 1024 * 1024);
  let list: any[];
  try {
    list = JSON.parse(text);
  } catch {
    throw new Error("Venera 源仓库返回的不是有效 JSON");
  }
  if (!Array.isArray(list)) throw new Error("Venera 源仓库根节点必须是数组");
  const seen = new Set<string>();
  const sources = list
    .slice(0, 100)
    .flatMap((item: any): VeneraSourceRecord[] => {
      const fileName = clean(item?.fileName || item?.filename, 180);
      const direct = clean(item?.url, 2000);
      let scriptUrl = "";
      try {
        scriptUrl = allowedScriptUrl(
          direct || new URL(fileName, url).toString(),
        );
      } catch {}
      const baseId = slug(fileName || item?.key);
      if (!fileName || !scriptUrl || !baseId || seen.has(baseId)) return [];
      seen.add(baseId);
      return [
        {
          id: `venera:${baseId}`,
          key: clean(item?.key || baseId, 120),
          name: clean(item?.name || item?.key || baseId, 160),
          version: clean(item?.version || "0.0.0", 40),
          description: clean(item?.description, 500),
          file_name: fileName,
          script_url: scriptUrl,
          repository_url: url,
          enabled: true,
        },
      ];
    });
  if (!sources.length)
    throw new Error("仓库没有可用的 Venera JavaScript 漫画源");
  const current = getVeneraRepositoryConfig();
  const previous = new Map(
    current.repositories
      .find((item) => item.url === url)
      ?.sources.map((item) => [item.id, item]) || [],
  );
  for (const source of sources)
    source.enabled = previous.get(source.id)?.enabled ?? true;
  const repository: VeneraRepository = {
    url,
    name: "Venera 官方源仓库",
    updated_at: new Date().toISOString(),
    sources,
  };
  const repositories = current.repositories.some((item) => item.url === url)
    ? current.repositories.map((item) => (item.url === url ? repository : item))
    : [...current.repositories, repository];
  if (repositories.length > 8) throw new Error("最多保留 8 个仓库");
  const sourceIds = repositories.flatMap((item) =>
    item.sources.map((source) => source.id),
  );
  if (new Set(sourceIds).size !== sourceIds.length)
    throw new Error("仓库包含已存在的源 ID；请先移除重复仓库");
  const saved = saveConfig({ version: 1, repositories });
  sourceStore.invalidateScripts(sources.map((source) => source.id));
  return saved;
}
export function removeVeneraRepository(input: unknown) {
  const url = allowedRepositoryUrl(input);
  const current = getVeneraRepositoryConfig();
  return saveConfig({
    version: 1,
    repositories: current.repositories.filter((item) => item.url !== url),
  });
}
export function exportVeneraConfiguration() {
  return {
    schema: "boke-venera-repositories",
    version: 1,
    config: getVeneraRepositoryConfig(),
  };
}
export function importVeneraConfiguration(
  input: unknown,
  mode: unknown = "merge",
) {
  const file = input as any;
  if (
    file?.schema !== "boke-venera-repositories" ||
    file?.version !== 1 ||
    !Array.isArray(file.config?.repositories)
  )
    throw new Error("不是有效的 Venera 仓库配置文件");
  if (!["merge", "replace"].includes(String(mode)))
    throw new Error("导入模式必须为 merge 或 replace");
  if (file.config.repositories.length > 8) throw new Error("最多保留 8 个仓库");
  const normalized = normalizeConfig(file.config);
  if (normalized.repositories.length !== file.config.repositories.length)
    throw new Error("配置包含不支持的仓库地址");
  const seen = new Set<string>();
  for (let index = 0; index < normalized.repositories.length; index++) {
    const repository = normalized.repositories[index];
    if (
      !Array.isArray(file.config.repositories[index].sources) ||
      repository.sources.length !==
        file.config.repositories[index].sources.length
    )
      throw new Error("配置包含无效源；未导入任何内容");
    for (const source of repository.sources) {
      if (seen.has(source.id))
        throw new Error(`配置包含重复源 ID：${source.id}`);
      seen.add(source.id);
    }
  }
  const existing = getVeneraRepositoryConfig();
  const repositories =
    mode === "replace"
      ? normalized.repositories
      : [
          ...existing.repositories.filter(
            (item) =>
              !normalized.repositories.some(
                (incoming) => incoming.url === item.url,
              ),
          ),
          ...normalized.repositories,
        ];
  if (repositories.length > 8)
    throw new Error("合并后仓库超过 8 个；未导入任何内容");
  if (
    new Set(repositories.map((item) => item.url)).size !== repositories.length
  )
    throw new Error("配置包含重复仓库");
  const ids = repositories.flatMap((item) =>
    item.sources.map((source) => source.id),
  );
  if (new Set(ids).size !== ids.length)
    throw new Error("合并后源 ID 冲突；请使用 replace 模式或先移除重复仓库");
  return saveConfig({ version: 1, repositories });
}
export function setVeneraSourceEnabled(id: unknown, enabled: unknown) {
  if (typeof enabled !== "boolean") throw new Error("enabled 必须为布尔值");
  const current = getVeneraRepositoryConfig();
  const source = current.repositories
    .flatMap((item) => item.sources)
    .find((item) => item.id === clean(id, 180));
  if (!source) throw new Error("漫画源不存在");
  source.enabled = enabled;
  return saveConfig(current);
}
export function getVeneraSources() {
  return getVeneraRepositoryConfig()
    .repositories.flatMap((repository) => repository.sources)
    .filter((source) => source.enabled);
}
export function getVeneraSource(id: unknown) {
  const source = getVeneraSources().find((item) => item.id === clean(id, 180));
  if (!source)
    throw new Error(`Venera 漫画源 ${clean(id, 180) || "(未选择)"} 不存在`);
  return source;
}
