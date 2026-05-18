<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useSettingsStore } from './stores/useSettingsStore'
import { useGoogleSync } from './composables/useGoogleSync'
import AppHeader from './components/AppHeader.vue'

const settings = useSettingsStore()
const { colorScheme, theme, googleDriveEnabled } = storeToRefs(settings)
const { connect } = useGoogleSync()
const schemes = ['scheme-pink', 'scheme-blue', 'scheme-green', 'scheme-purple', 'scheme-orange']

// Track OS dark-mode preference so 'auto' reacts to changes
const osDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)
const mq = window.matchMedia('(prefers-color-scheme: dark)')
const onMqChange = (e) => { osDark.value = e.matches }
onMounted(()   => {
  mq.addEventListener('change', onMqChange)
  
  // Auto-connect Google Drive if enabled
  if (googleDriveEnabled.value) {
    // We wait a bit for GIS script to be ready
    setTimeout(() => {
      if (typeof google !== 'undefined') {
        // connect() // Note: Auto-connect might trigger a popup, which can be annoying on every refresh.
        // Usually, we only connect when the user clicks. 
        // But the watchers in useGoogleSync are already active if we called useGoogleSync().
      }
    }, 2000)
  }
})
onUnmounted(() => mq.removeEventListener('change', onMqChange))

const isDark = computed(() =>
  theme.value === 'dark' || (theme.value === 'auto' && osDark.value)
)

// Apply colour scheme class to body
watch(colorScheme, (val) => {
  document.body.classList.remove(...schemes)
  document.body.classList.add(val)
}, { immediate: true })

// Apply / remove .dark class on body
watch(isDark, (val) => {
  document.body.classList.toggle('dark', val)
}, { immediate: true })
</script>

<template>
  <AppHeader />
  <RouterView />
</template>

