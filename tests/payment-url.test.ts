import { describe, it, expect } from "vitest";
import { createPaymentUrl } from "../src/core/payment-url";
import type { NinePayConfig } from "../src/core/types";

describe("createPaymentUrl", () => {
  const config: NinePayConfig = {
    merchantKey: "test-merchant",
    secretKey: "test-secret",
    checksumKey: "test-checksum",
    baseUrl: "https://payment.9pay.vn",
    returnUrl: "https://example.com/callback",
    cancelUrl: "https://example.com/cancel",
  };

  it("returns a URL pointing to the 9Pay portal", () => {
    const url = createPaymentUrl(config, {
      orderId: "ORD-001",
      amount: 1000,
      currency: "USD",
      description: "Test Payment",
    });

    expect(url).toMatch(/^https:\/\/payment\.9pay\.vn\/portal\?/);
  });

  it("includes baseEncode and signature query params", () => {
    const url = createPaymentUrl(config, {
      orderId: "ORD-001",
      amount: 1000,
      currency: "USD",
      description: "Test Payment",
    });

    const urlObj = new URL(url);
    expect(urlObj.searchParams.has("baseEncode")).toBe(true);
    expect(urlObj.searchParams.has("signature")).toBe(true);
  });

  it("baseEncode is valid base64 that decodes to payment params", () => {
    const url = createPaymentUrl(config, {
      orderId: "ORD-001",
      amount: 1000,
      currency: "USD",
      description: "Test Payment",
    });

    const urlObj = new URL(url);
    const baseEncode = urlObj.searchParams.get("baseEncode");

    expect(baseEncode).toBeTruthy();

    // Decode and verify content
    const decoded = JSON.parse(Buffer.from(baseEncode!, "base64").toString("utf-8"));
    expect(decoded.invoice_no).toBe("ORD-001");
    expect(decoded.amount).toBe(1000);
    expect(decoded.currency).toBe("USD");
    expect(decoded.description).toBe("Test Payment");
    expect(decoded.merchantKey).toBe("test-merchant");
    expect(decoded.return_url).toBe("https://example.com/callback");
  });

  it("includes optional card options in encoded params", () => {
    const url = createPaymentUrl(config, {
      orderId: "ORD-002",
      amount: 500,
      currency: "VND",
      description: "Card Payment",
      options: {
        lang: "vi",
        card_brand_allow: "VISA,MASTER",
        card_origin_allow: 1,
      },
    });

    const urlObj = new URL(url);
    const decoded = JSON.parse(
      Buffer.from(urlObj.searchParams.get("baseEncode")!, "base64").toString("utf-8")
    );

    expect(decoded.lang).toBe("vi");
    expect(decoded.card_brand_allow).toBe("VISA,MASTER");
    expect(decoded.card_origin_allow).toBe(1);
  });

  it("uses default baseUrl when not specified", () => {
    const minimalConfig: NinePayConfig = {
      merchantKey: "test",
      secretKey: "secret",
      checksumKey: "checksum",
      returnUrl: "https://example.com/callback",
    };

    const url = createPaymentUrl(minimalConfig, {
      orderId: "ORD-003",
      amount: 100,
      currency: "USD",
      description: "Minimal",
    });

    expect(url).toMatch(/^https:\/\/payment\.9pay\.vn\/portal\?/);
  });

  it("produces a non-empty signature", () => {
    const url = createPaymentUrl(config, {
      orderId: "ORD-001",
      amount: 1000,
      currency: "USD",
      description: "Test Payment",
    });

    const urlObj = new URL(url);
    const signature = urlObj.searchParams.get("signature");

    expect(signature).toBeTruthy();
    expect(signature!.length).toBeGreaterThan(0);
    // Base64 signature should not contain URL-unsafe characters
    expect(signature).not.toContain("\n");
    expect(signature).not.toContain(" ");
  });
});
