# Release the Business SDK

Build and publish `@orvelt/business` from this standalone repository root, never the storefront monorepo root. Use the version in `package.json`; publish only reviewed `main` commits. Version preparation and tags do not mean npm publication has succeeded.

The first publication uses the npm organization owner's local login and the archive verified by CI. Afterward, configure the npm trusted publisher for `orveltinc/typescript-sdk`, workflow `business-sdk.yml`, environment `npm`. Future publications use the manual **Business SDK** workflow on `main`, which verifies and publishes the same archive without rebuilding it in the publishing job. No npm token is stored in GitHub.

Verify registry installation before announcing a release. Create the matching `v<version>` GitHub release only after npm publication succeeds; tags run checks but do not publish automatically.

## Generator dependency audit

Reviewed November 2, 2026; review again before the next SDK release or by November 9, 2026.

`@hey-api/openapi-ts@0.99.0` depends on `@hey-api/json-schema-ref-parser@1.4.4`, which pins `js-yaml@4.2.0`. Bun audit reports GHSA-52cp-r559-cp3m, GHSA-5p4m-2wfm-xmqj, and GHSA-2883-xcg3-v3hh (YAML parsing denial of service).

This tooling is a development dependency, not a runtime dependency of the npm SDK. Release generation reads the reviewed, committed `openapi.json` with internal references, not customer-supplied YAML. Keep generation restricted to trusted specifications. Updating the generator or overriding its pinned parser is deferred from the initial as-is release; re-evaluate that choice if generation accepts untrusted input. This does not claim the development dependency has no vulnerability.
