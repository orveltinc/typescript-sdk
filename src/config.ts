import { createClient, type Client, type Config } from './generated/client/index.js';
import { DEFAULT_BUSINESS_API_BASE_URL } from './constants.js';

export type OrveltOptions = {
  /** An organization-wide API key created in Orvelt Business. */
  apiKey: string;
  /** Defaults to the production v1 API. Root-relative URLs are supported in browsers. */
  baseUrl?: string;
} & Pick<Config, 'fetch' | 'headers' | 'throwOnError'>;

function normalizeApiKey(apiKey: string) {
  const normalized = apiKey.trim();
  if (!normalized) throw new TypeError('apiKey must be a non-empty string.');
  return normalized;
}

function normalizeBaseUrl(baseUrl: string) {
  const normalized = baseUrl.trim();
  const relative = normalized.startsWith('/') && !normalized.startsWith('//');
  const base = relative ? 'https://sdk.invalid' : undefined;
  if (!normalized || normalized.includes('\\') || !URL.canParse(normalized, base))
    throw new TypeError('baseUrl must be an HTTP(S) URL or a root-relative path.');
  const url = new URL(normalized, base);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    normalized.includes('?') ||
    normalized.includes('#')
  )
    throw new TypeError('baseUrl must not contain credentials, a query, or a fragment.');
  return (relative ? url.pathname : url.href).replace(/\/+$/, '');
}

function createOrveltClientConfig(options: string | OrveltOptions): Config {
  const {
    apiKey,
    baseUrl = DEFAULT_BUSINESS_API_BASE_URL,
    ...config
  }: OrveltOptions = typeof options === 'string' ? { apiKey: options } : options;
  const normalizedApiKey = normalizeApiKey(apiKey);
  // Preserve record null values: Hey API uses them to delete default headers.
  const headers =
    config.headers instanceof Headers || Array.isArray(config.headers)
      ? Object.fromEntries(new Headers(config.headers))
      : { ...config.headers };
  // Credentials belong to apiKey, not a second, potentially stale header value.
  for (const name of Object.keys(headers)) {
    if (name.toLowerCase() === 'x-api-key') delete headers[name];
  }

  return {
    ...config,
    headers,
    fetch: config.fetch,
    throwOnError: config.throwOnError ?? false,
    auth: ({ name, type }) =>
      type === 'apiKey' && name === 'x-api-key' ? normalizedApiKey : undefined,
    baseUrl: normalizeBaseUrl(baseUrl),
  };
}

/** Creates the HTTP client an `Orvelt` instance sends its requests through. */
export function createOrveltClient(options: string | OrveltOptions): Client {
  return createClient(createOrveltClientConfig(options));
}
