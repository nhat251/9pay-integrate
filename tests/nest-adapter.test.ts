import { describe, it, expect, vi, afterEach } from "vitest";
import { InternalServerErrorException } from "@nestjs/common";
import { NinePayRecurringClientAdapter } from "../src/nest/ninepay-recurring-client.adapter";

const baseValues: Record<string, string | undefined> = {
  NINEPAY_BASE_URL: "https://sand-payment.9pay.vn",
  NINEPAY_MERCHANT_KEY: "merchant-key",
  NINEPAY_SECRET_KEY: "secret-key",
  NINEPAY_RETURN_URL: "https://ats.uctalent.io/payment/9pay-return",
};

const buildConfigService = (values: Record<string, string | undefined>) =>
  ({
    get: (key: string) => values[key],
  }) as never;

describe("NinePayRecurringClientAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates inquire to the core client", async () => {
    const body = { status: 5, error_code: "000", payment_no: 42 };
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    } as never);
    const adapter = new NinePayRecurringClientAdapter(
      buildConfigService(baseValues)
    );

    const result = await adapter.inquire("UCC1");

    expect(result.paymentNo).toBe(42);
    expect(result.httpOk).toBe(true);
  });

  it("maps missing config to InternalServerErrorException", async () => {
    const adapter = new NinePayRecurringClientAdapter(
      buildConfigService({ ...baseValues, NINEPAY_SECRET_KEY: undefined })
    );

    const error = await adapter.inquire("X").catch((e) => e);
    expect(error).toBeInstanceOf(InternalServerErrorException);
    expect(error.getResponse()).toMatchObject({
      code: "GATEWAY_NOT_CONFIGURED",
    });
  });

  it("maps non-JSON gateway bodies to InternalServerErrorException", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 200,
      text: vi.fn().mockResolvedValue("<html>oops</html>"),
    } as never);
    const adapter = new NinePayRecurringClientAdapter(
      buildConfigService(baseValues)
    );

    const error = await adapter.inquire("X").catch((e) => e);
    expect(error).toBeInstanceOf(InternalServerErrorException);
    expect(error.getResponse()).toMatchObject({
      code: "GATEWAY_INVALID_RESPONSE",
    });
  });
});
