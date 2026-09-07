type SourceRule = { id: string; kinds: string[]; [key: string]: unknown };
type LegacyConfig = { sources: SourceRule[]; defaults?: { manga?: string }; version?: number };
type VeneraFile = {
  schema: 'boke-venera-repositories';
  version: 1;
  config: { repositories: unknown[] };
};
type SourceFile = { schema: 'boke-content-search-source'; version: 1; source: SourceRule };
function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function veneraFile(value: unknown): VeneraFile {
  if (
    !isObject(value) ||
    value.schema !== 'boke-venera-repositories' ||
    value.version !== 1 ||
    !isObject(value.config) ||
    !Array.isArray(value.config.repositories)
  )
    throw new Error('不是有效的 Venera 仓库配置文件');
  return value as VeneraFile;
}
/** Compatible with existing single-source and bundle files; Venera is an optional extension. */
export function parseMangaSourceFile(value: unknown): {
  sources: SourceFile[];
  venera?: VeneraFile;
  skipped: number;
} {
  if (!isObject(value)) throw new Error('不是有效的漫画源文件');
  if (value.schema === 'boke-venera-repositories')
    return { sources: [], venera: veneraFile(value), skipped: 0 };
  const bundle = value.schema === 'boke-content-search-source-bundle';
  if (value.version !== 1 || (!bundle && value.schema !== 'boke-content-search-source'))
    throw new Error('不支持的漫画源文件格式');
  const rules = bundle && isObject(value.config) ? value.config.sources : [value.source];
  if (
    !Array.isArray(rules) ||
    rules.some(
      (rule) => !isObject(rule) || typeof rule.id !== 'string' || !Array.isArray(rule.kinds),
    )
  )
    throw new Error('漫画源配置不完整');
  const sources = (rules as SourceRule[])
    .filter((rule) => rule.kinds.includes('manga'))
    .map((source) => ({
      schema: 'boke-content-search-source' as const,
      version: 1 as const,
      source,
    }));
  return {
    sources,
    skipped: rules.length - sources.length,
    ...(value.venera ? { venera: veneraFile(value.venera) } : {}),
  };
}
export function mangaSourceBackup(config: LegacyConfig, venera: unknown) {
  return {
    schema: 'boke-content-search-source-bundle',
    version: 1,
    config: {
      version: 1,
      defaults: { manga: config.defaults?.manga || '' },
      sources: config.sources.filter((source) => source.kinds?.includes('manga')),
    },
    venera: veneraFile(venera),
  };
}
