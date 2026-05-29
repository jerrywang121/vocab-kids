import { ref, watch, computed } from 'vue'
import { useDecksStore } from '../stores/useDecksStore'
import { useCardsStore } from '../stores/useCardsStore'
import { useProgressStore } from '../stores/useProgressStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import * as drive from '../api/googleDrive'

// Shared state across all instances of the composable
const isSyncing = ref(false)
const syncError = ref(null)
const syncConflict = ref(null) // { remoteData, remoteTime, localTime }

export function useGoogleSync() {
  const decksStore = useDecksStore()
  const cardsStore = useCardsStore()
  const progressStore = useProgressStore()
  const settings = useSettingsStore()

  // Token is managed in the store for persistence across refreshes
  const accessToken = computed({
    get: () => {
      // Check if token exists and is not expired
      if (settings.googleAccessToken && settings.googleTokenExpiresAt) {
        if (Date.now() < settings.googleTokenExpiresAt) {
          return settings.googleAccessToken
        }
      }
      return null
    },
    set: (val) => {
      // Handled by updateSettings inside connect
    }
  })

  /**
   * Initialize sync: Connect and do initial download/merge
   */
  async function connect(options = {}) {
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
      // If we're already connected and have a valid token, just return it
      if (accessToken.value && !options.force) {
        return accessToken.value
      }

      // Default to forcing consent if not explicitly suppressed
      const requestOptions = {
        prompt: options.prompt !== undefined ? options.prompt : 'consent'
      }

      const { token, expiresIn } = await drive.requestAccessToken(requestOptions)
      const expiresAt = Date.now() + (expiresIn * 1000)
      
      settings.updateSettings({ 
        googleAccessToken: token, 
        googleTokenExpiresAt: expiresAt,
        googleDriveEnabled: true 
      })
      
      // Find or create backup file
      let file = await drive.findBackupFile(token)
      if (file) {
        settings.updateSettings({ googleDriveFileId: file.id })
        // Use the new sync logic after connecting
        await sync(true)
      } else {
        // First time backup: upload current local state
        await upload(true)
        file = await drive.findBackupFile(token)
        if (file) settings.updateSettings({ googleDriveFileId: file.id })
      }
      
      return token
    } catch (err) {
      syncError.value = err.message
      console.error('Google Sync Error:', err)
      throw err
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
    
    let token = accessToken.value
    if (!token) {
      // Try to connect silently if we were already enabled
      try {
        token = await connect({ prompt: '', force: true })
      } catch (e) {
        // Silent connect failed, maybe user needs to interact
        return
      }
    }
    
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
    
    let token = accessToken.value
    if (!token) {
      // If we don't have a token, we can't upload in background.
      // If it's a manual sync (hasToken is true but actually refers to 'skip check' in my previous code)
      // Wait, in previous code I used hasToken=true to mean "skip re-auth check".
      // Let's fix the parameter name to 'manual'
      return
    }

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
      throw err 
    } finally {
      isSyncing.value = false
    }
  }

  /**
   * Disconnect Google Drive
   */
  async function disconnect() {
    const token = settings.googleAccessToken
    if (token) {
      try {
        await drive.revokeToken(token)
      } catch (err) {
        console.warn('Failed to revoke token:', err)
      }
    }
    syncError.value = null
    syncConflict.value = null
    settings.updateSettings({ 
      googleDriveEnabled: false, 
      googleDriveFileId: null,
      googleUserEmail: null,
      googleAccessToken: null,
      googleTokenExpiresAt: null
    })
  }

  // ── Auto-Sync Watchers ─────────────────────────────────────────────────────
  let uploadTimeout = null

  function scheduleUpload() {
    if (!settings.googleDriveEnabled || !accessToken.value || syncConflict.value) return
    
    if (uploadTimeout) clearTimeout(uploadTimeout)
    uploadTimeout = setTimeout(() => {
      upload().catch(() => {}) 
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
