/**
 * Shared query cache for GET requests.
 *
 * Before this existed every component that needed the same list ran its
 * own `useEffect` and hit the API again. `/api/services/` alone was
 * requested by six independent components, so navigating between pages
 * re-downloaded identical JSON six times.
 *
 * This is a single in-memory store keyed by a stable string. It buys
 * three things:
 *
 *   1. Dedup      - concurrent callers for one key share a single
 *                   in-flight request.
 *   2. Freshness  - a fresh entry is served instantly with no network
 *                   call at all. Navigation is instant, not spinner-y.
 *   3. Invalidate - a mutation drops the affected keys and the next
 *                   reader refetches, so the UI never shows data that a
 *                   write has made wrong.
 *
 * Deliberately persisted for the public catalogue only. This used to be
 * session-scoped entirely, which meant a full page reload - a refresh,
 * a link opened in a new tab, a phone locking and unlocking - threw the
 * whole cache away and re-downloaded every list the site had just asked
 * for. The public lists (services, barbers, gallery, testimonials) are
 * the same for everyone and change rarely, so they now survive in
 * sessionStorage and a reload paints instantly.
 *
 * Staff data is deliberately *not* persisted. A console screen holds
 * permission-scoped rows that must never outlive the session, and a
 * stale permission is worse than a loading spinner. `persistable()`
 * is the boundary.
 *
 * Key format: "<scope>:<url>[?serialised-params]". The scope matters
 * because `/api/services/` returns different rows to staff than to the
 * public - caching one audience's answer under the public key would leak
 * inactive services into the storefront.
 */

/** How long a cached answer is served with no network activity at all. */
const DEFAULT_STALE_MS = 5 * 60 * 1000;

/**
 * A read that arrives this soon after the last successful one is served
 * from the cache instead of the network, whatever the entry's TTL.
 *
 * This is separate from `staleMs` on purpose. `staleMs` is a freshness
 * policy a caller sets; this is a floor on how often the same key may
 * hit the wire, and it is what stops the pattern where one user action
 * mounts two components that both ask for the same thing. The booking
 * status screens are the case that motivated it: a booking's success page
 * reads `/bookings/{id}/status/` to decide whether the pay form should be
 * open at all, and a customer with the history list open on the same
 * booking asks the identical question. With `staleMs: 0` on that key -
 * which it must have, so reception confirming and staff verifying show up
 * without a refresh - that was two identical requests a second apart.
 *
 * An explicit `refetch()` still bypasses this, so the Refresh button
 * means "ask again now" rather than "ask again if you can".
 */
const MIN_REQUEST_INTERVAL_MS = 1500;

/** A key with no live subscriber and this old stops being retained. */
const DEFAULT_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * Only the public catalogue is written to storage.
 *
 * Anything scoped to staff or a signed-in customer is permission-shaped:
 * services list, bookings, payments, the dashboard report. Writing any
 * of those down would hand the next person to open the app a view of the
 * shop that their token is not entitled to, which is exactly what the
 * scope in the key was introduced to prevent.
 */
const PERSISTED_SCOPE = "public:";

/** Never written to storage, whatever their scope. */
const NEVER_PERSISTED = [
  "/accounts/",
  "/payments/",
  "/notifications/",
  "/bookings/lookup",
  "/bookings/mine",
];

const STORAGE_KEY = "noir.query-cache.v1";

/** @type {Map<string, Entry>} */
const store = new Map();

/** Keys with a request already in flight, so concurrent callers can share it. */
const inFlight = new Map();

/**
 * @typedef {object} Entry
 * @property {unknown} data
 * @property {boolean} hasData
 * @property {unknown} error
 * @property {number} updatedAt
 * @property {number} staleAt
 * @property {number} expiresAt
 * @property {number} requestedAt when a request for this key last went out
 * @property {Function | null} fetcher
 * @property {Set<Function>} listeners
 */

function timestamp() {
  return Date.now();
}

function persistable(key) {
  if (!key.startsWith(PERSISTED_SCOPE)) {
    return false;
  }

  return !NEVER_PERSISTED.some((fragment) => key.includes(fragment));
}

function writeStored() {
  try {
    const snapshot = {};

    for (const [key, entry] of store) {
      if (!persistable(key) || !entry.hasData) {
        continue;
      }

      snapshot[key] = {
        data: entry.data,
        updatedAt: entry.updatedAt,
        staleAt: entry.staleAt,
        expiresAt: entry.expiresAt,
      };
    }

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Private browsing, a full quota, or a JSON value we did not expect.
    // The in-memory cache is still correct; only the across-reload part
    // of it is unavailable, which costs a request and nothing else.
  }
}

/**
 * Rehydrate the persisted public entries.
 *
 * Done once, lazily, on the first lookup - a module-level read would run
 * before the app is mounted and would put a storage parse in front of the
 * first paint.
 *
 * Expired entries are dropped on the way in rather than shown and then
 * corrected: an hour-old service list is worse than a spinner.
 */

let restored = false;

function restoreOnce() {
  if (restored) {
    return;
  }

  restored = true;

  let snapshot;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    snapshot = raw ? JSON.parse(raw) : null;
  } catch {
    return;
  }

  if (!snapshot || typeof snapshot !== "object") {
    return;
  }

  const now = timestamp();

  for (const [key, saved] of Object.entries(snapshot)) {
    if (
      !saved
      || !persistable(key)
      || typeof saved.updatedAt !== "number"
      || now > saved.expiresAt
    ) {
      continue;
    }

    store.set(key, {
      ...createEntry(saved.data, true),
      updatedAt: saved.updatedAt,
      staleAt: saved.staleAt,
      expiresAt: saved.expiresAt,
    });
  }
}

function createEntry(data, hasData) {
  const now = timestamp();

  return {
    data,
    hasData,
    error: null,
    updatedAt: now,
    staleAt: now,
    expiresAt: now + DEFAULT_MAX_AGE_MS,
    // Zero, not `now`: a restored entry has not been asked for in this
    // page load, so the first component to want it should go and ask.
    requestedAt: 0,
    fetcher: null,
    listeners: new Set(),
  };
}

/**
 * Build a stable cache key.
 *
 * Params are sorted so `{a:1,b:2}` and `{b:2,a:1}` are the same key.
 * Without sorting, two callers that build the same params in a different
 * order would each miss the cache and duplicate the request.
 *
 * @param {string} url
 * @param {Record<string, unknown>} [params]
 * @param {string} [scope] auth audience / variant, defaults to "public"
 */
export function queryKey(url, params, scope = "public") {
  if (!params) {
    return `${scope}:${url}`;
  }

  const pairs = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => [key, String(value)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  if (pairs.length === 0) {
    return `${scope}:${url}`;
  }

  const search = pairs
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  return `${scope}:${url}?${search}`;
}

/** The entry for `key`, dropping it first if it has aged out entirely. */
function liveEntry(key) {
  restoreOnce();

  const entry = store.get(key);

  if (!entry) {
    return null;
  }

  if (timestamp() > entry.expiresAt && entry.listeners.size === 0) {
    store.delete(key);
    return null;
  }

  return entry;
}

/** True once the entry is too old to show at all, however long it has been open. */
function isExpired(entry) {
  return timestamp() > entry.expiresAt;
}

function notify(entry) {
  // Copy first: a listener may unsubscribe or subscribe while we fan out.
  for (const listener of [...entry.listeners]) {
    listener();
  }
}

/**
 * Start (or join) the single request for `key`.
 *
 * The caller's `signal` is intentionally NOT forwarded. It exists so a
 * screen can cancel work it no longer cares about, but the request is
 * shared: aborting because one component unmounted would break every
 * other component waiting on the same key and would poison the cache.
 */
function startRequest(key, fetcher, staleMs) {
  const pending = inFlight.get(key);

  if (pending) {
    return pending;
  }

  const controller = new AbortController();

  const promise = Promise.resolve()
    .then(() => fetcher(controller.signal))
    .then((data) => {
      const entry = liveEntry(key) || createEntry(data, true);
      const now = timestamp();

      entry.data = data;
      entry.hasData = true;
      entry.error = null;
      entry.updatedAt = now;
      entry.staleAt = now + staleMs;
      entry.expiresAt = now + DEFAULT_MAX_AGE_MS;

      store.set(key, entry);
      entry.requestedAt = timestamp();
      notify(entry);

      if (persistable(key)) {
        writeStored();
      }

      return data;
    })
    .catch((error) => {
      const entry = liveEntry(key);

      if (entry) {
        // Keep the last good data on screen: a failed background
        // refresh must not wipe a list the user is reading.
        entry.error = error;
        entry.staleAt = entry.updatedAt;
        notify(entry);
      }

      throw error;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);

  return promise;
}

/**
 * Read a key, fetching only when there is nothing fresh to serve.
 *
 * @param {string} key
 * @param {(signal: AbortSignal) => Promise<unknown>} fetcher
 * @param {{ staleMs?: number, force?: boolean }} [options]
 * @returns {Promise<unknown>}
 */
export function fetchQuery(key, fetcher, options = {}) {
  const { staleMs = DEFAULT_STALE_MS, force = false } = options;
  const entry = liveEntry(key);

  if (entry) {
    entry.fetcher = fetcher;

    // Past its maximum age the old rows are not shown at all, even to a
    // component that has had the screen open for hours. Without this the
    // stale-while-revalidate path below would keep serving the first
    // answer indefinitely, which is a cache that never notices a change.
    if (!force && !isExpired(entry)) {
      if (entry.hasData) {
        const now = timestamp();

        if (now - entry.requestedAt < MIN_REQUEST_INTERVAL_MS) {
          /*
           * A request for this key went out moments ago. Serve its answer
           * and do not queue another behind it: the two components that
           * mounted together get one request between them, not one each,
           * and neither sees a spinner.
           *
           * This is the floor that makes `staleMs: 0` usable. A caller
           * that sets zero does so because it must always see the truth -
           * a payment status a customer is watching change - and without
           * this two components mounting in the same moment both fire.
           * An explicit refetch() passes `force` and is exempt, so the
           * Refresh button and the polling timer still mean "now".
           *
           * It also covers entries rehydrated from storage, which have no
           * fetcher and no subscribers yet: without it a reload would
           * fire one request per key at once.
           */
          return Promise.resolve(entry.data);
        }

        if (now < entry.staleAt) {
          // Nothing to do: this is the whole point of the cache.
          return Promise.resolve(entry.data);
        }

        // Stale but recent. Serve what we already have and refresh behind
        // the scenes, so remounting a screen costs a spinner zero times.
        void startRequest(key, fetcher, staleMs).catch(() => {});

        return Promise.resolve(entry.data);
      }
    } else if (entry.hasData && !force) {
      // Expired. Block on a real answer rather than paint old rows and
      // correct them a moment later.
      entry.hasData = false;
    }
  }

  return startRequest(key, fetcher, staleMs);
}

/**
 * Subscribe to a key. Fires immediately, then on every change.
 *
 * @param {string} key
 * @param {Function} listener
 * @returns {() => void} unsubscribe
 */
export function subscribe(key, listener) {
  const entry = liveEntry(key) || createEntry(undefined, false);

  store.set(key, entry);

  entry.listeners.add(listener);
  listener();

  return () => {
    entry.listeners.delete(listener);
  };
}

/** Current snapshot, so a first render can paint without waiting. */
export function peek(key) {
  return liveEntry(key);
}

/**
 * Mark matching keys as needing a refetch.
 *
 * `prefix` is matched against the whole key, so invalidating "services"
 * catches both `/services/` and `/services/4/` in one call. This is what
 * makes the cache correct rather than merely fast: every write calls it.
 *
 * Entries are kept (and their old rows left on screen) so a refreshing
 * list does not blank out, and live subscribers are refreshed in place
 * so no component has to remount.
 *
 * @param {string} [prefix]
 */
export function invalidate(prefix = "") {
  for (const [key, entry] of [...store]) {
    if (prefix && !key.includes(prefix)) {
      continue;
    }

    if (timestamp() > entry.expiresAt && entry.listeners.size === 0) {
      store.delete(key);
      continue;
    }

    entry.staleAt = 0;
    entry.error = null;
    notify(entry);

    if (entry.fetcher) {
      void startRequest(key, entry.fetcher, DEFAULT_STALE_MS).catch(() => {});
    }
  }
}

/**
 * Wipe everything. Used on sign-out and on sign-in, so the next person
 * at this machine starts from nothing rather than inheriting the last
 * one's permission-scoped rows - and, for the same reason, the persisted
 * copy goes with it.
 */
export function clearCache() {
  store.clear();
  inFlight.clear();

  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if storage was never available.
  }
}
