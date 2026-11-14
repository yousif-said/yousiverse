export type ProviderName = "tmdb" | "igdb" | "open_library" | "watchmode" | "itad" | "steam";

export type ProviderErrorKind = "not_found" | "rate_limited" | "unavailable" | "invalid_response";

/** Every failure talking to an external provider surfaces as this error. */
export class ProviderError extends Error {
  constructor(
    readonly provider: ProviderName,
    readonly kind: ProviderErrorKind,
    detail: string,
    options?: ErrorOptions,
  ) {
    super(`${provider}: ${detail}`, options);
    this.name = "ProviderError";
  }
}
