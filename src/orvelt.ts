import { OrveltSdk } from './generated/sdk.gen.js';
import { createOrveltClient, type OrveltOptions } from './config.js';

/**
 * The Orvelt Business API client. Pass your API key, or options when you also set a base URL,
 * headers, fetch or `throwOnError`:
 *
 * ```ts
 * const orvelt = new Orvelt(process.env.ORVELT_BUSINESS_API_KEY!);
 * const { data, error } = await orvelt.link.create({ projectId, email, firstName, reference });
 * ```
 *
 * Each instance keeps its own credentials, so one process can hold clients for several
 * organizations or environments.
 */
export class Orvelt extends OrveltSdk {
  constructor(options: string | OrveltOptions) {
    super({ client: createOrveltClient(options) });
  }
}
