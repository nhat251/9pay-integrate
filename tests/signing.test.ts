import { describe, it, expect } from "vitest";
import * as crypto from "crypto";
import { buildHttpQuery, buildSignature } from "../src/core/signing";

describe("buildHttpQuery", () => {
  it("sorts keys alphabetically", () => {
    const data = { zebra: 1, alpha: 2, mango: 3 };
    const result = buildHttpQuery(data);
    // Keys must be in alphabetical order
    expect(result).toBe("alpha=2&mango=3&zebra=1");
  });

  it("skips undefined and null values", () => {
    const data = { a: 1, b: undefined as unknown as number, c: null as unknown as number, d: 4 };
    const result = buildHttpQuery(data);
    expect(result).toBe("a=1&d=4");
  });

  it("handles empty object", () => {
    expect(buildHttpQuery({})).toBe("");
  });

  it("converts numbers to strings", () => {
    const result = buildHttpQuery({ amount: 1000, time: 1234567890 });
    expect(result).toBe("amount=1000&time=1234567890");
  });
});

describe("buildSignature", () => {
  it("produces consistent HMAC-SHA256 signature", () => {
    const baseUrl = "https://payment.9pay.vn";
    const time = 1700000000;
    const httpQuery = "amount=1000&currency=USD&merchantKey=test123";
    const secretKey = "secret";

    const sig1 = buildSignature(baseUrl, time, httpQuery, secretKey);
    const sig2 = buildSignature(baseUrl, time, httpQuery, secretKey);

    // Same inputs → same signature
    expect(sig1).toBe(sig2);
    // Signature is base64-encoded
    expect(() => Buffer.from(sig1, "base64")).not.toThrow();
  });

  it("produces different signature for different message", () => {
    const baseUrl = "https://payment.9pay.vn";
    const time = 1700000000;
    const secretKey = "secret";

    const sig1 = buildSignature(baseUrl, time, "a=1", secretKey);
    const sig2 = buildSignature(baseUrl, time, "a=2", secretKey);

    expect(sig1).not.toBe(sig2);
  });

  it("produces different signature for different secret key", () => {
    const baseUrl = "https://payment.9pay.vn";
    const time = 1700000000;
    const httpQuery = "a=1";

    const sig1 = buildSignature(baseUrl, time, httpQuery, "secret1");
    const sig2 = buildSignature(baseUrl, time, httpQuery, "secret2");

    expect(sig1).not.toBe(sig2);
  });

  it("produces correct format (known-good verification)", () => {
    // Verify the message format matches 9Pay spec:
    // POST\n{baseUrl}/payments/create\n{time}\n{httpQuery}
    const baseUrl = "https://payment.9pay.vn";
    const time = 1700000000;
    const httpQuery = "a=1";
    const secretKey = "test-secret";

    // Manually construct expected message
    const expectedMessage = `POST\n${baseUrl}/payments/create\n${time}\n${httpQuery}`;

    // Build signature with known message
    const actualSig = buildSignature(baseUrl, time, httpQuery, secretKey);

    // Cross-verify: manually compute what the sig should be
    const expectedSig = crypto
      .createHmac("sha256", secretKey)
      .update(expectedMessage)
      .digest()
      .toString("base64");

    expect(actualSig).toBe(expectedSig);
  });
});
