import { createClient, mergeHeaders, type Client, type Config } from './generated/client/index.js';
import { client } from './generated/client.gen.js';
import { DEFAULT_BUSINESS_API_BASE_URL } from './constants.js';

export type BusinessClientOptions = {
  /** An organization-wide API key created in Orvelt Business. */
  apiKey: string;
  /** Defaults to the production v1 API. Root-relative URLs are supported in browsers. */
  baseUrl?: string;
} & Pick<Config, 'fetch' | 'headers' | 'throwOnError'>;

export type BusinessClient = Client;

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

function createBusinessClientConfig({
  apiKey,
  baseUrl = DEFAULT_BUSINESS_API_BASE_URL,
  ...config
}: BusinessClientOptions): Config {
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

/**
 * Creates an isolated client. Pass it to an SDK operation through the `client` option.
 */
export function createBusinessClient(options: BusinessClientOptions): BusinessClient {
  return createClient(createBusinessClientConfig(options));
}

/**
 * Configures the package-level client used by every generated SDK operation.
 * Call this once during application startup. Reconfiguration replaces the supported options;
 * use isolated clients for concurrent requests with different credentials.
 */
export function orvelt(options: BusinessClientOptions): BusinessClient {
  const config = createBusinessClientConfig(options);
  // Hey API merges headers on setConfig; explicitly remove the previous configuration first.
  const headers = mergeHeaders(client.getConfig().headers);
  client.setConfig({ headers: Object.fromEntries([...headers.keys()].map((key) => [key, null])) });
  client.setConfig(config);
  return client;
}

/** @deprecated Use `orvelt` instead. */
export const configureBusinessSdk = orvelt;
