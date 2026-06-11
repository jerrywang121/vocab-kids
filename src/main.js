import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import router from './router'
import App from './App.vue'
import './assets/main.css'
import { migrateFromLocalStorage } from './utils/migrateFromLocalStorage.js'
import { initIdbStorage, idbStorage } from './utils/idbStorage.js'

const STORE_KEYS = ['vocab-decks', 'vocab-cards', 'vocab-progress', 'vocab-settings']

async function bootstrap() {
  // Migrate any existing localStorage data into IndexedDB (one-time, no-ops after)
  await migrateFromLocalStorage()

  // Pre-load all store data from IndexedDB into the synchronous cache
  await initIdbStorage(STORE_KEYS)

  const pinia = createPinia()
  pinia.use(createPersistedState({ storage: idbStorage }))

  createApp(App)
    .use(pinia)
    .use(router)
    .mount('#app')
}

bootstrap()
