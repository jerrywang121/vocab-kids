<script setup>
import { ref, computed } from 'vue'
import { useDecksStore }    from '../stores/useDecksStore'
import { useCardsStore }    from '../stores/useCardsStore'
import { useProgressStore } from '../stores/useProgressStore'
import FlashCard from '../components/FlashCard.vue'

const decksStore    = useDecksStore()
const cardsStore    = useCardsStore()
const progressStore = useProgressStore()

const selectedDeckId = ref(null)
const currentIndex   = ref(0)
const flashCardRef   = ref(null)
const sessionDone    = ref(false)
const cardMode       = ref('flip') // 'flip' | 'full'
const deckQuery      = ref('')
const transitionName = ref('slide-next')

const touchStartX = ref(0)
const touchStartY = ref(0)
const SWIPE_THRESHOLD = 50

function handleTouchStart(e) {
  touchStartX.value = e.touches[0].clientX
  touchStartY.value = e.touches[0].clientY
}

function handleTouchEnd(e) {
  const touchEndX = e.changedTouches[0].clientX
  const touchEndY = e.changedTouches[0].clientY
  const dx = touchStartX.value - touchEndX
  const dy = touchStartY.value - touchEndY

  // Only trigger if horizontal movement is greater than vertical movement
  if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0 && hasNextUnlearned.value) {
      navigateNext()
    } else if (dx < 0 && hasPrevUnlearned.value) {
      navigatePrev()
    }
  }
}

const filteredDecks = computed(() => {
  if (!deckQuery.value.trim()) return decksStore.decks
  const q = deckQuery.value.toLowerCase()
  return decksStore.decks.filter(d => d.name.toLowerCase().includes(q))
})

const selectedDeck = computed(() => {
  if (selectedDeckId.value === 'all') return { id: 'all', name: 'All Cards' }
  return decksStore.decks.find(d => d.id === selectedDeckId.value)
})

const deckCards    = computed(() => {
  if (!selectedDeckId.value) return []
  const cards = selectedDeckId.value === 'all'
    ? cardsStore.cards
    : cardsStore.cardsForDeck(selectedDeckId.value)

  return [...cards]
    .sort((a, b) => progressStore.cardScoreForOrder(a.id) - progressStore.cardScoreForOrder(b.id) + (Math.random() - 0.5) * 0.2)
})
const currentCard  = computed(() => deckCards.value[currentIndex.value] ?? null)
const progress     = computed(() => currentCard.value ? progressStore.getProgress(currentCard.value.id) : null)
const score        = computed(() => currentCard.value ? progressStore.cardScore(currentCard.value.id) : null)

const learnedCount = computed(() =>
  deckCards.value.filter(c => progressStore.getProgress(c.id)?.isLearned).length
)

const hasPrevUnlearned = computed(() => {
  for (let i = currentIndex.value - 1; i >= 0; i--) {
    if (!progressStore.getProgress(deckCards.value[i].id)?.isLearned) return true
  }
  return false
})

const hasNextUnlearned = computed(() => {
  for (let i = currentIndex.value + 1; i < deckCards.value.length; i++) {
    if (!progressStore.getProgress(deckCards.value[i].id)?.isLearned) return true
  }
  return false
})

function isLearned(cardId) {
  return progressStore.getProgress(cardId)?.isLearned ?? false
}

function findFirstUnlearnedIndex() {
  for (let i = 0; i < deckCards.value.length; i++) {
    if (!isLearned(deckCards.value[i].id)) return i
  }
  return -1
}

function selectDeck(deckId) {
  selectedDeckId.value = deckId
  sessionDone.value = false
  const idx = findFirstUnlearnedIndex()
  if (idx === -1) {
    sessionDone.value = true
    currentIndex.value = 0
  } else {
    currentIndex.value = idx
  }
}

function toggleMode() {
  cardMode.value = cardMode.value === 'flip' ? 'full' : 'flip'
  flashCardRef.value?.reset()
}

function gotIt() {
  transitionName.value = 'slide-next'
  progressStore.markLearned(currentCard.value.id)
  flashCardRef.value?.reset()
  // Advance to next unlearned card after current
  let found = false
  for (let i = currentIndex.value + 1; i < deckCards.value.length; i++) {
    if (!isLearned(deckCards.value[i].id)) {
      currentIndex.value = i
      found = true
      break
    }
  }
  if (!found) {
    // Wrap to first unlearned before current position
    for (let i = 0; i < currentIndex.value; i++) {
      if (!isLearned(deckCards.value[i].id)) {
        currentIndex.value = i
        found = true
        break
      }
    }
  }
  if (!found) sessionDone.value = true
}

function navigateNext() {
  transitionName.value = 'slide-next'
  flashCardRef.value?.reset()
  for (let i = currentIndex.value + 1; i < deckCards.value.length; i++) {
    if (!isLearned(deckCards.value[i].id)) {
      currentIndex.value = i
      return
    }
  }
}

function navigatePrev() {
  transitionName.value = 'slide-prev'
  flashCardRef.value?.reset()
  for (let i = currentIndex.value - 1; i >= 0; i--) {
    if (!isLearned(deckCards.value[i].id)) {
      currentIndex.value = i
      return
    }
  }
}

function restart() {
  progressStore.resetLearnedForDeck(deckCards.value.map(c => c.id))
  currentIndex.value = 0
  sessionDone.value = false
  flashCardRef.value?.reset()
}
</script>

<template>
  <main class="page">
    <h1>📖 Learn</h1>

    <!-- Deck selector -->
    <template v-if="!selectedDeckId">
      <div class="search-row mt-1">
        <input
          v-model="deckQuery"
          type="text"
          class="search-input"
          placeholder="Search decks..."
        />
      </div>

      <div v-if="decksStore.decks.length > 1 && !deckQuery" class="study-all-section mt-2">
        <button class="study-all-btn card-surface" @click="selectDeck('all')">
          <span class="deck-name">📚 Study All Cards</span>
          <span class="deck-count text-muted">{{ cardsStore.cards.length }} total</span>
        </button>
      </div>

      <p class="text-muted mt-2">Choose a deck to study:</p>
      <p v-if="!decksStore.decks.length" class="text-muted mt-2">
        No decks yet — <RouterLink to="/manage">create one first</RouterLink>.
      </p>
      <div class="deck-list mt-2">
        <button
          v-for="deck in filteredDecks"
          :key="deck.id"
          class="deck-btn card-surface"
          @click="selectDeck(deck.id)"
        >
          <span class="deck-name">{{ deck.name }}</span>
          <span class="deck-count text-muted">
            {{ cardsStore.cardsForDeck(deck.id).length }} cards
            <span v-if="cardsStore.uniqueCardCount(deck.id) !== cardsStore.cardsForDeck(deck.id).length" class="unique-badge">{{ cardsStore.uniqueCardCount(deck.id) }} unique</span>
          </span>
        </button>
      </div>
    </template>

    <!-- Learning session -->
    <template v-else-if="!sessionDone">
      <div class="session-header mt-1">
        <button class="btn btn-ghost" style="font-size:0.85rem; padding: 0.3rem 0.8rem;" @click="selectedDeckId = null">← Decks</button>
        <span class="progress-text text-muted">{{ learnedCount }} / {{ deckCards.length }} learned</span>
        <button
          class="mode-toggle-btn"
          :class="{ active: cardMode === 'full' }"
          @click="toggleMode"
          :title="cardMode === 'flip' ? 'Switch to Full view' : 'Switch to Flip view'"
        >
          <span v-if="cardMode === 'flip'">🃏</span>
          <span v-else>📋</span>
        </button>
      </div>

      <div class="progress-track mt-1">
        <div class="progress-fill" :style="{ width: `${(learnedCount / deckCards.length) * 100}%` }" />
      </div>

      <div v-if="currentCard" class="mt-3">
        <div class="nav-row mb-1">
          <button class="btn btn-ghost nav-btn" :disabled="!hasPrevUnlearned" @click="navigatePrev">←</button>
          <button class="btn btn-primary got-it-btn" @click="gotIt">✅ I Know It!</button>
          <button class="btn btn-ghost nav-btn" :disabled="!hasNextUnlearned" @click="navigateNext">→</button>
        </div>

        <div
          class="flashcard-container"
          @touchstart="handleTouchStart"
          @touchend="handleTouchEnd"
        >
          <Transition :name="transitionName">
            <FlashCard :key="currentCard.id" ref="flashCardRef" :card="currentCard" :mode="cardMode" />
          </Transition>
        </div>

        <div v-if="progress && score !== null" class="card-stats text-muted mt-1">
          ✅ {{ progress.correctCount }} correct &nbsp; ❌ {{ progress.wrongCount }} wrong &nbsp; 🎯 {{ (score * 100).toFixed(0) }}%
        </div>
      </div>
    </template>

    <!-- Session complete -->
    <template v-else>
      <div class="done-screen text-center card-surface mt-3">
        <div class="done-emoji">🎉</div>
        <h2>All learned!</h2>
        <p class="text-muted mt-1">You've learned all {{ deckCards.length }} cards in <strong>{{ selectedDeck?.name }}</strong>.</p>
        <div class="flex gap-2 justify-center mt-3" style="flex-wrap:wrap">
          <button class="btn btn-ghost" @click="selectedDeckId = null">Choose Deck</button>
          <button class="btn btn-primary" @click="restart">🔄 Start Fresh</button>
          <RouterLink to="/quiz" class="btn btn-secondary">🧠 Take a Quiz</RouterLink>
        </div>
      </div>
    </template>
  </main>
</template>

<style scoped>
.search-row { width: 100%; }
.search-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 999px;
  border: 2px solid var(--color-surface-alt);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  font-size: 1rem;
  transition: border-color 0.15s;
}
.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
}
.study-all-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 1rem 1.5rem;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 1rem;
  cursor: pointer;
  text-align: left;
  transition: transform 0.15s, box-shadow 0.15s;
  min-height: 54px;
}
.study-all-btn .text-muted { color: rgba(255,255,255,0.8); }
.study-all-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.1); }

.deck-list { display: flex; flex-direction: column; gap: 0.75rem; }
.deck-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: var(--color-surface);
  color: var(--color-text);
  border: none;
  cursor: pointer;
  text-align: left;
  transition: transform 0.15s, box-shadow 0.15s;
  min-height: 44px;
}
.deck-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.1); }
.deck-name { font-weight: 800; font-size: 1rem; }
.deck-count { font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem; }
.unique-badge {
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  background: var(--color-surface-alt);
  color: var(--color-primary);
}
.session-header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; }
.mode-toggle-btn {
  background: var(--color-surface-alt);
  border: 2px solid var(--color-primary);
  border-radius: 999px;
  color: var(--color-primary);
  cursor: pointer;
  padding: 0.2rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 800;
  transition: transform 0.1s, background 0.1s;
  min-height: 32px;
  display: flex;
  align-items: center;
}
.mode-toggle-btn.active {
  background: var(--color-primary);
  color: #fff;
}
.mode-toggle-btn:not(.active):hover { background: var(--color-primary); color: #fff; }
.mode-toggle-btn:active { transform: scale(0.95); }

.progress-text { font-size: 0.9rem; font-weight: 700; }
.card-stats { font-size: 0.85rem; text-align: center; }
.nav-row { display: flex; gap: 0.75rem; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.got-it-btn { flex: 1; }
.nav-btn { font-size: 1.4rem; min-width: 56px; flex-shrink: 0; }
.nav-btn:disabled { opacity: 0.3; cursor: default; }
.got-it-btn { flex: 1; }

.flashcard-container {
  touch-action: pan-y;
  min-height: 290px;
  position: relative;
  overflow: hidden;
}

/* Transitions */
.slide-next-enter-active, .slide-next-leave-active,
.slide-prev-enter-active, .slide-prev-leave-active {
  transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
}

.slide-next-leave-active, .slide-prev-leave-active {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}

.slide-next-enter-from {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}
.slide-next-leave-to {
  opacity: 0;
  transform: translateX(-100%) scale(0.9);
}

.slide-prev-enter-from {
  opacity: 0;
  transform: translateX(-100%) scale(0.9);
}
.slide-prev-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

.done-screen { padding: 2.5rem 1.5rem; }
.done-emoji { font-size: 3.5rem; margin-bottom: 0.5rem; }
.justify-center { justify-content: center; }
</style>
