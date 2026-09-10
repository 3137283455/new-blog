import path from "node:path";
import { isMarkedAsUntransferable, Worker } from "node:worker_threads";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { assertImageSize } from "./binary";

export type ProcessedImage = {
  bytes: Buffer;
  contentType: string;
  width: number;
  height: number;
};
type Job = {
  start: () => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  abort: () => void;
};
const queue: Job[] = [];
let active = 0;

function drain() {
  while (active < 2 && queue.length) {
    const job = queue.shift()!;
    job.signal?.removeEventListener("abort", job.abort);
    if (job.signal?.aborted) {
      job.reject(new Error("图片处理已取消"));
      continue;
    }
    active++;
    job.start();
  }
}

/** A worker is a responsiveness/resource boundary, NOT a security sandbox. */
export function transformImage(
  bytes: Buffer,
  script?: string,
  signal?: AbortSignal,
): Promise<ProcessedImage> {
  assertImageSize(bytes.length);
  if (script && Buffer.byteLength(script) > 256 * 1024)
    return Promise.reject(new Error("图片规则脚本过大"));
  if (signal?.aborted) return Promise.reject(new Error("图片处理已取消"));
  if (queue.length >= 32)
    return Promise.reject(new Error("图片处理队列已满，请稍后重试"));
  return new Promise((resolve, reject) => {
    const job: Job = {
      signal,
      reject,
      abort: () => {
        const index = queue.indexOf(job);
        if (index >= 0) queue.splice(index, 1);
        reject(new Error("图片处理已取消"));
      },
      start: () => {
        let worker: Worker;
        try {
          const compiled = path.join(__dirname, "transform-worker.js");
          const development = !existsSync(compiled);
          const entry = development
            ? `require(${JSON.stringify(require.resolve("tsx/cjs"))}); require(${JSON.stringify(path.join(__dirname, "transform-worker.ts"))});`
            : compiled;
          const workerBytes =
            bytes.byteOffset === 0 &&
            bytes.buffer instanceof ArrayBuffer &&
            !isMarkedAsUntransferable(bytes.buffer) &&
            bytes.byteLength === bytes.buffer.byteLength
              ? new Uint8Array(bytes.buffer)
              : Uint8Array.from(bytes);
          worker = new Worker(entry, {
            eval: development,
            workerData: { bytes: workerBytes, script },
            transferList: [workerBytes.buffer],
            // No inherited application secrets. Windows needs an explicit temp path.
            env: { TMP: tmpdir(), TEMP: tmpdir(), TSX_DISABLE_CACHE: "1" },
            resourceLimits: {
              maxOldGenerationSizeMb: 128,
              maxYoungGenerationSizeMb: 16,
            },
          });
        } catch (error) {
          active--;
          reject(error);
          drain();
          return;
        }
        let settled = false;
        const finish = (error?: Error, result?: ProcessedImage) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", abort);
          void worker.terminate().finally(() => {
            active--;
            drain();
          });
          if (error) reject(error);
          else resolve(result!);
        };
        const abort = () => finish(new Error("图片处理已取消"));
        const timer = setTimeout(
          () => finish(new Error("图片解码或重排执行超时")),
          10000,
        );
        signal?.addEventListener("abort", abort, { once: true });
        worker.once("error", (error) =>
          finish(error instanceof Error ? error : new Error(String(error))),
        );
        worker.once("exit", (code) => {
          if (!settled) finish(new Error(`图片处理进程退出 (${code})`));
        });
        worker.once("message", (message) => {
          if (!message.ok) finish(new Error(message.message));
          else
            finish(undefined, {
              ...message,
              bytes: Buffer.from(
                message.bytes.buffer,
                message.bytes.byteOffset,
                message.bytes.byteLength,
              ),
            });
        });
      },
    };
    queue.push(job);
    signal?.addEventListener("abort", job.abort, { once: true });
    drain();
  });
}
