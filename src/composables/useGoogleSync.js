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
        await downloadAndMerge(true) // Pass true to avoid infinite loop or redundant checks
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
   * Download from Drive and merge with local state
   */
  async function downloadAndMerge(hasToken = false) {
    if (!settings.googleDriveEnabled) return
    if (!navigator.onLine) return
    
    if (!accessToken.value && !hasToken) {
      return connect() // Try to connect if token is missing
    }
    
    const token = accessToken.value
    if (!token) return

    isSyncing.value = true
    syncError.value = null
    try {
      // Ensure we have a file ID
      let fileId = settings.googleDriveFileId
      if (!fileId) {
        const file = await drive.findBackupFile(token)
        if (file) {
          fileId = file.id
          settings.updateSettings({ googleDriveFileId: fileId })
        } else {
          // No backup found on drive, nothing to download
          return
        }
      }

      const remoteData = await drive.fetchDriveData(token, fileId)
      
      // Merge logic
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
      
      settings.updateSettings({ lastSyncAt: new Date().toISOString() })
    } catch (err) {
      syncError.value = err.message
      console.error('Download error:', err)
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
      return connect() // Try to connect if token is missing
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
    if (!settings.googleDriveEnabled || !accessToken.value) return
    
    if (uploadTimeout) clearTimeout(uploadTimeout)
    uploadTimeout = setTimeout(() => {
      upload(true)
    }, 10000) // Debounce 10 seconds for auto-sync
  }

  // Watch for data changes across stores
  watch(() => [decksStore.decks, cardsStore.cards, progressStore.progress], () => {
    scheduleUpload()
  }, { deep: true })

  return {
    accessToken,
    isSyncing,
    syncError,
    connect,
    upload,
    disconnect,
    downloadAndMerge
  }
}
