import { describe, it, expect, vi, afterEach } from "vitest";
import {
  NinePayGatewayError,
  NinePayRecurringClient,
} from "../src/core/recurring-client";

const config = {
  baseUrl: "https://sand-payment.9pay.vn",
  merchantKey: "merchant-key",
  secretKey: "secret-key",
  returnUrl: "https://ats.uctalent.io/payment/9pay-return",
};

function mockFetchJson(status: number, body: Record<string, unknown>) {
  const response = {
    status,
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  };
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(response as never);
}

describe("NinePayRecurringClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("createCit posts a CIT body and parses the result", async () => {
    const fetchSpy = mockFetchJson(200, {
      order_code: 123,
      payment_url: "https://pay/abc",
      error_code: "000",
    });
    const client = new NinePayRecurringClient(config);

    const result = await client.createCit({
      requestId: "UCC1",
      amountVnd: 603900,
      description: "UC Talent subscription",
      paymentIntentId: "pi_123",
    });

    expect(result).toEqual({
      httpOk: true,
      httpStatus: 200,
      orderCode: 123,
      paymentUrl: "https://pay/abc",
      errorCode: "000",
      failureReason: null,
      raw: {
        order_code: 123,
        payment_url: "https://pay/abc",
        error_code: "000",
      },
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://sand-payment.9pay.vn/v2/payments/recurring/request"
    );
    const body = new URLSearchParams(init.body as string);
    expect(body.get("request_type")).toBe("CIT");
    expect(body.get("request_id")).toBe("UCC1");
    expect(body.get("return_url")).toBe(
      "https://ats.uctalent.io/payment/9pay-return?intentId=pi_123"
    );
    expect(init.headers).toMatchObject({ Date: expect.any(String) });
    expect(
      (init.headers as Record<string, string>).Authorization
    ).toContain("merchant-key");
  });

  it("chargeMit posts a MIT body and keeps unknown fields in raw", async () => {
    const body = {
      error_code: "000",
      status: 5,
      order_code: 1,
      auth_code: "A",
      network_advice_code: "03",
    };
    mockFetchJson(200, body);
    const client = new NinePayRecurringClient(config);

    const result = await client.chargeMit({
      requestId: "UCMTEST1",
      amountVnd: 10000,
      originalOrderCode: 123,
      cardToken: "token-1",
    });

    expect(result.raw).toEqual(body);
    expect(result.authCode).toBe("A");
    expect(result.orderCode).toBe(1);
  });

  it("sends requests with an AbortSignal timeout", async () => {
    const fetchSpy = mockFetchJson(200, { error_code: "000", status: 5 });
    const client = new NinePayRecurringClient(config);

    await client.chargeMit({
      requestId: "UCMTEST1",
      amountVnd: 10000,
      originalOrderCode: 123,
      cardToken: "token-1",
    });

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("inquire reads failureReason and raw from an error body", async () => {
    const body = {
      status: 6,
      error_code: "221",
      failure_reason: "Transaction not found",
    };
    mockFetchJson(503, body);
    const client = new NinePayRecurringClient(config);

    const result = await client.inquire("X");

    expect(result.httpOk).toBe(false);
    expect(result.errorCode).toBe("221");
    expect(result.failureReason).toBe("Transaction not found");
    expect(result.raw).toEqual(body);
  });

  it("deleteCardToken succeeds on code 00", async () => {
    mockFetchJson(200, { code: "00" });
    const client = new NinePayRecurringClient(config);

    await expect(client.deleteCardToken("token-1")).resolves.toEqual({
      succeeded: true,
    });
  });

  it("throws GATEWAY_NOT_CONFIGURED when credentials are missing", async () => {
    const client = new NinePayRecurringClient({});

    const error = await client.inquire("X").catch((e) => e);
    expect(error).toBeInstanceOf(NinePayGatewayError);
    expect((error as NinePayGatewayError).code).toBe(
      "GATEWAY_NOT_CONFIGURED"
    );
  });

  it("throws GATEWAY_INVALID_RESPONSE on non-JSON bodies", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 200,
      text: vi.fn().mockResolvedValue("<html>not json</html>"),
    } as never);
    const client = new NinePayRecurringClient(config);

    const error = await client.inquire("X").catch((e) => e);
    expect(error).toBeInstanceOf(NinePayGatewayError);
    expect((error as NinePayGatewayError).code).toBe(
      "GATEWAY_INVALID_RESPONSE"
    );
  });

  it("resolves gateway HTTP errors as business results with httpOk false", async () => {
    mockFetchJson(500, { error_code: "999", failure_reason: "busy" });
    const client = new NinePayRecurringClient(config);

    const result = await client.chargeMit({
      requestId: "UCMTEST1",
      amountVnd: 10000,
      originalOrderCode: 123,
      cardToken: "token-1",
    });

    expect(result.httpOk).toBe(false);
    expect(result.httpStatus).toBe(500);
    expect(result.errorCode).toBe("999");
  });

  it("wraps network failures in NinePayGatewayError", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("fetch failed")
    );
    const client = new NinePayRecurringClient(config);

    const error = await client.inquire("X").catch((e) => e);
    expect(error).toBeInstanceOf(NinePayGatewayError);
    expect((error as NinePayGatewayError).code).toBe("GATEWAY_NETWORK");
  });

  it("rejects empty references", async () => {
    const client = new NinePayRecurringClient(config);

    const error = await client.inquire("   ").catch((e) => e);
    expect(error).toBeInstanceOf(NinePayGatewayError);
    expect((error as NinePayGatewayError).code).toBe("INVALID_ARGUMENT");
  });

  it("rejects unsafe integer digit strings as null", async () => {
    mockFetchJson(200, {
      error_code: "000",
      order_code: "9007199254740993",
    });
    const client = new NinePayRecurringClient(config);

    const result = await client.chargeMit({
      requestId: "UCMTEST1",
      amountVnd: 10000,
      originalOrderCode: 123,
      cardToken: "token-1",
    });

    expect(result.orderCode).toBeNull();
  });
});
