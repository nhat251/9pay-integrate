import { describe, it, expect } from "vitest";
import { configFromEnv, validateConfig } from "../src/core/config";

describe("validateConfig", () => {
  it("throws for each missing key", () => {
    expect(() => validateConfig({})).toThrow(/merchantKey/);
    expect(() => validateConfig({ merchantKey: "m" })).toThrow(/secretKey/);
    expect(() =>
      validateConfig({ merchantKey: "m", secretKey: "s" })
    ).toThrow(/checksumKey/);
    expect(() =>
      validateConfig({ merchantKey: "m", secretKey: "s", checksumKey: "c" })
    ).toThrow(/returnUrl/);
  });

  it("fills the default base URL", () => {
    const config = validateConfig({
      merchantKey: "m",
      secretKey: "s",
      checksumKey: "c",
      returnUrl: "https://example.com/callback",
    });

    expect(config.baseUrl).toBe("https://payment.9pay.vn");
  });
});

describe("configFromEnv", () => {
  it("builds config from env vars", () => {
    const config = configFromEnv({
      NINEPAY_MERCHANT_KEY: "m",
      NINEPAY_SECRET_KEY: "s",
      NINEPAY_CHECKSUM_KEY: "c",
      NINEPAY_RETURN_URL: "https://example.com/callback",
      NINEPAY_BASE_URL: "https://sand-payment.9pay.vn",
    });

    expect(config).toMatchObject({
      merchantKey: "m",
      baseUrl: "https://sand-payment.9pay.vn",
    });
  });
});
