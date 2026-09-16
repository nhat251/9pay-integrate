# 9pay-integrate

Complete 9Pay payment gateway integration for Node.js and Next.js. Generate payment URLs, verify callbacks, process IPN webhooks — all with a clean, framework-agnostic core.

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
- `NINEPAY_CANCEL_URL` (default: same as RETURN_URL)

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
    // Query order status from your database
    // Return "neworder" | "pending" | "completed" | "failed" | null
  },
  async updateOrderStatus(orderId: string, status: "completed" | "failed") {
    // Update order status in your database
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

  // 3. Generate 9Pay payment URL
  const paymentUrl = createPaymentUrl(ninepay, {
    orderId: order.id, // or order.documentId, whatever your DB returns
    amount: body.amount,
    currency: body.currency,
    description: "Order Payment",
  });

  return NextResponse.json({ success: true, orderId: order.id, paymentUrl });
}
```

### 5. Wire Up Routes

#### Callback Route (GET)

Handles the browser redirect after payment on 9Pay's portal.

```typescript
// app/api/checkout/9pay/callback/route.ts
import { NextResponse } from "next/server";
import { verifyNinePayCallback } from "9pay-integrate/next";
import { ninepay } from "@/lib/9pay-config";

export async function GET(request: Request) {
  const result = verifyNinePayCallback(request, ninepay);

  if (!result.success) {
    return NextResponse.redirect(new URL("/payment/error", request.url));
  }

  return NextResponse.redirect(
    new URL(`/payment/process?orderId=${result.orderId}`, request.url)
  );
}
```

#### IPN Webhook (POST)

Handles the server-to-server webhook from 9Pay. This is the source of truth for payment status.

```typescript
// app/api/checkout/9pay/ipn/route.ts
import { handle9PayIpn } from "9pay-integrate/next";
import { ninepay } from "@/lib/9pay-config";
import { repo } from "@/lib/order-repository";
import { notifications } from "@/lib/notifications";

export async function POST(request: Request) {
  return handle9PayIpn(request, {
    config: ninepay,
    orderRepository: repo,
    notifications,
  });
}
```

#### Payment Status (GET)

For frontend polling.

```typescript
// app/api/payment/status/route.ts
import { handlePaymentStatus } from "9pay-integrate/next";
import { repo } from "@/lib/order-repository";

export async function GET(request: Request) {
  return handlePaymentStatus(request, { orderRepository: repo });
}
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
| `extractIpnFromUrlEncoded(body)` | Extract IPN from URL-encoded body |
| `NINEPAY_STATUS` | Status codes (SUCCESS = 5) |
| `SUCCESS_STATUS` | Constant for successful payment |

### Next.js Adapter (`9pay-integrate/next`)

| Export | Description |
|--------|-------------|
| `verifyNinePayCallback(request, config)` | Verify callback, return result object |
| `handle9PayIpn(request, options)` | Full IPN handler → NextResponse |
| `handlePaymentStatus(request, options)` | Status polling handler → NextResponse |

### Types

All types are exported from the main entry point. Key interfaces:

- `NinePayConfig` — configuration
- `OrderRepository` — implement for your data layer
- `NotificationHooks` — optional notification callbacks
- `IpnProcessResult` — IPN processing result
- `VerifyCallbackResult` — callback verification result
- `OrderStatus` — `"neworder" | "pending" | "completed" | "failed"`

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

## License

MIT
