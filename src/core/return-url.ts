export function buildReturnUrl(
  baseUrl: string,
  paymentIntentId: string
): string {
  const url = new URL(baseUrl);
  url.searchParams.set("intentId", paymentIntentId);
  return url.toString();
}
