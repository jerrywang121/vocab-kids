import { ref, watch } from 'vue'
import { useDecksStore } from '../stores/useDecksStore'
import { useCardsStore } from '../stores/useCardsStore'
import { useProgressStore } from '../stores/useProgressStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import * as drive from '../api/googleDrive'

// Shared state across all instances of the composable
const accessToken = ref(null)
const isSyncing = ref(false)
const syncError = ref(null)
const syncConflict = ref(null) // { remoteData, remoteTime, localTime }

export function useGoogleSync() {
  const decksStore = useDecksStore()
  const cardsStore = useCardsStore()
  const progressStore = useProgressStore()
  const settings = useSettingsStore()

  /**
   * Initialize sync: Connect and do initial download/merge
   */
  async function connect() {
    if (!navigator.onLine) {
      syncError.value = 'You are offline. Please check your internet connection.'
      return
    }

    if (typeof google === 'undefined') {
      syncError.value = 'Google services are not available. This might be due to an ad-blocker or being offline.'
      return
    }

    isSyncing.value = true
    syncError.value = null
    try {
      const token = await drive.requestAccessToken()
      accessToken.value = token
      
      // Find or create backup file
      let file = await drive.findBackupFile(token)
      if (file) {
        settings.updateSettings({ googleDriveFileId: file.id, googleDriveEnabled: true })
        // Use the new sync logic after connecting
        await sync(true)
      } else {
        // First time backup: upload current local state
        await upload(true)
        file = await drive.findBackupFile(token)
        if (file) settings.updateSettings({ googleDriveFileId: file.id, googleDriveEnabled: true })
      }
    } catch (err) {
      syncError.value = err.message
      console.error('Google Sync Error:', err)
    } finally {
      isSyncing.value = false
    }
  }

  /**
   * Main sync entry point: Check for conflicts then merge/upload
   */
  async function sync(hasToken = false) {
    if (!settings.googleDriveEnabled) return
    if (!navigator.onLine) return
    
    if (!accessToken.value && !hasToken) {
      return connect()
    }
    
    const token = accessToken.value
    if (!token) return

    isSyncing.value = true
    syncError.value = null
    syncConflict.value = null

    try {
      let fileId = settings.googleDriveFileId
      if (!fileId) {
        const file = await drive.findBackupFile(token)
        if (file) {
          fileId = file.id
          settings.updateSettings({ googleDriveFileId: fileId })
        } else {
          // No backup on drive, just upload local
          await upload(true)
          return
        }
      }

      const remoteData = await drive.fetchDriveData(token, fileId)
      const remoteTime = remoteData.exportedAt ? new Date(remoteData.exportedAt) : new Date(0)
      const localTime  = settings.lastSyncAt ? new Date(settings.lastSyncAt) : new Date(0)

      // Add a small buffer (1s) to avoid micro-second precision issues
      if (remoteTime.getTime() > localTime.getTime() + 1000) {
        // Conflict detected
        syncConflict.value = {
          remoteData,
          remoteTime: remoteData.exportedAt,
          localTime: settings.lastSyncAt
        }
      } else {
        // Local is newer or equal, just upload
        await upload(true)
      }
    } catch (err) {
      syncError.value = err.message
      console.error('Sync error:', err)
    } finally {
      isSyncing.value = false
    }
  }

  /**
   * Handle user choice for sync conflict
   */
  async function resolveConflict(action) {
    if (!syncConflict.value) return
    
    const { remoteData } = syncConflict.value
    syncConflict.value = null // Clear conflict state immediately
    isSyncing.value = true

    try {
      if (action === 'merge') {
        // 1. Merge remote into local
        if (remoteData.decks) {
          for (const deck of remoteData.decks) {
            const exists = decksStore.decks.find(d => d.id === deck.id)
            if (!exists) decksStore.addDeck(deck)
            else decksStore.updateDeck(deck.id, deck)
          }
        }
        if (remoteData.cards) {
          for (const card of remoteData.cards) {
            const exists = cardsStore.cards.find(c => c.id === card.id)
            if (!exists) cardsStore.addCard(card)
            else cardsStore.updateCard(card.id, card)
          }
        }
        if (remoteData.progress) {
          mergeProgress(remoteData.progress)
        }
        // 2. Upload merged state
        await upload(true)
      } else if (action === 'overwrite') {
        // Just upload current local state
        await upload(true)
      }
      // 'cancel' action just exits as conflict was already cleared
    } catch (err) {
      syncError.value = err.message
    } finally {
      isSyncing.value = false
    }
  }

  function mergeProgress(incoming) {
    for (const p of incoming) {
      const existing = progressStore.progress.find(e => e.cardId === p.cardId)
      if (!existing) {
        progressStore.progress.push(p)
      } else {
        const incomingDate = p.lastCorrectAt ? new Date(p.lastCorrectAt) : null
        const existingDate = existing.lastCorrectAt ? new Date(existing.lastCorrectAt) : null
        if (!existingDate || (incomingDate && incomingDate > existingDate)) {
          Object.assign(existing, p)
        }
      }
    }
  }

  /**
   * Upload current local state to Drive
   */
  async function upload(hasToken = false) {
    if (!settings.googleDriveEnabled) return
    if (!navigator.onLine) return
    
    if (!accessToken.value && !hasToken) {
      // For manual calls, we might want to connect, but for auto-sync we shouldn't
      if (hasToken) return connect() 
      return
    }

    const token = accessToken.value
    if (!token) return
    
    isSyncing.value = true
    syncError.value = null
    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        decks: decksStore.decks,
        cards: cardsStore.cards,
        progress: progressStore.progress,
      }
      
      const result = await drive.uploadDriveData(
        token, 
        settings.googleDriveFileId, 
        payload
      )
      
      if (result.id && !settings.googleDriveFileId) {
        settings.updateSettings({ googleDriveFileId: result.id })
      }
      
      settings.updateSettings({ lastSyncAt: payload.exportedAt })
    } catch (err) {
      syncError.value = err.message
      console.error('Upload error:', err)
      throw err // Re-throw to be caught by sync/resolveConflict
    } finally {
      isSyncing.value = false
    }
  }

  /**
   * Disconnect Google Drive
   */
  async function disconnect() {
    if (accessToken.value) {
      try {
        await drive.revokeToken(accessToken.value)
      } catch (err) {
        console.warn('Failed to revoke token:', err)
      }
    }
    accessToken.value = null
    syncError.value = null
    syncConflict.value = null
    settings.updateSettings({ 
      googleDriveEnabled: false, 
      googleDriveFileId: null,
      googleUserEmail: null 
    })
  }

  // ── Auto-Sync Watchers ─────────────────────────────────────────────────────
  let uploadTimeout = null

  function scheduleUpload() {
    // Auto-sync only works if we already have a token
    // We don't want to pop up login windows automatically
    // Also skip if there's an active conflict being shown
    if (!settings.googleDriveEnabled || !accessToken.value || syncConflict.value) return
    
    if (uploadTimeout) clearTimeout(uploadTimeout)
    uploadTimeout = setTimeout(() => {
      // Auto-sync doesn't check for conflicts to keep it lightweight, 
      // it assumes manual sync has resolved them.
      upload(true).catch(() => {}) 
    }, 15000) // Debounce 15 seconds for auto-sync
  }

  // Watch for data changes across stores
  watch(() => [decksStore.decks, cardsStore.cards, progressStore.progress], () => {
    scheduleUpload()
  }, { deep: true })

  return {
    accessToken,
    isSyncing,
    syncError,
    syncConflict,
    connect,
    sync,
    upload,
    disconnect,
    resolveConflict
  }
}
