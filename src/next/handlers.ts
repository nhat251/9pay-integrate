import { NextResponse } from "next/server";

import type {
  IpnProcessorLogger,
  NinePayConfig,
  NotificationHooks,
  OrderRepository,
  VerifyCallbackResult,
} from "../core/types";
import { verifyCallback } from "../core/verify-callback";
import { processIpn } from "../core/ipn-processor";
import { extractIpnFromFormData, extractIpnFromUrlEncoded } from "../core/ipn";

// ─── Callback ───────────────────────────────────────────────────────────────

/**
 * Verify 9Pay browser redirect callback (GET /api/checkout/9pay/callback).
 *
 * Returns a result object — consumer decides the redirect target.
 * This is Option B: package does NOT redirect, only verifies and returns data.
 *
 * The callback is display-only: only the IPN settles orders. Route
 * successful checksums to a processing page that polls the order status,
 * and anything else to an error page.
 *
 * Example consumer usage:
 *   const result = verifyNinePayCallback(request, config);
 *   if (!result.success || !result.isSuccess) {
 *     return NextResponse.redirect(new URL("/payment/error", request.url));
 *   }
 *   return NextResponse.redirect(
 *     new URL(`/payment/process?orderId=${encodeURIComponent(result.orderId)}`, request.url)
 *   );
 */
export function verifyNinePayCallback(
  request: Request,
  config: NinePayConfig
): VerifyCallbackResult {
  const { searchParams } = new URL(request.url);
  return verifyCallback(searchParams, config);
}

// ─── IPN Handler ────────────────────────────────────────────────────────────

/**
 * Parse IPN payload from a Next.js Request.
 * Handles multipart/form-data and application/x-www-form-urlencoded.
 * A missing content-type is treated as a urlencoded body attempt.
 */
async function parseIpnRequest(
  request: Request
): Promise<{ result: string; checksum: string }> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    return extractIpnFromFormData(await request.formData());
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType === ""
  ) {
    const body = await request.text();
    const extracted = extractIpnFromUrlEncoded(body);
    if (!extracted.result || !extracted.checksum) {
      throw new Error("Invalid IPN payload: missing result or checksum");
    }
    return extracted;
  }

  throw new Error(`Unsupported IPN content-type: ${contentType}`);
}

export interface Handle9PayIpnOptions<TOrder = unknown> {
  config: NinePayConfig;
  orderRepository: OrderRepository<TOrder>;
  notifications?: NotificationHooks;
  expected?: {
    amount: number;
    currency: string;
  };
  logger?: IpnProcessorLogger;
}

/**
 * Handle 9Pay IPN webhook (POST /api/checkout/9pay/ipn).
 *
 * This is Option C: the handler encapsulates all 6 steps:
 *  1. Parse request (content-type detection + extraction)
 *  2. Verify checksum (via core)
 *  3. Decode payment info
 *  4. Call orderRepository.updateOrderStatus()
 *  5. Call notification hooks
 *  6. Return NextResponse with appropriate status code
 *
 * Consumer usage:
 *   export async function POST(request: Request) {
 *     return handle9PayIpn(request, {
 *       config,
 *       orderRepository: repo,
 *       notifications: { onSuccess, onFailure },
 *     });
 *   }
 */
export async function handle9PayIpn<TOrder = unknown>(
  request: Request,
  options: Handle9PayIpnOptions<TOrder>
): Promise<NextResponse> {
  let payload: { result: string; checksum: string };
  try {
    payload = await parseIpnRequest(request);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid IPN payload";
    const status = message.startsWith("Unsupported IPN content-type")
      ? 415
      : 400;
    return NextResponse.json({ success: false, message }, { status });
  }

  try {
    const result = await processIpn(payload, {
      config: options.config,
      orderRepository: options.orderRepository,
      notifications: options.notifications,
      expected: options.expected,
      logger: options.logger,
    });

    return NextResponse.json(
      { success: result.success, message: result.message },
      { status: result.statusCode }
    );
  } catch (error) {
    options.logger?.error("9pay-integrate IPN processing failed", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── Payment Status ─────────────────────────────────────────────────────────

export interface HandlePaymentStatusOptions<TOrder = unknown> {
  orderRepository: OrderRepository<TOrder>;
  /** Reject the lookup (403) unless the caller owns the order */
  authorize?: (orderId: string) => Promise<boolean> | boolean;
}

/**
 * Handle payment status polling (GET /api/payment/status).
 *
 * Pass `authorize` to prevent order enumeration — without it any
 * caller can probe arbitrary orderIds.
 *
 * Consumer usage:
 *   export async function GET(request: Request) {
 *     return handlePaymentStatus(request, {
 *       orderRepository: repo,
 *       authorize: (orderId) => belongsToSession(orderId),
 *     });
 *   }
 */
export async function handlePaymentStatus<TOrder = unknown>(
  request: Request,
  options: HandlePaymentStatusOptions<TOrder>
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");

  if (!orderId) {
    return NextResponse.json(
      { success: false, message: "Missing orderId" },
      { status: 400 }
    );
  }

  try {
    if (options.authorize && !(await options.authorize(orderId))) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const status = await options.orderRepository.getOrderStatus(orderId);

    if (status === null) {
      return NextResponse.json(
        { success: false, message: "Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, status });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
