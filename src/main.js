import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import router from './router'
import App from './App.vue'
import './assets/main.css'
import { migrateFromLocalStorage } from './utils/migrateFromLocalStorage.js'
import { initIdbStorage, idbStorage } from './utils/idbStorage.js'
import { runMigrations } from './utils/migrations.js'

const STORE_KEYS = ['vocab-decks', 'vocab-cards', 'vocab-progress', 'vocab-settings']

async function bootstrap() {
  // Step 1: One-time copy of any existing localStorage data into IndexedDB.
  await migrateFromLocalStorage()

  // Step 2: Run any pending versioned data-schema migrations against raw IDB data.
  //         Must happen before Pinia hydrates so the cache sees the migrated shape.
  await runMigrations()

  // Step 3: Pre-load all store data from IndexedDB into the synchronous cache.
  await initIdbStorage(STORE_KEYS)

  const pinia = createPinia()
  pinia.use(createPersistedState({ storage: idbStorage }))

  createApp(App)
    .use(pinia)
    .use(router)
    .mount('#app')
}

bootstrap()
