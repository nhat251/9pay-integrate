import type {
  IpnRawPayload,
  IpnProcessResult,
  IpnProcessorOptions,
} from "./types";
import { verifyChecksum } from "./verification";
import { SUCCESS_STATUS } from "./constants";

/**
 * Process a 9Pay IPN (Instant Payment Notification) — adapter-agnostic.
 *
 * This is the core IPN logic, completely independent of Next.js, Express,
 * or any framework. It:
 *  1. Verifies the checksum
 *  2. Decodes the payment info
 *  3. Extracts the orderId (invoice_no)
 *  4. Checks payment status (5 = success)
 *  5. Calls orderRepository.updateOrderStatus()
 *  6. Calls notification hooks (onSuccess / onFailure)
 *
 * The Next.js adapter (or Express, Hono, etc.) is responsible for:
 *  - Parsing the incoming request into IpnRawPayload
 *  - Returning the appropriate HTTP response
 */
export async function processIpn(
  payload: IpnRawPayload,
  options: IpnProcessorOptions
): Promise<IpnProcessResult> {
  const { config, orderRepository, notifications } = options;

  // Step 1: Verify checksum
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

  // Step 2: Extract orderId from invoice_no
  const invoiceNo = paymentInfo.invoice_no;
  const orderId =
    typeof invoiceNo === "string" && invoiceNo.trim().length > 0
      ? invoiceNo
      : typeof invoiceNo === "number"
        ? String(invoiceNo)
        : null;

  if (!orderId) {
    return {
      success: false,
      message: "Missing invoice_no in IPN payload",
      statusCode: 400,
    };
  }

  // Step 3: Check payment status
  const isSuccess = Number(paymentInfo.status) === SUCCESS_STATUS;
  const amount = Number(paymentInfo.amount ?? 0);
  const currency = String(paymentInfo.currency ?? "");

  if (isSuccess) {
    // Step 4a: Update order to completed
    try {
      await orderRepository.updateOrderStatus(orderId, "completed");
    } catch (error) {
      return {
        success: false,
        message: `Failed to update order: ${error instanceof Error ? error.message : String(error)}`,
        statusCode: 500,
        orderId,
      };
    }

    // Step 5a: Fire success notification
    if (notifications?.onSuccess) {
      try {
        await notifications.onSuccess({
          orderId,
          status: "completed",
          amount,
          currency,
          paymentMethod: "9pay",
          metadata: paymentInfo,
        });
      } catch {
        // Notification failure should not fail the IPN response.
        // The order is already updated — log externally if needed.
      }
    }

    return {
      success: true,
      message: "Order updated successfully",
      statusCode: 200,
      orderId,
    };
  }

  // Step 4b: Update order to failed
  try {
    await orderRepository.updateOrderStatus(orderId, "failed");
  } catch (error) {
    return {
      success: false,
      message: `Failed to update order: ${error instanceof Error ? error.message : String(error)}`,
      statusCode: 500,
      orderId,
    };
  }

  // Step 5b: Fire failure notification
  if (notifications?.onFailure) {
    try {
      await notifications.onFailure({
        orderId,
        status: "failed",
        amount,
        currency,
        paymentMethod: "9pay",
        metadata: paymentInfo,
      });
    } catch {
      // Notification failure should not fail the IPN response.
    }
  }

  return {
    success: false,
    message: "Payment failed",
    statusCode: 200,
    orderId,
  };
}
