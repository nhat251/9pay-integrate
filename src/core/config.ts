import type { NinePayConfig } from "./types";
import { DEFAULT_BASE_URL } from "./constants";

/**
 * Validate and normalize a partial NinePayConfig.
 * Throws if required fields are missing — fail fast at init time.
 */
export function validateConfig(
  config: Partial<NinePayConfig>
): NinePayConfig {
  const errors: string[] = [];

  if (!config.merchantKey) errors.push("merchantKey is required");
  if (!config.secretKey) errors.push("secretKey is required");
  if (!config.checksumKey) errors.push("checksumKey is required");
  if (!config.returnUrl) errors.push("returnUrl is required");

  if (errors.length > 0) {
    throw new Error(
      `9pay-integrate configuration error:\n  - ${errors.join("\n  - ")}`
    );
  }

  return {
    merchantKey: config.merchantKey!,
    secretKey: config.secretKey!,
    checksumKey: config.checksumKey!,
    baseUrl: config.baseUrl || DEFAULT_BASE_URL,
    returnUrl: config.returnUrl!,
    cancelUrl: config.cancelUrl || config.returnUrl,
  };
}

/**
 * Build NinePayConfig from any environment-like object.
 * Accepts Record<string, string | undefined> so it works with
 * process.env, Vercel env, or custom config loaders.
 */
export function configFromEnv(
  env: Record<string, string | undefined>
): NinePayConfig {
  return validateConfig({
    merchantKey: env.NINEPAY_MERCHANT_KEY,
    secretKey: env.NINEPAY_SECRET_KEY,
    checksumKey: env.NINEPAY_CHECKSUM_KEY,
    baseUrl: env.NINEPAY_BASE_URL,
    returnUrl: env.NINEPAY_RETURN_URL,
    cancelUrl: env.NINEPAY_CANCEL_URL,
  });
}
