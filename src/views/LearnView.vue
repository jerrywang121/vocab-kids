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

const selectedDeck = computed(() => decksStore.decks.find(d => d.id === selectedDeckId.value))
const deckCards    = computed(() => {
  if (!selectedDeckId.value) return []
  return [...cardsStore.cardsForDeck(selectedDeckId.value)]
    .sort((a, b) => progressStore.cardScore(a.id) - progressStore.cardScore(b.id))
})
const currentCard  = computed(() => deckCards.value[currentIndex.value] ?? null)
const progress     = computed(() => currentCard.value ? progressStore.getProgress(currentCard.value.id) : null)
const score        = computed(() => currentCard.value ? progressStore.cardScore(currentCard.value.id) : null)

function selectDeck(deckId) {
  selectedDeckId.value = deckId
  currentIndex.value = 0
  sessionDone.value = false
}

function gotIt() {
  progressStore.recordReviewed(currentCard.value.id)
  advance()
}

function keepPractising() {
  progressStore.recordReviewed(currentCard.value.id)
  advance()
}

function advance() {
  flashCardRef.value?.reset()
  if (currentIndex.value < deckCards.value.length - 1) {
    currentIndex.value++
  } else {
    sessionDone.value = true
  }
}

function restart() {
  currentIndex.value = 0
  sessionDone.value = false
  flashCardRef.value?.reset()
}
</script>

<template>
  <main class="page">
    <h1>🔄 Learn</h1>

    <!-- Deck selector -->
    <template v-if="!selectedDeckId">
      <p class="text-muted mt-1">Choose a deck to study:</p>
      <p v-if="!decksStore.decks.length" class="text-muted mt-2">
        No decks yet — <RouterLink to="/manage">create one first</RouterLink>.
      </p>
      <div class="deck-list mt-2">
        <button
          v-for="deck in decksStore.decks"
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
        <span class="progress-text text-muted">{{ currentIndex + 1 }} / {{ deckCards.length }}</span>
      </div>

      <div class="progress-track mt-1">
        <div class="progress-fill" :style="{ width: `${((currentIndex) / deckCards.length) * 100}%` }" />
      </div>

      <div v-if="currentCard" class="mt-3">
        <FlashCard ref="flashCardRef" :card="currentCard" />

        <div v-if="progress" class="card-stats text-muted mt-1">
          ✅ {{ progress.correctCount }} correct &nbsp; ❌ {{ progress.wrongCount }} wrong &nbsp; 🎯 {{ (score * 100).toFixed(0) }}%
        </div>

        <div class="action-row mt-2">
          <button class="btn btn-ghost" style="flex:1" @click="keepPractising">😕 Keep Practising</button>
          <button class="btn btn-primary" style="flex:1" @click="gotIt">✅ Got It!</button>
        </div>
      </div>
    </template>

    <!-- Session complete -->
    <template v-else>
      <div class="done-screen text-center card-surface mt-3">
        <div class="done-emoji">🎉</div>
        <h2>All done!</h2>
        <p class="text-muted mt-1">You've reviewed all {{ deckCards.length }} cards in <strong>{{ selectedDeck?.name }}</strong>.</p>
        <div class="flex gap-2 justify-center mt-3" style="flex-wrap:wrap">
          <button class="btn btn-ghost" @click="selectedDeckId = null">Choose Deck</button>
          <button class="btn btn-primary" @click="restart">🔄 Restart</button>
          <RouterLink to="/quiz" class="btn btn-secondary">🧠 Take a Quiz</RouterLink>
        </div>
      </div>
    </template>
  </main>
</template>

<style scoped>
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
.session-header { display: flex; align-items: center; justify-content: space-between; }
.progress-text { font-size: 0.9rem; font-weight: 700; }
.card-stats { font-size: 0.85rem; text-align: center; }
.action-row { display: flex; gap: 1rem; }
.done-screen { padding: 2.5rem 1.5rem; }
.done-emoji { font-size: 3.5rem; margin-bottom: 0.5rem; }
.justify-center { justify-content: center; }
</style>
