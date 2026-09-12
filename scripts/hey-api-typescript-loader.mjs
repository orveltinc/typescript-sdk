// @hey-api/openapi-ts@0.99.0 uses TypeScript's pre-v7 monolithic compiler API.
// The published SDK itself is built and typechecked with this repository's TypeScript 7;
// only code generation is redirected to an explicitly isolated compatibility runtime.
const legacyTypeScriptUrl = new URL('./typescript-legacy-shim.mjs', import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'typescript') {
    return { shortCircuit: true, url: legacyTypeScriptUrl.href };
  }
  return nextResolve(specifier, context);
}
