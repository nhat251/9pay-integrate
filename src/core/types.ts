/**
 * Core type definitions for 9Pay integration.
 * Framework-agnostic — no Next.js, React, or Express dependencies.
 */

// ─── 9Pay Configuration ────────────────────────────────────────────────────

export interface NinePayConfig {
  merchantKey: string;
  secretKey: string;
  checksumKey: string;
  baseUrl?: string;
  returnUrl: string;
}

// ─── Payment Creation ───────────────────────────────────────────────────────

export interface NinePayPaymentOptions {
  /** 0: All, 1: Domestic, 2: International */
  card_origin_allow?: 0 | 1 | 2;
  /** Comma-separated: "VISA,MASTER,JCB,AMEX" */
  card_brand_allow?: string;
  /** Comma-separated BIN codes */
  bin_allow?: string;
  /** Card type filter */
  card_type_allow?: string;
  lang?: "en" | "vi";
  method?: string;
}

export interface CreatePaymentParams {
  orderId: string | number;
  amount: number;
  currency: string;
  description: string;
  /** When set, return_url/back_url embed ?intentId= for linking callbacks */
  paymentIntentId?: string;
  options?: NinePayPaymentOptions;
}

// ─── Callback Verification ──────────────────────────────────────────────────

export type VerifyCallbackResult =
  | {
      success: true;
      orderId: string;
      amount: number;
      currency: string;
      status: number;
      /** True when status indicates a paid order (status 5). IPN remains the source of truth. */
      isSuccess: boolean;
      /** Raw decoded payload for consumer access */
      rawParams: Record<string, unknown>;
    }
  | {
      success: false;
      rawParams: Record<string, unknown>;
      error: string;
      isSuccess: false;
    };

// ─── Checksum Verification ──────────────────────────────────────────────────

export interface VerificationResult<T = Record<string, unknown>> {
  valid: boolean;
  data: T | null;
  error?: string;
}

// ─── Order Management (consumer implements) ─────────────────────────────────

export type OrderStatus =
  | "neworder"
  | "pending"
  | "completed"
  | "failed"
  | "cancelled";

export interface CreateOrderParams {
  orderId?: string;
  totalAmount: number;
  currency: string;
  paymentMethod: string;
  metadata?: Record<string, unknown>;
}

export interface OrderRepository<TOrder = unknown> {
  createOrder(params: CreateOrderParams): Promise<TOrder>;
  getOrderStatus(orderId: string): Promise<OrderStatus | null>;
  updateOrderStatus(
    orderId: string,
    status: "completed" | "failed" | "cancelled"
  ): Promise<TOrder | null>;
}

// ─── Notification Hooks (consumer implements) ───────────────────────────────

export interface NotificationContext {
  orderId: string;
  status: "completed" | "failed";
  amount: number;
  currency: string;
  paymentMethod: string;
  metadata?: Record<string, unknown>;
}

export interface ManualReviewContext {
  orderId: string;
  amount: number;
  currency: string;
  status: number;
  errorCode: string;
  metadata?: Record<string, unknown>;
}

export type NotificationHandler = (
  ctx: NotificationContext
) => Promise<void> | void;

export interface NotificationHooks {
  onSuccess?: NotificationHandler;
  onFailure?: NotificationHandler;
  onManualReview?: (ctx: ManualReviewContext) => Promise<void> | void;
}

// ─── IPN Processing ─────────────────────────────────────────────────────────

export interface IpnRawPayload {
  result: string;
  checksum: string;
}

export interface IpnProcessResult {
  success: boolean;
  message: string;
  statusCode: number;
  orderId?: string;
  /** True when the order was already settled by an earlier IPN delivery */
  duplicate?: boolean;
  /** True when the payment needs human review (no status change applied) */
  manualReview?: boolean;
}

export interface IpnProcessorLogger {
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

export interface IpnProcessorOptions<TOrder = unknown> {
  config: NinePayConfig;
  orderRepository: OrderRepository<TOrder>;
  notifications?: NotificationHooks;
  /** When set, IPN amount/currency must match or the payload is rejected */
  expected?: {
    amount: number;
    currency: string;
  };
  logger?: IpnProcessorLogger;
}

// ─── Status Polling Response ────────────────────────────────────────────────

export interface PaymentStatusResponse {
  success: boolean;
  status: OrderStatus | null;
  message?: string;
}
