const clean = (value: unknown, max: number) =>
  String(value ?? "")
    .trim()
    .slice(0, max);

/** A chapter failure must never silently read a different chapter. */
export async function loadExactChapter(
  comicId: string,
  chapterId: string,
  load: (comicId: string, chapterId: string) => Promise<any>,
) {
  let result: any;
  let failed = false;
  try {
    result = await load(comicId, chapterId);
  } catch {
    failed = true;
  }
  const pages = (
    Array.isArray(result?.images)
      ? result.images
      : Array.isArray(result?.pages)
        ? result.pages
        : []
  )
    .map((item: any) =>
      clean(typeof item === "string" ? item : item?.url, 3000),
    )
    .filter(Boolean);
  const title = clean(result?.title, 300) || "漫画阅读";
  return {
    title,
    content: "",
    content_html: "",
    pages,
    source_url: clean(result?.url, 2000),
    chapter_id: chapterId,
    chapter_title: title,
    error: pages.length
      ? ""
      : failed
        ? "本章请求失败，请稍后重试或返回目录选择章节。不会自动跳到其他章节。"
        : "源站暂时没有返回本章图片，可能是章节语言或版权区域不可用。请返回目录选择其他章节。",
  };
}
