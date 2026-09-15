/**
 * Lets `node --test` load the app's own TypeScript modules directly.
 *
 * Node strips types on its own, but its ESM resolver will not guess an extension and
 * knows nothing of the `@/` alias the app imports by. Both are supplied here so a unit
 * test can import `../src/lib/upcoming.ts` and get the real module, not a copy of it.
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = new URL('../src/', import.meta.url);

export async function resolve(specifier, context, next) {
  const target = specifier.startsWith('@/') ? new URL(specifier.slice(2), root).href : specifier;
  try { return await next(target, context); } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    for (const extension of ['.ts', '.tsx']) {
      try { return await next(target + extension, context); } catch { /* try the next one */ }
    }
    throw error;
  }
}

register(pathToFileURL(new URL(import.meta.url).pathname));
