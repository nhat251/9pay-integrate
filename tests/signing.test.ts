import { describe, it, expect } from "vitest";
import * as crypto from "crypto";
import {
  buildAuthorizationHeaders,
  buildGetSignature,
  buildHttpQuery,
  buildPostSignature,
  buildSignature,
} from "../src/core/signing";

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

describe("buildPostSignature / buildGetSignature", () => {
  it("buildPostSignature matches the portal signature for /payments/create", () => {
    const baseUrl = "https://payment.9pay.vn";
    const time = 1700000000;
    const httpQuery = "a=1";

    expect(buildPostSignature(baseUrl, "/payments/create", time, httpQuery, "s")).toBe(
      buildSignature(baseUrl, time, httpQuery, "s")
    );
  });

  it("buildPostSignature omits the trailing segment for empty bodies", () => {
    const sig = buildPostSignature("https://b.vn", "/p", 1, "", "s");
    const expected = crypto
      .createHmac("sha256", "s")
      .update("POST\nhttps://b.vn/p\n1")
      .digest("base64");
    expect(sig).toBe(expected);
  });

  it("buildGetSignature follows GET message format", () => {
    const sig = buildGetSignature("https://b.vn", "/v2/payments/X/inquire", 7, "s");
    const expected = crypto
      .createHmac("sha256", "s")
      .update("GET\nhttps://b.vn/v2/payments/X/inquire\n7")
      .digest("base64");
    expect(sig).toBe(expected);
  });

  it("buildAuthorizationHeaders returns Date + Signature headers", () => {
    const headers = buildAuthorizationHeaders("msg", 7, "merchant", "secret");
    expect(headers.Date).toBe("7");
    expect(headers.Authorization).toContain("Credential=merchant");
    expect(headers.Authorization).toContain("Algorithm=HS256");
  });

  it("buildAuthorizationHeaders signature matches manual HMAC", () => {
    const headers = buildAuthorizationHeaders("msg", 7, "merchant", "secret");
    const expected = crypto
      .createHmac("sha256", "secret")
      .update("msg")
      .digest("base64");

    expect(headers.Authorization).toContain(`Signature=${expected}`);
  });
});
