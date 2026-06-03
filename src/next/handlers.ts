import { NextResponse } from "next/server";

import type {
  NinePayConfig,
  OrderRepository,
  NotificationHooks,
  VerifyCallbackResult,
  PaymentStatusResponse,
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
 * Example consumer usage:
 *   const result = verifyNinePayCallback(request, config);
 *   if (!result.success) return NextResponse.redirect(new URL("/payment/error", request.url));
 *   return NextResponse.redirect(new URL(`/payment/process?orderId=${result.orderId}`, request.url));
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
 * Handles both multipart/form-data and application/x-www-form-urlencoded.
 */
async function parseIpnRequest(
  request: Request
): Promise<{ result: string; checksum: string }> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const extracted = extractIpnFromFormData(formData);
    return extracted;
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body = await request.text();
    const extracted = extractIpnFromUrlEncoded(body);
    return extracted;
  }

  throw new Error(`Unsupported IPN content-type: ${contentType || "unknown"}`);
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
export async function handle9PayIpn(
  request: Request,
  options: {
    config: NinePayConfig;
    orderRepository: OrderRepository;
    notifications?: NotificationHooks;
  }
): Promise<NextResponse> {
  try {
    const payload = await parseIpnRequest(request);

    const result = await processIpn(payload, {
      config: options.config,
      orderRepository: options.orderRepository,
      notifications: options.notifications,
    });

    return NextResponse.json(
      { success: result.success, message: result.message },
      { status: result.statusCode }
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "Unsupported or invalid form payload" },
      { status: 400 }
    );
  }
}

// ─── Payment Status ─────────────────────────────────────────────────────────

/**
 * Handle payment status polling (GET /api/payment/status).
 *
 * Consumer usage:
 *   export async function GET(request: Request) {
 *     return handlePaymentStatus(request, { orderRepository: repo });
 *   }
 */
export async function handlePaymentStatus(
  request: Request,
  options: {
    orderRepository: OrderRepository;
  }
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
    const status = await options.orderRepository.getOrderStatus(orderId);

    if (status === null) {
      return NextResponse.json(
        { success: false, message: "Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, status } satisfies PaymentStatusResponse);
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
