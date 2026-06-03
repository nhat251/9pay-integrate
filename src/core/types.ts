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
  cancelUrl?: string;
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
  options?: NinePayPaymentOptions;
}

// ─── Callback Verification ──────────────────────────────────────────────────

export interface VerifyCallbackResult {
  success: boolean;
  orderId?: string;
  amount?: number;
  currency?: string;
  status?: number;
  /** Raw decoded payload for consumer access */
  rawParams: Record<string, unknown>;
  error?: string;
}

// ─── Checksum Verification ──────────────────────────────────────────────────

export interface VerificationResult<T = Record<string, unknown>> {
  valid: boolean;
  data: T | null;
  error?: string;
}

// ─── Order Management (consumer implements) ─────────────────────────────────

export type OrderStatus = "neworder" | "pending" | "completed" | "failed";

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
    status: "completed" | "failed"
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

export type NotificationHandler = (
  ctx: NotificationContext
) => Promise<void> | void;

export interface NotificationHooks {
  onSuccess?: NotificationHandler;
  onFailure?: NotificationHandler;
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
}

export interface IpnProcessorOptions {
  config: NinePayConfig;
  orderRepository: OrderRepository;
  notifications?: NotificationHooks;
}

// ─── Status Polling Response ────────────────────────────────────────────────

export interface PaymentStatusResponse {
  success: boolean;
  status: OrderStatus | null;
  message?: string;
}
