# 9pay-integrate

[![npm version](https://img.shields.io/npm/v/9pay-integrate.svg)](https://www.npmjs.com/package/9pay-integrate)
[![npm downloads](https://img.shields.io/npm/dm/9pay-integrate.svg)](https://www.npmjs.com/package/9pay-integrate)

Complete 9Pay payment gateway integration for Node.js and Next.js. Generate payment URLs, verify callbacks, process IPN webhooks — all with a clean, framework-agnostic core.

Node.js 18+ required (uses `node:crypto`, `AbortSignal.timeout`, and `Buffer` — the App Router route handlers run on the Node.js runtime, not the Edge runtime).

```bash
pnpm install 9pay-integrate
```

## Quick Start

### 1. Configure

```typescript
// lib/9pay-config.ts
import { configFromEnv } from "9pay-integrate";

export const ninepay = configFromEnv(process.env);
```

Required environment variables:
- `NINEPAY_MERCHANT_KEY`
- `NINEPAY_SECRET_KEY`
- `NINEPAY_CHECKSUM_KEY`
- `NINEPAY_RETURN_URL` (e.g. `https://yoursite.com/api/checkout/9pay/callback`)

Optional:
- `NINEPAY_BASE_URL` (default: `https://payment.9pay.vn`)

### 2. Implement Order Repository

The package needs a way to manage orders. Implement the `OrderRepository` interface for your data layer (Strapi, Prisma, Drizzle, MongoDB, REST API, etc.).

```typescript
// lib/order-repository.ts
import type { OrderRepository, OrderStatus } from "9pay-integrate";

export const repo: OrderRepository = {
  async createOrder(params) {
    // Create order in your database
    // Return whatever your DB returns
  },
  async getOrderStatus(orderId: string): Promise<OrderStatus | null> {
    // Query order status from your database.
    // Used for status polling AND to detect duplicate IPN deliveries,
    // so return the live status: "neworder" | "pending" | "completed" | "failed" | "cancelled" | null
  },
  async updateOrderStatus(orderId: string, status: "completed" | "failed" | "cancelled") {
    // Update order status in your database.
    // Only transition out of "pending" — return null when the order is missing
    // so IPN retries instead of silently acking.
    // Return the updated order or null
  },
};
```

### 3. Implement Notification Hooks (optional)

```typescript
// lib/notifications.ts
import type { NotificationContext } from "9pay-integrate";

export const notifications = {
  async onSuccess(ctx: NotificationContext) {
    // Send confirmation email
    // Send Telegram/Slack notification
    console.log(`Order ${ctx.orderId} completed: ${ctx.amount} ${ctx.currency}`);
  },
  async onFailure(ctx: NotificationContext) {
    // Alert on payment failure
    console.log(`Order ${ctx.orderId} failed`);
  },
};
```

### 4. Create Payment URL (Checkout POST)

In your checkout API route, create the order in your database, then generate the 9Pay redirect URL.

```typescript
// app/api/checkout/route.ts
import { NextResponse } from "next/server";
import { createPaymentUrl } from "9pay-integrate";
import { ninepay } from "@/lib/9pay-config";
import { repo } from "@/lib/order-repository";

export async function POST(request: Request) {
  const body = await request.json();

  // 1. Validate checkout form data, calculate pricing, etc.
  // 2. Create order in your database
  const order = await repo.createOrder({
    totalAmount: body.amount,
    currency: body.currency,
    paymentMethod: "9pay",
    metadata: body,
  });

  // 3. Generate 9Pay payment URL (pass paymentIntentId to link return_url)
  const paymentUrl = createPaymentUrl(ninepay, {
    orderId: order.id, // or order.documentId, whatever your DB returns
    amount: body.amount,
    currency: body.currency,
    description: "Order Payment",
    paymentIntentId: order.id,
  });

  return NextResponse.json({ success: true, orderId: order.id, paymentUrl });
}
```

### 5. Wire Up Routes

#### Callback Route (GET)

Handles the browser redirect after payment on 9Pay's portal.
Display-only: a valid checksum does not mean the order is paid —
only the IPN settles orders. Send the user to a processing page
that polls the order status.

```typescript
// app/api/checkout/9pay/callback/route.ts
import { NextResponse } from "next/server";
import { verifyNinePayCallback } from "9pay-integrate/next";
import { ninepay } from "@/lib/9pay-config";

export async function GET(request: Request) {
  const result = verifyNinePayCallback(request, ninepay);

  if (!result.success || !result.isSuccess) {
    return NextResponse.redirect(new URL("/payment/error", request.url));
  }

  return NextResponse.redirect(
    new URL(
      `/payment/process?orderId=${encodeURIComponent(result.orderId)}`,
      request.url
    )
  );
}
```

#### IPN Webhook (POST)

Handles the server-to-server webhook from 9Pay. This is the source of truth for payment status.
Pass `expected` so underpaid/tampered IPNs are rejected instead of settling the order.

```typescript
// app/api/checkout/9pay/ipn/route.ts
import { handle9PayIpn } from "9pay-integrate/next";
import { ninepay } from "@/lib/9pay-config";
import { repo } from "@/lib/order-repository";
import { notifications } from "@/lib/notifications";
import { getOrderTotal } from "@/lib/orders";

export async function POST(request: Request) {
  return handle9PayIpn(request, {
    config: ninepay,
    orderRepository: repo,
    notifications,
  });
}
```

With amount/currency enforcement (recommended for any real-money flow —
a 1k VND payment must never settle a 10M VND order). Use `processIpn`
directly so you can load the expected total from your DB first:

```typescript
// app/api/checkout/9pay/ipn/route.ts
import { NextResponse } from "next/server";
import {
  decodeIpnResult,
  extractIpnFromFormData,
  processIpn,
} from "9pay-integrate";
import { ninepay } from "@/lib/9pay-config";
import { repo } from "@/lib/order-repository";
import { notifications } from "@/lib/notifications";
import { getOrderById } from "@/lib/orders";

export async function POST(request: Request) {
  const payload = extractIpnFromFormData(await request.formData());
  // Untrusted preview only — processIpn below does the real verification.
  const preview = decodeIpnResult(payload.result);
  const invoiceNo = preview?.invoice_no;
  const order =
    typeof invoiceNo === "string" && invoiceNo.trim()
      ? await getOrderById(invoiceNo.trim())
      : null;

  const result = await processIpn(payload, {
    config: ninepay,
    orderRepository: repo,
    notifications,
    expected: order ? { amount: order.total, currency: order.currency } : undefined,
  });

  return NextResponse.json(
    { success: result.success, message: result.message },
    { status: result.statusCode }
  );
}
```

Handling manual review and duplicate deliveries:

```typescript
import { processIpn } from "9pay-integrate";

const result = await processIpn(payload, {
  config: ninepay,
  orderRepository: repo,
  notifications: {
    ...notifications,
    async onManualReview({ orderId, status, amount }) {
      // Status 3 or 9: 9Pay needs a human decision.
      // No order status was changed — alert ops and investigate.
      await alertOps(`Order ${orderId} needs review (status ${status}, ${amount})`);
    },
  },
});

if (result.duplicate) {
  // 9Pay retried an already-settled delivery — safe to ignore.
}
if (result.manualReview) {
  // Order left untouched — track it in your ops queue.
}
```

Status mapping: `5` → completed, `6` → failed, `8` → cancelled,
`3`/`9` → manual review (no status change, `onManualReview` hook),
anything else is acknowledged without a status change. Already-settled
orders are acknowledged as duplicates. Malformed payloads are rejected
with 4xx without touching the order so 9Pay retries.

#### Payment Status (GET)

For frontend polling. Pass `authorize` to prevent order enumeration.

```typescript
// app/api/payment/status/route.ts
import { handlePaymentStatus } from "9pay-integrate/next";
import { repo } from "@/lib/order-repository";

export async function GET(request: Request) {
  return handlePaymentStatus(request, {
    orderRepository: repo,
    authorize: (orderId) => belongsToSession(orderId),
  });
}
```

### 6. Recurring Payments (CIT/MIT) — Core

For saved-card / subscription flows, use the framework-agnostic recurring client.
It mirrors the `POST /v2/payments/recurring/request` API: CIT creates the first
charge (returns a payment URL), MIT charges a saved `cardToken`, and `inquire`
reconciles any order.

```typescript
import {
  NinePayRecurringClient,
  classifyNinePayMitResult,
  classifyNinePayInquiry,
} from "9pay-integrate";

const client = new NinePayRecurringClient({
  baseUrl: process.env.NINEPAY_BASE_URL,
  merchantKey: process.env.NINEPAY_MERCHANT_KEY,
  secretKey: process.env.NINEPAY_SECRET_KEY,
  returnUrl: process.env.NINEPAY_RETURN_URL,
});

// First charge — redirect the user to result.paymentUrl
const cit = await client.createCit({
  requestId: "UCC1",
  amountVnd: 603900,
  description: "UC Talent subscription",
  paymentIntentId: "pi_123",
});

// Renewal charge against the saved card token
const mit = await client.chargeMit({
  requestId: "UCM1",
  amountVnd: 603900,
  originalOrderCode: 123,
  cardToken: "card-token-from-ipn",
});
const outcome = classifyNinePayMitResult(mit);
// "SUCCEEDED" | "PENDING" | "DUPLICATE" | "RETRYABLE"
// | "MERCHANT_ERROR" | "CARD_INVALID" | "MANUAL_REVIEW"

// Reconciliation / expiry guard
const inquiry = await client.inquire("UCC1");
const state = classifyNinePayInquiry(inquiry);
// { kind: "PAID" } | { kind: "NOT_FOUND" } | { kind: "PENDING" }
// | { kind: "FAILED", errorCode, failureReason }
```

### 7. NestJS Adapter (`9pay-integrate/nest`)

Drop-in replacement for a hand-rolled recurring adapter. Reads credentials
from `ConfigService` and surfaces gateway failures as
`InternalServerErrorException` (codes `GATEWAY_NOT_CONFIGURED`,
`GATEWAY_INVALID_RESPONSE`).

```typescript
// checkout.module.ts
import { NinePayRecurringClientAdapter } from "9pay-integrate/nest";

@Module({
  providers: [
    NinePayRecurringClientAdapter,
    { provide: NINEPAY_RECURRING_CLIENT_PORT_OUT, useExisting: NinePayRecurringClientAdapter },
  ],
})
export class CheckoutModule {}
```

### 8. Advanced: standalone primitives

For custom frameworks or non-standard 9Pay endpoints, use the signing
and verification primitives directly:

```typescript
import {
  buildHttpQuery,
  buildPostSignature,
  buildGetSignature,
  buildAuthorizationHeaders,
  verifyChecksum,
} from "9pay-integrate";

// Sign a custom POST endpoint
const canonical = buildHttpQuery({ request_id: "UCC1", amount: 1000 });
const time = Math.floor(Date.now() / 1000);
const signature = buildPostSignature(baseUrl, "/v2/custom/path", time, canonical, secretKey);

// Or build the auth headers for a recurring-style call
const message = `POST\n${baseUrl}/v2/custom/path\n${time}\n${canonical}`;
const headers = buildAuthorizationHeaders(message, time, merchantKey, secretKey);

// Verify + decode any 9Pay result/checksum pair
const { valid, data, error } = verifyChecksum(result, checksum, checksumKey);
```

## API Reference

### Core (`9pay-integrate`)

| Export | Description |
|--------|-------------|
| `configFromEnv(env)` | Build config from any env-like object |
| `validateConfig(partial)` | Validate and normalize config |
| `createPaymentUrl(config, params)` | Generate signed 9Pay redirect URL |
| `verifyChecksum(result, checksum, key)` | Verify callback/IPN checksum |
| `verifyCallback(searchParams, config)` | Verify browser redirect callback |
| `processIpn(payload, options)` | Process IPN (adapter-agnostic) |
| `buildHttpQuery(data)` | Build sorted query string (advanced) |
| `buildSignature(baseUrl, time, query, key)` | Build HMAC signature (advanced) |
| `extractIpnFromFormData(formData)` | Extract IPN from FormData |
| `extractIpnFromUrlEncoded(body)` | Extract IPN from URL-encoded body (`+`-safe) |
| `decodeIpnResult(result)` | Untrusted base64→JSON preview (no checksum check) |
| `NINEPAY_STATUS` | Legacy portal status codes (prefer `transaction-status` below) |
| `SUCCESS_STATUS` | Constant for successful payment |
| `NinePayRecurringClient` | CIT/MIT/inquire/deleteCardToken client (zero framework deps) |
| `NinePayGatewayError` | Typed gateway failure (`code`, `statusCode`) |
| `buildReturnUrl(baseUrl, intentId)` | Return URL with `?intentId=` embedded |
| `buildPostSignature(baseUrl, path, time, canonical, key)` | Generic POST signature |
| `buildGetSignature(baseUrl, path, time, key)` | Generic GET signature |
| `buildAuthorizationHeaders(message, time, merchantKey, key)` | Date + Authorization headers |
| `classifyNinePayMitResult(result)` | MIT outcome (7 states) |
| `classifyNinePayInquiry(result)` | Inquiry outcome (PAID/NOT_FOUND/PENDING/FAILED) |
| `isKnownNinePayMitErrorCode(code)` | Check MIT error-code taxonomy |

Transaction statuses (`transaction-status`): `NINEPAY_SUCCESS_STATUS` (5),
`NINEPAY_FAILED_STATUS` (6), `NINEPAY_CANCELLED_STATUS` (8),
`NINEPAY_RISK_REJECTED_STATUS` (9), `NINEPAY_INQUIRY_PENDING_STATUSES` ([2, 3]),
`NINEPAY_INQUIRY_FAILED_STATUSES` ([6, 8, 9]), `NINEPAY_MANUAL_REVIEW_STATUSES`
([3, 9]), `NINEPAY_SUCCESS_ERROR_CODE` ("000"),
`NINEPAY_ORDER_NOT_FOUND_ERROR_CODE` ("221"), `NINEPAY_PROCESSING_ERROR_CODE`
("999"), plus reusable/dead order statuses. MIT error-code taxonomy
(`mit-error-codes`): pending / duplicate (`611`) / retryable / merchant /
card-invalid / manual-review (`408`, `615`) / token-invalid (`666`).

### Gateway errors (`NinePayGatewayError`)

Thrown by `NinePayRecurringClient` for transport and configuration failures
(business declines resolve normally with an `errorCode` — classify them
with `classifyNinePayMitResult` / `classifyNinePayInquiry` instead).
Each error carries a machine-readable `code` and an HTTP-like `statusCode`:

| `code` | Meaning |
|--------|---------|
| `GATEWAY_NOT_CONFIGURED` | Missing `baseUrl`/`merchantKey`/`secretKey`/`returnUrl` (500) |
| `GATEWAY_INVALID_RESPONSE` | Non-JSON or non-object gateway body (500) |
| `GATEWAY_TIMEOUT` | 60s request timeout (504) |
| `GATEWAY_NETWORK` | DNS/connection failure (503) |
| `INVALID_ARGUMENT` | Empty reference/token or non-positive amount (400) |

### NestJS Adapter (`9pay-integrate/nest`)

| Export | Description |
|--------|-------------|
| `NinePayRecurringClientAdapter` | Injectable recurring client (ConfigService + HTTP exceptions) |

### Next.js Adapter (`9pay-integrate/next`)

| Export | Description |
|--------|-------------|
| `verifyNinePayCallback(request, config)` | Verify callback, return result object |
| `handle9PayIpn(request, options)` | Full IPN handler → NextResponse (`expected`, `logger` supported) |
| `handlePaymentStatus(request, options)` | Status polling handler → NextResponse (`authorize` supported) |

### Breaking changes since 1.0.x

- `NINEPAY_STATUS` values corrected to production behavior (`CANCELLED: 8`, added `RISK_REJECTED: 9`, removed guessed `PENDING/PROCESSING/REFUNDED`). Prefer the `transaction-status` module.
- `NinePayConfig.cancelUrl` / `NINEPAY_CANCEL_URL` removed — `back_url` always equals `return_url` (production 9Pay behavior).
- `VerifyCallbackResult` is now a discriminated union with `isSuccess` (status 5 only).
- `processIpn` no longer marks every non-5 status as failed: `8` → cancelled, `3`/`9` → manual review flag, others acknowledged without change; malformed payloads return 4xx without touching the order.
- `updateOrderStatus` accepts `"cancelled"`; `OrderStatus` includes `"cancelled"`.
- `NinePayCitResult` / `NinePayMitResult` include `httpOk`, `httpStatus`, and (CIT) `raw`.

### Types

All types are exported from the main entry point. Key interfaces:

- `NinePayConfig` — configuration
- `OrderRepository` — implement for your data layer
- `NotificationHooks` — optional notification callbacks (`onSuccess` / `onFailure` / `onManualReview`)
- `IpnProcessResult` — IPN processing result (`duplicate`, `manualReview` flags)
- `VerifyCallbackResult` — discriminated union; `isSuccess` is true only for status 5 (IPN still settles)
- `OrderStatus` — `"neworder" | "pending" | "completed" | "failed" | "cancelled"`

## Architecture

```
┌─────────────────────────────────────────┐
│           9Pay Portal                    │
│      payment.9pay.vn/portal              │
└────────────┬────────────────┬───────────┘
             │                │
      Browser redirect    Server-to-server
        (callback GET)        (IPN POST)
             │                │
┌────────────▼────────────────▼───────────┐
│              9pay-integrate/core         │
│  ┌─────────┐  ┌───────────┐  ┌───────┐  │
│  │ signing  │  │ verify    │  │ ipn   │  │
│  │ +payment │  │ callback  │  │ proc  │  │
│  └─────────┘  └───────────┘  └───────┘  │
│            (zero framework deps)         │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│          9pay-integrate/next             │
│  (thin glue: parse req → call core)      │
└─────────────────────────────────────────┘
```

### Design Principles

1. **Core has zero framework dependencies** — works in Express, Fastify, Hono, Bun, Deno
2. **Inversion of Control** — package never hardcodes ORM/CMS/notification service
3. **Option B for callback** — returns data, consumer controls redirect
4. **Option C for IPN** — encapsulates all 6 steps, but consumer can bypass and call `processIpn()` directly from core
5. **Fail fast** — config validation at init time, not during live payment

## Support

Found a bug or have a feature request?

[Create an issue](https://github.com/nhat251/9pay-integrate/issues/new)

## Releases

Branching: code on `dev`, merge `dev` into `main` (keep `dev`), then tag on `main`:

```bash
git checkout dev
# ... code ...
git push origin dev
git checkout main
git merge dev
git push origin main
npm version patch # or minor / major — creates commit + tag on main
git push origin main --follow-tags
```

Every push and pull request to `main` / `dev` runs typecheck, test and build without publishing. Pushing a `v*` tag whose commit is on `main` publishes that version to npm. Tags created outside `main` are rejected.

## License

MIT
