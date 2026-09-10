import { MAX_IMAGE_PIXELS } from "./binary";

const MAX_ALLOCATED_BYTES = 192 * 1024 * 1024;

/** Synchronous, straight-RGBA subset of Venera's assets/init.js Image API. */
export function createImageApi() {
  let allocated = 0;
  const storage = new WeakMap<RasterImage, Buffer>();
  const integer = (value: number, label: string) => {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error(`Image.${label} 必须是非负整数`);
    return value;
  };
  const dataOf = (image: RasterImage) => {
    const data = storage.get(image);
    if (!data) throw new Error("图片规则引用了无效 Image 对象");
    return data;
  };

  class RasterImage {
    readonly width: number;
    readonly height: number;

    constructor(width: number, height: number, pixels?: Buffer) {
      this.width = integer(width, "width");
      this.height = integer(height, "height");
      const area = width * height;
      if (!Number.isSafeInteger(area) || area > MAX_IMAGE_PIXELS)
        throw new Error("漫画图片像素数超过限制");
      allocated += area * 4;
      if (allocated > MAX_ALLOCATED_BYTES)
        throw new Error("图片规则申请的内存超过限制");
      if (pixels && pixels.length !== area * 4)
        throw new Error("图片像素数据长度不匹配");
      storage.set(this, pixels || Buffer.alloc(area * 4));
      Object.freeze(this);
    }

    static empty(width: number, height: number) {
      return new RasterImage(width, height);
    }

    private checkRect(x: number, y: number, width: number, height: number) {
      [x, y, width, height].forEach((value) => integer(value, "range"));
      if (x + width > this.width || y + height > this.height)
        throw new Error("图片规则的复制范围超出图片边界");
    }

    copyRange(x: number, y: number, width: number, height: number) {
      this.checkRect(x, y, width, height);
      const result = RasterImage.empty(width, height);
      result.fillImageRangeAt(0, 0, this, x, y, width, height);
      return result;
    }

    fillImageAt(x: number, y: number, image: RasterImage) {
      this.fillImageRangeAt(x, y, image, 0, 0, image.width, image.height);
    }

    fillImageRangeAt(
      x: number,
      y: number,
      image: RasterImage,
      srcX: number,
      srcY: number,
      width: number,
      height: number,
    ) {
      this.checkRect(x, y, width, height);
      dataOf(image);
      image.checkRect(srcX, srcY, width, height);
      const source = dataOf(image);
      const target = dataOf(this);
      if (source !== target) {
        const sourceStride = image.width * 4;
        const targetStride = this.width * 4;
        if (
          x === 0 &&
          srcX === 0 &&
          width === image.width &&
          width === this.width
        ) {
          source.copy(
            target,
            y * targetStride,
            srcY * sourceStride,
            (srcY + height) * sourceStride,
          );
          return;
        }
        for (let row = 0; row < height; row++) {
          const from = (srcY + row) * sourceStride + srcX * 4;
          const to = (y + row) * targetStride + x * 4;
          source.copy(target, to, from, from + width * 4);
        }
        return;
      }
      // Match Venera's forward copy order, including self-overlapping ranges.
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          const from = ((srcY + row) * image.width + srcX + col) * 4;
          const to = ((y + row) * this.width + x + col) * 4;
          target.writeUInt32LE(source.readUInt32LE(from), to);
        }
      }
    }

    copyAndRotate90() {
      const result = RasterImage.empty(this.height, this.width);
      const source = dataOf(this);
      const target = dataOf(result);
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          target.writeUInt32LE(
            source.readUInt32LE((y * this.width + x) * 4),
            (x * this.height + this.height - y - 1) * 4,
          );
        }
      }
      return result;
    }
  }

  return { Image: RasterImage, dataOf };
}
