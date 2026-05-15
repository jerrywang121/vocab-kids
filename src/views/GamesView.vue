<script setup>
import { ref, computed } from 'vue'
import { useDecksStore } from '../stores/useDecksStore'
import { useCardsStore } from '../stores/useCardsStore'

const decksStore = useDecksStore()
const cardsStore = useCardsStore()

// ── State machine: 'hub' | 'hangman-select' | 'hangman-play' | 'hangman-result'
const phase = ref('hub')
const selectedDeckId = ref(null)
const secretWord = ref('')
const guessedLetters = ref(new Set())
const wrongCount = ref(0)
const MAX_WRONG = 6

// ── Computed helpers
const selectedDeck = computed(() => decksStore.decks.find(d => d.id === selectedDeckId.value))

const normalised = computed(() => secretWord.value.toUpperCase())

const displayLetters = computed(() =>
  normalised.value.split('').map(ch => (/[A-Z]/.test(ch) ? ch : ' '))
)

const revealed = computed(() =>
  displayLetters.value.map(ch => (ch === ' ' || guessedLetters.value.has(ch) ? ch : '_'))
)

const wrongLetters = computed(() =>
  [...guessedLetters.value].filter(l => !normalised.value.includes(l))
)

const won = computed(() => revealed.value.join('') === displayLetters.value.join(''))
const lost = computed(() => wrongCount.value >= MAX_WRONG)

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

// ── Pick a random word from deck
function startHangman(deckId) {
  const cards = cardsStore.cardsForDeck(deckId)
  if (!cards.length) return
  const card = cards[Math.floor(Math.random() * cards.length)]
  selectedDeckId.value = deckId
  secretWord.value = card.word.trim()
  guessedLetters.value = new Set()
  wrongCount.value = 0
  phase.value = 'hangman-play'
}

function guess(letter) {
  if (guessedLetters.value.has(letter) || won.value || lost.value) return
  guessedLetters.value = new Set([...guessedLetters.value, letter])
  if (!normalised.value.includes(letter)) wrongCount.value++
  if (won.value || lost.value) phase.value = 'hangman-result'
}

function playAgain() {
  startHangman(selectedDeckId.value)
}

function goHub() {
  phase.value = 'hub'
  selectedDeckId.value = null
}

// ── Hangman SVG parts (cumulative, 1 per wrong guess)
const hangmanParts = computed(() => {
  const parts = []
  const n = wrongCount.value
  if (n >= 1) parts.push('head')
  if (n >= 2) parts.push('body')
  if (n >= 3) parts.push('left-arm')
  if (n >= 4) parts.push('right-arm')
  if (n >= 5) parts.push('left-leg')
  if (n >= 6) parts.push('right-leg')
  return parts
})
</script>

<template>
  <main class="page">

    <!-- ═══════════════ HUB ═══════════════ -->
    <template v-if="phase === 'hub'">
      <h1>🎮 Games</h1>
      <p class="text-muted mt-1">Fun word games to practise your vocabulary!</p>

      <div class="game-grid mt-3">
        <!-- Hangman card -->
        <button class="game-card card-surface" @click="phase = 'hangman-select'">
          <div class="game-icon">🪢</div>
          <div class="game-info">
            <h2 class="game-title">Hangman</h2>
            <p class="game-desc text-muted">Guess the word one letter at a time before the man is hanged!</p>
          </div>
          <span class="game-arrow">›</span>
        </button>

        <!-- Placeholder for future games -->
        <div class="game-card card-surface game-coming-soon">
          <div class="game-icon">🔤</div>
          <div class="game-info">
            <h2 class="game-title">Word Scramble</h2>
            <p class="game-desc text-muted">Coming soon…</p>
          </div>
          <span class="game-badge">Soon</span>
        </div>

        <div class="game-card card-surface game-coming-soon">
          <div class="game-icon">⚡</div>
          <div class="game-info">
            <h2 class="game-title">Speed Spell</h2>
            <p class="game-desc text-muted">Coming soon…</p>
          </div>
          <span class="game-badge">Soon</span>
        </div>
      </div>
    </template>

    <!-- ═══════════════ HANGMAN – DECK SELECT ═══════════════ -->
    <template v-else-if="phase === 'hangman-select'">
      <div class="back-row">
        <button class="btn btn-ghost" @click="goHub">← Back</button>
      </div>
      <h1>🪢 Hangman</h1>
      <p class="text-muted mt-1">Choose a deck to play with:</p>

      <p v-if="!decksStore.decks.length" class="text-muted mt-2">
        No decks yet — <RouterLink to="/manage">create one first</RouterLink>.
      </p>

      <div class="deck-list mt-2">
        <button
          v-for="deck in decksStore.decks"
          :key="deck.id"
          class="deck-btn card-surface"
          :disabled="!cardsStore.cardsForDeck(deck.id).length"
          @click="startHangman(deck.id)"
        >
          <span class="deck-name">{{ deck.name }}</span>
          <span class="deck-count text-muted">
            {{ cardsStore.cardsForDeck(deck.id).length }} cards
            <span v-if="!cardsStore.cardsForDeck(deck.id).length">&nbsp;(empty)</span>
          </span>
        </button>
      </div>
    </template>

    <!-- ═══════════════ HANGMAN – PLAY ═══════════════ -->
    <template v-else-if="phase === 'hangman-play' || phase === 'hangman-result'">
      <div class="back-row">
        <button class="btn btn-ghost" @click="phase = 'hangman-select'">← Decks</button>
        <span class="deck-tag text-muted">{{ selectedDeck?.name }}</span>
      </div>

      <div class="hangman-layout mt-2">

        <!-- Gallows SVG -->
        <div class="gallows-wrap">
          <svg viewBox="0 0 120 130" class="gallows-svg" aria-hidden="true">
            <!-- Scaffold -->
            <line x1="10"  y1="125" x2="110" y2="125" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
            <line x1="30"  y1="125" x2="30"  y2="10"  stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
            <line x1="30"  y1="10"  x2="75"  y2="10"  stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
            <line x1="75"  y1="10"  x2="75"  y2="25"  stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
            <!-- Head -->
            <circle
              v-if="hangmanParts.includes('head')"
              cx="75" cy="35" r="10"
              stroke="var(--color-primary)" stroke-width="3" fill="none"
              class="part-animate"
            />
            <!-- Body -->
            <line
              v-if="hangmanParts.includes('body')"
              x1="75" y1="45" x2="75" y2="80"
              stroke="var(--color-primary)" stroke-width="3" stroke-linecap="round"
              class="part-animate"
            />
            <!-- Left arm -->
            <line
              v-if="hangmanParts.includes('left-arm')"
              x1="75" y1="55" x2="55" y2="68"
              stroke="var(--color-primary)" stroke-width="3" stroke-linecap="round"
              class="part-animate"
            />
            <!-- Right arm -->
            <line
              v-if="hangmanParts.includes('right-arm')"
              x1="75" y1="55" x2="95" y2="68"
              stroke="var(--color-primary)" stroke-width="3" stroke-linecap="round"
              class="part-animate"
            />
            <!-- Left leg -->
            <line
              v-if="hangmanParts.includes('left-leg')"
              x1="75" y1="80" x2="55" y2="100"
              stroke="var(--color-primary)" stroke-width="3" stroke-linecap="round"
              class="part-animate"
            />
            <!-- Right leg -->
            <line
              v-if="hangmanParts.includes('right-leg')"
              x1="75" y1="80" x2="95" y2="100"
              stroke="var(--color-primary)" stroke-width="3" stroke-linecap="round"
              class="part-animate"
            />
          </svg>
          <p class="wrong-count text-muted">{{ wrongCount }} / {{ MAX_WRONG }} wrong</p>
        </div>

        <!-- Word + keyboard -->
        <div class="word-side">
          <!-- Blanks -->
          <div class="word-display">
            <span
              v-for="(ch, i) in revealed"
              :key="i"
              class="letter-slot"
              :class="{ 'is-space': displayLetters[i] === ' ', 'is-revealed': ch !== '_' && ch !== ' ' }"
            >{{ ch === '_' ? '' : ch }}</span>
          </div>

          <!-- Wrong letters -->
          <p v-if="wrongLetters.length" class="wrong-letters text-muted mt-1">
            ❌ {{ wrongLetters.join('  ') }}
          </p>

          <!-- Alphabet keyboard -->
          <div class="keyboard mt-2">
            <button
              v-for="letter in alphabet"
              :key="letter"
              class="key-btn"
              :class="{
                'key-correct': guessedLetters.has(letter) && normalised.includes(letter),
                'key-wrong':   guessedLetters.has(letter) && !normalised.includes(letter),
                'key-used':    guessedLetters.has(letter),
              }"
              :disabled="guessedLetters.has(letter) || phase === 'hangman-result'"
              @click="guess(letter)"
            >{{ letter }}</button>
          </div>
        </div>
      </div>

      <!-- Result overlay -->
      <div v-if="phase === 'hangman-result'" class="result-banner card-surface mt-3 text-center">
        <template v-if="won">
          <div class="result-emoji">🎉</div>
          <h2 class="result-title">You got it!</h2>
          <p class="result-word">{{ secretWord }}</p>
        </template>
        <template v-else>
          <div class="result-emoji">😢</div>
          <h2 class="result-title">Better luck next time!</h2>
          <p class="text-muted" style="font-size:0.9rem">The word was</p>
          <p class="result-word">{{ secretWord }}</p>
        </template>

        <div class="flex gap-2 mt-3" style="flex-wrap:wrap;justify-content:center">
          <button class="btn btn-primary" @click="playAgain">🔄 Play Again</button>
          <button class="btn btn-ghost" @click="phase = 'hangman-select'">Change Deck</button>
          <button class="btn btn-ghost" @click="goHub">🎮 All Games</button>
        </div>
      </div>
    </template>

  </main>
</template>

<style scoped>
/* ── Game hub grid ───────────────────────── */
.game-grid {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.game-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  background: var(--color-surface);
  color: var(--color-text);
  border: none;
  cursor: pointer;
  text-align: left;
  transition: transform 0.15s, box-shadow 0.15s;
  min-height: 72px;
}
.game-card:hover:not(.game-coming-soon) {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0,0,0,0.1);
}
.game-coming-soon { opacity: 0.5; cursor: default; }
.game-icon { font-size: 2rem; flex-shrink: 0; }
.game-info { flex: 1; }
.game-title { font-family: 'Fredoka One', cursive; font-size: 1.15rem; color: var(--color-primary); margin-bottom: 0.15rem; }
.game-desc { font-size: 0.85rem; }
.game-arrow { font-size: 1.5rem; color: var(--color-primary); font-weight: 900; flex-shrink: 0; }
.game-badge {
  font-size: 0.72rem;
  font-weight: 700;
  background: var(--color-surface-alt);
  color: var(--color-text-muted);
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  flex-shrink: 0;
}

/* ── Deck list (shared style with QuizView) ── */
.back-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}
.deck-tag {
  font-size: 0.85rem;
  font-weight: 700;
}
.deck-list { display: flex; flex-direction: column; gap: 0.75rem; }
.deck-btn {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; background: var(--color-surface); color: var(--color-text); border: none;
  cursor: pointer; text-align: left; transition: transform 0.15s, box-shadow 0.15s; min-height: 44px;
}
.deck-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.1); }
.deck-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.deck-name { font-weight: 800; font-size: 1rem; }
.deck-count { font-size: 0.85rem; }

/* ── Hangman layout ──────────────────────── */
.hangman-layout {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

/* Gallows */
.gallows-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}
.gallows-svg {
  width: 140px;
  height: 150px;
  color: var(--color-text);
}
.wrong-count {
  font-size: 0.8rem;
  margin-top: 0.35rem;
}
.part-animate {
  animation: pop-in 0.25s ease-out;
}
@keyframes pop-in {
  from { opacity: 0; transform: scale(0.5); }
  to   { opacity: 1; transform: scale(1); }
}

/* Word display */
.word-side { flex: 1; min-width: 220px; }

.word-display {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: flex-end;
}
.letter-slot {
  display: inline-flex;
  align-items: flex-end;
  justify-content: center;
  width: 2rem;
  height: 2.6rem;
  border-bottom: 3px solid var(--color-primary);
  font-family: 'Fredoka One', cursive;
  font-size: 1.4rem;
  color: var(--color-primary);
  transition: color 0.2s;
  text-transform: uppercase;
}
.letter-slot.is-space {
  border-bottom-color: transparent;
  width: 1rem;
}
.letter-slot.is-revealed {
  animation: letter-pop 0.3s ease-out;
}
@keyframes letter-pop {
  0%   { transform: scale(0.5) translateY(4px); opacity: 0; }
  60%  { transform: scale(1.2) translateY(-2px); opacity: 1; }
  100% { transform: scale(1) translateY(0); }
}

.wrong-letters {
  font-family: 'Fredoka One', cursive;
  font-size: 0.95rem;
  letter-spacing: 0.05em;
}

/* Keyboard */
.keyboard {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  max-width: 380px;
}
.key-btn {
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 0.5rem;
  border: 2px solid var(--color-surface-alt);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: 'Fredoka One', cursive;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s, opacity 0.12s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.key-btn:hover:not(:disabled):not(.key-used) {
  border-color: var(--color-primary);
  background: var(--color-surface-alt);
}
.key-btn.key-correct {
  background: #e8f5e9;
  border-color: #388e3c;
  color: #1b5e20;
}
.key-btn.key-wrong {
  background: #ffebee;
  border-color: #d32f2f;
  color: #b71c1c;
  opacity: 0.6;
}
.key-btn:disabled { cursor: default; }

/* Result */
.result-banner { padding: 2rem 1.5rem; }
.result-emoji { font-size: 3rem; margin-bottom: 0.5rem; }
.result-title { font-family: 'Fredoka One', cursive; font-size: 1.5rem; color: var(--color-primary); }
.result-word {
  font-family: 'Fredoka One', cursive;
  font-size: 2rem;
  color: var(--color-primary);
  margin-top: 0.25rem;
  text-transform: capitalize;
}

@media (max-width: 500px) {
  .hangman-layout { flex-direction: column; gap: 1rem; }
  .gallows-wrap { flex-direction: row; align-items: center; gap: 1rem; }
  .gallows-svg { width: 100px; height: 110px; }
}
</style>

<style>
/* Dark-mode key overrides (global to beat scoped specificity) */
body.dark .key-btn.key-correct { background: #1b3a1d !important; color: #a5d6a7 !important; border-color: #2e7d32 !important; }
body.dark .key-btn.key-wrong   { background: #3a1a1a !important; color: #ef9a9a !important; border-color: #c62828 !important; }
</style>
