import { describe, it, expect } from "vitest";
import * as crypto from "node:crypto";
import { verifyCallback } from "../src/core/verify-callback";
import type { NinePayConfig } from "../src/core/types";

const checksumKey = "test-checksum-key";
const config: NinePayConfig = {
  merchantKey: "test",
  secretKey: "test",
  checksumKey,
  returnUrl: "https://example.com/callback",
};

function makeParams(paymentInfo: Record<string, unknown>): URLSearchParams {
  const result = Buffer.from(JSON.stringify(paymentInfo)).toString("base64");
  const checksum = crypto
    .createHash("sha256")
    .update(result + checksumKey)
    .digest("hex")
    .toUpperCase();
  return new URLSearchParams({ result, checksum });
}

describe("verifyCallback", () => {
  it("verifies a successful payment and reports isSuccess", () => {
    const result = verifyCallback(
      makeParams({
        invoice_no: "ORD-123",
        status: 5,
        amount: 1000,
        currency: "VND",
      }),
      config
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.orderId).toBe("ORD-123");
      expect(result.isSuccess).toBe(true);
      expect(result.amount).toBe(1000);
    }
  });

  it("verifies checksum but reports isSuccess false for failed payments", () => {
    const result = verifyCallback(
      makeParams({ invoice_no: "ORD-FAIL", status: 6, amount: 500 }),
      config
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.isSuccess).toBe(false);
    }
  });

  it("rejects wrong checksums", () => {
    const params = new URLSearchParams({
      result: Buffer.from(JSON.stringify({ invoice_no: "X" })).toString(
        "base64"
      ),
      checksum: "0".repeat(64),
    });

    const result = verifyCallback(params, config);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Checksum mismatch");
    }
  });

  it("rejects missing invoice_no", () => {
    const result = verifyCallback(
      makeParams({ status: 5, amount: 100 }),
      config
    );

    expect(result.success).toBe(false);
  });

  it("accepts numeric invoice_no values", () => {
    const result = verifyCallback(
      makeParams({ invoice_no: 12345, status: 5, amount: 100 }),
      config
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.orderId).toBe("12345");
    }
  });

  it("trims padded invoice_no values", () => {
    const result = verifyCallback(
      makeParams({ invoice_no: "  ORD-1  ", status: 5, amount: 100 }),
      config
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.orderId).toBe("ORD-1");
    }
  });

  it("rejects malformed amounts instead of returning NaN", () => {
    const result = verifyCallback(
      makeParams({ invoice_no: "ORD-1", status: 5, amount: "lots" }),
      config
    );

    expect(result.success).toBe(false);
  });
});
