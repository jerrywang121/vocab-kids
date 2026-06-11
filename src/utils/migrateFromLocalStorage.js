/**
 * One-time migration: copies existing localStorage data into IndexedDB,
 * then removes the original localStorage entries.
 *
 * Safe to call on every boot — it no-ops after the first successful run.
 */

import { get, set } from 'idb-keyval'

const STORE_KEYS = ['vocab-decks', 'vocab-cards', 'vocab-progress', 'vocab-settings']
const MIGRATION_FLAG = 'vocab-migrated-to-idb-v1'

export async function migrateFromLocalStorage() {
  const alreadyMigrated = await get(MIGRATION_FLAG)
  if (alreadyMigrated) return

  for (const key of STORE_KEYS) {
    const value = localStorage.getItem(key)
    if (value !== null) {
      await set(key, value)
      localStorage.removeItem(key)
    }
  }

  await set(MIGRATION_FLAG, true)
}
