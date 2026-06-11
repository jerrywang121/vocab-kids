<script setup>
/**
 * UpdateBanner – shown when a new PWA version is available.
 *
 * Props:
 *   version  (String) – new version label to display (optional)
 *
 * Emits:
 *   update   – user chose to install the update
 *   dismiss  – user chose to update later
 */
defineProps({
  version: { type: String, default: '' },
})

const emit = defineEmits(['update', 'dismiss'])
</script>

<template>
  <div class="update-banner" role="alert" aria-live="polite">
    <span class="update-icon">🎉</span>
    <div class="update-text">
      <strong>New version available!</strong>
      <span v-if="version" class="update-version">v{{ version }}</span>
      <span class="update-sub">Update now to get the latest features &amp; fixes.</span>
    </div>
    <div class="update-actions">
      <button class="btn-update" @click="emit('update')">Update Now</button>
      <button class="btn-later" @click="emit('dismiss')">Later</button>
    </div>
  </div>
</template>

<style scoped>
.update-banner {
  position: sticky;
  top: var(--header-height, 64px); /* stacks flush below the sticky AppHeader (z-index 100) */
  z-index: 99;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  background: var(--color-primary, #4f81e8);
  color: #fff;
  font-size: 0.9rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  flex-wrap: wrap;
}

.update-icon {
  font-size: 1.4rem;
  flex-shrink: 0;
}

.update-text {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem;
  min-width: 0;
}

.update-version {
  font-size: 0.8rem;
  opacity: 0.85;
  background: rgba(255, 255, 255, 0.2);
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
}

.update-sub {
  font-size: 0.82rem;
  opacity: 0.9;
  width: 100%;
}

.update-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.btn-update,
.btn-later {
  min-height: 44px;
  min-width: 44px;
  padding: 0.4rem 1rem;
  border-radius: 999px;
  border: none;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
}

.btn-update {
  background: #fff;
  color: var(--color-primary, #4f81e8);
}

.btn-update:hover {
  opacity: 0.9;
  transform: scale(1.03);
}

.btn-later {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.btn-later:hover {
  background: rgba(255, 255, 255, 0.28);
}
</style>
