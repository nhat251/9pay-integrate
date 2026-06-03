import type { NinePayConfig, CreatePaymentParams } from "./types";
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
  const time = Math.floor(Date.now() / 1000);

  const parameters: Record<string, string | number> = {
    merchantKey: config.merchantKey,
    time,
    invoice_no: params.orderId,
    amount: params.amount,
    currency: params.currency,
    description: params.description,
    return_url: config.returnUrl,
    ...(config.cancelUrl ? { back_url: config.cancelUrl } : {}),
    ...params.options,
  };

  const httpQuery = buildHttpQuery(parameters);
  const signature = buildSignature(
    config.baseUrl || "https://payment.9pay.vn",
    time,
    httpQuery,
    config.secretKey
  );

  // Sort parameters for baseEncode to ensure consistency
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
