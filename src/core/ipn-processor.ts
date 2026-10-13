import type {
  IpnProcessorLogger,
  IpnRawPayload,
  IpnProcessResult,
  IpnProcessorOptions,
  ManualReviewContext,
  NotificationContext,
} from "./types";
import { verifyChecksum } from "./verification";
import {
  NINEPAY_CANCELLED_STATUS,
  NINEPAY_FAILED_STATUS,
  NINEPAY_MANUAL_REVIEW_STATUSES,
  NINEPAY_SUCCESS_STATUS,
} from "./transaction-status";

function readOrderId(paymentInfo: Record<string, unknown>): string | null {
  const invoiceNo = paymentInfo.invoice_no;
  if (typeof invoiceNo === "string" && invoiceNo.trim().length > 0) {
    return invoiceNo.trim();
  }
  if (typeof invoiceNo === "number" && Number.isSafeInteger(invoiceNo)) {
    return String(invoiceNo);
  }
  return null;
}

function readStatus(paymentInfo: Record<string, unknown>): number | null {
  const status = paymentInfo.status;
  if (typeof status === "number" && Number.isInteger(status)) return status;
  if (typeof status === "string" && /^\d+$/.test(status.trim())) {
    return Number(status.trim());
  }
  return null;
}

function readAmount(paymentInfo: Record<string, unknown>): number | null {
  const amount = paymentInfo.amount;
  if (typeof amount === "number" && Number.isFinite(amount)) return amount;
  if (typeof amount === "string" && amount.trim().length > 0) {
    const parsed = Number(amount.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readCurrency(paymentInfo: Record<string, unknown>): string {
  return typeof paymentInfo.currency === "string"
    ? paymentInfo.currency.trim()
    : "";
}

type NotifyOptions = Pick<IpnProcessorOptions, "notifications" | "logger">;

async function notifySuccess(
  options: NotifyOptions,
  ctx: NotificationContext
): Promise<void> {
  if (!options.notifications?.onSuccess) return;
  try {
    await options.notifications.onSuccess(ctx);
  } catch (error) {
    options.logger?.error("9pay-integrate onSuccess hook failed", error);
  }
}

async function notifyFailure(
  options: NotifyOptions,
  ctx: NotificationContext
): Promise<void> {
  if (!options.notifications?.onFailure) return;
  try {
    await options.notifications.onFailure(ctx);
  } catch (error) {
    options.logger?.error("9pay-integrate onFailure hook failed", error);
  }
}

async function notifyManualReview(
  options: NotifyOptions,
  ctx: ManualReviewContext
): Promise<void> {
  if (!options.notifications?.onManualReview) return;
  try {
    await options.notifications.onManualReview(ctx);
  } catch (error) {
    options.logger?.error("9pay-integrate onManualReview hook failed", error);
  }
}

/**
 * Process a 9Pay IPN (Instant Payment Notification) — adapter-agnostic.
 *
 * The IPN is the source of truth for payment status. It:
 *  1. Verifies the checksum
 *  2. Decodes the payment info
 *  3. Extracts the orderId (invoice_no)
 *  4. Validates status / amount / currency
 *  5. Skips already-settled orders (at-least-once delivery)
 *  6. Calls orderRepository.updateOrderStatus()
 *  7. Calls notification hooks (onSuccess / onFailure / onManualReview)
 *
 * Status handling mirrors production 9Pay behavior: 5 settles, 6 fails,
 * 8 cancels, 3/9 need manual review without a status change, anything
 * else is ignored. Malformed payloads are rejected without touching
 * the order so 9Pay retries the delivery.
 *
 * The Next.js adapter (or Express, Hono, etc.) is responsible for:
 *  - Parsing the incoming request into IpnRawPayload
 *  - Returning the appropriate HTTP response
 */
export async function processIpn<TOrder = unknown>(
  payload: IpnRawPayload,
  options: IpnProcessorOptions<TOrder>
): Promise<IpnProcessResult> {
  const { config, orderRepository, expected, logger } = options;

  const verification = verifyChecksum(
    payload.result,
    payload.checksum,
    config.checksumKey
  );

  if (!verification.valid || !verification.data) {
    return {
      success: false,
      message: verification.error || "Invalid checksum",
      statusCode: 403,
    };
  }

  const paymentInfo = verification.data;

  const orderId = readOrderId(paymentInfo);
  if (!orderId) {
    return {
      success: false,
      message: "Missing invoice_no in IPN payload",
      statusCode: 400,
    };
  }

  const status = readStatus(paymentInfo);
  if (status === null) {
    return {
      success: false,
      message: "Missing or invalid status in IPN payload",
      statusCode: 400,
      orderId,
    };
  }

  const amount = readAmount(paymentInfo);
  if (amount === null) {
    return {
      success: false,
      message: "Missing or invalid amount in IPN payload",
      statusCode: 400,
      orderId,
    };
  }
  const currency = readCurrency(paymentInfo);

  if (expected) {
    if (amount !== expected.amount) {
      return {
        success: false,
        message: "IPN amount does not match the order total",
        statusCode: 400,
        orderId,
      };
    }
    if (currency.toUpperCase() !== expected.currency.toUpperCase()) {
      return {
        success: false,
        message: "IPN currency does not match the order currency",
        statusCode: 400,
        orderId,
      };
    }
  }

  let currentStatus: string | null = null;
  try {
    currentStatus = await orderRepository.getOrderStatus(orderId);
  } catch (error) {
    logger?.warn("9pay-integrate status lookup failed, continuing", error);
  }
  if (currentStatus === "completed" || currentStatus === "failed" || currentStatus === "cancelled") {
    return {
      success: true,
      message: "Order already settled",
      statusCode: 200,
      orderId,
      duplicate: true,
    };
  }

  if (status === NINEPAY_SUCCESS_STATUS) {
    const notification: NotificationContext = {
      orderId,
      status: "completed",
      amount,
      currency,
      paymentMethod: "9pay",
      metadata: paymentInfo,
    };
    try {
      const updated = await orderRepository.updateOrderStatus(
        orderId,
        "completed"
      );
      if (updated === null) {
        return {
          success: false,
          message: "Order not found",
          statusCode: 404,
          orderId,
        };
      }
    } catch {
      return {
        success: false,
        message: "Failed to update order",
        statusCode: 500,
        orderId,
      };
    }

    await notifySuccess(options, notification);

    return {
      success: true,
      message: "Order updated successfully",
      statusCode: 200,
      orderId,
    };
  }

  if (status === NINEPAY_FAILED_STATUS || status === NINEPAY_CANCELLED_STATUS) {
    const terminal = status === NINEPAY_FAILED_STATUS ? "failed" : "cancelled";
    const notification: NotificationContext = {
      orderId,
      status: "failed",
      amount,
      currency,
      paymentMethod: "9pay",
      metadata: paymentInfo,
    };
    try {
      const updated = await orderRepository.updateOrderStatus(
        orderId,
        terminal
      );
      if (updated === null) {
        return {
          success: false,
          message: "Order not found",
          statusCode: 404,
          orderId,
        };
      }
    } catch {
      return {
        success: false,
        message: "Failed to update order",
        statusCode: 500,
        orderId,
      };
    }

    await notifyFailure(options, notification);

    return {
      success: false,
      message: terminal === "failed" ? "Payment failed" : "Payment cancelled",
      statusCode: 200,
      orderId,
    };
  }

  if (
    (NINEPAY_MANUAL_REVIEW_STATUSES as readonly number[]).includes(status)
  ) {
    await notifyManualReview(
      options,
      {
        orderId,
        amount,
        currency,
        status,
        errorCode: String(paymentInfo.error_code ?? ""),
        metadata: paymentInfo,
      }
    );
    return {
      success: true,
      message: "Payment needs manual review",
      statusCode: 200,
      orderId,
      manualReview: true,
    };
  }

  return {
    success: true,
    message: "IPN acknowledged without a status change",
    statusCode: 200,
    orderId,
  };
}
