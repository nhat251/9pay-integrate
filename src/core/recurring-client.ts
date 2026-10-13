import {
  buildAuthorizationHeaders,
  buildHttpQuery,
} from "./signing";
import { buildReturnUrl } from "./return-url";
import { NINEPAY_GATEWAY_NOT_CONFIGURED_ERROR_CODE } from "./transaction-status";

export const NINEPAY_RECURRING_PATH = "/v2/payments/recurring/request";
export const NINEPAY_REQUEST_TIMEOUT_MS = 60_000;

export interface NinePayRecurringClientConfig {
  baseUrl: string;
  merchantKey: string;
  secretKey: string;
  returnUrl: string;
}

export interface NinePayCitRequest {
  requestId: string;
  amountVnd: number;
  description: string;
  paymentIntentId: string;
}

export interface NinePayCitResult {
  httpOk: boolean;
  httpStatus: number;
  orderCode: number | null;
  paymentUrl: string | null;
  errorCode: string;
  failureReason: string | null;
  raw: Record<string, unknown>;
}

export interface NinePayMitRequest {
  requestId: string;
  amountVnd: number;
  originalOrderCode: number;
  cardToken: string;
}

export interface NinePayMitResult {
  httpOk: boolean;
  httpStatus: number;
  orderCode: number | null;
  originalOrderCode: number | null;
  authCode: string | null;
  errorCode: string;
  failureReason: string | null;
  raw: Record<string, unknown>;
}

export interface NinePayInquiryResult {
  httpOk: boolean;
  paymentNo: number | null;
  invoiceNo: string | null;
  amount: number | null;
  amountActuallyReceived: number | null;
  status: number | null;
  errorCode: string;
  failureReason: string | null;
  raw: Record<string, unknown>;
}

export class NinePayGatewayError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 500) {
    super(message);
    this.name = "NinePayGatewayError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function readString(
  source: Record<string, unknown>,
  key: string
): string | null {
  const value = source[key];
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return String(value);
  }
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readNumber(
  source: Record<string, unknown>,
  key: string
): number | null {
  const value = source[key];
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function requireField(
  config: Partial<NinePayRecurringClientConfig>,
  key: keyof NinePayRecurringClientConfig
): string {
  const value = config[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new NinePayGatewayError(
      NINEPAY_GATEWAY_NOT_CONFIGURED_ERROR_CODE,
      "9Pay gateway is not configured"
    );
  }
  return value.trim();
}

function requireReference(value: string, name: string): string {
  if (value.trim().length === 0) {
    throw new NinePayGatewayError("INVALID_ARGUMENT", `${name} must not be empty`, 400);
  }
  return encodeURIComponent(value.trim());
}

function requireAmountVnd(amountVnd: number): void {
  if (!Number.isSafeInteger(amountVnd) || amountVnd <= 0) {
    throw new NinePayGatewayError(
      "INVALID_ARGUMENT",
      "amountVnd must be a positive safe integer",
      400
    );
  }
}

/**
 * Framework-agnostic client for the 9Pay recurring (CIT/MIT) API.
 * Zero framework dependencies — works in Node.js, Next.js route handlers,
 * Express, Fastify, Hono, Bun and Deno (with a global fetch).
 */
export class NinePayRecurringClient {
  private readonly config: NinePayRecurringClientConfig;

  constructor(config: Partial<NinePayRecurringClientConfig>) {
    this.config = {
      baseUrl: config.baseUrl ?? "",
      merchantKey: config.merchantKey ?? "",
      secretKey: config.secretKey ?? "",
      returnUrl: config.returnUrl ?? "",
    };
  }

  async createCit(input: NinePayCitRequest): Promise<NinePayCitResult> {
    requireAmountVnd(input.amountVnd);
    const body = {
      request_id: input.requestId,
      request_type: "CIT",
      currency: "VND",
      amount: input.amountVnd,
      method: "CREDIT_CARD",
      description: input.description,
      return_url: buildReturnUrl(
        requireField(this.config, "returnUrl"),
        input.paymentIntentId
      ),
      lang: "vi",
    };
    const { httpStatus, payload } = await this.post(NINEPAY_RECURRING_PATH, body);
    return {
      httpOk: httpStatus >= 200 && httpStatus < 300,
      httpStatus,
      orderCode: readNumber(payload, "order_code"),
      paymentUrl: readString(payload, "payment_url"),
      errorCode: readString(payload, "error_code") ?? "UNKNOWN",
      failureReason: readString(payload, "failure_reason"),
      raw: payload,
    };
  }

  async chargeMit(input: NinePayMitRequest): Promise<NinePayMitResult> {
    requireAmountVnd(input.amountVnd);
    const body = {
      request_id: input.requestId,
      request_type: "MIT",
      currency: "VND",
      amount: input.amountVnd,
      method: "CREDIT_CARD",
      original_order_code: input.originalOrderCode,
      card_token: input.cardToken,
    };
    const { httpStatus, payload } = await this.post(NINEPAY_RECURRING_PATH, body);
    return {
      httpOk: httpStatus >= 200 && httpStatus < 300,
      httpStatus,
      orderCode: readNumber(payload, "order_code"),
      originalOrderCode: readNumber(payload, "original_order_code"),
      authCode: readString(payload, "auth_code"),
      errorCode: readString(payload, "error_code") ?? "UNKNOWN",
      failureReason: readString(payload, "failure_reason"),
      raw: payload,
    };
  }

  async inquire(reference: string): Promise<NinePayInquiryResult> {
    const { httpStatus, payload } = await this.get(
      `/v2/payments/${requireReference(reference, "reference")}/inquire`
    );
    return {
      httpOk: httpStatus >= 200 && httpStatus < 300,
      paymentNo: readNumber(payload, "payment_no"),
      invoiceNo: readString(payload, "invoice_no"),
      amount: readNumber(payload, "amount"),
      amountActuallyReceived: readNumber(payload, "amount_actually_received"),
      status: readNumber(payload, "status"),
      errorCode: readString(payload, "error_code") ?? "UNKNOWN",
      failureReason: readString(payload, "failure_reason"),
      raw: payload,
    };
  }

  async deleteCardToken(token: string): Promise<{ succeeded: boolean }> {
    const { payload } = await this.post(
      `/card_token/${requireReference(token, "token")}/delete`,
      {}
    );
    return { succeeded: readString(payload, "code") === "00" };
  }

  private async post(
    path: string,
    body: Record<string, string | number>
  ): Promise<{ httpStatus: number; payload: Record<string, unknown> }> {
    const baseUrl = requireField(this.config, "baseUrl").replace(/\/$/, "");
    const merchantKey = requireField(this.config, "merchantKey");
    const secretKey = requireField(this.config, "secretKey");
    const time = Math.floor(Date.now() / 1000);
    const canonical = buildHttpQuery(body);
    const message =
      canonical.length > 0
        ? `POST\n${baseUrl}${path}\n${time}\n${canonical}`
        : `POST\n${baseUrl}${path}\n${time}`;
    const headers = buildAuthorizationHeaders(
      message,
      time,
      merchantKey,
      secretKey
    );
    return this.send(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: canonical,
    });
  }

  private async get(
    path: string
  ): Promise<{ httpStatus: number; payload: Record<string, unknown> }> {
    const baseUrl = requireField(this.config, "baseUrl").replace(/\/$/, "");
    const merchantKey = requireField(this.config, "merchantKey");
    const secretKey = requireField(this.config, "secretKey");
    const time = Math.floor(Date.now() / 1000);
    const message = `GET\n${baseUrl}${path}\n${time}`;
    const headers = buildAuthorizationHeaders(
      message,
      time,
      merchantKey,
      secretKey
    );
    return this.send(`${baseUrl}${path}`, {
      method: "GET",
      headers: { ...headers, Accept: "application/json" },
    });
  }

  private async send(
    url: string,
    init: RequestInit
  ): Promise<{ httpStatus: number; payload: Record<string, unknown> }> {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(NINEPAY_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof NinePayGatewayError) throw error;
      const timedOut =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      throw new NinePayGatewayError(
        timedOut ? "GATEWAY_TIMEOUT" : "GATEWAY_NETWORK",
        timedOut ? "9Pay request timed out" : "9Pay request failed",
        timedOut ? 504 : 503
      );
    }
    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new NinePayGatewayError(
        "GATEWAY_INVALID_RESPONSE",
        "9Pay returned an unreadable response"
      );
    }
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new NinePayGatewayError(
        "GATEWAY_INVALID_RESPONSE",
        "9Pay returned a non-JSON response"
      );
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new NinePayGatewayError(
        "GATEWAY_INVALID_RESPONSE",
        "9Pay returned a non-JSON response"
      );
    }
    return {
      httpStatus: response.status,
      payload: parsed as Record<string, unknown>,
    };
  }
}
