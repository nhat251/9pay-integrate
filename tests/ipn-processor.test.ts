import { describe, it, expect, vi } from "vitest";
import * as crypto from "crypto";
import { processIpn } from "../src/core/ipn-processor";
import type { IpnProcessorOptions, OrderRepository } from "../src/core/types";

describe("processIpn", () => {
  const checksumKey = "test-checksum-key";

  function makePayload(paymentInfo: Record<string, unknown>) {
    const result = Buffer.from(JSON.stringify(paymentInfo)).toString("base64");
    const checksum = crypto
      .createHash("sha256")
      .update(result + checksumKey)
      .digest("hex")
      .toUpperCase();
    return { result, checksum };
  }

  function makeOptions(): IpnProcessorOptions {
    const repo: OrderRepository = {
      createOrder: vi.fn(),
      getOrderStatus: vi.fn(),
      updateOrderStatus: vi.fn().mockResolvedValue({ id: "1" }),
    };
    return {
      config: {
        merchantKey: "test",
        secretKey: "test",
        checksumKey,
        returnUrl: "https://example.com/callback",
      },
      orderRepository: repo,
      notifications: {
        onSuccess: vi.fn().mockResolvedValue(undefined),
        onFailure: vi.fn().mockResolvedValue(undefined),
      },
    };
  }

  it("processes successful payment (status=5)", async () => {
    const payload = makePayload({
      invoice_no: "ORD-SUCCESS",
      status: 5,
      amount: 1000,
      currency: "USD",
    });
    const options = makeOptions();

    const result = await processIpn(payload, options);

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.orderId).toBe("ORD-SUCCESS");
    expect(result.message).toContain("updated successfully");

    // Repo was called with completed
    expect(options.orderRepository.updateOrderStatus).toHaveBeenCalledWith(
      "ORD-SUCCESS",
      "completed"
    );

    // Success notification was fired
    expect(options.notifications?.onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "ORD-SUCCESS",
        status: "completed",
        amount: 1000,
        currency: "USD",
        paymentMethod: "9pay",
      })
    );
  });

  it("processes failed payment (status!=5)", async () => {
    const payload = makePayload({
      invoice_no: "ORD-FAIL",
      status: 6,
      amount: 500,
      currency: "VND",
    });
    const options = makeOptions();

    const result = await processIpn(payload, options);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(200);
    expect(result.orderId).toBe("ORD-FAIL");
    expect(result.message).toBe("Payment failed");

    // Repo was called with failed
    expect(options.orderRepository.updateOrderStatus).toHaveBeenCalledWith(
      "ORD-FAIL",
      "failed"
    );

    // Failure notification was fired
    expect(options.notifications?.onFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "ORD-FAIL",
        status: "failed",
        amount: 500,
        currency: "VND",
        paymentMethod: "9pay",
      })
    );
  });

  it("rejects invalid checksum without calling repo", async () => {
    const payload = { result: "dGVzdA==", checksum: "wrong-checksum" };
    const options = makeOptions();

    const result = await processIpn(payload, options);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(403);
    expect(result.orderId).toBeUndefined();

    // Repo was NOT called
    expect(options.orderRepository.updateOrderStatus).not.toHaveBeenCalled();
    expect(options.notifications?.onSuccess).not.toHaveBeenCalled();
    expect(options.notifications?.onFailure).not.toHaveBeenCalled();
  });

  it("rejects missing invoice_no without calling repo", async () => {
    const payload = makePayload({
      status: 5,
      amount: 1000,
      currency: "USD",
      // No invoice_no
    });
    const options = makeOptions();

    const result = await processIpn(payload, options);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.message).toContain("Missing invoice_no");

    // Repo was NOT called
    expect(options.orderRepository.updateOrderStatus).not.toHaveBeenCalled();
  });

  it("returns 500 if repo throws", async () => {
    const payload = makePayload({
      invoice_no: "ORD-ERROR",
      status: 5,
      amount: 1000,
      currency: "USD",
    });

    const repo: OrderRepository = {
      createOrder: vi.fn(),
      getOrderStatus: vi.fn(),
      updateOrderStatus: vi.fn().mockRejectedValue(new Error("DB connection lost")),
    };

    const options: IpnProcessorOptions = {
      config: {
        merchantKey: "test",
        secretKey: "test",
        checksumKey,
        returnUrl: "https://example.com/callback",
      },
      orderRepository: repo,
    };

    const result = await processIpn(payload, options);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
    expect(result.message).toContain("DB connection lost");
    expect(result.orderId).toBe("ORD-ERROR");
  });

  it("does not fail IPN if notification throws", async () => {
    const payload = makePayload({
      invoice_no: "ORD-notify",
      status: 5,
      amount: 2000,
      currency: "SGD",
    });

    const repo: OrderRepository = {
      createOrder: vi.fn(),
      getOrderStatus: vi.fn(),
      updateOrderStatus: vi.fn().mockResolvedValue({ id: "1" }),
    };

    const options: IpnProcessorOptions = {
      config: {
        merchantKey: "test",
        secretKey: "test",
        checksumKey,
        returnUrl: "https://example.com/callback",
      },
      orderRepository: repo,
      notifications: {
        onSuccess: vi.fn().mockRejectedValue(new Error("Telegram API down")),
        onFailure: vi.fn(),
      },
    };

    const result = await processIpn(payload, options);

    // IPN should still succeed — notification failure is fire-and-forget
    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);

    // But repo should have been called
    expect(repo.updateOrderStatus).toHaveBeenCalledWith("ORD-notify", "completed");
  });

  it("works without notification hooks", async () => {
    const payload = makePayload({
      invoice_no: "ORD-no-hooks",
      status: 5,
      amount: 100,
      currency: "USD",
    });

    const repo: OrderRepository = {
      createOrder: vi.fn(),
      getOrderStatus: vi.fn(),
      updateOrderStatus: vi.fn().mockResolvedValue({ id: "1" }),
    };

    const options: IpnProcessorOptions = {
      config: {
        merchantKey: "test",
        secretKey: "test",
        checksumKey,
        returnUrl: "https://example.com/callback",
      },
      orderRepository: repo,
      // No notifications
    };

    const result = await processIpn(payload, options);

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
  });
});
