<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { useDecksStore } from '../stores/useDecksStore'
import { useCardsStore } from '../stores/useCardsStore'

const decksStore = useDecksStore()
const cardsStore = useCardsStore()

// ── State machine:
//    'hub' | 'hangman-select' | 'hangman-play' | 'hangman-result'
//    | 'scramble-select' | 'scramble-play' | 'scramble-result'
//    | 'speed-select'    | 'speed-play'    | 'speed-result'
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

// ── Pick a random word from deck (deduplicated by word text)
function startHangman(deckId) {
  const cards = cardsStore.cardsForDeck(deckId)
  if (!cards.length) return
  const seen = new Set()
  const unique = cards.filter(c => {
    const key = c.word.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const card = unique[Math.floor(Math.random() * unique.length)]
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
  clearInterval(speedTimerHandle.value)
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

// ════════════════════════════════════════════════════════════════
// WORD SCRAMBLE
// ════════════════════════════════════════════════════════════════

const scrambleCard    = ref(null)
const scrambleTiles   = ref([])   // remaining tiles in the pool
const placedTiles     = ref([])   // tiles the player has placed
const scrambleHint    = ref(false)
const scrambleWrong   = ref(false) // triggers shake animation
const scrambleCorrect = ref(false) // game won

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function uniqueWordsForDeck(deckId) {
  const cards = cardsStore.cardsForDeck(deckId)
  const seen  = new Set()
  return cards.filter(c => {
    const key = c.word.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function startScramble(deckId) {
  const unique  = uniqueWordsForDeck(deckId)
  if (!unique.length) return

  // Prefer words ≥ 4 letters for a reasonable challenge
  const usable  = unique.filter(c => c.word.trim().length >= 4)
  const pool    = usable.length ? usable : unique
  const card    = pool[Math.floor(Math.random() * pool.length)]

  const letters = card.word.trim().toUpperCase().split('')
  let tiles     = letters.map((letter, i) => ({ id: i, letter }))

  // Ensure the shuffle isn't the same as the original
  let shuffled
  do { shuffled = shuffleArray(tiles) }
  while (
    shuffled.map(t => t.letter).join('') === letters.join('') &&
    letters.length > 1
  )

  scrambleCard.value    = card
  scrambleTiles.value   = shuffled
  placedTiles.value     = []
  scrambleHint.value    = false
  scrambleWrong.value   = false
  scrambleCorrect.value = false
  selectedDeckId.value  = deckId
  phase.value           = 'scramble-play'
}

function placeTile(tile) {
  if (scrambleCorrect.value || scrambleWrong.value) return
  scrambleTiles.value = scrambleTiles.value.filter(t => t.id !== tile.id)
  placedTiles.value   = [...placedTiles.value, tile]

  // Auto-check when all tiles have been placed
  if (placedTiles.value.length === scrambleCard.value.word.trim().length) {
    checkAnswer()
  }
}

function removeTile(tile) {
  if (scrambleCorrect.value || scrambleWrong.value) return
  placedTiles.value   = placedTiles.value.filter(t => t.id !== tile.id)
  scrambleTiles.value = [...scrambleTiles.value, tile]
}

function checkAnswer() {
  const answer = placedTiles.value.map(t => t.letter).join('')
  const target = scrambleCard.value.word.trim().toUpperCase()

  if (answer === target) {
    scrambleCorrect.value = true
    phase.value = 'scramble-result'
  } else {
    scrambleWrong.value = true
    setTimeout(() => {
      // Return all placed tiles to the pool and re-shuffle
      scrambleTiles.value = shuffleArray([...scrambleTiles.value, ...placedTiles.value])
      placedTiles.value   = []
      scrambleWrong.value = false
    }, 600)
  }
}

function clearPlaced() {
  if (scrambleCorrect.value || scrambleWrong.value) return
  scrambleTiles.value = shuffleArray([...scrambleTiles.value, ...placedTiles.value])
  placedTiles.value   = []
}

function playScrambleAgain() {
  startScramble(selectedDeckId.value)
}

const scrambleDeck = computed(() => decksStore.decks.find(d => d.id === selectedDeckId.value))

// Number of empty answer slots still to fill
const emptySlots = computed(() =>
  scrambleCard.value
    ? scrambleCard.value.word.trim().length - placedTiles.value.length
    : 0
)

// ════════════════════════════════════════════════════════════════
// SPEED SPELL
// ════════════════════════════════════════════════════════════════

const SPEED_DURATION    = 60   // seconds
const SPEED_BONUS       = 3    // seconds added per correct answer
const SPEED_PENALTY     = 5    // seconds deducted per skip

const speedCards        = ref([])
const speedIdx          = ref(0)
const speedInputVal     = ref('')
const speedScore        = ref(0)
const speedTimeLeft     = ref(SPEED_DURATION)
const speedTimerHandle  = ref(null)
const speedFeedback     = ref(null)    // 'correct' | 'wrong' | null
const speedInputRef     = ref(null)    // template ref for auto-focus

const speedCard = computed(() => speedCards.value[speedIdx.value] ?? null)
const speedDeck = computed(() => decksStore.decks.find(d => d.id === selectedDeckId.value))

const speedTimerPct = computed(() => (speedTimeLeft.value / SPEED_DURATION) * 100)
const speedTimerColor = computed(() => {
  const p = speedTimerPct.value
  if (p > 50) return 'var(--color-primary)'
  if (p > 25) return '#f57c00'
  return '#d32f2f'
})

// Auto-submit when the typed word matches (no Enter needed)
watch(speedInputVal, val => {
  if (!speedCard.value || speedFeedback.value || phase.value !== 'speed-play') return
  if (val.trim().toLowerCase() === speedCard.value.word.trim().toLowerCase()) submitSpeed()
})

function startSpeed(deckId) {
  const cards = cardsStore.cardsForDeck(deckId)
  if (!cards.length) return

  const seen   = new Set()
  const unique = cards.filter(c => {
    const key = c.word.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  selectedDeckId.value  = deckId
  speedCards.value      = shuffleArray(unique)
  speedIdx.value        = 0
  speedInputVal.value   = ''
  speedScore.value      = 0
  speedTimeLeft.value   = SPEED_DURATION
  speedFeedback.value   = null
  phase.value           = 'speed-play'

  clearInterval(speedTimerHandle.value)
  speedTimerHandle.value = setInterval(() => {
    speedTimeLeft.value--
    if (speedTimeLeft.value <= 0) {
      speedTimeLeft.value = 0
      endSpeed()
    }
  }, 1000)

  nextTick(() => speedInputRef.value?.focus())
}

function submitSpeed() {
  if (speedFeedback.value || phase.value !== 'speed-play') return
  const answer = speedInputVal.value.trim().toLowerCase()
  const target = speedCard.value?.word.trim().toLowerCase()

  if (answer === target) {
    speedScore.value++
    speedTimeLeft.value   = Math.min(SPEED_DURATION, speedTimeLeft.value + SPEED_BONUS)
    speedFeedback.value   = 'correct'
    speedInputVal.value   = ''
    setTimeout(() => {
      speedFeedback.value = null
      speedIdx.value++
      if (speedIdx.value >= speedCards.value.length) {
        endSpeed()
      } else {
        nextTick(() => speedInputRef.value?.focus())
      }
    }, 500)
  } else {
    speedFeedback.value = 'wrong'
    setTimeout(() => {
      speedFeedback.value = null
      speedInputVal.value = ''
      nextTick(() => speedInputRef.value?.focus())
    }, 600)
  }
}

function skipSpeed() {
  if (speedFeedback.value || phase.value !== 'speed-play') return
  speedInputVal.value = ''
  speedIdx.value++
  speedTimeLeft.value = Math.max(0, speedTimeLeft.value - SPEED_PENALTY)
  if (speedIdx.value >= speedCards.value.length || speedTimeLeft.value <= 0) {
    speedTimeLeft.value = Math.max(0, speedTimeLeft.value)
    endSpeed()
  } else {
    nextTick(() => speedInputRef.value?.focus())
  }
}

function endSpeed() {
  clearInterval(speedTimerHandle.value)
  phase.value = 'speed-result'
}

function goSpeedSelect() {
  clearInterval(speedTimerHandle.value)
  phase.value = 'speed-select'
}

function playSpeedAgain() {
  startSpeed(selectedDeckId.value)
}

onBeforeUnmount(() => clearInterval(speedTimerHandle.value))
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

        <!-- Word Scramble card -->
        <button class="game-card card-surface" @click="phase = 'scramble-select'">
          <div class="game-icon">🔤</div>
          <div class="game-info">
            <h2 class="game-title">Word Scramble</h2>
            <p class="game-desc text-muted">Rearrange the letters to spell the word!</p>
          </div>
          <span class="game-arrow">›</span>
        </button>

        <button class="game-card card-surface" @click="phase = 'speed-select'">
          <div class="game-icon">⚡</div>
          <div class="game-info">
            <h2 class="game-title">Speed Spell</h2>
            <p class="game-desc text-muted">Read the definition and type the word before time runs out!</p>
          </div>
          <span class="game-arrow">›</span>
        </button>
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

    <!-- ═══════════════ SCRAMBLE – DECK SELECT ═══════════════ -->
    <template v-else-if="phase === 'scramble-select'">
      <div class="back-row">
        <button class="btn btn-ghost" @click="goHub">← Back</button>
      </div>
      <h1>🔤 Word Scramble</h1>
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
          @click="startScramble(deck.id)"
        >
          <span class="deck-name">{{ deck.name }}</span>
          <span class="deck-count text-muted">
            {{ cardsStore.cardsForDeck(deck.id).length }} cards
            <span v-if="!cardsStore.cardsForDeck(deck.id).length">&nbsp;(empty)</span>
          </span>
        </button>
      </div>
    </template>

    <!-- ═══════════════ SCRAMBLE – PLAY / RESULT ═══════════════ -->
    <template v-else-if="phase === 'scramble-play' || phase === 'scramble-result'">
      <div class="back-row">
        <button class="btn btn-ghost" @click="phase = 'scramble-select'">← Decks</button>
        <span class="deck-tag text-muted">{{ scrambleDeck?.name }}</span>
      </div>

      <h1>🔤 Word Scramble</h1>

      <!-- Hint toggle -->
      <div class="hint-row mt-2">
        <button class="btn btn-ghost hint-btn" @click="scrambleHint = !scrambleHint">
          {{ scrambleHint ? '🙈 Hide hint' : '💡 Show hint' }}
        </button>
      </div>
      <div v-if="scrambleHint" class="hint-box card-surface mt-1">
        <p class="hint-def">{{ scrambleCard?.definition }}</p>
        <p v-if="scrambleCard?.exampleSentence" class="hint-example text-muted">
          "{{ scrambleCard.exampleSentence }}"
        </p>
      </div>

      <!-- Answer area -->
      <div class="answer-area mt-3">
        <div
          class="tile-row answer-row"
          :class="{ 'animate-wrong': scrambleWrong, 'animate-correct-row': scrambleCorrect }"
        >
          <!-- Filled tiles -->
          <button
            v-for="tile in placedTiles"
            :key="tile.id"
            class="tile tile-placed"
            :disabled="scrambleCorrect || scrambleWrong"
            @click="removeTile(tile)"
          >{{ tile.letter }}</button>
          <!-- Empty slots -->
          <span
            v-for="n in emptySlots"
            :key="'empty-' + n"
            class="tile-slot"
          ></span>
        </div>
      </div>

      <!-- Scramble pool -->
      <div class="tile-row pool-row mt-3">
        <button
          v-for="tile in scrambleTiles"
          :key="tile.id"
          class="tile tile-pool"
          :disabled="scrambleCorrect || scrambleWrong"
          @click="placeTile(tile)"
        >{{ tile.letter }}</button>
      </div>

      <!-- Action buttons -->
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <button
          class="btn btn-ghost"
          :disabled="!placedTiles.length || scrambleCorrect || scrambleWrong"
          @click="clearPlaced"
        >↩ Clear</button>
      </div>

      <!-- Result overlay -->
      <div v-if="phase === 'scramble-result'" class="result-banner card-surface mt-3 text-center">
        <div class="result-emoji">🎉</div>
        <h2 class="result-title">Brilliant!</h2>
        <p class="result-word">{{ scrambleCard?.word }}</p>
        <p v-if="scrambleCard?.definition" class="text-muted mt-1" style="font-size:0.9rem">
          {{ scrambleCard.definition }}
        </p>
        <div class="flex gap-2 mt-3" style="flex-wrap:wrap;justify-content:center">
          <button class="btn btn-primary" @click="playScrambleAgain">🔄 New Word</button>
          <button class="btn btn-ghost" @click="phase = 'scramble-select'">Change Deck</button>
          <button class="btn btn-ghost" @click="goHub">🎮 All Games</button>
        </div>
      </div>
    </template>

    <!-- ═══════════════ SPEED – DECK SELECT ═══════════════ -->
    <template v-else-if="phase === 'speed-select'">
      <div class="back-row">
        <button class="btn btn-ghost" @click="goHub">← Back</button>
      </div>
      <h1>⚡ Speed Spell</h1>
      <p class="text-muted mt-1">Choose a deck — you have {{ SPEED_DURATION }} seconds!</p>

      <p v-if="!decksStore.decks.length" class="text-muted mt-2">
        No decks yet — <RouterLink to="/manage">create one first</RouterLink>.
      </p>

      <div class="deck-list mt-2">
        <button
          v-for="deck in decksStore.decks"
          :key="deck.id"
          class="deck-btn card-surface"
          :disabled="!cardsStore.cardsForDeck(deck.id).length"
          @click="startSpeed(deck.id)"
        >
          <span class="deck-name">{{ deck.name }}</span>
          <span class="deck-count text-muted">
            {{ cardsStore.cardsForDeck(deck.id).length }} cards
            <span v-if="!cardsStore.cardsForDeck(deck.id).length">&nbsp;(empty)</span>
          </span>
        </button>
      </div>
    </template>

    <!-- ═══════════════ SPEED – PLAY / RESULT ═══════════════ -->
    <template v-else-if="phase === 'speed-play' || phase === 'speed-result'">
      <div class="back-row">
        <button class="btn btn-ghost" @click="goSpeedSelect">← Decks</button>
        <span class="deck-tag text-muted">{{ speedDeck?.name }}</span>
      </div>

      <h1>⚡ Speed Spell</h1>

      <!-- Timer bar -->
      <div class="speed-timer-track mt-2">
        <div
          class="speed-timer-fill"
          :style="{ width: speedTimerPct + '%', background: speedTimerColor }"
        ></div>
      </div>

      <div class="speed-meta mt-1">
        <span class="speed-time" :class="{ 'speed-time-low': speedTimeLeft <= 10 }">
          ⏱ {{ speedTimeLeft }}s
        </span>
        <span class="text-muted">
          {{ speedScore }} ✓&nbsp; | &nbsp;{{ speedIdx }}&thinsp;/&thinsp;{{ speedCards.length }} words
        </span>
      </div>

      <!-- Definition clue card -->
      <div
        v-if="speedCard"
        class="speed-clue card-surface mt-2"
        :class="{
          'animate-correct': speedFeedback === 'correct',
          'animate-wrong':   speedFeedback === 'wrong',
        }"
      >
        <div class="speed-clue-top">
          <span v-if="speedCard.partOfSpeech" class="pos-badge">{{ speedCard.partOfSpeech }}</span>
          <span class="word-dots">
            <span v-for="n in speedCard.word.trim().length" :key="n" class="word-dot">●</span>
          </span>
        </div>
        <p class="speed-def">{{ speedCard.definition }}</p>
        <p v-if="speedCard.exampleSentence" class="speed-example text-muted">
          "{{ speedCard.exampleSentence }}"
        </p>
      </div>

      <!-- Typing input -->
      <div class="speed-input-wrap mt-3">
        <input
          ref="speedInputRef"
          v-model="speedInputVal"
          class="speed-input"
          type="text"
          placeholder="Type the word…"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          :disabled="speedFeedback !== null || phase === 'speed-result'"
          @keydown.enter.prevent="submitSpeed"
        />
      </div>

      <div class="flex gap-2 mt-2" style="flex-wrap:wrap">
        <button
          class="btn btn-primary"
          :disabled="!speedInputVal.trim() || speedFeedback !== null || phase === 'speed-result'"
          @click="submitSpeed"
        >✓ Submit</button>
        <button
          class="btn btn-ghost"
          :disabled="speedFeedback !== null || phase === 'speed-result'"
          @click="skipSpeed"
        >⏭ Skip <span class="skip-penalty">−{{ SPEED_PENALTY }}s</span></button>
      </div>

      <!-- Result overlay -->
      <div v-if="phase === 'speed-result'" class="result-banner card-surface mt-3 text-center">
        <div class="result-emoji">
          {{ speedScore / speedCards.length >= 0.8 ? '🌟' : speedScore / speedCards.length >= 0.5 ? '😊' : '💪' }}
        </div>
        <h2 class="result-title">
          {{ speedScore / speedCards.length >= 0.8 ? 'Amazing!' : speedScore / speedCards.length >= 0.5 ? 'Good job!' : 'Keep practising!' }}
        </h2>
        <p class="speed-result-score">{{ speedScore }}&thinsp;/&thinsp;{{ speedCards.length }}</p>
        <p class="text-muted" style="font-size:0.9rem">words spelled correctly</p>
        <div class="flex gap-2 mt-3" style="flex-wrap:wrap;justify-content:center">
          <button class="btn btn-primary" @click="playSpeedAgain">🔄 Play Again</button>
          <button class="btn btn-ghost" @click="phase = 'speed-select'">Change Deck</button>
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

/* ── Word Scramble ───────────────────────── */
.hint-row { display: flex; }
.hint-btn { font-size: 0.9rem; min-height: 36px; padding: 0.3rem 0.85rem; }
.hint-box {
  padding: 0.85rem 1rem;
  border-left: 4px solid var(--color-primary);
}
.hint-def { font-weight: 700; font-size: 0.95rem; }
.hint-example { font-size: 0.85rem; margin-top: 0.35rem; font-style: italic; }

.answer-area { min-height: 3.8rem; }

.tile-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.answer-row {
  min-height: 3.4rem;
  padding: 0.5rem 0.25rem;
  border-bottom: 3px solid var(--color-primary);
}

.pool-row {
  min-height: 3.4rem;
}

.tile {
  width: 2.8rem;
  height: 2.8rem;
  border-radius: 0.6rem;
  font-family: 'Fredoka One', cursive;
  font-size: 1.3rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.12s, box-shadow 0.12s, background 0.12s;
  text-transform: uppercase;
  user-select: none;
}
.tile:active { transform: scale(0.92); }
.tile:disabled { cursor: default; }

.tile-pool {
  background: var(--color-primary);
  color: #fff;
  border: none;
  box-shadow: 0 3px 8px color-mix(in srgb, var(--color-primary) 35%, transparent);
}
.tile-pool:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--color-primary) 45%, transparent);
}

.tile-placed {
  background: var(--color-surface-alt);
  color: var(--color-text);
  border: 2px solid var(--color-primary);
  animation: tile-drop-in 0.2s ease-out;
}
.tile-placed:hover:not(:disabled) {
  background: #ffebee;
  border-color: #d32f2f;
  color: #b71c1c;
}

.tile-slot {
  width: 2.8rem;
  height: 2.8rem;
  border-radius: 0.6rem;
  border: 2px dashed var(--color-surface-alt);
  display: inline-flex;
}

@keyframes tile-drop-in {
  from { transform: scale(0.6) translateY(-8px); opacity: 0; }
  to   { transform: scale(1) translateY(0); opacity: 1; }
}

.animate-correct-row .tile-placed {
  background: #e8f5e9;
  border-color: #388e3c;
  color: #1b5e20;
}

/* ── Speed Spell ─────────────────────────── */
.speed-timer-track {
  height: 14px;
  background: var(--color-surface-alt);
  border-radius: 999px;
  overflow: hidden;
}
.speed-timer-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.9s linear, background 0.5s;
}

.speed-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}
.speed-time {
  font-family: 'Fredoka One', cursive;
  font-size: 1.1rem;
  color: var(--color-primary);
}
.speed-time-low {
  color: #d32f2f;
  animation: pulse-red 0.5s ease infinite alternate;
}
@keyframes pulse-red {
  from { opacity: 1; }
  to   { opacity: 0.5; }
}

.speed-clue {
  padding: 1rem 1.25rem;
}
.speed-clue-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.pos-badge {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--color-surface-alt);
  color: var(--color-text-muted);
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
}
.word-dots {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}
.word-dot {
  font-size: 0.55rem;
  color: var(--color-primary);
  line-height: 1;
}
.speed-def {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.45;
}
.speed-example {
  font-size: 0.85rem;
  font-style: italic;
  margin-top: 0.35rem;
}

.speed-input-wrap { display: flex; }
.speed-input {
  flex: 1;
  width: 100%;
  padding: 0.75rem 1rem;
  border: 3px solid var(--color-primary);
  border-radius: 0.85rem;
  font-family: 'Fredoka One', cursive;
  font-size: 1.4rem;
  background: var(--color-surface);
  color: var(--color-text);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.speed-input:focus {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 25%, transparent);
}
.speed-input:disabled { opacity: 0.7; }

.skip-penalty {
  font-size: 0.75rem;
  opacity: 0.75;
  margin-left: 0.2rem;
}

.speed-result-score {
  font-family: 'Fredoka One', cursive;
  font-size: 2.5rem;
  color: var(--color-primary);
  margin-top: 0.5rem;
}

</style>

<style>
/* Dark-mode key overrides (global to beat scoped specificity) */
body.dark .key-btn.key-correct { background: #1b3a1d !important; color: #a5d6a7 !important; border-color: #2e7d32 !important; }
body.dark .key-btn.key-wrong   { background: #3a1a1a !important; color: #ef9a9a !important; border-color: #c62828 !important; }
/* Scramble dark mode */
body.dark .tile-placed { background: #2a2f3d; color: var(--color-text); }
body.dark .tile-placed:hover:not(:disabled) { background: #3a1a1a; border-color: #c62828; color: #ef9a9a; }
body.dark .animate-correct-row .tile-placed { background: #1b3a1d !important; border-color: #2e7d32 !important; color: #a5d6a7 !important; }
</style>
