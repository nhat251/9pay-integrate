import { describe, it, expect } from "vitest";
import * as crypto from "crypto";
import { verifyChecksum } from "../src/core/verification";

describe("verifyChecksum", () => {
  const checksumKey = "my-secret-key";

  function makeValidChecksum(result: string): string {
    return crypto
      .createHash("sha256")
      .update(result + checksumKey)
      .digest("hex")
      .toUpperCase();
  }

  it("accepts valid checksum and decodes payload", () => {
    const payload = JSON.stringify({ invoice_no: "ORD-123", status: 5, amount: 1000 });
    const result = Buffer.from(payload).toString("base64");
    const checksum = makeValidChecksum(result);

    const verification = verifyChecksum(result, checksum, checksumKey);

    expect(verification.valid).toBe(true);
    expect(verification.data).toEqual({
      invoice_no: "ORD-123",
      status: 5,
      amount: 1000,
    });
    expect(verification.error).toBeUndefined();
  });

  it("rejects wrong checksum", () => {
    const payload = JSON.stringify({ invoice_no: "ORD-123" });
    const result = Buffer.from(payload).toString("base64");
    const wrongChecksum = "abc123def456";

    const verification = verifyChecksum(result, wrongChecksum, checksumKey);

    expect(verification.valid).toBe(false);
    expect(verification.data).toBeNull();
    expect(verification.error).toBe("Checksum mismatch");
  });

  it("rejects tampered result (even with correct checksum for original)", () => {
    const originalPayload = JSON.stringify({ invoice_no: "ORD-123", amount: 1000 });
    const originalResult = Buffer.from(originalPayload).toString("base64");
    const checksum = makeValidChecksum(originalResult);

    // Tamper with the result
    const tamperedPayload = JSON.stringify({ invoice_no: "ORD-123", amount: 999999 });
    const tamperedResult = Buffer.from(tamperedPayload).toString("base64");

    const verification = verifyChecksum(tamperedResult, checksum, checksumKey);

    expect(verification.valid).toBe(false);
  });

  it("rejects empty result", () => {
    const verification = verifyChecksum("", "some-checksum", checksumKey);

    expect(verification.valid).toBe(false);
    expect(verification.error).toBe("Missing result or checksum");
  });

  it("rejects empty checksum", () => {
    const verification = verifyChecksum("c29tZQ==", "", checksumKey);

    expect(verification.valid).toBe(false);
    expect(verification.error).toBe("Missing result or checksum");
  });

  it("rejects malformed base64 result", () => {
    const checksum = makeValidChecksum("not-valid-base64!!!");
    const verification = verifyChecksum("not-valid-base64!!!", checksum, checksumKey);

    // Checksum matches (we computed it from the same string)
    // but JSON.parse will fail on the decoded bytes
    expect(verification.valid).toBe(false);
    expect(verification.error).toBe("Failed to decode result");
  });
});
