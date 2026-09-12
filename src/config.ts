import { createClient, type Client, type Config } from './generated/client/index.js';
import { client } from './generated/client.gen.js';
import { DEFAULT_BUSINESS_API_BASE_URL } from './constants.js';

export type BusinessClientOptions = {
  /** A project-scoped API key created in Orvelt Business. */
  apiKey: string;
  /** Defaults to the production v1 API. Relative URLs are supported for local proxies. */
  baseUrl?: string;
} & Pick<Config, 'fetch' | 'headers' | 'throwOnError'>;

export type BusinessClient = Client;

function normalizeApiKey(apiKey: string) {
  const normalized = apiKey.trim();
  if (!normalized) throw new TypeError('apiKey must be a non-empty string.');
  return normalized;
}

function normalizeBaseUrl(baseUrl: string) {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (!normalized) throw new TypeError('baseUrl must be a non-empty URL.');
  return normalized;
}

function createBusinessClientConfig({
  apiKey,
  baseUrl = DEFAULT_BUSINESS_API_BASE_URL,
  ...config
}: BusinessClientOptions): Config {
  const normalizedApiKey = normalizeApiKey(apiKey);

  return {
    ...config,
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
 * Call this once during application startup.
 */
export function orvelt(options: BusinessClientOptions): BusinessClient {
  client.setConfig(createBusinessClientConfig(options));
  return client;
}

/** @deprecated Use `orvelt` instead. */
export const configureBusinessSdk = orvelt;
