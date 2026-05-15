<script setup>
import { computed, onMounted } from 'vue'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useDecksStore }    from '../stores/useDecksStore'
import { useCardsStore }    from '../stores/useCardsStore'
import { useProgressStore } from '../stores/useProgressStore'

const settings = useSettingsStore()
const decksStore = useDecksStore()
const cardsStore = useCardsStore()
const progressStore = useProgressStore()

const totalDecks  = computed(() => decksStore.decks.length)
const totalCards  = computed(() => cardsStore.cards.length)
const learnedCards = computed(() =>
  progressStore.progress.filter(p => p.correctCount > 0).length
)

const FALLBACK_AVATAR = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle cx="40" cy="40" r="40" fill="%231976d2"/><text x="40" y="52" text-anchor="middle" fill="white" font-size="40">😊</text></svg>`

function onAvatarError(e) { e.target.src = FALLBACK_AVATAR }

// Take a daily snapshot for each deck on home load
onMounted(() => {
  decksStore.decks.forEach(deck => {
    const deckCards = cardsStore.cardsForDeck(deck.id)
    if (!deckCards.length) return
    const learned = deckCards.filter(c => {
      const p = progressStore.getProgress(c.id)
      return p && p.correctCount > 0
    }).length
    progressStore.appendTodaySnapshot(deck.id, Math.round((learned / deckCards.length) * 100))
  })
})
</script>

<template>
  <main class="page">
    <div class="welcome text-center">
      <img
        :src="`/avatars/${settings.avatar}`"
        :alt="settings.userName"
        class="welcome-avatar"
        @error="onAvatarError"
      />
      <h1>Hello, {{ settings.userName }}! 👋</h1>
      <p class="text-muted mt-1">Ready to learn some words today?</p>
    </div>

    <div class="stats-row mt-3">
      <div class="stat-chip card-surface text-center">
        <div class="stat-num">{{ totalDecks }}</div>
        <div class="stat-label text-muted">Decks</div>
      </div>
      <div class="stat-chip card-surface text-center">
        <div class="stat-num">{{ totalCards }}</div>
        <div class="stat-label text-muted">Cards</div>
      </div>
      <div class="stat-chip card-surface text-center">
        <div class="stat-num">{{ learnedCards }}</div>
        <div class="stat-label text-muted">Learned</div>
      </div>
    </div>

    <div class="mode-grid mt-3">
      <RouterLink to="/manage" class="mode-card card-surface">
        <div class="mode-icon">📖</div>
        <div class="mode-name">Manage</div>
        <div class="mode-desc text-muted">Add &amp; organise decks and cards</div>
      </RouterLink>
      <RouterLink to="/learn" class="mode-card card-surface">
        <div class="mode-icon">🔄</div>
        <div class="mode-name">Learn</div>
        <div class="mode-desc text-muted">Flip through flashcards</div>
      </RouterLink>
      <RouterLink to="/quiz" class="mode-card card-surface">
        <div class="mode-icon">🧠</div>
        <div class="mode-name">Quiz</div>
        <div class="mode-desc text-muted">Test yourself with fun questions</div>
      </RouterLink>
      <RouterLink to="/achievements" class="mode-card card-surface">
        <div class="mode-icon">🏆</div>
        <div class="mode-name">Achievements</div>
        <div class="mode-desc text-muted">See how far you've come</div>
      </RouterLink>
    </div>
  </main>
</template>

<style scoped>
.welcome-avatar {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  border: 4px solid var(--color-primary);
  margin-bottom: 0.75rem;
}
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}
.stat-num {
  font-family: 'Fredoka One', cursive;
  font-size: 2rem;
  color: var(--color-primary);
}
.stat-label { font-size: 0.85rem; }
.mode-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}
@media (max-width: 480px) {
  .mode-grid { grid-template-columns: 1fr; }
}
.mode-card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  text-decoration: none;
  color: var(--color-text);
  transition: transform 0.15s, box-shadow 0.15s;
  cursor: pointer;
}
.mode-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}
.mode-icon  { font-size: 2rem; }
.mode-name  { font-family: 'Fredoka One', cursive; font-size: 1.2rem; color: var(--color-primary); }
.mode-desc  { font-size: 0.85rem; }
</style>
