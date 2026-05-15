<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useRoute } from 'vue-router'

const settings = useSettingsStore()
const { theme, userName, avatar } = storeToRefs(settings)
const route = useRoute()

const BASE_URL = import.meta.env.BASE_URL

const FALLBACK_AVATAR = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="%231976d2"/><text x="20" y="26" text-anchor="middle" fill="white" font-size="20">😊</text></svg>`
function onAvatarError(e) { e.target.src = FALLBACK_AVATAR }

const navLinks = [
  { to: '/manage',       label: 'Manage',       icon: '📖' },
  { to: '/learn',        label: 'Learn',        icon: '🔄' },
  { to: '/quiz',         label: 'Quiz',         icon: '🧠' },
  { to: '/achievements', label: 'Achievements', icon: '🏆' },
  { to: '/settings',     label: 'Settings',     icon: '⚙️' },
]

// Cycle: auto → light → dark → auto
const themeIcon = computed(() => ({ auto: '🖥️', light: '☀️', dark: '🌙' }[theme.value] ?? '🖥️'))
function cycleTheme() {
  const next = { auto: 'light', light: 'dark', dark: 'auto' }
  settings.updateSettings({ theme: next[theme.value] ?? 'auto' })
}

const menuOpen = ref(false)
function toggleMenu() { menuOpen.value = !menuOpen.value }
function closeMenu() { menuOpen.value = false }

function onOutsideClick(e) {
  if (!e.target.closest('.nav-mobile-wrapper')) closeMenu()
}
onMounted(() => document.addEventListener('click', onOutsideClick))
onUnmounted(() => document.removeEventListener('click', onOutsideClick))
</script>

<template>
  <header class="app-header">
    <div class="header-inner">
      <RouterLink to="/" class="logo">
        <span class="logo-icon">📚</span>
        <span class="logo-text">VocabKids</span>
      </RouterLink>

      <!-- Mobile hamburger + dropdown (hidden on large screens) -->
      <div class="nav-mobile-wrapper">
        <button
          class="hamburger"
          :aria-expanded="menuOpen"
          aria-label="Open navigation menu"
          @click.stop="toggleMenu"
        >☰</button>
        <div v-if="menuOpen" class="nav-dropdown">
          <RouterLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            :title="link.label"
            @click="closeMenu"
          >
            <span class="dropdown-icon">{{ link.icon }}</span>
            <span>{{ link.label }}</span>
          </RouterLink>
        </div>
      </div>

      <!-- Desktop nav (hidden on small screens) -->
      <nav class="nav-links">
        <RouterLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          :title="link.label"
        >{{ link.icon || link.label }}</RouterLink>
      </nav>

      <button
        class="theme-toggle"
        :title="`Theme: ${theme} (click to cycle)`"
        @click="cycleTheme"
      >{{ themeIcon }}</button>

      <RouterLink to="/settings" class="header-user" title="Settings">
        <span class="user-name">{{ userName }}</span>
        <img
          :src="`${BASE_URL}avatars/${avatar}`"
          :alt="userName"
          class="avatar"
          @error="onAvatarError"
        />
      </RouterLink>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  background: var(--color-surface);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  position: sticky;
  top: 0;
  z-index: 100;
}
.header-inner {
  max-width: 720px;
  margin: 0 auto;
  padding: 0.6rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.logo {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  text-decoration: none;
  flex-shrink: 0;
}
.logo-icon { font-size: 1.4rem; }
.logo-text {
  font-family: 'Fredoka One', cursive;
  font-size: 1.3rem;
  color: var(--color-primary);
}
.nav-links {
  display: flex;
  gap: 0.25rem;
  flex-wrap: nowrap;
}
.nav-links a {
  padding: 0.4rem 0.7rem;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  transition: background 0.15s, color 0.15s;
  text-decoration: none;
  min-height: 44px;
  min-width: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.nav-links a.router-link-active,
.nav-links a:hover {
  background: var(--color-surface-alt);
  color: var(--color-primary);
}
.theme-toggle {
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  min-height: 44px;
  min-width: 44px;
  border-radius: 999px;
  transition: background 0.15s;
  flex-shrink: 0;
}
.theme-toggle:hover { background: var(--color-surface-alt); }

/* Mobile hamburger */
.nav-mobile-wrapper {
  display: none;
  position: relative;
  flex-shrink: 0;
}
.hamburger {
  background: none;
  border: none;
  font-size: 1.4rem;
  cursor: pointer;
  min-height: 44px;
  min-width: 44px;
  border-radius: 999px;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hamburger:hover { background: var(--color-surface-alt); }
.nav-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  background: var(--color-surface);
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  border-radius: 12px;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 160px;
  z-index: 200;
}
.nav-dropdown a {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.9rem;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--color-text-muted);
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
  min-height: 44px;
}
.nav-dropdown a.router-link-active,
.nav-dropdown a:hover {
  background: var(--color-surface-alt);
  color: var(--color-primary);
}
.dropdown-icon { font-size: 1.1rem; }

@media (max-width: 560px) {
  .nav-links,
  .theme-toggle {
    display: none;
  }
  .nav-mobile-wrapper {
    display: block;
  }
}
.header-user {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  text-decoration: none;
  flex-shrink: 0;
}
.user-name {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--color-text);
}
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2.5px solid var(--color-primary);
  object-fit: cover;
}
</style>
