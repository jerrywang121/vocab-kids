/**
 * Composable for PWA update detection.
 *
 * Uses vite-plugin-pwa's `useRegisterSW` to detect when a new service worker
 * is waiting to activate.  Exposes:
 *   - `needRefresh`   – reactive boolean; true when an update is ready to install
 *   - `dismissed`     – reactive boolean; true when the user clicked "Later"
 *   - `applyUpdate()` – activates the waiting SW and reloads the page
 *   - `dismissUpdate()` – hides the banner for this session
 *
 * Periodic checks: once per hour while the tab is open.
 * Visibility checks: re-triggers an update check whenever the tab becomes visible
 * again (e.g. returning from background), so long-lived tabs don't stay stale.
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'

export function useAppUpdate() {
  const dismissed = ref(false)
  let swRegistration = null

  const { needRefresh, updateServiceWorker, registrationError, offlineReady } = useRegisterSW({
    onRegistered(registration) {
      if (!registration) return
      swRegistration = registration

      // Check for updates every 60 minutes while the tab is running.
      const intervalId = setInterval(() => {
        registration.update().catch(() => {})
      }, 60 * 60 * 1000)

      // Clean up on page unload.
      window.addEventListener('beforeunload', () => clearInterval(intervalId), { once: true })
    },
    onRegisterError(error) {
      console.warn('[useAppUpdate] SW registration error:', error)
    },
  })

  // Re-check for updates when the tab regains visibility (e.g. returning from background).
  // Also re-show the banner if a new update arrived while the user had dismissed it.
  function onVisibilityChange() {
    if (document.visibilityState !== 'visible') return
    if (needRefresh.value) {
      // Update was waiting while we were hidden — re-show banner if user had dismissed.
      dismissed.value = false
    } else if (swRegistration) {
      // Actively poll the server for a new SW when the tab comes back into focus.
      swRegistration.update().catch(() => {})
    }
  }

  onMounted(() => document.addEventListener('visibilitychange', onVisibilityChange))
  onUnmounted(() => document.removeEventListener('visibilitychange', onVisibilityChange))

  async function applyUpdate() {
    await updateServiceWorker(true)
  }

  function dismissUpdate() {
    dismissed.value = true
  }

  return { needRefresh, dismissed, offlineReady, registrationError, applyUpdate, dismissUpdate }
}
