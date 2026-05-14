<script setup>
import { ref, computed } from 'vue'
import { useDecksStore }    from '../stores/useDecksStore'
import { useCardsStore }    from '../stores/useCardsStore'
import { useProgressStore } from '../stores/useProgressStore'
import { useEnrich }        from '../composables/useEnrich'
import { convertWordsToCards } from '../api/ai.js'
import DeckCard       from '../components/DeckCard.vue'
import DeckFormModal  from '../components/DeckFormModal.vue'
import CardFormModal  from '../components/CardFormModal.vue'

const decksStore    = useDecksStore()
const cardsStore    = useCardsStore()
const progressStore = useProgressStore()
const { enrich }    = useEnrich()

// ── Deck management ──────────────────────────────────────
const activeDeck       = ref(null)
const showDeckForm     = ref(false)
const editingDeck      = ref(null)
const confirmDeleteDeck = ref(null)

function openNewDeck()       { editingDeck.value = null; showDeckForm.value = true }
function openEditDeck(deck)  { editingDeck.value = deck; showDeckForm.value = true }

function saveDeck(formData) {
  if (editingDeck.value) {
    decksStore.updateDeck(editingDeck.value.id, formData)
  } else {
    decksStore.addDeck(formData)
  }
  showDeckForm.value = false
}

function deleteDeck(deck) {
  const cardIds = cardsStore.cardsForDeck(deck.id).map(c => c.id)
  progressStore.deleteProgressForCards(cardIds)
  cardsStore.deleteCardsForDeck(deck.id)
  decksStore.deleteDeck(deck.id)
  if (activeDeck.value?.id === deck.id) activeDeck.value = null
  confirmDeleteDeck.value = null
}

// ── Card management ──────────────────────────────────────
const deckCards      = computed(() => activeDeck.value ? cardsStore.cardsForDeck(activeDeck.value.id) : [])
const showCardForm   = ref(false)
const editingCard    = ref(null)
const cardLoading    = ref(false)
const confirmDeleteCard = ref(null)
const cardSearch     = ref('')

const filteredCards = computed(() => {
  const q = cardSearch.value.trim().toLowerCase()
  if (!q) return deckCards.value
  return deckCards.value.filter(c =>
    c.word.toLowerCase().includes(q) || c.definition.toLowerCase().includes(q)
  )
})

function openNewCard()       { editingCard.value = null; showCardForm.value = true }
function openEditCard(card)  { editingCard.value = card; showCardForm.value = true }

async function saveCard(formData) {
  cardLoading.value = true
  try {
    const enriched = await enrich(formData.word, formData)
    const merged = { ...formData, ...enriched }
    if (editingCard.value) {
      cardsStore.updateCard(editingCard.value.id, merged)
    } else {
      const added = cardsStore.addCard({ ...merged, deckId: activeDeck.value.id })
      if (!added) {
        alert(`"${formData.word}" with this definition already exists in this deck.`)
        return
      }
    }
    showCardForm.value = false
  } finally {
    cardLoading.value = false
  }
}

async function saveManyCards(cards) {
  cardLoading.value = true
  try {
    let added = 0, skipped = 0
    for (const card of cards) {
      const result = cardsStore.addCard({ ...card, deckId: activeDeck.value.id })
      result ? added++ : skipped++
    }
    showCardForm.value = false
    if (skipped) alert(`Added ${added} card${added !== 1 ? 's' : ''}. ${skipped} skipped (already in deck).`)
  } finally {
    cardLoading.value = false
  }
}

function deleteCard(card) {
  progressStore.deleteProgressForCards([card.id])
  cardsStore.deleteCard(card.id)
  confirmDeleteCard.value = null
}

// ── Bulk import ──────────────────────────────────────────
const importInput    = ref(null)
const importStatus   = ref('')
const importLoading  = ref(false)

function triggerImport() { importInput.value.click() }

async function handleImport(e) {
  const file = e.target.files[0]
  if (!file || !activeDeck.value) return
  importLoading.value = true
  importStatus.value = ''
  try {
    const text = await file.text()
    let rows = []

    if (file.name.endsWith('.json')) {
      const parsed = JSON.parse(text)
      rows = Array.isArray(parsed) ? parsed : parsed.cards ?? []
    } else if (file.name.endsWith('.txt')) {
      // Word-list format: one word / term per line; use AI to generate full cards
      const words = text.split('\n').map(l => l.trim()).filter(Boolean)
      if (!words.length) { importStatus.value = '⚠️ No words found in file.'; return }

      // Reject words already in the deck (case-insensitive)
      const existingWords = new Set(deckCards.value.map(c => c.word.toLowerCase()))
      const newWords = words.filter(w => !existingWords.has(w.toLowerCase()))
      const alreadyExist = words.length - newWords.length

      if (!newWords.length) {
        importStatus.value = `⚠️ All ${words.length} word${words.length !== 1 ? 's' : ''} already exist in this deck.`
        return
      }

      importStatus.value = `⏳ Generating cards for ${newWords.length} word${newWords.length !== 1 ? 's' : ''} via AI…`

      const BATCH = 5
      let added = 0, skipped = 0, errors = 0
      for (let i = 0; i < newWords.length; i += BATCH) {
        const batch = newWords.slice(i, i + BATCH)
        importStatus.value = `⏳ Processing words ${i + 1}–${Math.min(i + BATCH, newWords.length)} of ${newWords.length}…`
        try {
          const cards = await convertWordsToCards(batch)
          if (!cards) { errors += batch.length; continue }
          for (const card of cards) {
            const result = cardsStore.addCard({ ...card, deckId: activeDeck.value.id })
            result ? added++ : skipped++
          }
        } catch (err) {
          importStatus.value = `❌ AI error: ${err.message}`
          return
        }
      }

      importStatus.value = `✅ Imported ${added} card${added !== 1 ? 's' : ''}${alreadyExist ? ` (${alreadyExist} word${alreadyExist !== 1 ? 's' : ''} already in deck)` : ''}${skipped ? ` (${skipped} duplicates skipped)` : ''}${errors ? ` (${errors} words failed)` : ''}.`
      return
    } else {
      // CSV: first line = headers
      const lines = text.trim().split('\n')
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, ''))
      rows = lines.slice(1).map(line => {
        const vals = line.split(',')
        return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]))
      })
    }

    let added = 0, skipped = 0
    for (const row of rows) {
      const word = row.word?.trim()
      if (!word) { skipped++; continue }
      const base = {
        word,
        partOfSpeech:    row.partofspeech ?? row.partOfSpeech ?? '',
        forms:           (row.forms && typeof row.forms === 'object') ? row.forms : {},
        definition:      row.definition ?? '',
        synonyms:        typeof row.synonyms === 'string' ? row.synonyms.split(';').map(s => s.trim()).filter(Boolean) : (row.synonyms ?? []),
        antonyms:        typeof row.antonyms === 'string' ? row.antonyms.split(';').map(s => s.trim()).filter(Boolean) : (row.antonyms ?? []),
        exampleSentence: row.examplesentence ?? row.exampleSentence ?? '',
        deckId: activeDeck.value.id,
      }
      const enriched = await enrich(word, base)
      const result = cardsStore.addCard({ ...base, ...enriched })
      result ? added++ : skipped++
    }
    importStatus.value = `✅ Imported ${added} card${added !== 1 ? 's' : ''}${skipped ? ` (${skipped} skipped as duplicates)` : ''}.`
  } catch (err) {
    importStatus.value = `❌ Import failed: ${err.message}`
  } finally {
    importLoading.value = false
    e.target.value = ''
  }
}

// ── Helpers ──────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return null
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1)    return 'just now'
  if (mins < 60)   return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)    return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30)   return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

// ── Data export / import (full backup) ───────────────────
function exportData() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    decks: decksStore.decks,
    cards: cardsStore.cards,
    progress: progressStore.progress,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `vocabkids-backup-${new Date().toISOString().slice(0,10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <main class="page">
    <!-- ── Header ─────────────────────────── -->
    <div class="flex items-center justify-between">
      <h1>{{ activeDeck ? `📖 ${activeDeck.name}` : '📖 Manage' }}</h1>
      <div class="flex gap-1">
        <button v-if="activeDeck" class="btn btn-secondary" @click="activeDeck = null">← Decks</button>
        <button v-if="!activeDeck" class="btn btn-primary" @click="openNewDeck">+ New Deck</button>
        <button v-if="activeDeck" class="btn btn-primary" @click="openNewCard">+ Add Card</button>
        <button v-if="activeDeck" class="btn btn-ghost" title="Import CSV, JSON or TXT word list" @click="triggerImport">
          <span v-if="importLoading">⏳</span><span v-else>📥 Import</span>
        </button>
      </div>
    </div>

    <!-- ── Deck grid ──────────────────────── -->
    <template v-if="!activeDeck">
      <p v-if="!decksStore.decks.length" class="text-muted mt-2">
        No decks yet — create your first one!
      </p>
      <div class="grid-2 mt-2">
        <DeckCard
          v-for="deck in decksStore.decks"
          :key="deck.id"
          :deck="deck"
          :card-count="cardsStore.cardsForDeck(deck.id).length"
          :unique-count="cardsStore.uniqueCardCount(deck.id)"
          @select="activeDeck = $event"
          @edit="openEditDeck"
          @delete="confirmDeleteDeck = $event"
        />
      </div>
    </template>

    <!-- ── Card list ──────────────────────── -->
    <template v-else>
      <input
        v-model="cardSearch"
        class="search-input mt-2"
        placeholder="🔍 Search cards…"
      />
      <p v-if="importStatus" class="import-status mt-1">{{ importStatus }}</p>

      <!-- Import format hints + template downloads -->
      <details class="import-hint mt-2">
        <summary>📋 Import format guide &amp; templates</summary>
        <div class="hint-body">
          <div class="hint-section">
            <strong>TXT</strong> — plain word list, one word / term per line.
            Cards are generated automatically via AI (requires AI configured in Settings).
            Words are sent in batches of 5 for efficiency.
            <pre class="hint-code">abundant
serendipity
ephemeral
run fast</pre>
          </div>
          <div class="hint-section">
            <strong>CSV</strong> — one word per row, comma-separated.
            Synonyms &amp; antonyms use <code>;</code> as a separator within a cell.
            Only <code>word</code> is required; missing fields are auto-filled via the Dictionary API.
            <pre class="hint-code">word,definition,partOfSpeech,synonyms,antonyms,exampleSentence
abundant,present in large quantities,adjective,plentiful;ample,scarce;rare,The forest had abundant wildlife.</pre>
          </div>
          <div class="hint-section">
            <strong>JSON</strong> — an array of card objects (or an object with a <code>cards</code> key).
            <code>synonyms</code> and <code>antonyms</code> are string arrays.
            <pre class="hint-code">[{ "word": "abundant", "definition": "present in large quantities",
  "partOfSpeech": "adjective", "synonyms": ["plentiful","ample"],
  "antonyms": ["scarce","rare"], "exampleSentence": "The forest had abundant wildlife." }]</pre>
          </div>
          <div class="hint-downloads">
            <span class="text-muted" style="font-size:0.85rem">Download starter templates:</span>
            <a href="/templates/sample-cards.csv" download class="btn btn-secondary" style="font-size:0.85rem;padding:0.3rem 0.75rem">⬇️ CSV template</a>
            <a href="/templates/sample-cards.json" download class="btn btn-secondary" style="font-size:0.85rem;padding:0.3rem 0.75rem">⬇️ JSON template</a>
          </div>
        </div>
      </details>

      <p v-if="!deckCards.length" class="text-muted mt-2">
        No cards yet — add your first card or import a CSV/JSON file.
      </p>

      <div class="card-list mt-2">
        <div
          v-for="card in filteredCards"
          :key="card.id"
          class="card-row card-surface"
        >
          <div class="card-row-main">
            <div>
              <span class="card-word">{{ card.word }}</span>
              <span v-if="card.partOfSpeech" class="pos-badge">{{ card.partOfSpeech }}</span>
            </div>
            <p class="card-def text-muted">{{ card.definition }}</p>
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
            <div class="card-progress text-muted">
              <template v-if="progressStore.getProgress(card.id)">
                <span>✅ {{ progressStore.getProgress(card.id).correctCount }}</span>
                <span>❌ {{ progressStore.getProgress(card.id).wrongCount }}</span>
                <span>🎯 {{ (progressStore.cardScore(card.id) * 100).toFixed(0) }}%</span>
                <span v-if="progressStore.getProgress(card.id).lastCorrectAt">· correct {{ timeAgo(progressStore.getProgress(card.id).lastCorrectAt) }}</span>
                <span v-if="progressStore.getProgress(card.id).lastWrongAt">· wrong {{ timeAgo(progressStore.getProgress(card.id).lastWrongAt) }}</span>
                <span v-if="progressStore.getProgress(card.id).lastReviewedAt">· reviewed {{ timeAgo(progressStore.getProgress(card.id).lastReviewedAt) }}</span>
              </template>
              <template v-else><span>Not studied yet</span></template>
            </div>
          </div>
          <div class="card-row-actions">
            <button class="icon-btn" @click="openEditCard(card)">✏️</button>
            <button class="icon-btn" @click="confirmDeleteCard = card">🗑️</button>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Hidden import file input ──────── -->
    <input ref="importInput" type="file" accept=".csv,.json,.txt" class="hidden" @change="handleImport" />

    <!-- ── Deck form modal ────────────────── -->
    <DeckFormModal
      v-if="showDeckForm"
      :deck="editingDeck"
      @save="saveDeck"
      @cancel="showDeckForm = false"
    />

    <!-- ── Card form modal ────────────────── -->
    <CardFormModal
      v-if="showCardForm"
      :model-value="editingCard"
      :deck-id="activeDeck?.id ?? ''"
      :loading="cardLoading"
      @save="saveCard"
      @save-many="saveManyCards"
      @cancel="showCardForm = false"
    />

    <!-- ── Confirm delete deck ────────────── -->
    <div v-if="confirmDeleteDeck" class="modal-backdrop" @click.self="confirmDeleteDeck = null">
      <div class="modal card-surface">
        <h2>🗑️ Delete Deck?</h2>
        <p class="text-muted">
          Delete <strong>{{ confirmDeleteDeck.name }}</strong> and all
          {{ cardsStore.cardsForDeck(confirmDeleteDeck.id).length }} cards inside?
          This cannot be undone.
        </p>
        <div class="flex gap-1 justify-end mt-2">
          <button class="btn btn-secondary" @click="confirmDeleteDeck = null">Cancel</button>
          <button class="btn btn-danger" @click="deleteDeck(confirmDeleteDeck)">Delete</button>
        </div>
      </div>
    </div>

    <!-- ── Confirm delete card ────────────── -->
    <div v-if="confirmDeleteCard" class="modal-backdrop" @click.self="confirmDeleteCard = null">
      <div class="modal card-surface">
        <h2>🗑️ Delete Card?</h2>
        <p class="text-muted">
          Delete <strong>{{ confirmDeleteCard.word }}</strong>? This cannot be undone.
        </p>
        <div class="flex gap-1 justify-end mt-2">
          <button class="btn btn-secondary" @click="confirmDeleteCard = null">Cancel</button>
          <button class="btn btn-danger" @click="deleteCard(confirmDeleteCard)">Delete</button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.search-input {
  width: 100%;
  padding: 0.6rem 1rem;
  border: 2px solid var(--color-surface-alt);
  border-radius: 999px;
  font-family: 'Nunito', sans-serif;
  font-size: 1rem;
  background: var(--color-surface);
  color: var(--color-text);
  min-height: 44px;
}
.search-input:focus { outline: none; border-color: var(--color-primary); }
.card-list { display: flex; flex-direction: column; gap: 0.75rem; }
.card-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
}
.card-row-main { flex: 1; display: flex; flex-direction: column; gap: 0.3rem; }
.card-row-actions { display: flex; gap: 0.25rem; flex-shrink: 0; }
.card-word { font-weight: 800; font-size: 1.05rem; }
.pos-badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--color-surface-alt);
  color: var(--color-text-muted);
}
.card-def { font-size: 0.9rem; }
.card-example { font-size: 0.85rem; font-style: italic; }
.card-progress { font-size: 0.78rem; display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.25rem; }
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
.icon-btn {
  background: none; border: none; cursor: pointer;
  font-size: 1rem; min-height: 36px; min-width: 36px;
  border-radius: 0.5rem; transition: background 0.15s;
}
.icon-btn:hover { background: var(--color-surface-alt); }
.import-status { font-size: 0.9rem; font-weight: 600; }
.hidden { display: none; }

/* ── Import hint ────────────────────────────────────── */
.import-hint {
  border: 2px solid var(--color-surface-alt);
  border-radius: 1rem;
  overflow: hidden;
}
.import-hint summary {
  padding: 0.65rem 1rem;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.9rem;
  background: var(--color-surface);
  list-style: none;
  user-select: none;
}
.import-hint summary::-webkit-details-marker { display: none; }
.import-hint[open] summary { border-bottom: 2px solid var(--color-surface-alt); }
.hint-body {
  background: var(--color-surface);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.hint-section { display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.875rem; }
.hint-code {
  background: var(--color-surface-alt);
  border-radius: 0.6rem;
  padding: 0.6rem 0.8rem;
  font-size: 0.78rem;
  font-family: 'Courier New', monospace;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
}
code {
  background: var(--color-surface-alt);
  padding: 0.1rem 0.35rem;
  border-radius: 0.3rem;
  font-size: 0.82rem;
  font-family: 'Courier New', monospace;
}
.hint-downloads {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
}
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 200; padding: 1rem;
}
.modal { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 1rem; }
.justify-end { justify-content: flex-end; }
</style>
