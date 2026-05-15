<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useDecksStore }    from '../stores/useDecksStore'
import { useCardsStore }    from '../stores/useCardsStore'
import { useProgressStore } from '../stores/useProgressStore'
import { PROVIDERS }        from '../api/providers.js'
import { useSpeech }        from '../composables/useSpeech'

const settings      = useSettingsStore()
const decksStore    = useDecksStore()
const cardsStore    = useCardsStore()
const progressStore = useProgressStore()
const { speak }     = useSpeech()

// All settings bind directly to the store — changes persist immediately
const {
  userName, avatar, colorScheme, theme,
  questionsPerQuiz, dictionaryApiEnabled, userAgeGroup,
  ttsVoice, ttsPitch, ttsRate,
  aiProvider, aiApiKey, aiApiUrl, aiModel, aiCallsPerMinute, aiBatchSize,
} = storeToRefs(settings)

const AGE_GROUPS = [
  { value: '3-5',  label: '🐣 3–5 years old'  },
  { value: '6-8',  label: '🌟 6–8 years old'  },
  { value: '9-11', label: '🚀 9–11 years old' },
  { value: '12+',  label: '🎓 12+ years old'  },
]

const SCHEMES = [
  { value: 'scheme-blue',   label: '💙 Blue'   },
  { value: 'scheme-pink',   label: '🩷 Pink'   },
  { value: 'scheme-green',  label: '💚 Green'  },
  { value: 'scheme-purple', label: '💜 Purple' },
  { value: 'scheme-orange', label: '🧡 Orange' },
]

const BASE_URL = import.meta.env.BASE_URL
const AVATARS = ['avatar-1.png', 'avatar-2.png', 'avatar-3.png', 'avatar-4.png', 'avatar-5.png']

// ── TTS (Web Speech API) ──────────────────────────────────────────────────────
const availableVoices = ref([])

function loadVoices() {
  const voices = window.speechSynthesis?.getVoices() ?? []
  // Prefer English voices but include all so user can pick any
  const en  = voices.filter(v => v.lang.startsWith('en'))
  const rest = voices.filter(v => !v.lang.startsWith('en'))
  availableVoices.value = [...en, ...rest]
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices()
  window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
}

// ── AI Provider UI ────────────────────────────────────────────────────────────

const currentProvider = computed(() =>
  PROVIDERS.find(p => p.id === aiProvider.value) ?? PROVIDERS.find(p => p.id === 'custom')
)

const availableModels = ref([])
const listingModels   = ref(false)
const listModelsMsg   = ref('')
const modelFilter     = ref('')

const filteredModels = computed(() => {
  const q = modelFilter.value.trim().toLowerCase()
  if (!q) return availableModels.value
  return availableModels.value.filter(m =>
    m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
  )
})

// Reset model list when provider changes
watch(aiProvider, (newId) => {
  const p = PROVIDERS.find(pp => pp.id === newId)
  if (p?.staticModels) {
    availableModels.value = p.staticModels.map(id => ({ id, name: id }))
  } else {
    availableModels.value = []
  }
  aiModel.value = ''
  listModelsMsg.value = ''
  modelFilter.value = ''
  // Clear custom URL when switching to a provider that has a fixed baseUrl
  if (p?.baseUrl && !p.requiresCustomUrl) aiApiUrl.value = ''
}, { immediate: false })

onMounted(() => {
  const p = PROVIDERS.find(pp => pp.id === aiProvider.value)
  if (p?.staticModels) {
    availableModels.value = p.staticModels.map(id => ({ id, name: id }))
  }
  // Restore previously saved model into the list so the select shows it selected
  if (aiModel.value && !availableModels.value.find(m => m.id === aiModel.value)) {
    availableModels.value = [{ id: aiModel.value, name: aiModel.value }, ...availableModels.value]
  }
})

async function fetchModels() {
  listingModels.value = true
  listModelsMsg.value = ''
  try {
    const { listModels } = await import('../api/ai.js')
    const models = await listModels({
      aiProvider: aiProvider.value,
      aiApiKey:   aiApiKey.value,
      aiApiUrl:   aiApiUrl.value,
    })
    if (models.length === 0) {
      listModelsMsg.value = '⚠️ No models found — check your URL and API key.'
    } else {
      availableModels.value = models
      listModelsMsg.value   = `✅ ${models.length} model${models.length !== 1 ? 's' : ''} loaded`
      // Auto-select default if nothing is selected yet
      if (!aiModel.value) {
        const def = currentProvider.value?.defaultModel
        aiModel.value = models.find(m => m.id === def)?.id ?? models[0]?.id ?? ''
      }
    }
  } catch (err) {
    listModelsMsg.value = `❌ Error: ${err.message}`
  } finally {
    listingModels.value = false
  }
}

// ── Export / Import ───────────────────────────────────────────────────────────
function exportData() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    decks: decksStore.decks,
    cards: cardsStore.cards,
    progress: progressStore.progress,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `vocabkids-backup-${new Date().toISOString().slice(0,10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const importFileInput = ref(null)
const importMsg       = ref('')

function triggerImport() { importFileInput.value.click() }

async function handleImport(e) {
  const file = e.target.files[0]
  if (!file) return
  try {
    const text   = await file.text()
    const parsed = JSON.parse(text)

    if (parsed.decks)    mergeById(decksStore.decks, parsed.decks, d => decksStore.updateDeck(d.id, d), d => decksStore.addDeck(d))
    if (parsed.cards)    mergeById(cardsStore.cards, parsed.cards, c => cardsStore.updateCard(c.id, c), c => cardsStore.addCard(c))
    if (parsed.progress) mergeProgress(parsed.progress)

    importMsg.value = '✅ Import complete!'
  } catch (err) {
    importMsg.value = `❌ Import failed: ${err.message}`
  }
  e.target.value = ''
  setTimeout(() => importMsg.value = '', 4000)
}

function mergeById(existing, incoming, updateFn, addFn) {
  for (const item of incoming) {
    const exists = existing.find(e => e.id === item.id)
    exists ? updateFn(item) : addFn(item)
  }
}

function mergeProgress(incoming) {
  for (const p of incoming) {
    const existing = progressStore.getProgress(p.cardId)
    if (!existing) {
      progressStore.progress.push(p)
    } else {
      const incomingDate  = p.lastCorrectAt  ? new Date(p.lastCorrectAt)  : null
      const existingDate  = existing.lastCorrectAt ? new Date(existing.lastCorrectAt) : null
      if (!existingDate || (incomingDate && incomingDate > existingDate)) {
        Object.assign(existing, p)
      }
    }
  }
}

// ── Clear all data ────────────────────────────────────────────────────────────
const showClearConfirm = ref(false)

function clearAllData() {
  decksStore.decks.length    = 0
  cardsStore.cards.length    = 0
  progressStore.progress.length            = 0
  progressStore.quizSessions.length        = 0
  progressStore.achievementSnapshots.length = 0
  showClearConfirm.value = false
}
</script>

<template>
  <main class="page">
    <h1>⚙️ Settings</h1>

    <div class="settings-form mt-2">

      <!-- Profile -->
      <details class="settings-section card-surface" open>
        <summary class="section-summary">👤 Profile</summary>
        <div class="section-body">
          <div class="form-field">
            <label>Your Name</label>
            <input v-model="userName" placeholder="Enter your name" maxlength="30" />
          </div>
          <div class="form-field">
            <label>Age Group</label>
            <select v-model="userAgeGroup" class="provider-select">
              <option v-for="ag in AGE_GROUPS" :key="ag.value" :value="ag.value">{{ ag.label }}</option>
            </select>
          </div>
          <div class="form-field">
            <label>Avatar</label>
            <div class="avatar-picker">
              <label v-for="av in AVATARS" :key="av" class="avatar-option">
                <input type="radio" v-model="avatar" :value="av" />
                <img :src="`${BASE_URL}avatars/${av}`" :alt="av" class="avatar-img" :class="{ selected: avatar === av }" />
              </label>
            </div>
          </div>
        </div>
      </details>

      <!-- Appearance -->
      <details class="settings-section card-surface">
        <summary class="section-summary">🎨 Appearance</summary>
        <div class="section-body">
          <div class="form-field">
            <label>Colour Scheme</label>
            <div class="scheme-picker">
              <label v-for="s in SCHEMES" :key="s.value" class="scheme-option">
                <input type="radio" v-model="colorScheme" :value="s.value" />
                <span class="scheme-dot" :class="s.value">{{ s.label }}</span>
              </label>
            </div>
          </div>
          <div class="form-field">
            <label>Theme</label>
            <div class="theme-picker">
              <label class="theme-option">
                <input type="radio" v-model="theme" value="auto" />
                <span class="theme-btn">🖥️ Auto</span>
              </label>
              <label class="theme-option">
                <input type="radio" v-model="theme" value="light" />
                <span class="theme-btn">☀️ Light</span>
              </label>
              <label class="theme-option">
                <input type="radio" v-model="theme" value="dark" />
                <span class="theme-btn">🌙 Dark</span>
              </label>
            </div>
          </div>
        </div>
      </details>

      <!-- TTS (Text-to-Speech) -->
      <details class="settings-section card-surface">
        <summary class="section-summary">🔊 Pronunciation</summary>
        <div class="section-body">
          <div class="form-field">
            <label>Voice</label>
            <select v-model="ttsVoice" class="provider-select">
              <option value="">— Browser default —</option>
              <optgroup v-if="availableVoices.filter(v => v.lang.startsWith('en')).length" label="English voices">
                <option
                  v-for="v in availableVoices.filter(v2 => v2.lang.startsWith('en'))"
                  :key="v.voiceURI"
                  :value="v.voiceURI"
                >{{ v.name }} ({{ v.lang }})</option>
              </optgroup>
              <optgroup v-if="availableVoices.filter(v => !v.lang.startsWith('en')).length" label="Other voices">
                <option
                  v-for="v in availableVoices.filter(v2 => !v2.lang.startsWith('en'))"
                  :key="v.voiceURI"
                  :value="v.voiceURI"
                >{{ v.name }} ({{ v.lang }})</option>
              </optgroup>
            </select>
          </div>
          <div class="form-field">
            <label>Pitch: <strong>{{ ttsPitch }}</strong></label>
            <input type="range" v-model.number="ttsPitch" min="0.5" max="2" step="0.1" />
            <div class="range-labels text-muted"><span>Low (0.5)</span><span>High (2)</span></div>
          </div>
          <div class="form-field">
            <label>Speed: <strong>{{ ttsRate }}×</strong></label>
            <input type="range" v-model.number="ttsRate" min="0.5" max="2" step="0.1" />
            <div class="range-labels text-muted"><span>Slow (0.5×)</span><span>Fast (2×)</span></div>
          </div>
          <div>
            <button type="button" class="btn btn-ghost" @click="speak('Hello! I am ready to help you learn.')">
              🎤 Test Voice
            </button>
          </div>
        </div>
      </details>

      <!-- Quiz -->
      <details class="settings-section card-surface">
        <summary class="section-summary">🧠 Quiz</summary>
        <div class="section-body">
          <div class="form-field">
            <label>Questions per Quiz: <strong>{{ questionsPerQuiz }}</strong></label>
            <input type="range" v-model.number="questionsPerQuiz" min="5" max="50" step="5" />
            <div class="range-labels text-muted"><span>5</span><span>50</span></div>
          </div>
        </div>
      </details>

      <!-- APIs -->
      <details class="settings-section card-surface">
        <summary class="section-summary">🌐 APIs</summary>
        <div class="section-body">
          <label class="toggle-label">
            <input type="checkbox" v-model="dictionaryApiEnabled" />
            <span>Use Free Dictionary API when adding cards</span>
          </label>

          <div class="ai-provider-box mt-2">
            <h3 class="ai-section-title">🤖 AI Provider</h3>

            <!-- Provider selector -->
            <div class="form-field">
              <label>Provider</label>
              <select v-model="aiProvider" class="provider-select">
                <option v-for="p in PROVIDERS" :key="p.id" :value="p.id" :disabled="p.disabled">
                  {{ p.name }}{{ p.disabled ? ' (not supported in browser)' : '' }}
                </option>
              </select>
            </div>

            <!-- Fixed base URL (read-only info) -->
            <div v-if="currentProvider?.baseUrl && !currentProvider.requiresCustomUrl" class="form-field">
              <label class="text-muted">Base URL <span class="badge-fixed">fixed</span></label>
              <input :value="currentProvider.baseUrl" readonly class="input-readonly" />
            </div>

            <!-- Custom / override URL -->
            <div v-if="currentProvider?.requiresCustomUrl" class="form-field">
              <label>Base URL</label>
              <input
                v-model="aiApiUrl"
                :placeholder="currentProvider.urlHint || 'https://…'"
                autocomplete="off"
              />
            </div>

            <!-- API Key -->
            <div class="form-field">
              <label>API Key</label>
              <input
                v-model="aiApiKey"
                type="password"
                :placeholder="currentProvider?.keyPlaceholder || 'API key'"
                autocomplete="off"
              />
            </div>

            <!-- List Models button -->
            <div class="models-row">
              <button
                type="button"
                class="btn btn-ghost"
                :disabled="listingModels || currentProvider?.disabled"
                @click="fetchModels"
              >
                <span v-if="listingModels">⏳ Loading…</span>
                <span v-else>🔍 List Models</span>
              </button>
              <span v-if="listModelsMsg" class="models-msg" :class="{ 'msg-error': listModelsMsg.startsWith('❌') || listModelsMsg.startsWith('⚠️') }">
                {{ listModelsMsg }}
              </span>
            </div>

            <!-- Model selector (filterable dropdown when models are loaded) -->
            <div v-if="availableModels.length > 0" class="form-field">
              <label>
                Model
                <span class="text-muted" style="font-size:0.8rem;">
                  ({{ filteredModels.length }}/{{ availableModels.length }})
                </span>
              </label>
              <input
                v-model="modelFilter"
                class="model-filter-input"
                placeholder="🔎 Filter models…"
                autocomplete="off"
              />
              <select v-model="aiModel" class="model-select" size="5">
                <option value="">— select a model —</option>
                <option v-for="m in filteredModels" :key="m.id" :value="m.id">{{ m.name }}</option>
              </select>
            </div>

            <!-- Model text input (when no models loaded yet) -->
            <div v-else class="form-field">
              <label>Model <span class="text-muted">(or click List Models above)</span></label>
              <input
                v-model="aiModel"
                :placeholder="currentProvider?.defaultModel || 'model-name'"
                autocomplete="off"
              />
            </div>

            <p v-if="currentProvider?.disabled" class="ai-notice">
              ⚠️ {{ currentProvider.keyPlaceholder }}
            </p>

            <!-- Rate limit -->
            <div class="form-field">
              <label>
                AI Call Rate Limit:
                <strong>{{ aiCallsPerMinute > 0 ? `${aiCallsPerMinute} calls/min` : 'Unlimited' }}</strong>
              </label>
              <input type="range" v-model.number="aiCallsPerMinute" min="0" max="60" step="1" />
              <div class="range-labels text-muted"><span>Unlimited (0)</span><span>60/min</span></div>
              <p class="ai-hint text-muted">Limits how many AI API calls the app makes per minute across all features.</p>
            </div>

            <!-- Batch size -->
            <div class="form-field">
              <label>
                AI Import Batch Size:
                <strong>{{ aiBatchSize }} word{{ aiBatchSize !== 1 ? 's' : '' }} per batch</strong>
              </label>
              <input type="range" v-model.number="aiBatchSize" min="1" max="20" step="1" />
              <div class="range-labels text-muted"><span>1</span><span>20</span></div>
              <p class="ai-hint text-muted">How many words are sent to the AI in each request during bulk TXT import. Larger batches are faster but may hit token limits.</p>
            </div>
          </div>
        </div>
      </details>

    </div>

    <!-- Data management -->
    <details class="settings-section card-surface mt-3">
      <summary class="section-summary">💾 Data</summary>
      <div class="section-body">
        <p class="text-muted" style="font-size:0.9rem;">
          {{ decksStore.decks.length }} decks · {{ cardsStore.cards.length }} cards
        </p>
        <div class="data-actions mt-2">
          <button class="btn btn-ghost" @click="exportData">📤 Export Backup</button>
          <button class="btn btn-ghost" @click="triggerImport">
            <span v-if="importMsg">{{ importMsg }}</span><span v-else>📥 Import Backup</span>
          </button>
          <button class="btn btn-danger" @click="showClearConfirm = true">🗑️ Clear All Data</button>
        </div>
        <input ref="importFileInput" type="file" accept=".json" class="hidden" @change="handleImport" />
      </div>
    </details>

    <!-- GitHub link at bottom -->
    <div class="github-footer">
      <a
        href="https://github.com/jerrywang121/vocab-kids"
        target="_blank"
        rel="noopener noreferrer"
        class="github-footer-link"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" class="github-footer-icon">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
        </svg>
        View source on GitHub
      </a>
    </div>

    <!-- Clear confirm dialog -->
    <div v-if="showClearConfirm" class="modal-backdrop" @click.self="showClearConfirm = false">
      <div class="modal card-surface">
        <h2>⚠️ Clear All Data?</h2>
        <p class="text-muted">This will permanently delete all decks, cards, and progress. This cannot be undone.</p>
        <div class="flex gap-1 mt-2" style="justify-content:flex-end">
          <button class="btn btn-secondary" @click="showClearConfirm = false">Cancel</button>
          <button class="btn btn-danger" @click="clearAllData">Yes, Clear Everything</button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.settings-form { display: flex; flex-direction: column; gap: 1rem; }
.settings-section { overflow: hidden; }
.settings-section summary.section-summary {
  padding: 0.85rem 1.25rem;
  cursor: pointer;
  font-size: 1.05rem;
  font-weight: 800;
  list-style: none;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.settings-section summary.section-summary::-webkit-details-marker { display: none; }
.settings-section summary.section-summary::after {
  content: '›';
  font-size: 1.3rem;
  line-height: 1;
  color: var(--color-text-muted);
  transition: transform 0.2s;
}
.settings-section[open] summary.section-summary::after { transform: rotate(90deg); }
.settings-section[open] summary.section-summary {
  border-bottom: 1.5px solid var(--color-surface-alt);
}
.section-body { display: flex; flex-direction: column; gap: 0.9rem; padding: 1rem 1.25rem; }
.avatar-picker { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.avatar-option { cursor: pointer; }
.avatar-option input { display: none; }
.avatar-img {
  width: 56px; height: 56px;
  border-radius: 50%;
  border: 3px solid transparent;
  transition: border-color 0.15s;
  object-fit: cover;
}
.avatar-img.selected { border-color: var(--color-primary); }
.scheme-picker { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.scheme-option { cursor: pointer; }
.scheme-option input { display: none; }
.scheme-dot {
  display: inline-block;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 700;
  border: 2px solid transparent;
  background: var(--color-surface-alt);
  transition: border-color 0.15s;
}
.scheme-option input:checked + .scheme-dot { border-color: var(--color-primary); }
.theme-picker { display: flex; gap: 0.5rem; }
.theme-option { cursor: pointer; }
.theme-option input { display: none; }
.theme-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 1rem;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 700;
  border: 2px solid transparent;
  background: var(--color-surface-alt);
  transition: border-color 0.15s, background 0.15s;
  min-height: 44px;
}
.theme-option input:checked + .theme-btn {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
}
.range-labels { display: flex; justify-content: space-between; font-size: 0.8rem; }
.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  font-weight: 600;
}
.toggle-label input { width: 18px; height: 18px; cursor: pointer; }
.data-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.hidden { display: none; }
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 200; padding: 1rem;
}
.modal { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 1rem; }

/* AI Provider section */
.ai-provider-box {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1rem;
  border-radius: 12px;
  background: var(--color-surface-alt);
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
}
.ai-section-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
}
.provider-select,
.model-select {
  width: 100%;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  border: 1.5px solid var(--color-border, #ccc);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.95rem;
  min-height: 44px;
  font-family: inherit;
}
.input-readonly {
  background: var(--color-surface-alt);
  color: var(--color-text-muted, #888);
  cursor: default;
}
.badge-fixed {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary) 15%, transparent);
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  vertical-align: middle;
  margin-left: 0.4rem;
}
.models-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.models-msg {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-primary);
}
.models-msg.msg-error { color: var(--color-danger, #e53e3e); }
.ai-notice {
  font-size: 0.82rem;
  color: var(--color-text-muted, #888);
  background: color-mix(in srgb, #f59e0b 12%, transparent);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  margin: 0;
}
.ai-hint {
  font-size: 0.8rem;
  margin: 0.15rem 0 0;
}
.model-filter-input {
  margin-bottom: 0.35rem;
}
.model-select[size] {
  height: auto;
  min-height: 44px;
  max-height: 180px;
  overflow-y: auto;
}
.github-footer {
  display: flex;
  justify-content: center;
  padding: 1.5rem 0 0.5rem;
}
.github-footer-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 700;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  transition: background 0.15s, color 0.15s;
}
.github-footer-link:hover {
  background: var(--color-surface-alt);
  color: var(--color-text);
}
.github-footer-icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
  flex-shrink: 0;
}
</style>
