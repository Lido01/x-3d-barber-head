/**
 * Unwrap a list response.
 *
 * Django REST Framework returns a bare array for an unpaginated
 * ViewSet, and `{ results: [...] }` once pagination is switched on. The
 * shape is chosen by the server, so a client cannot know in advance -
 * which is why this exact line was copied into seven separate hooks.
 * Written once here instead.
 *
 * `select` on a useQuery hook is the right place for this; it is what
 * keeps every list in the app shaping its payload the same way.
 */
export function toArray(payload) {
  return Array.isArray(payload) ? payload : payload?.results || [];
}