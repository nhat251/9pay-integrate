import { describe, it, expect, vi } from "vitest";
import * as crypto from "node:crypto";
import {
  handle9PayIpn,
  handlePaymentStatus,
  verifyNinePayCallback,
} from "../src/next/handlers";
import type { NinePayConfig, OrderRepository } from "../src/core/types";

const checksumKey = "test-checksum-key";
const config: NinePayConfig = {
  merchantKey: "test",
  secretKey: "test",
  checksumKey,
  returnUrl: "https://example.com/callback",
};

function signedBody(paymentInfo: Record<string, unknown>): string {
  const result = Buffer.from(JSON.stringify(paymentInfo)).toString("base64");
  const checksum = crypto
    .createHash("sha256")
    .update(result + checksumKey)
    .digest("hex")
    .toUpperCase();
  return `result=${encodeURIComponent(result)}&checksum=${checksum}`;
}

function makeRepo(status: string | null = "pending"): OrderRepository {
  return {
    createOrder: vi.fn(),
    getOrderStatus: vi.fn().mockResolvedValue(status),
    updateOrderStatus: vi.fn().mockResolvedValue({ id: "1" }),
  };
}

describe("handle9PayIpn", () => {
  it("processes a urlencoded IPN and returns 200", async () => {
    const request = new Request("https://example.com/ipn", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: signedBody({ invoice_no: "ORD-1", status: 5, amount: 100 }),
    });

    const response = await handle9PayIpn(request, {
      config,
      orderRepository: makeRepo(),
    });

    expect(response.status).toBe(200);
  });

  it("returns 415 for unsupported content types", async () => {
    const request = new Request("https://example.com/ipn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    const response = await handle9PayIpn(request, {
      config,
      orderRepository: makeRepo(),
    });

    expect(response.status).toBe(415);
  });
});

describe("handlePaymentStatus", () => {
  it("returns 400 without orderId", async () => {
    const response = await handlePaymentStatus(
      new Request("https://example.com/status"),
      { orderRepository: makeRepo() }
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 for unknown orders", async () => {
    const response = await handlePaymentStatus(
      new Request("https://example.com/status?orderId=GHOST"),
      { orderRepository: makeRepo(null) }
    );

    expect(response.status).toBe(404);
  });

  it("returns 403 when authorize rejects", async () => {
    const response = await handlePaymentStatus(
      new Request("https://example.com/status?orderId=ORD-1"),
      { orderRepository: makeRepo(), authorize: () => false }
    );

    expect(response.status).toBe(403);
  });

  it("returns the order status", async () => {
    const response = await handlePaymentStatus(
      new Request("https://example.com/status?orderId=ORD-1"),
      { orderRepository: makeRepo("completed") }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      status: "completed",
    });
  });
});

describe("verifyNinePayCallback", () => {
  it("verifies callback query params", () => {
    const body = signedBody({ invoice_no: "ORD-1", status: 5, amount: 100 });
    const request = new Request(`https://example.com/callback?${body}`);

    const result = verifyNinePayCallback(request, config);

    expect(result.success).toBe(true);
  });
});
