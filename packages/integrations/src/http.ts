import type { z } from "zod";
import { ProviderError, type ProviderName } from "./errors";

const TIMEOUT_MS = 10_000;

async function transport(): Promise<typeof fetch> {
  if (process.env.PROVIDER_FIXTURES !== "true") return fetch;
  if (process.env.NODE_ENV === "production") {
    throw new Error("PROVIDER_FIXTURES must not be set in production.");
  }
  const { fixtureFetch } = await import("./fixtures/fixture-fetch");
  return fixtureFetch;
}

/**
 * Requests JSON from a provider and validates it. Failures become a ProviderError whose message
 * names only the path, because some providers carry credentials in the query string.
 */
export async function requestJson<Schema extends z.ZodType>(
  provider: ProviderName,
  url: URL,
  schema: Schema,
  init?: RequestInit,
  /** Statuses besides 404 that this provider uses to say "no such thing". */
  options: { notFoundStatuses?: number[] } = {},
): Promise<z.output<Schema>> {
  const send = await transport();

  let response: Response;
  try {
    response = await send(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (cause) {
    throw new ProviderError(provider, "unavailable", `request to ${url.pathname} failed`, {
      cause,
    });
  }

  if (!response.ok) {
    const kind =
      response.status === 404 || options.notFoundStatuses?.includes(response.status)
        ? "not_found"
        : response.status === 429
          ? "rate_limited"
          : "unavailable";
    throw new ProviderError(provider, kind, `${url.pathname} responded ${response.status}`);
  }

  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ProviderError(provider, "invalid_response", `unexpected data from ${url.pathname}`, {
      cause: parsed.error,
    });
  }
  return parsed.data;
}
