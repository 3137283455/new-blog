import { parentPort, workerData } from "node:worker_threads";
import vm from "node:vm";
import sharp from "sharp";
import { assertImageSize, MAX_IMAGE_PIXELS } from "./binary";
import { createImageApi } from "./image-api";

const mime: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
};

async function processImage() {
  const input = Buffer.from(workerData.bytes);
  assertImageSize(input.length);
  sharp.cache(false);
  sharp.concurrency(1);
  const decoder = sharp(input, {
    limitInputPixels: MAX_IMAGE_PIXELS,
    failOn: "error",
  });
  const metadata = await decoder.metadata();
  const contentType =
    metadata.format === "heif" && metadata.compression === "av1"
      ? "image/avif"
      : mime[metadata.format || ""];
  if (!contentType) throw new Error("源站返回的不是支持的光栅图片");
  // Decode even with no transform, so corrupt/HTML responses can trigger onLoadFailed.
  const decoded = await decoder
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (!workerData.script)
    return {
      bytes: input,
      contentType,
      width: decoded.info.width,
      height: decoded.info.height,
    };
  const { Image, dataOf } = createImageApi();
  const image = new Image(
    decoded.info.width,
    decoded.info.height,
    decoded.data,
  );
  const context = vm.createContext(
    { Image, __input: image },
    { codeGeneration: { strings: false, wasm: false } },
  );
  const result = new vm.Script(`${workerData.script}\n;modifyImage(__input)`, {
    filename: "venera-modify-image.js",
  }).runInContext(context, { timeout: 3000 });
  if (!(result instanceof Image) || !result.width || !result.height)
    throw new Error("modifyImage 没有返回有效 Image");
  const output = await sharp(dataOf(result), {
    raw: { width: result.width, height: result.height, channels: 4 },
  })
    .png()
    .toBuffer();
  assertImageSize(output.length);
  return {
    bytes: output,
    contentType: "image/png",
    width: result.width,
    height: result.height,
  };
}

void processImage().then(
  (result) => parentPort?.postMessage({ ok: true, ...result }),
  (error) =>
    parentPort?.postMessage({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }),
);
