<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useSettingsStore } from './stores/useSettingsStore'
import AppHeader from './components/AppHeader.vue'

const settings = useSettingsStore()
const { colorScheme, theme } = storeToRefs(settings)
const schemes = ['scheme-pink', 'scheme-blue', 'scheme-green', 'scheme-purple', 'scheme-orange']

// Track OS dark-mode preference so 'auto' reacts to changes
const osDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)
const mq = window.matchMedia('(prefers-color-scheme: dark)')
const onMqChange = (e) => { osDark.value = e.matches }
onMounted(()   => mq.addEventListener('change', onMqChange))
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

