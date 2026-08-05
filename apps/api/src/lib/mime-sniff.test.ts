import { describe, expect, it } from "vitest";
import { AppError } from "./errors.js";
import { assertMimeMatchesContent, sniffMimeType } from "./mime-sniff.js";

describe("mime-sniff", () => {
  it("detects JPEG magic bytes", () => {
    expect(sniffMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
  });

  it("detects PDF magic bytes", () => {
    expect(sniffMimeType(Buffer.from("%PDF-1.7"))).toBe("application/pdf");
  });

  it("rejects mismatched declared PDF content", () => {
    expect(() => assertMimeMatchesContent("application/pdf", Buffer.from("not-a-pdf"))).toThrow(
      AppError,
    );
  });

  it("accepts matching PDF content", () => {
    expect(() =>
      assertMimeMatchesContent("application/pdf", Buffer.from("%PDF-1.4\n%âãÏÓ")),
    ).not.toThrow();
  });
});
