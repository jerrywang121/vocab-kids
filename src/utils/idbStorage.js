/**
 * Synchronous-interface IndexedDB storage for pinia-plugin-persistedstate.
 *
 * pinia-plugin-persistedstate expects a synchronous Storage (getItem / setItem).
 * IndexedDB is async, so we pre-load all relevant keys into an in-memory Map
 * before the app mounts (via `initIdbStorage`), then serve reads from that cache.
 * Writes update the cache immediately and persist to IndexedDB in the background.
 */

import { get, set, del } from 'idb-keyval'

const cache = new Map()

/**
 * Pre-loads the given keys from IndexedDB into the in-memory cache.
 * Must be awaited before creating the Pinia instance.
 *
 * @param {string[]} keys - The persist keys used by each store.
 */
export async function initIdbStorage(keys) {
  await Promise.all(
    keys.map(async (key) => {
      const value = await get(key)
      if (value !== undefined) cache.set(key, value)
    })
  )
}

/**
 * Synchronous storage adapter backed by IndexedDB.
 * Reads are served from the in-memory cache (populated by `initIdbStorage`).
 * Writes update the cache synchronously and flush to IndexedDB asynchronously.
 */
export const idbStorage = {
  getItem(key) {
    return cache.get(key) ?? null
  },
  setItem(key, value) {
    cache.set(key, value)
    set(key, value).catch((err) => console.warn('[idbStorage] setItem failed:', key, err))
  },
  removeItem(key) {
    cache.delete(key)
    del(key).catch((err) => console.warn('[idbStorage] removeItem failed:', key, err))
  },
}
