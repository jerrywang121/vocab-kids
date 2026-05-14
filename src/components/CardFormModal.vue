<script setup>
import { ref, watch, computed } from 'vue'
import { useSettingsStore } from '../stores/useSettingsStore'

const props = defineProps({
  modelValue: { type: Object, default: null }, // null = create mode
  deckId: { type: String, required: true },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'save', 'save-many', 'cancel'])

const settings = useSettingsStore()

const EMPTY = () => ({
  word: '', partOfSpeech: '', definition: '',
  synonyms: '', antonyms: '', exampleSentence: '',
  forms: {},
})

const form = ref(EMPTY())

// ── Part-of-speech aware form fields ────────────────────
const FORM_FIELDS_BY_POS = {
  verb:      ['Past Tense', 'Past Participle', '3rd Person Singular', 'Present Participle'],
  adjective: ['Comparative', 'Superlative'],
  noun:      ['Plural'],
}
const formFields = computed(() => FORM_FIELDS_BY_POS[form.value.partOfSpeech] ?? [])

// ── AI lookup state ──────────────────────────────────────
// 'form' | 'ai-loading' | 'ai-results'
const view = ref('form')
const aiError = ref('')
const aiResults = ref([])          // array of card objects from AI
const aiSelected = ref(new Set())  // indices of selected cards

const isEditMode = computed(() => !!props.modelValue)
const aiAvailable = computed(() =>
  !!settings.aiProvider && (!!settings.aiApiKey || settings.aiProvider === 'ollama')
)

watch(() => props.modelValue, (val) => {
  if (val) {
    form.value = {
      ...val,
      synonyms: (val.synonyms ?? []).join(', '),
      antonyms: (val.antonyms ?? []).join(', '),
      forms: (val.forms && typeof val.forms === 'object') ? { ...val.forms } : {},
    }
  } else {
    form.value = EMPTY()
  }
  view.value = 'form'
  aiResults.value = []
  aiSelected.value = new Set()
}, { immediate: true })

// ── AI lookup ────────────────────────────────────────────
async function runAILookup() {
  const word = form.value.word.trim()
  if (!word) return
  view.value = 'ai-loading'
  aiError.value = ''

  try {
    const { convertWordsToCards } = await import('../api/ai.js')

    const cards = await convertWordsToCards([word]) // pass as array for potential multi-word support

    if (!cards || cards.length === 0) {
      aiError.value = 'No results returned. Check your AI settings or try again.'
      view.value = 'form'
      return
    }

    aiResults.value = cards
    aiSelected.value = new Set(cards.map((_, i) => i)) // select all by default
    view.value = 'ai-results'
  } catch (err) {
    aiError.value = `Error: ${err.message}`
    view.value = 'form'
  }
}

function toggleSelect(i) {
  const s = new Set(aiSelected.value)
  s.has(i) ? s.delete(i) : s.add(i)
  aiSelected.value = s
}

function confirmAISelection() {
  const selected = aiResults.value.filter((_, i) => aiSelected.value.has(i))
  if (!selected.length) return
  emit('save-many', selected.map(c => ({
    ...c,
    synonyms: Array.isArray(c.synonyms) ? c.synonyms : [],
    antonyms: Array.isArray(c.antonyms) ? c.antonyms : [],
    forms: (c.forms && typeof c.forms === 'object') ? c.forms : {},
    deckId: props.deckId,
  })))
}

// ── Manual form submit ───────────────────────────────────
function submit() {
  const card = {
    ...form.value,
    deckId: props.deckId,
    synonyms: form.value.synonyms.split(',').map(s => s.trim()).filter(Boolean),
    antonyms: form.value.antonyms.split(',').map(s => s.trim()).filter(Boolean),
    forms: form.value.forms ?? {},
  }
  emit('save', card)
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('cancel')">
    <div class="modal card-surface">

      <!-- ── Form view ───────────────────────── -->
      <template v-if="view === 'form' || view === 'ai-loading'">
        <h2>{{ isEditMode ? '✏️ Edit Card' : '➕ Add Card' }}</h2>

        <form class="card-form" @submit.prevent="submit">
          <div class="form-field">
            <label>Word *</label>
            <div class="word-row">
              <input v-model="form.word" placeholder="e.g. abundant" required class="word-input" />
              <button
                v-if="!isEditMode && aiAvailable"
                type="button"
                class="btn btn-ai"
                :disabled="!form.word.trim() || view === 'ai-loading'"
                @click="runAILookup"
                title="Look up with AI"
              >
                <span v-if="view === 'ai-loading'">⏳</span>
                <span v-else>🤖 AI</span>
              </button>
            </div>
            <p v-if="aiError" class="ai-error">{{ aiError }}</p>
          </div>

          <div class="form-row">
            <div class="form-field">
              <label>Part of Speech</label>
              <select v-model="form.partOfSpeech">
                <option value="">—</option>
                <option>noun</option><option>verb</option><option>adjective</option>
                <option>adverb</option><option>pronoun</option><option>preposition</option>
                <option>conjunction</option><option>interjection</option>
                <option>idiom</option><option>phrasal verb</option>
                <option>adverbial phrase</option>  
              </select>
            </div>
          </div>

          <div class="form-field">
            <label>Definition *</label>
            <textarea v-model="form.definition" rows="2" placeholder="Meaning of the word" required />
          </div>

          <div class="form-field">
            <label>Example Sentence</label>
            <textarea v-model="form.exampleSentence" rows="2" placeholder="Use the word in a sentence..." />
          </div>

          <div class="form-field">
            <label>Synonyms <span class="text-muted">(comma-separated)</span></label>
            <input v-model="form.synonyms" placeholder="e.g. plentiful, ample, rich" />
          </div>

          <div class="form-field">
            <label>Antonyms <span class="text-muted">(comma-separated)</span></label>
            <input v-model="form.antonyms" placeholder="e.g. scarce, rare, lacking" />
          </div>

          <div v-if="formFields.length" class="form-field">
            <label>Word Forms <span class="text-muted">({{ form.partOfSpeech }})</span></label>
            <div class="forms-grid">
              <template v-for="key in formFields" :key="key">
                <span class="form-key-label">{{ key }}</span>
                <input
                  :value="form.forms[key] ?? ''"
                  :placeholder="key"
                  class="form-key-input"
                  @input="form.forms = { ...form.forms, [key]: $event.target.value }"
                />
              </template>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="emit('cancel')">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="loading || view === 'ai-loading'">
              <span v-if="loading">⏳ Enriching…</span>
              <span v-else>{{ isEditMode ? 'Save Changes' : 'Add Card' }}</span>
            </button>
          </div>
        </form>
      </template>

      <!-- ── AI results picker ───────────────── -->
      <template v-else-if="view === 'ai-results'">
        <div class="ai-results-header">
          <h2>🤖 AI Results for "{{ form.word }}"</h2>
          <p class="text-muted ai-subtitle">
            {{ aiResults.length }} definition{{ aiResults.length !== 1 ? 's' : '' }} found.
            Select the cards you want to add.
          </p>
        </div>

        <div class="ai-card-list">
          <label
            v-for="(card, i) in aiResults"
            :key="i"
            class="ai-card-option card-surface"
            :class="{ selected: aiSelected.has(i) }"
          >
            <input
              type="checkbox"
              :checked="aiSelected.has(i)"
              @change="toggleSelect(i)"
              class="ai-checkbox"
            />
            <div class="ai-card-body">
              <div class="ai-card-top">
                <span class="card-word">{{ card.word }}</span>
                <span v-if="card.partOfSpeech" class="pos-badge">{{ card.partOfSpeech }}</span>
              </div>
              <p class="card-def">{{ card.definition }}</p>
              <p v-if="card.exampleSentence" class="card-example text-muted">"{{ card.exampleSentence }}"</p>
              <div v-if="card.synonyms?.length || card.antonyms?.length" class="tag-row">
                <span v-if="card.synonyms?.length" class="tag syn">↑ {{ card.synonyms.slice(0,4).join(', ') }}</span>
                <span v-if="card.antonyms?.length" class="tag ant">↓ {{ card.antonyms.slice(0,4).join(', ') }}</span>
              </div>
              <div v-if="card.forms && Object.keys(card.forms).length" class="forms-row">
                <span v-for="(val, key) in card.forms" :key="key" class="form-tag">
                  <span class="form-label">{{ key }}:</span> {{ val }}
                </span>
              </div>
            </div>
          </label>
        </div>

        <div class="form-actions">
          <button class="btn btn-secondary" @click="view = 'form'">← Back</button>
          <button
            class="btn btn-primary"
            :disabled="aiSelected.size === 0"
            @click="confirmAISelection"
          >
            ✅ Add {{ aiSelected.size }} Card{{ aiSelected.size !== 1 ? 's' : '' }}
          </button>
        </div>
      </template>

    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
}
.modal {
  width: 100%;
  max-width: 540px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.card-form { display: flex; flex-direction: column; gap: 0.9rem; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

/* ── Word row with AI button ── */
.word-row { display: flex; gap: 0.5rem; align-items: center; }
.word-input { flex: 1; }
.btn-ai {
  flex-shrink: 0;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 0.75rem;
  padding: 0 1rem;
  font-family: 'Nunito', sans-serif;
  font-weight: 800;
  font-size: 0.9rem;
  cursor: pointer;
  min-height: 44px;
  transition: background 0.15s, opacity 0.15s;
}
.btn-ai:hover:not(:disabled) { background: var(--color-primary-dark); }
.btn-ai:disabled { opacity: 0.5; cursor: not-allowed; }

.ai-error { color: #c62828; font-size: 0.85rem; margin-top: 0.3rem; }

/* ── AI results ── */
.ai-results-header { display: flex; flex-direction: column; gap: 0.3rem; }
.ai-subtitle { font-size: 0.9rem; }

.ai-card-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  max-height: 55vh;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.ai-card-option {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-radius: 1rem;
  border: 2px solid var(--color-surface-alt);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.ai-card-option.selected {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
}
.ai-card-option:hover { border-color: var(--color-primary); }

.ai-checkbox {
  margin-top: 0.25rem;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  accent-color: var(--color-primary);
  cursor: pointer;
}

.ai-card-body { flex: 1; display: flex; flex-direction: column; gap: 0.3rem; }
.ai-card-top { display: flex; align-items: center; gap: 0.5rem; }

.card-word { font-weight: 800; font-size: 1.05rem; }
.pos-badge {
  display: inline-block;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--color-surface-alt);
  color: var(--color-text-muted);
}
.card-def { font-size: 0.9rem; }
.card-example { font-size: 0.85rem; font-style: italic; }
.tag-row { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.2rem; }
.tag {
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-weight: 700;
}
.syn { background: #e8f5e9; color: #2e7d32; }
.ant { background: #fce4ec; color: #c62828; }
.forms-row { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.2rem; }
.form-tag {
  font-size: 0.72rem;
  padding: 0.12rem 0.5rem;
  border-radius: 999px;
  background: var(--color-surface-alt);
  color: var(--color-text);
  font-weight: 600;
}
.form-label { color: var(--color-text-muted); font-weight: 700; }
.forms-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.4rem 0.6rem;
  align-items: center;
}
.form-key-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--color-text-muted);
  white-space: nowrap;
}
.form-key-input {
  font-size: 0.9rem;
  padding: 0.3rem 0.6rem;
  border: 2px solid var(--color-surface-alt);
  border-radius: 0.5rem;
  background: var(--color-surface);
  color: var(--color-text);
  font-family: 'Nunito', sans-serif;
  min-height: 36px;
}
.form-key-input:focus { outline: none; border-color: var(--color-primary); }
</style>

