// Exact, reviewable frontmatter-only changes. DOM, CSS and client scripts remain frozen.
export const adapters = [
  {
    file: "frontend-astro/src/pages/source/[kind]/[source]/chapter/[chapter].astro",
    reason:
      "Pass comic/episode context to Venera image rules; no markup or styling change.",
    before:
      "const mediaUrl = (url: string) => `/api/content-sources/media?source=${encodeURIComponent(source)}&kind=${encodeURIComponent(kind)}&url=${encodeURIComponent(url)}`",
    after:
      "const mediaUrl = (url: string) => `/api/content-sources/media?source=${encodeURIComponent(source)}&kind=${encodeURIComponent(kind)}&url=${encodeURIComponent(url)}&purpose=page&comic_id=${encodeURIComponent(workId)}&chapter_id=${encodeURIComponent(chapterId)}`",
  },
];

export function normalizeDataAdapters(file, content) {
  for (const adapter of adapters.filter((item) => item.file === file)) {
    const end = content.indexOf("\n---", 4);
    const frontmatter = content.slice(0, end);
    if (
      !content.startsWith("---\n") ||
      end < 0 ||
      frontmatter.split(adapter.after).length !== 2
    )
      continue;
    content =
      frontmatter.replace(adapter.after, adapter.before) + content.slice(end);
  }
  return content;
}
