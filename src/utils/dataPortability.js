/**
 * Data portability — export / import for full backup files.
 *
 * Backup file format
 * ------------------
 * {
 *   "formatVersion": <integer>,   // schema version of THIS file (bumped when shape changes)
 *   "appVersion":    <string>,    // app semver at export time (informational)
 *   "exportedAt":    <ISO8601>,
 *   "decks":         [...],
 *   "cards":         [...],
 *   "progress":      [...]
 * }
 *
 * Backwards-compatibility
 * -----------------------
 * Older backups used "version" instead of "formatVersion".  The loader normalises
 * that automatically so existing backups keep working.
 *
 * ADDING A NEW FORMAT MIGRATION
 * -----------------------------
 * 1. Bump BACKUP_FORMAT_VERSION.
 * 2. Append { fromVersion: <old>, up(data) { …return data } } to `migrations`.
 * 3. Bump package.json version.
 */

export const BACKUP_FORMAT_VERSION = 1

/**
 * Ordered list of format migrations.
 * Each entry upgrades from `fromVersion` → `fromVersion + 1`.
 *
 * Example (commented out — shows how to add future migrations):
 *
 * {
 *   fromVersion: 1,
 *   up(data) {
 *     // e.g. rename a field on every card
 *     data.cards = (data.cards ?? []).map(c => ({ notes: '', ...c }))
 *     return data
 *   },
 * },
 */
const migrations = [
  // (none yet — formatVersion 1 is the baseline)
]

/**
 * Normalise and migrate a raw parsed backup object to the current format.
 * Returns { ok: true, data } or { ok: false, error: string }.
 */
export function migrateBackupData(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Not a valid JSON object.' }
  }

  // Normalise legacy "version" key → "formatVersion"
  let data = { ...parsed }
  if (data.formatVersion === undefined && data.version !== undefined) {
    data.formatVersion = data.version
  }

  const fileVersion = typeof data.formatVersion === 'number' ? data.formatVersion : 0

  if (fileVersion > BACKUP_FORMAT_VERSION) {
    return {
      ok: false,
      error:
        `This backup was created with a newer version of VocabKids ` +
        `(format v${fileVersion}, app supports up to v${BACKUP_FORMAT_VERSION}). ` +
        `Please update the app first.`,
    }
  }

  // Apply any pending migrations in order
  let current = fileVersion
  for (const migration of migrations) {
    if (migration.fromVersion === current) {
      try {
        data = migration.up(data)
        current++
        data.formatVersion = current
      } catch (err) {
        return { ok: false, error: `Migration from v${migration.fromVersion} failed: ${err.message}` }
      }
    }
  }

  return { ok: true, data }
}

/**
 * Build the export payload object (ready to JSON.stringify).
 *
 * @param {{ decks: any[], cards: any[], progress: any[] }} stores
 */
export function buildExportPayload({ decks, cards, progress }) {
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion: __APP_VERSION__,
    exportedAt: new Date().toISOString(),
    decks,
    cards,
    progress,
  }
}

/**
 * Trigger a browser download of a JSON backup file.
 *
 * @param {{ decks: any[], cards: any[], progress: any[] }} stores
 */
export function downloadBackup({ decks, cards, progress }) {
  const payload = buildExportPayload({ decks, cards, progress })
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `vocabkids-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
