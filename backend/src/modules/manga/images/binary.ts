export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 24 * 1024 * 1024;

/** Source callbacks return objects from a different JavaScript realm. */
export function imageBytes(value: unknown): Buffer {
  if (Object.prototype.toString.call(value) === "[object ArrayBuffer]") {
    return Buffer.from(new Uint8Array(value as ArrayBuffer));
  }
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  if (Array.isArray(value)) return Buffer.from(value);
  throw new Error("图片规则必须返回 ArrayBuffer 或字节数组");
}

export function transferableBytes(value: Buffer): ArrayBuffer {
  return Uint8Array.from(value).buffer;
}

export function assertImageSize(size: number, maxBytes = MAX_IMAGE_BYTES) {
  if (size > maxBytes)
    throw new Error(
      `漫画图片超过 ${Math.floor(maxBytes / 1024 / 1024)}MB 限制`,
    );
}

export async function readLimitedBody(
  response: Response,
  maxBytes = MAX_IMAGE_BYTES,
): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) {
    await response.body?.cancel();
    assertImageSize(declared, maxBytes);
  }
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      assertImageSize(total, maxBytes);
      chunks.push(value);
    }
    return Buffer.concat(chunks, total);
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
