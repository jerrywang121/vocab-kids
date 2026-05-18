import { ref, watch } from 'vue'
import { useDecksStore } from '../stores/useDecksStore'
import { useCardsStore } from '../stores/useCardsStore'
import { useProgressStore } from '../stores/useProgressStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import * as drive from '../api/googleDrive'

export function useGoogleSync() {
  const decksStore = useDecksStore()
  const cardsStore = useCardsStore()
  const progressStore = useProgressStore()
  const settings = useSettingsStore()

  const accessToken = ref(null)
  const isSyncing = ref(false)
  const syncError = ref(null)

  /**
   * Initialize sync: Connect and do initial download/merge
   */
  async function connect() {
    isSyncing.value = true
    syncError.value = null
    try {
      const token = await drive.requestAccessToken()
      accessToken.value = token
      
      // Find or create backup file
      let file = await drive.findBackupFile(token)
      if (file) {
        settings.updateSettings({ googleDriveFileId: file.id, googleDriveEnabled: true })
        await downloadAndMerge()
      } else {
        // First time backup: upload current local state
        await upload()
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
  async function downloadAndMerge() {
    if (!accessToken.value || !settings.googleDriveFileId) return
    
    isSyncing.value = true
    try {
      const remoteData = await drive.fetchDriveData(accessToken.value, settings.googleDriveFileId)
      
      // Merge logic (Similar to SettingsView.vue but automated)
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
  async function upload() {
    if (!accessToken.value) return
    
    isSyncing.value = true
    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        decks: decksStore.decks,
        cards: cardsStore.cards,
        progress: progressStore.progress,
      }
      
      const result = await drive.uploadDriveData(
        accessToken.value, 
        settings.googleDriveFileId, 
        payload
      )
      
      if (result.id && !settings.googleDriveFileId) {
        settings.updateSettings({ googleDriveFileId: result.id })
      }
      
      settings.updateSettings({ lastSyncAt: payload.exportedAt })
    } catch (err) {
      syncError.value = err.message
    } finally {
      isSyncing.value = false
    }
  }

  // ── Auto-Sync Watchers ─────────────────────────────────────────────────────
  let uploadTimeout = null

  function scheduleUpload() {
    if (!settings.googleDriveEnabled || !accessToken.value) return
    
    if (uploadTimeout) clearTimeout(uploadTimeout)
    uploadTimeout = setTimeout(() => {
      upload()
    }, 5000) // Debounce 5 seconds
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
    downloadAndMerge
  }
}
