import {
  assertImageSize,
  imageBytes,
  readLimitedBody,
  transferableBytes,
} from "./binary";
import { transformImage, type ProcessedImage } from "./transform";

export type ImageContext = {
  purpose?: "page" | "thumbnail";
  comicId?: string;
  chapterId?: string;
  signal?: AbortSignal;
};
type ImageConfig = {
  url?: unknown;
  method?: unknown;
  headers?: unknown;
  data?: unknown;
  onResponse?: unknown;
  onLoadFailed?: unknown;
  modifyImage?: unknown;
};
type Dependencies = {
  comic: { onImageLoad?: unknown; onThumbnailLoad?: unknown };
  invoke: (
    callback: Function,
    args: unknown[],
    receiver?: unknown,
  ) => Promise<unknown>;
  validateUrl: (url: unknown) => string;
  fetch?: typeof fetch;
  transform?: typeof transformImage;
};

function configOf(value: unknown): ImageConfig {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value))
    throw new Error("图片加载规则没有返回有效配置");
  return value;
}

async function requestImage(
  url: string,
  init: RequestInit,
  deps: Dependencies,
) {
  for (let redirects = 0; ; redirects++) {
    const response = await (deps.fetch || fetch)(url, {
      ...init,
      redirect: "manual",
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    await response.body?.cancel();
    const location = response.headers.get("location");
    if (!location || redirects >= 3)
      throw new Error("图片重定向无效或次数过多");
    const next = deps.validateUrl(new URL(location, url).toString());
    const headers = new Headers(init.headers);
    if (new URL(next).origin !== new URL(url).origin) {
      headers.delete("authorization");
      headers.delete("cookie");
    }
    if (
      (response.status === 303 && init.method !== "HEAD") ||
      ([301, 302].includes(response.status) && init.method === "POST")
    ) {
      init = { ...init, method: "GET", body: undefined };
      headers.delete("content-type");
      headers.delete("content-length");
    }
    init = { ...init, headers };
    url = next;
  }
}

/** Loading/decryption/decoding/reassembly share one bounded retry path. */
export async function loadSourceImage(
  target: unknown,
  context: ImageContext,
  deps: Dependencies,
): Promise<ProcessedImage> {
  const initialUrl = deps.validateUrl(target);
  const isPage = context.purpose === "page";
  // Contextless legacy cover requests must never run chapter-dependent rearrangement.
  const handler = isPage ? deps.comic.onImageLoad : deps.comic.onThumbnailLoad;
  let config =
    typeof handler === "function"
      ? configOf(
          await deps.invoke(
            handler,
            isPage
              ? [initialUrl, context.comicId || "", context.chapterId || ""]
              : [initialUrl],
            deps.comic,
          ),
        )
      : {};
  for (let attempt = 0; ; attempt++) {
    context.signal?.throwIfAborted();
    try {
      const url = deps.validateUrl(config.url || initialUrl);
      const method = String(config.method || "GET").toUpperCase();
      if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(method))
        throw new Error("不支持的图片请求方法");
      const headers = new Headers();
      if (config.headers && typeof config.headers === "object") {
        for (const [key, value] of Object.entries(config.headers).slice(0, 40))
          headers.set(key, String(value));
      }
      let body: string | Buffer | undefined;
      if (!["GET", "HEAD"].includes(method) && config.data != null) {
        body =
          typeof config.data === "string"
            ? config.data
            : ArrayBuffer.isView(config.data) ||
                Object.prototype.toString.call(config.data) ===
                  "[object ArrayBuffer]"
              ? imageBytes(config.data)
              : JSON.stringify(config.data);
        if (body) assertImageSize(Buffer.byteLength(body));
      }
      const timeout = AbortSignal.timeout(25000);
      const signal = context.signal
        ? AbortSignal.any([timeout, context.signal])
        : timeout;
      const response = await requestImage(
        url,
        { method, headers, body: body as BodyInit | undefined, signal },
        deps,
      );
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Venera 源图片 HTTP ${response.status}`);
      }
      let bytes = await readLimitedBody(response);
      if (typeof config.onResponse === "function") {
        const value = await deps.invoke(config.onResponse, [
          transferableBytes(bytes),
        ]);
        // A nullable no-op callback must not return an already-consumed Response.
        if (value != null) bytes = imageBytes(value);
        assertImageSize(bytes.length);
      }
      context.signal?.throwIfAborted();
      if (
        isPage &&
        config.modifyImage != null &&
        typeof config.modifyImage !== "string"
      )
        throw new Error("modifyImage 必须是脚本文本");
      return await (deps.transform || transformImage)(
        bytes,
        isPage ? (config.modifyImage as string | undefined) : undefined,
        context.signal,
      );
    } catch (error) {
      context.signal?.throwIfAborted();
      if (!isPage || attempt >= 2 || typeof config.onLoadFailed !== "function")
        throw error;
      const fallback = await deps.invoke(config.onLoadFailed, []);
      if (fallback == null) throw error;
      config = configOf(fallback);
    }
  }
}
