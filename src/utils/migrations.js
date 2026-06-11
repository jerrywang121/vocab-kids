/**
 * Versioned data migration system for VocabKids.
 *
 * Each migration describes a schema change to the persisted IndexedDB data.
 * Migrations run sequentially and are guarded by a version number stored in IDB.
 *
 * Multi-tab safety: if the Web Locks API is available (all modern browsers) we
 * acquire an exclusive lock so that only one tab runs migrations at a time.
 * Each migration is also designed to be idempotent — re-running it must be safe.
 *
 * ADDING A NEW MIGRATION
 * ----------------------
 * Append a new entry to the `migrations` array below:
 *   { version: <next integer>, description: '<what changed>', up: async () => { ... } }
 * The `up` function receives raw IDB access via `get`/`set` from idb-keyval.
 * Always bump `package.json` version when adding a new migration.
 */

import { get, set } from 'idb-keyval'

export const SCHEMA_VERSION_KEY = 'vocab-schema-version'

/**
 * Ordered list of migrations.
 * version 1 = baseline after the localStorage → IndexedDB migration.
 * Future schema changes must be appended here with incrementing version numbers.
 */
const migrations = [
  {
    version: 1,
    description: 'Baseline: localStorage already migrated to IndexedDB',
    // The actual data move is done by migrateFromLocalStorage.js.
    // This entry simply marks the starting schema version.
    up: async () => {},
  },

  // Example of a future migration (commented out):
  // {
  //   version: 2,
  //   description: 'Add isLearned flag to all cards',
  //   up: async () => {
  //     const raw = await get('vocab-cards')
  //     if (!raw) return
  //     const state = JSON.parse(raw)
  //     state.cards = (state.cards ?? []).map(c => ({ isLearned: false, ...c }))
  //     await set('vocab-cards', JSON.stringify(state))
  //   },
  // },
]

async function _run() {
  const currentVersion = (await get(SCHEMA_VERSION_KEY)) ?? 0
  const pending = migrations.filter((m) => m.version > currentVersion)

  for (const migration of pending) {
    console.info(`[migrations] Running v${migration.version}: ${migration.description}`)
    await migration.up()
    await set(SCHEMA_VERSION_KEY, migration.version)
    console.info(`[migrations] v${migration.version} done`)
  }
}

/**
 * Run all pending data migrations.
 *
 * Uses the Web Locks API for multi-tab exclusion when available.
 * Safe to call on every app startup — migrations that have already run are skipped.
 */
export async function runMigrations() {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    await navigator.locks.request('vocab-schema-migrations', _run)
  } else {
    await _run()
  }
}
