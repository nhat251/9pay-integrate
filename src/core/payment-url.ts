import type { NinePayConfig, CreatePaymentParams } from "./types";
import { buildReturnUrl } from "./return-url";
import { buildHttpQuery, buildSignature } from "./signing";

/**
 * Create a signed 9Pay payment redirect URL.
 *
 * The user is redirected to this URL to complete payment on 9Pay's portal.
 * After payment, 9Pay redirects the browser to config.returnUrl (callback)
 * and sends a server-to-server POST to config.returnUrl (IPN).
 */
export function createPaymentUrl(
  config: NinePayConfig,
  params: CreatePaymentParams
): string {
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new Error("9pay-integrate: amount must be a positive finite number");
  }
  if (String(params.orderId).trim().length === 0) {
    throw new Error("9pay-integrate: orderId must not be empty");
  }

  const time = Math.floor(Date.now() / 1000);
  const returnUrl = params.paymentIntentId
    ? buildReturnUrl(config.returnUrl, params.paymentIntentId)
    : config.returnUrl;

  const parameters: Record<string, string | number> = {
    ...params.options,
    merchantKey: config.merchantKey,
    time,
    invoice_no: params.orderId,
    amount: params.amount,
    currency: params.currency,
    description: params.description,
    return_url: returnUrl,
    back_url: returnUrl,
  };

  const httpQuery = buildHttpQuery(parameters);
  const signature = buildSignature(
    config.baseUrl || "https://payment.9pay.vn",
    time,
    httpQuery,
    config.secretKey
  );

  const sortedParameters: Record<string, string | number> = {};
  Object.keys(parameters)
    .sort()
    .forEach((key) => {
      sortedParameters[key] = parameters[key];
    });

  const baseEncode = Buffer.from(JSON.stringify(sortedParameters)).toString(
    "base64"
  );

  const redirectParams = new URLSearchParams({ baseEncode, signature });
  return `${config.baseUrl || "https://payment.9pay.vn"}/portal?${redirectParams.toString()}`;
}
