import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { AppError } from "./errors.js";
import { compressImageBuffer } from "./storage.js";

describe("compressImageBuffer", () => {
  it("downscales and encodes JPEG under the max dimension", async () => {
    const raw = await sharp({
      create: {
        width: 3200,
        height: 2400,
        channels: 3,
        background: { r: 40, g: 120, b: 200 },
      },
    })
      .png()
      .toBuffer();

    const result = await compressImageBuffer(raw, { maxDimension: 1920, quality: 80 });
    expect(result.contentType).toBe("image/jpeg");
    expect(result.ext).toBe("jpg");
    expect(result.buffer.byteLength).toBeLessThan(raw.byteLength);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBeLessThanOrEqual(1920);
    expect(meta.height).toBeLessThanOrEqual(1920);
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(1920);
  });

  it("does not enlarge small images", async () => {
    const raw = await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await compressImageBuffer(raw, { maxDimension: 1920, quality: 80 });
    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(300);
  });

  it("rejects corrupt image bytes", async () => {
    await expect(compressImageBuffer(Buffer.from("not-an-image"), { maxDimension: 1024, quality: 80 })).rejects.toSatisfy(
      (err: unknown) => err instanceof AppError && err.status === 400,
    );
  });
});
